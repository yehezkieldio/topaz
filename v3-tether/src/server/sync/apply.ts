import "server-only";
import { and, desc, eq } from "drizzle-orm";
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

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0] | typeof dbClient;

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
    await tx.update(table).set(columnDiffs).where(eq(idColumn, rowId) as SQL);
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
 */
const applyToTable = async (
  tx: Tx,
  tableName: string,
  rowId: string,
  columnDiffs: Record<string, unknown>
): Promise<boolean> => {
  switch (tableName) {
    case "library_entry":
      await upsertRow(tx, libraryEntry, libraryEntry.id, "id", rowId, columnDiffs);
      return true;
    case "reading_state":
      await upsertRow(
        tx,
        readingState,
        readingState.libraryEntryId,
        "libraryEntryId",
        rowId,
        columnDiffs
      );
      return true;
    case "taxonomy_term":
      await upsertRow(tx, taxonomyTerm, taxonomyTerm.id, "id", rowId, columnDiffs);
      return true;
    case "work":
      await upsertRow(tx, work, work.id, "id", rowId, columnDiffs);
      return true;
    case "work_source":
      await upsertRow(tx, workSource, workSource.id, "id", rowId, columnDiffs);
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
