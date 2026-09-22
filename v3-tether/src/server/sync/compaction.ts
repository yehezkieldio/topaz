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
 * Manual trigger only, same restraint the spec already applies to Phase 3
 * auto-repair ("only after Phase 2 has proven reliable in practice") --
 * this is new and unproven, so it's an admin action, not a step folded
 * into every sync round or even the periodic integrity-check cadence.
 */
export const compactOplog = async (
  database: typeof dbClient
): Promise<CompactionResult> => {
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
    // tables -- shouldn't happen (appendOplogEntry's only callers write one
    // of these five), but fetchRowById indexes TABLE_CONFIG by
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
};
