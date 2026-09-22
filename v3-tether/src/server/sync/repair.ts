import "server-only";
import { eq } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import type { RepairTrigger } from "@/server/db/schema/sync";
import { syncIntegrityCheck, syncRepairHistory } from "@/server/db/schema/sync";

import { applyToTable } from "./apply";
import type {
  IntegrityCheckPeer,
  SyncedTableName,
  TableDigest,
} from "./digest";
import {
  checkIntegrityWithPeer,
  computeTableDigest,
  diffMismatchedBuckets,
  fetchPeerDigests,
} from "./digest";
import { fetchAllLocalTableRows, fetchAllPeerTableRows } from "./full-table";
import { appendOplogEntry } from "./oplog";

export interface RepairTableOutcome {
  table: SyncedTableName;
  rowsRepaired: number;
  converged: boolean;
}

export interface RepairResult {
  deviceId: string;
  repairedAt: Date;
  outcomes: RepairTableOutcome[];
}

// One repair at a time per peer -- guards against the periodic automatic
// trigger (round.ts) and a manual "Repair now" click landing on the same
// peer at once, which would otherwise run two concurrent reconcileTable
// passes against the same rows. Keyed by deviceId, not a single flag, since
// repairs against different peers are independent and shouldn't block each
// other. In-memory only, same reasoning as compaction.ts's compactionInFlight.
const peersCurrentlyRepairing = new Set<string>();

/**
 * Resolves one mismatched table against one peer's full row state -- the
 * spec's Repair Step (08_sync/03_data_integrity_and_reconciliation.md
 * Part 2):
 *
 * - A row present on both sides with a different version/updated_at: the
 *   more recent write wins. A full-table row doesn't carry an HLC
 *   timestamp the way an oplog row does -- only version/updated_at, the
 *   same two fields Part 1's digest already hashes on -- so updated_at is
 *   the proxy for "later write" here (this device's own clock isn't a
 *   valid substitute either, since it would just always prefer whichever
 *   side is reconciling). version breaks a tie when updated_at is
 *   identical. A genuine tie on both is left alone: there's no signal left
 *   to prefer one side, and guessing is worse than leaving it for the next
 *   check to catch.
 * - A row present only on the peer is remote-wins unconditionally --
 *   "very likely a row that was correctly created and simply never made it
 *   across," per the spec -- and gets applied locally.
 * - A row present only locally is left alone here. This device can only
 *   ever correct its *own* local state: every write in this system,
 *   including sync, is "a device writes to itself" via a request/response
 *   pull, never "a device pushes to a peer" (01_transport_and_pairing.md).
 *   The peer catches this same case, symmetrically, the next time *it*
 *   runs a repair pulling from this device.
 * - Every correction is written through applyToTable (apply.ts's own
 *   per-table switch, reused as-is -- not a second table-write
 *   implementation) plus a fresh appendOplogEntry call on this device's own
 *   clock, never a silent direct table write, so the correction relays
 *   onward to a third device the same as any other oplog change (spec:
 *   "must itself be written as a new oplog entry on the device being
 *   corrected").
 *
 * `buckets`, when given, scopes both the local and peer full-table pulls to
 * only the id-hash buckets (digest.ts's bucketForRowId) a fresh digest
 * comparison already found mismatched -- repairMismatchedTablesWithPeer
 * computes this before calling in. `null` falls back to pulling the whole
 * table, used when no peer digest was available to diff against.
 */
const reconcileTable = async (
  database: typeof dbClient,
  peer: IntegrityCheckPeer,
  table: SyncedTableName,
  buckets: number[] | null
): Promise<number> => {
  const [localRows, remoteRows] = await Promise.all([
    fetchAllLocalTableRows(table, buckets),
    fetchAllPeerTableRows(database, peer, table, buckets),
  ]);

  const localByRowId = new Map(localRows.map((row) => [row.rowId, row]));
  let rowsRepaired = 0;

  await database.transaction(async (tx) => {
    for (const remoteRow of remoteRows) {
      const localRow = localByRowId.get(remoteRow.rowId);
      const remoteWins =
        !localRow ||
        remoteRow.updatedAtMs > localRow.updatedAtMs ||
        (remoteRow.updatedAtMs === localRow.updatedAtMs &&
          (remoteRow.version ?? -1) > (localRow.version ?? -1));

      if (!remoteWins) {
        continue;
      }

      // biome-ignore lint/performance/noAwaitInLoops: corrections apply one row at a time inside one transaction, same discipline round.ts's applied-row loop already uses
      await applyToTable(tx, table, remoteRow.rowId, remoteRow.columnDiffs);
      // biome-ignore lint/performance/noAwaitInLoops: this correction's own oplog record follows the table write it describes
      await appendOplogEntry(tx, {
        columnDiffs: remoteRow.columnDiffs,
        rowId: remoteRow.rowId,
        tableName: table,
      });
      rowsRepaired += 1;
    }
  });

  return rowsRepaired;
};

