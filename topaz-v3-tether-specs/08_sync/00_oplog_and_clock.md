# Oplog and Clock

This is the sync substrate every device's local writes flow through before they can reach another device. It exists because store-and-forward replication needs a durable, ordered record of "what changed," independent of the base tables themselves -- diffing full tables at sync time doesn't scale and can't express intent (an update vs. a delete-then-recreate).

## Why Not CRDTs

Already stated in `00_context/00_project_summary.md` and `01_principles/02_non_goals.md`, restated here because it's the load-bearing decision this whole file depends on: there is exactly one user. The hard problem CRDTs solve -- multiple *actors* concurrently editing the same data and needing an automatic, commutative merge -- does not exist in a single-user app. What does exist is "the same person, editing from a different device, at a different time." That's a total-order problem, not a merge problem, and a Hybrid Logical Clock plus last-write-wins solves a total-order problem directly, with far less implementation and debugging surface than a CRDT library.

## The Oplog Table

```typescript
export const oplog = sqliteTable("oplog", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(),
  tableName: text("table_name").notNull(),
  rowId: text("row_id").notNull(),
  columnDiffs: text("column_diffs", { mode: "json" }).notNull(), // { column: newValue, ... }
  hlcTimestamp: text("hlc_timestamp").notNull(), // sortable string encoding, see below
  tombstone: integer("tombstone", { mode: "boolean" }).notNull().default(false),
});
```

```text
- Append-only. Nothing in the oplog is ever updated or deleted -- a correction
  is a new oplog row, same as any other change.
- Every mutation in a feature's server/actions.ts appends exactly one oplog
  row per changed table/row, inside the same transaction as the write itself.
  One commit produces both the row mutation and its oplog record -- never two
  separate commits, which would let one succeed without the other on a crash.
- column_diffs carries only the columns that actually changed, not a full-row
  snapshot -- keeps oplog rows small (the memory/storage budget in
  07_backend/02_connections_and_scaling_limits.md applies here too) and makes
  per-column conflict resolution possible (see below).
- Deletes are tombstones (tombstone = true, column_diffs empty or carrying a
  deleted_at marker), never a hard DELETE. A hard delete would let a
  late-arriving update from another device silently resurrect a row the user
  deliberately removed -- the tombstone is what a sync round actually applies
  and propagates.
```

## The Clock: Hybrid Logical Clock, Not Vector Clocks

Each device maintains one HLC: `(physical_time_ms, logical_counter)`, advanced on every local event and on every received remote event (standard HLC merge: take the max of local and remote physical time, tie-break with the logical counter). Encoded as a single sortable string (e.g. zero-padded physical time + counter + device id) so `ORDER BY hlc_timestamp` is a correct total order without decoding.

```text
- HLC over vector clocks because a total order is exactly what's needed here
  (last-write-wins needs "which write is last," not "which writes are
  concurrent") -- vector clocks answer a question (causal concurrency
  detection) this design doesn't ask.
- HLC over plain wall-clock timestamps because device clocks drift and can be
  wrong; HLC's logical counter guarantees monotonicity per device even when
  physical clocks disagree, and its merge rule keeps devices' clocks loosely
  synchronized with each observed remote event.
```

## Conflict Resolution: Last-Write-Wins, Per Column Where It Matters

```text
- Default: last-write-wins per row, by HLC timestamp. The oplog row with the
  latest HLC timestamp for a given (table_name, row_id) is the one applied.
- Where two devices are likely to touch different fields of the same row
  independently (e.g. one device updates reading progress while another edits
  the work's title), resolution happens per column, not per row -- column_diffs
  already carries only the changed columns, so applying "latest HLC per
  column" instead of "latest HLC per row" is a matter of which key the resolve
  step groups by, not a schema change.
- A tombstone always wins over a data change with an earlier HLC timestamp,
  and a data change with a later HLC timestamp always wins over an earlier
  tombstone (i.e. tombstones participate in the same total order as any other
  change -- there is no special-cased "deletes always win" rule).
```

## Checkpointing

The checkpoint is keyed by **HLC timestamp, not `seq`** -- `seq` is a plain autoincrement local to one device's own SQLite file, so a row a device received *from* a peer gets a new, unrelated `seq` value when it's inserted into that device's own oplog (to make it available for further relay). Two different devices' oplog tables never agree on what a given `seq` number means, so `seq` cannot be the cross-device sync cursor -- only the globally-comparable `hlc_timestamp` can be.

```text
- Each device tracks, per known peer, the highest hlc_timestamp it has
  already received from that peer (last_synced_hlc in known_peer, see
  03_data/00_schema_contract.md) -- not a seq number.
- A sync round asks a peer for oplog rows with hlc_timestamp > last_synced_hlc,
  scanning that peer's *entire* local oplog (every device_id it has ever
  recorded, not just rows it originated itself) -- this is what makes sync
  transitive without a separate per-origin-device checkpoint: if peer A
  already absorbed a change from device C, asking A once also picks up
  that change, the same as asking C directly would.
- Applies received rows in hlc_timestamp order, and re-inserts each into this
  device's own oplog (so it can relay them onward to a third device later),
  then advances the checkpoint to the highest hlc_timestamp actually received.
- Bounded per round (07_backend/02_connections_and_scaling_limits.md's fixed
  batch size, e.g. 500 oplog rows). A device that was closed for weeks
  reconciles across several bounded rounds, not one unbounded pull.
```
