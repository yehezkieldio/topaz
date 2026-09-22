import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { enumCheck, jsonText } from "./_shared";

/**
 * How a repair attempt (sync_repair_history below) was started. Only
 * "manual" is ever written today -- Phase 2's "Repair now" button is the
 * only trigger that exists. "auto" is reserved for Phase 3 (automatic
 * repair, not implemented yet) so that landing it doesn't need a second
 * migration just to widen this column.
 */
export const REPAIR_TRIGGERS = ["manual", "auto"] as const;
export type RepairTrigger = (typeof REPAIR_TRIGGERS)[number];

/**
 * This device's own stable identity and Ed25519 keypair
 * (08_sync/00_oplog_and_clock.md, 01_transport_and_pairing.md) -- generated
 * once on first run and never regenerated, so oplog rows and sync pairing
 * keep referring to the same device across restarts. Deliberately a
 * single-row table rather than a config file alongside the SQLite
 * database: everything this app needs lives in the one per-device file
 * (00_context/00_project_summary.md). `id` is always the literal "self" --
 * there is exactly one row, ever.
 *
 * `privateKeyPkcs8` never leaves this device -- it isn't part of pairing or
 * sync payloads, only used locally to sign outgoing /api/sync requests.
 * `publicKeyRaw` is what gets shared with a peer during pairing (stored on
 * the *peer's* side in that peer's own known_peer row, not here).
 */
export const deviceIdentity = sqliteTable("device_identity", {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deviceId: text("device_id").notNull().unique(),
  id: text("id").primaryKey().default("self"),
  privateKeyPkcs8: text("private_key_pkcs8").notNull(),
  publicKeyRaw: text("public_key_raw").notNull(),
});

/**
 * Append-only change log (08_sync/00_oplog_and_clock.md). Nothing here is
 * ever updated or deleted -- a correction is a new row, same as any other
 * change. `seq` orders this device's own history (used for sync
 * checkpointing); `hlcTimestamp` orders changes across devices (used for
 * last-write-wins conflict resolution) -- these are different orderings and
 * neither substitutes for the other.
 */
export const oplog = sqliteTable(
  "oplog",
  {
    // column_diffs carries only the columns that actually changed, not a
    // full-row snapshot -- keeps rows small and makes per-column conflict
    // resolution possible.
    columnDiffs: jsonText<Record<string, unknown>>("column_diffs").notNull(),
    deviceId: text("device_id").notNull(),
    // Sortable string encoding (physical time + logical counter + device
    // id, fixed-width zero-padded prefix) -- see src/server/sync/hlc.ts. A
    // plain `order by hlc_timestamp` is a correct total order without
    // decoding, and it's globally unique by construction (a device's clock
    // never produces the same encoded value twice) -- the unique index
    // below lets a relayed row's re-insertion during sync
    // (src/server/sync/apply.ts) use onConflictDoNothing() to skip an
    // already-recorded event in one statement, instead of a separate
    // existence check every time.
    hlcTimestamp: text("hlc_timestamp").notNull(),
    rowId: text("row_id").notNull(),
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    tableName: text("table_name").notNull(),
    // A tombstone (not a hard DELETE) so a late-arriving update from
    // another device can't silently resurrect a row the user deliberately
    // removed.
    tombstone: integer("tombstone", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [uniqueIndex("oplog_hlc_timestamp_uidx").on(table.hlcTimestamp)]
);

/**
 * A device the admin has explicitly paired with (Ed25519 key exchange,
 * 08_sync/01_transport_and_pairing.md) -- never itself synced; each
 * device's peer list is its own local configuration. `lastSyncedHlc` is
 * this device's sync checkpoint against that peer's oplog history: the
 * highest `oplog.hlc_timestamp` already received from them. Deliberately
 * not a seq number -- `seq` is per-device-file and isn't comparable across
 * devices (08_sync/00_oplog_and_clock.md's Checkpointing), so only the
 * globally-ordered HLC timestamp can serve as the cross-device cursor.
 * Null means "never synced with this peer yet."
 */
export const knownPeer = sqliteTable(
  "known_peer",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    // Populated during pairing, not sync -- see 01_transport_and_pairing.md.
    deviceId: text("device_id").notNull(),
    lastSyncedHlc: text("last_synced_hlc"),
    port: integer("port").notNull(),
    publicKey: text("public_key").notNull(),
    tailnetHostname: text("tailnet_hostname").notNull(),
  },
  (table) => [uniqueIndex("known_peer_device_id_uidx").on(table.deviceId)]
);

/**
 * This device's latest per-table digest comparison against one peer
 * (08_sync/03_data_integrity_and_reconciliation.md Part 1 -- detection
 * only). One row per peer, overwritten on each check rather than kept as
 * history -- Phase 1 only needs "does this table currently mismatch,"
 * not a timeline of past checks. `mismatchedTables` is empty when the last
 * check found every synced table's digest agreeing with this peer's.
 *
 * `lastRepairAt`/`lastRepairResult` are Part 2's addition (repair.ts):
 * the outcome of the most recent manual "Repair now" run against this
 * peer, overwritten on each repair the same way the check fields are --
 * still no history, just "what happened last time." Null until a repair
 * has ever been run against this peer.
 */
export const syncIntegrityCheck = sqliteTable("sync_integrity_check", {
  checkedAt: integer("checked_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deviceId: text("device_id").primaryKey(),
  lastRepairAt: integer("last_repair_at", { mode: "timestamp_ms" }),
  lastRepairResult:
    jsonText<{ table: string; rowsRepaired: number; converged: boolean }[]>(
      "last_repair_result"
    ),
  mismatchedTables: jsonText<string[]>("mismatched_tables").notNull(),
});

/**
 * One row per repair attempt against a peer (Phase 2:
 * 08_sync/03_data_integrity_and_reconciliation.md) -- unlike
 * sync_integrity_check's lastRepairAt/lastRepairResult (which stay as the
 * "what happened last time" summary the UI reads by default), this is
 * append-only history, never updated or deleted, same discipline as oplog.
 * It exists so Phase 3's gate -- "only after Phase 2 has proven reliable in
 * practice" -- can actually be evaluated from data instead of a single
 * overwritten row. Written on every attempt, success or failure: `error`
 * is null on success, `outcome`/`rowsRepaired`/`converged` reflect their
 * pre-error defaults on failure (see repair.ts).
 */
export const syncRepairHistory = sqliteTable("sync_repair_history", {
  attemptedAt: integer("attempted_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  converged: integer("converged", { mode: "boolean" }).notNull(),
  deviceId: text("device_id").notNull(),
  error: text("error"),
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Per-table breakdown, same shape as syncIntegrityCheck.lastRepairResult
  // -- null on failure, when reconciliation never got far enough to produce
  // one.
  outcome:
    jsonText<{ table: string; rowsRepaired: number; converged: boolean }[]>(
      "outcome"
    ),
  rowsRepaired: integer("rows_repaired").notNull(),
  // The table(s) this attempt targeted, not the table(s) that actually
  // converged -- outcome (when present) has the per-table breakdown.
  tables: jsonText<string[]>("tables").notNull(),
  trigger: text("trigger", { enum: REPAIR_TRIGGERS })
    .notNull()
    .default("manual"),
}, (table) => [
  enumCheck("sync_repair_history_trigger_check", table.trigger, REPAIR_TRIGGERS),
]);
