import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

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

type Tx =
  | Parameters<Parameters<typeof dbClient.transaction>[0]>[0]
  | typeof dbClient;

/**
 * Applies a column diff to one row of `table`, inserting a fresh row if
 * `idColumn` doesn't match any existing row, updating in place if it does.
 *
 * This is deliberately two branches, not one `INSERT ... ON CONFLICT DO
 * UPDATE` statement: `columnDiffs` from an *update*-shaped oplog row (e.g.
 * a rename's `{name, normalizedName, slug, version}`) omits NOT NULL
 * columns like a foreign key that a create event would have included --
 * and SQLite validates NOT NULL against the row an INSERT would produce
 * *before* it even checks for a conflict to resolve via DO UPDATE, so an
 * upsert with a partial column set throws `NOT NULL constraint failed` on
 * the very first update it ever needs to apply, even though the row
 * already exists and only the listed columns needed to change. Verified
 * empirically (not assumed) applying a real create-then-rename oplog
 * sequence across two devices. A plain `UPDATE ... SET` never has this
 * problem -- it only ever touches the columns actually listed.
 */
const upsertRow = async (
  tx: Tx,
  table: SQLiteTable,
  idColumn: SQLiteColumn,
  idKey: string,
  rowId: string,
  columnDiffs: Record<string, unknown>
): Promise<void> => {
  const existing = await tx
    .select({ found: idColumn })
    .from(table)
    .where(eq(idColumn, rowId) as SQL)
    .limit(1);

  if (existing.length > 0) {
    await tx
      .update(table)
      .set(columnDiffs)
      .where(eq(idColumn, rowId) as SQL);
    return;
  }

  // `columnDiffs`'s keys are Record<string, unknown> data that arrived over
  // the network from a peer (08_sync/01_transport_and_pairing.md) -- the
  // cast below is the only place that matters for safety, and safety here
  // comes from Drizzle's typed `.values()` resolving each key against this
  // table's own fixed column registry (an unrecognized key can never
  // become an arbitrary SQL identifier the way raw string-built SQL could),
  // not from the cast itself, which TypeScript can't avoid needing since
  // the target table is only known at runtime from the oplog row.
  await tx
    .insert(table)
    .values({ [idKey]: rowId, ...columnDiffs } as Record<string, unknown>);
};

/**
 * Every table a remote oplog row can legally target, as one explicit
 * branch each rather than a generic string-keyed table/column lookup with
 * raw SQL -- see upsertRow's doc for the insert/update split, and this
 * file's original commit message for why raw SQL was rejected outright.
 *
 * Exported (not just used internally by applyRemoteOplogRow below) so
 * Part 2's full-table repair (repair.ts, 08_sync/03_data_integrity_and_reconciliation.md)
 * can write a reconciled row through the exact same table-write logic a
 * normal oplog apply uses, rather than duplicating the insert/update split
 * for a second time.
 */
export const applyToTable = async (
  tx: Tx,
  tableName: string,
  rowId: string,
  columnDiffs: Record<string, unknown>
): Promise<boolean> => {
  switch (tableName) {
    case "library_entry": {
      await upsertRow(
        tx,
        libraryEntry,
        libraryEntry.id,
        "id",
        rowId,
        columnDiffs
      );
      return true;
    }
    case "reading_state": {
      await upsertRow(
        tx,
        readingState,
        readingState.libraryEntryId,
        "libraryEntryId",
        rowId,
        columnDiffs
      );
      return true;
    }
    case "taxonomy_term": {
      await upsertRow(
        tx,
        taxonomyTerm,
        taxonomyTerm.id,
        "id",
        rowId,
        columnDiffs
      );
      return true;
    }
    case "work": {
      await upsertRow(tx, work, work.id, "id", rowId, columnDiffs);
      return true;
    }
    case "work_source": {
      await upsertRow(tx, workSource, workSource.id, "id", rowId, columnDiffs);
      return true;
    }
    default: {
      return false;
    }
  }
};

/**
 * Applies a tombstoned oplog row -- update-only, never insert. If this
 * device has never seen the row before, there's nothing to soft-delete
 * (the row can't have existed here), so this is a correct no-op rather
 * than an error: an INSERT here would hit the exact NOT NULL problem
 * upsertRow's own doc describes for a partial-column update, since a
 * tombstone's columnDiffs carries no more than {deleted: true} -- nowhere
 * near a full row's required columns.
 *
 * library_entry, reading_state, work, and work_source support this
 * (deleteLibraryEntryAction, deleteWorkAction, deleteWorkSourceAction) via
 * their own `deleted` column, same as applyToTable's closed set.
 * taxonomy_term deletion is modeled differently -- it reuses its existing
 * `status` column (already "active"/"merged" from mergeTermsAction) with a
 * new "deleted" value, so it flows through the normal, non-tombstoned
 * applyToTable path instead of this one (terms.ts's deleteTerm). A
 * tombstone naming taxonomy_term, or any table outside this closed set, is
 * still a real bug or forward-incompatible payload, not a case to silently
 * drop.
 */
