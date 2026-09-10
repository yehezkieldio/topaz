import "server-only";
import { and, desc, eq } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import {
  libraryEntry,
  readingState,
  taxonomyTerm,
  work,
  workSource,
} from "@/server/db/schema";
import { oplog } from "@/server/db/schema/sync";

import type { OplogEntry } from "./oplog";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0] | typeof dbClient;

/**
 * Every table a remote oplog row can legally target, as one explicit
 * branch each rather than a generic string-keyed table/column lookup with
 * raw SQL. This is deliberate, not just verbose-for-its-own-sake:
 * `row.columnDiffs` is `Record<string, unknown>` data that arrived over
 * the network from a peer (08_sync/01_transport_and_pairing.md), so its
 * *keys* are attacker-influenceable if a paired device were ever
 * compromised. Routing them through Drizzle's typed `.values()`/`.set()`
 * means every key is resolved against that table's own fixed column
 * registry -- an unrecognized key can never become an arbitrary SQL
 * identifier, only a column Drizzle doesn't know about. Building the
 * equivalent upsert by string-interpolating table/column names into raw
 * SQL would reopen exactly the injection surface this design exists to
 * avoid, for the sake of not writing five near-identical branches.
 *
 * The `as never`-adjacent casts below exist because `columnDiffs`'s type
 * genuinely can't be narrowed to a specific table's insert shape at compile
 * time -- the table it applies to is only known at runtime, from
 * `row.tableName`. Safety here comes from routing through Drizzle's typed
 * builder (as above), not from the cast.
 */
const applyToTable = async (
  tx: Tx,
  tableName: string,
  rowId: string,
  columnDiffs: Record<string, unknown>
): Promise<boolean> => {
  switch (tableName) {
    case "library_entry":
      await tx
        .insert(libraryEntry)
        .values({
          id: rowId,
          ...columnDiffs,
        } as typeof libraryEntry.$inferInsert)
        .onConflictDoUpdate({ set: columnDiffs, target: libraryEntry.id });
      return true;
    case "reading_state":
      await tx
        .insert(readingState)
        .values({
          libraryEntryId: rowId,
          ...columnDiffs,
        } as typeof readingState.$inferInsert)
        .onConflictDoUpdate({
          set: columnDiffs,
          target: readingState.libraryEntryId,
        });
      return true;
    case "taxonomy_term":
      await tx
        .insert(taxonomyTerm)
        .values({
          id: rowId,
          ...columnDiffs,
        } as typeof taxonomyTerm.$inferInsert)
        .onConflictDoUpdate({ set: columnDiffs, target: taxonomyTerm.id });
      return true;
    case "work":
      await tx
        .insert(work)
        .values({ id: rowId, ...columnDiffs } as typeof work.$inferInsert)
        .onConflictDoUpdate({ set: columnDiffs, target: work.id });
      return true;
    case "work_source":
      await tx
        .insert(workSource)
        .values({
          id: rowId,
          ...columnDiffs,
        } as typeof workSource.$inferInsert)
        .onConflictDoUpdate({ set: columnDiffs, target: workSource.id });
      return true;
    default:
      return false;
  }
};

/**
 * Applies one remote oplog row to this device's own copy of the row
 * (08_sync/00_oplog_and_clock.md), upserting so this works identically
 * whether this device has ever seen the row before or not. Skips the
 * write -- but still records the oplog entry, so it isn't re-evaluated on
 * a future overlapping pull -- when this device's own latest recorded
 * change for the same (table, row) is already at or after the incoming
 * row's HLC timestamp: last-write-wins at row granularity. Per-column
 * resolution (mentioned in the spec as a refinement for rows two devices
 * are likely to touch independently) is not implemented -- every column in
 * a given oplog row currently wins or loses together.
 *
 * Throws on a tombstoned row (no synced table has a soft-delete column
 * defined yet -- there is no delete path in the app that produces one) and
 * on an oplog row naming a table outside the closed set above, rather than
 * silently dropping either: both are either a real bug or a
 * forward-incompatible payload from a newer build, and a sync round should
 * stop and surface that, not apply a partial, undetectable state.
 */
export const applyRemoteOplogRow = async (
  tx: Tx,
  row: OplogEntry
): Promise<void> => {
  if (row.tombstone) {
    throw new Error(
      `Cannot apply tombstoned oplog row for ${row.tableName}/${row.rowId}: ` +
        "no synced table has a soft-delete column defined yet."
    );
  }

  const [latestLocal] = await tx
    .select({ hlcTimestamp: oplog.hlcTimestamp })
    .from(oplog)
    .where(
      and(eq(oplog.tableName, row.tableName), eq(oplog.rowId, row.rowId))
    )
    .orderBy(desc(oplog.hlcTimestamp))
    .limit(1);

  const isStaleOrDuplicate =
    latestLocal !== undefined && latestLocal.hlcTimestamp >= row.hlcTimestamp;

  if (!isStaleOrDuplicate) {
    const applied = await applyToTable(
      tx,
      row.tableName,
      row.rowId,
      row.columnDiffs
    );
    if (!applied) {
      throw new Error(`Unknown synced table in oplog row: "${row.tableName}".`);
    }
  }

  // Recorded locally regardless of whether it changed the row -- this
  // device now knows about the change (so it can relay it to a third
  // device later) and the hlc_timestamp unique index makes re-applying an
  // already-seen row (an overlapping pull) a no-op here.
  await tx
    .insert(oplog)
    .values({
      columnDiffs: row.columnDiffs,
      deviceId: row.deviceId,
      hlcTimestamp: row.hlcTimestamp,
      rowId: row.rowId,
      tableName: row.tableName,
      tombstone: row.tombstone,
    })
    .onConflictDoNothing();
};
