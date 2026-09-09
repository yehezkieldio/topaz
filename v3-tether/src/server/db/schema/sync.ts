import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { jsonText } from "./_shared";

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
export const oplog = sqliteTable("oplog", {
  // column_diffs carries only the columns that actually changed, not a
  // full-row snapshot -- keeps rows small and makes per-column conflict
  // resolution possible.
  columnDiffs: jsonText<Record<string, unknown>>("column_diffs").notNull(),
  deviceId: text("device_id").notNull(),
  // Sortable string encoding (physical time + logical counter + device id,
  // fixed-width zero-padded prefix) -- see src/server/sync/hlc.ts. A plain
  // `order by hlc_timestamp` is a correct total order without decoding.
  hlcTimestamp: text("hlc_timestamp").notNull(),
  rowId: text("row_id").notNull(),
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  tableName: text("table_name").notNull(),
  // A tombstone (not a hard DELETE) so a late-arriving update from another
  // device can't silently resurrect a row the user deliberately removed.
  tombstone: integer("tombstone", { mode: "boolean" }).notNull().default(false),
});

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