/**
 * Phase 2's "Repair now" action (spec: "A 'Repair now' action next to a
 * flagged mismatch runs the full-table pull and reconciliation... on
 * demand, with a visible result"). Repairs only the table(s) passed in --
 * the caller (actions.ts) scopes this to whatever the most recent Part 1
 * check actually flagged for this peer, never all five tables
 * unconditionally (spec: "Only fetch this for a table a digest check has
 * already flagged as mismatched").
 *
 * After reconciling, re-runs the Part 1 digest check against the same peer
 * (checkIntegrityWithPeer) rather than trusting the repair converged --
 * this also refreshes sync_integrity_check so the UI reflects the new
 * state without a separate manual "Check integrity" click. A table that
 * still mismatches after one repair pass is reported as not converged, not
 * retried automatically (spec: "stop and report failure rather than
 * looping -- a repair that can't converge after one pass indicates a bug
 * worth surfacing, not something to retry silently").
 *
 * Before pulling any rows, fetches this device's and the peer's digests
 * fresh (never the possibly-stale ones a Part 1 check happened to store)
 * and diffs their buckets (digest.ts's diffMismatchedBuckets) to find which
 * id-hash buckets actually disagree for each table being repaired -- the
 * pull below is scoped to just those buckets rather than the whole table.
 * If the peer's response is missing a table entirely (shouldn't happen
 * against another build of this same closed five-table set, but not
 * assumed), that table's pull falls back to unscoped -- correctness over a
 * best-effort narrowing that can't be verified. If the fresh diff finds
 * zero mismatched buckets for a table (the drift already resolved itself,
 * e.g. via a normal oplog round that landed between the check and this
 * click), that table is skipped entirely rather than paying for a
 * whole-table scan that would apply nothing.
 *
 * `trigger` records why this attempt is happening -- "manual" for the UI's
 * "Repair now" button (actions.ts), "auto" for round.ts's periodic
 * detect-then-repair cadence. Every attempt, success or failure, is
 * appended to sync_repair_history (schema/sync.ts) with this trigger and
 * its outcome or error -- that table is append-only and was built
 * specifically so a future decision about widening automatic repair
 * further can be evaluated from real attempt data instead of guessed at;
 * leaving it unwritten now that an "auto" trigger actually exists would
 * defeat the reason it was added. Split out from
 * repairMismatchedTablesWithPeer below only so that function's in-flight
 * guard can wrap it in a try/finally without also swallowing this one's own
 * try/catch around the sync_repair_history write.
 */
const attemptRepair = async (
  database: typeof dbClient,
  peer: IntegrityCheckPeer,
  tables: SyncedTableName[],
  trigger: RepairTrigger
): Promise<RepairResult> => {
  try {
    const remoteDigests = await fetchPeerDigests(database, peer);
    const remoteDigestByTable = new Map<SyncedTableName, TableDigest>(
      remoteDigests.map((entry) => [entry.table, entry])
    );

    const rowsRepairedByTable = new Map<SyncedTableName, number>();

    for (const table of tables) {
      // biome-ignore lint/performance/noAwaitInLoops: each table's bucket diff and reconciliation depend on this device's current state, evaluated one table at a time
      const localDigest = await computeTableDigest(table);
      const remoteDigest = remoteDigestByTable.get(table);
      const mismatchedBuckets = remoteDigest
        ? diffMismatchedBuckets(localDigest, remoteDigest)
        : null;

      // biome-ignore lint/performance/noAwaitInLoops: each table's reconciliation runs its own transaction against this device's local tables and shouldn't overlap with the next
      const rowsRepaired =
        mismatchedBuckets !== null && mismatchedBuckets.length === 0
          ? 0
          : await reconcileTable(database, peer, table, mismatchedBuckets);
      rowsRepairedByTable.set(table, rowsRepaired);
    }

    const recheck = await checkIntegrityWithPeer(database, peer);
    const stillMismatched = new Set(recheck.mismatchedTables);

    const outcomes: RepairTableOutcome[] = tables.map((table) => ({
      converged: !stillMismatched.has(table),
      rowsRepaired: rowsRepairedByTable.get(table) ?? 0,
      table,
    }));

    await database
      .update(syncIntegrityCheck)
      .set({ lastRepairAt: recheck.checkedAt, lastRepairResult: outcomes })
      .where(eq(syncIntegrityCheck.deviceId, peer.deviceId));

    await database.insert(syncRepairHistory).values({
      attemptedAt: recheck.checkedAt,
      converged: outcomes.every((outcome) => outcome.converged),
      deviceId: peer.deviceId,
      outcome: outcomes,
      rowsRepaired: outcomes.reduce((sum, o) => sum + o.rowsRepaired, 0),
      tables,
      trigger,
    });

    return {
      deviceId: peer.deviceId,
      outcomes,
      repairedAt: recheck.checkedAt,
    };
  } catch (error) {
    await database.insert(syncRepairHistory).values({
      converged: false,
      deviceId: peer.deviceId,
      error: error instanceof Error ? error.message : String(error),
      outcome: null,
      rowsRepaired: 0,
      tables,
      trigger,
    });
    throw error;
  }
};

/**
 * Phase 2's "Repair now" action (spec: "A 'Repair now' action next to a
 * flagged mismatch runs the full-table pull and reconciliation... on
 * demand, with a visible result"), plus round.ts's automatic "auto"-
 * triggered call on a detected mismatch. Guards attemptRepair above with
 * the peersCurrentlyRepairing in-flight check, so a manual click and an
 * automatic trigger landing on the same peer at once can't run two
 * concurrent reconciliation passes against it.
 */
export const repairMismatchedTablesWithPeer = async (
  database: typeof dbClient,
  peer: IntegrityCheckPeer,
  tables: SyncedTableName[],
  trigger: RepairTrigger
): Promise<RepairResult> => {
  if (peersCurrentlyRepairing.has(peer.deviceId)) {
    throw new Error(
      `A repair against ${peer.deviceId} is already in progress.`
    );
  }
  peersCurrentlyRepairing.add(peer.deviceId);

  try {
    return await attemptRepair(database, peer, tables, trigger);
  } finally {
    peersCurrentlyRepairing.delete(peer.deviceId);
  }
};