const applyTombstoneToTable = async (
  tx: Tx,
  tableName: string,
  rowId: string
): Promise<boolean> => {
  switch (tableName) {
    case "library_entry": {
      await tx
        .update(libraryEntry)
        .set({ deleted: true })
        .where(eq(libraryEntry.id, rowId));
      return true;
    }
    case "reading_state": {
      await tx
        .update(readingState)
        .set({ deleted: true })
        .where(eq(readingState.libraryEntryId, rowId));
      return true;
    }
    case "work": {
      await tx.update(work).set({ deleted: true }).where(eq(work.id, rowId));
      return true;
    }
    case "work_source": {
      await tx
        .update(workSource)
        .set({ deleted: true })
        .where(eq(workSource.id, rowId));
      return true;
    }
    default: {
      return false;
    }
  }
};

const latestHlcKey = (tableName: string, rowId: string): string =>
  `${tableName}\u0000${rowId}`;

/**
 * One query's worth of "this device's latest recorded HLC per (table, row)"
 * for every row in a sync batch, instead of applyRemoteOplogRow running that
 * lookup itself once per row -- a 500-row batch (oplog.ts's SYNC_BATCH_SIZE)
 * otherwise means 500 sequential round trips to SQLite just to find out
 * which rows are even stale before applying anything.
 *
 * Filters by tableName IN (...) AND rowId IN (...) rather than the exact
 * (table, row) pairs -- SQLite has no clean composite-IN syntax via Drizzle,
 * and this candidate set is still bounded by the batch size, so resolving
 * the exact pair via the returned map (keyed on both) below is cheap and
 * correct: a candidate row whose (table, row) pair isn't actually in this
 * batch simply never gets looked up.
 *
 * Safe to compute once up front rather than per row within the batch: a
 * sync batch is already ordered ascending by hlc_timestamp
 * (oplog.ts's getOplogEntriesSince), so two rows in the same batch that
 * target the same (table, row) always have increasing hlc_timestamp -- an
 * earlier same-row entry in this batch can never be >= a later one, so it
 * can never itself cause that later row to read as stale. Only history that
 * already existed before this batch started can do that, and that's exactly
 * what this pre-batch snapshot captures.
 */
export const getLatestLocalHlcByRow = async (
  tx: Tx,
  rows: { tableName: string; rowId: string }[]
): Promise<Map<string, string>> => {
  const latest = new Map<string, string>();
  if (rows.length === 0) {
    return latest;
  }

  const tableNames = [...new Set(rows.map((row) => row.tableName))];
  const rowIds = [...new Set(rows.map((row) => row.rowId))];

  const candidates = await tx
    .select({
      hlcTimestamp: oplog.hlcTimestamp,
      rowId: oplog.rowId,
      tableName: oplog.tableName,
    })
    .from(oplog)
    .where(
      and(inArray(oplog.tableName, tableNames), inArray(oplog.rowId, rowIds))
    );

  for (const candidate of candidates) {
    const key = latestHlcKey(candidate.tableName, candidate.rowId);
    const current = latest.get(key);
    if (current === undefined || candidate.hlcTimestamp > current) {
      latest.set(key, candidate.hlcTimestamp);
    }
  }

  return latest;
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
 * `latestLocalByRow`, when passed (round.ts precomputes it once per batch
 * via getLatestLocalHlcByRow above), is used instead of a per-row query --
 * omitted, this falls back to the original single-row lookup so any other
 * caller doesn't need to know about batching to stay correct.
 *
 * A tombstoned row goes through this exact same staleness gate as any other
 * write, not a separate path -- a delete is just another kind of change in
 * HLC order, and an older tombstone arriving after a newer edit must lose
 * the same way an older edit would. Only once it's confirmed not stale does
 * it soft-delete via applyTombstoneToTable instead of writing columnDiffs.
 * Throws on an oplog row naming a table outside the closed set above (for a
 * tombstone, the closed set is narrower still -- see
 * applyTombstoneToTable's doc), rather than silently dropping it: that's
 * either a real bug or a forward-incompatible payload from a newer build,
 * and a sync round should stop and surface that, not apply a partial,
 * undetectable state.
 */
export const applyRemoteOplogRow = async (
  tx: Tx,
  row: OplogEntry,
  latestLocalByRow?: Map<string, string>
): Promise<void> => {
  let latestHlc: string | undefined;
  if (latestLocalByRow) {
    latestHlc = latestLocalByRow.get(latestHlcKey(row.tableName, row.rowId));
  } else {
    const [latestLocal] = await tx
      .select({ hlcTimestamp: oplog.hlcTimestamp })
      .from(oplog)
      .where(
        and(eq(oplog.tableName, row.tableName), eq(oplog.rowId, row.rowId))
      )
      .orderBy(desc(oplog.hlcTimestamp))
      .limit(1);
    latestHlc = latestLocal?.hlcTimestamp;
  }

  const isStaleOrDuplicate =
    latestHlc !== undefined && latestHlc >= row.hlcTimestamp;

  if (!isStaleOrDuplicate) {
    const applied = row.tombstone
      ? await applyTombstoneToTable(tx, row.tableName, row.rowId)
      : await applyToTable(tx, row.tableName, row.rowId, row.columnDiffs);
    if (!applied) {
      throw new Error(
        row.tombstone
          ? `Cannot apply tombstoned oplog row for "${row.tableName}": no soft-delete column defined for this table.`
          : `Unknown synced table in oplog row: "${row.tableName}".`
      );
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
