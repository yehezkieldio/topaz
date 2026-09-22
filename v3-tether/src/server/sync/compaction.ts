import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import { oplog } from "@/server/db/schema/sync";

import { SYNCED_TABLES } from "./digest";
import type { SyncedTableName } from "./digest";
import { fetchRowById } from "./full-table";
import { appendOplogEntry } from "./oplog";

// Bounds how many (table, row) groups one compaction run processes -- same
// reasoning as round.ts's MAX_ROUNDS_PER_PEER and full-table.ts's
// MAX_PAGES_PER_TABLE: an oplog that's grown large enough to need many
// groups compacted can't stall one admin click indefinitely. Running the
// action again picks up wherever this pass left off, since the next sweep's
// group query only ever finds groups that still have more than one row.
const MAX_COMPACTION_GROUPS_PER_RUN = 500;

export interface CompactionResult {
  groupsCompacted: number;
  rowsRemoved: number;
}

// One compaction run at a time, regardless of whether it was started by the
// periodic automatic trigger (round.ts) or the manual "Compact oplog"
// button -- both call compactOplog itself, so guarding here covers both
// callers without either needing to know about the other. In-memory only,
// same reasoning as round.ts's roundsSinceLastIntegrityCheck counter: one
// process per device, and losing this flag on a restart just means the
// worst case is one extra run, not a correctness problem.
let compactionInFlight = false;

/**
 * Collapses one (table, row)'s oplog history into a single fresh full-row
 * snapshot entry, then deletes every older entry for that same (table,
 * row) -- the snapshot alone is enough to reconstruct the row's current
 * state for any peer, including one that pairs for the first time after
 * this runs and pulls from sinceHlc: null.
 *
 * This is safe unconditionally, not just for peers already fully synced:
 * appendOplogEntry always ticks this device's clock forward, so the new
 * snapshot's HLC is guaranteed greater than every row it replaces. Applying
 * it on any peer goes through the exact same staleness gate
 * (apply.ts's applyRemoteOplogRow) as any other row -- it always wins
 * against older history for the same row, and a peer whose cursor sits
 * anywhere in the now-deleted range simply never asks for those rows again
 * (getOplogEntriesSince filters by hlc_timestamp > cursor, not by which
 * rows still exist). A peer that already applied some of the deleted
 * history isn't affected either: replaying the snapshot on top just
 * re-applies the same current state via an UPDATE, not a second, different
 * change.
 *
 * A row this device has no live copy of (shouldn't happen -- nothing in
 * this app hard-deletes a synced-table row) is skipped rather than
 * compacted against nothing.
 */
const compactRowHistory = async (
  database: typeof dbClient,
  tableName: SyncedTableName,
  rowId: string
): Promise<number> =>
  await database.transaction(async (tx) => {
    const row = await fetchRowById(tableName, rowId);
    if (!row) {
      return 0;
    }

    const snapshotHlc = await appendOplogEntry(tx, {
      columnDiffs: row.columnDiffs,
      rowId,
      tableName,
      tombstone: false,
    });

    const deleted = await tx
      .delete(oplog)
      .where(
        and(
          eq(oplog.tableName, tableName),
          eq(oplog.rowId, rowId),
          lt(oplog.hlcTimestamp, snapshotHlc)
        )
      )
      .returning({ seq: oplog.seq });

    return deleted.length;
  });

/**
 * Finds every (table, row) with more than one oplog entry and compacts
 * each in its own transaction (08_sync/03_data_integrity_and_reconciliation.md's
 * "each table's reconciliation runs its own transaction" discipline,
 * applied here per row-group instead of per table) -- one group's failure
 * doesn't lose progress on the others already compacted this run.
 *
 * Runs both from the periodic automatic trigger (round.ts's
 * compactOplogIfNeeded, folded into the same cadence as the integrity
 * check) and from the manual "Compact oplog" button (actions.ts) -- the
 * compactionInFlight guard above means whichever caller gets here first
 * for a given moment does the work; the other returns a zero-change result
 * rather than racing it, since both would otherwise walk the same set of
 * (table, row) groups.
 */
export const compactOplog = async (
  database: typeof dbClient
): Promise<CompactionResult> => {
  if (compactionInFlight) {
    return { groupsCompacted: 0, rowsRemoved: 0 };
  }
  compactionInFlight = true;

  try {
    const groups = await database
      .select({ rowId: oplog.rowId, tableName: oplog.tableName })
      .from(oplog)
      .groupBy(oplog.tableName, oplog.rowId)
      .having(sql`count(*) > 1`)
      .limit(MAX_COMPACTION_GROUPS_PER_RUN);

    const syncedTableNames = new Set<string>(SYNCED_TABLES);
    let groupsCompacted = 0;
    let rowsRemoved = 0;

    for (const group of groups) {
      // Skips a group whose table_name isn't one of the five known synced
      // tables -- shouldn't happen (appendOplogEntry's only callers write
      // one of these five), but fetchRowById indexes TABLE_CONFIG by
      // SyncedTableName, and an unrecognized key there would throw rather
      // than fail gracefully.
      if (!syncedTableNames.has(group.tableName)) {
        continue;
      }
      // SAFETY: just confirmed group.tableName is a member of SYNCED_TABLES.
      const tableName = group.tableName as SyncedTableName;
      // biome-ignore lint/performance/noAwaitInLoops: each group compacts in its own transaction and must not overlap with the next
      const removed = await compactRowHistory(database, tableName, group.rowId);
      if (removed > 0) {
        groupsCompacted += 1;
        rowsRemoved += removed;
      }
    }

    return { groupsCompacted, rowsRemoved };
  } finally {
    compactionInFlight = false;
  }
};

// Oplog rows accumulate one entry per column-changing write across the five
// synced tables, so it grows faster than any single table's own row count.
// BUCKET_COUNT (digest.ts) is sized for "a personal-library row count (a
// few thousand rows)" per table; 2,000 oplog entries is on that same order
// of magnitude, picked so compaction fires well before the oplog outgrows
// the current-state tables it describes, without paying a COUNT(*) more
// than once per INTEGRITY_CHECK_EVERY_N_ROUNDS-round cadence (round.ts
// checks this on the same cycle as the integrity check, not every round).
const OPLOG_COMPACTION_THRESHOLD = 2000;

/**
 * Automatic-trigger entry point (round.ts): a cheap COUNT(*) over oplog --
 * SQLite answers this from the table's own rowid b-tree without reading row
 * content, so it stays fast even as the oplog grows -- gates whether a full
 * compactOplog run is worth paying for right now. Returns null without
 * touching the oplog at all when the count is still under threshold, so a
 * healthy, already-small oplog never pays for anything beyond the count
 * itself.
 */
export const compactOplogIfNeeded = async (
  database: typeof dbClient
): Promise<CompactionResult | null> => {
  const [row] = await database
    .select({ count: sql<number>`count(*)` })
    .from(oplog);
  if (!row || row.count < OPLOG_COMPACTION_THRESHOLD) {
    return null;
  }
  return await compactOplog(database);
};
