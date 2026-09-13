# ADR-0007: Append-Only Oplog + Hybrid Logical Clock Over CRDTs

## Status

Accepted.

## Context

Moving to per-device SQLite files (ADR-0006) means the same logical data now has multiple independent replicas that must reconcile without either device being online at the same time as the other (store-and-forward). The conventional answer to "replicated data across devices" in current tooling is CRDTs (Automerge, Yjs, or a CRDT-shaped sync engine) -- but CRDTs solve *concurrent multi-actor merge*, and this app has exactly one actor (a single admin, on different devices, at different times).

## Decision

Every mutation appends a row to an append-only `oplog` table (`08_sync/00_oplog_and_clock.md`) in the same transaction as the write, timestamped with a per-device Hybrid Logical Clock. Sync exchanges oplog rows between devices; conflicts resolve as last-write-wins by HLC timestamp, per column where two devices are likely to touch different fields of the same row independently.

## Consequences

```text
- No CRDT library, no CRDT-shaped document model forced onto the relational
  schema -- the existing Postgres-derived relational schema
  (03_data/00_schema_contract.md) is preserved as-is; the oplog sits alongside
  it, not underneath it.
- Conflict resolution is simple enough to unit-test directly: given an
  arbitrary interleaving of oplog rows from two devices, applying them in HLC
  order must converge to the same final state regardless of exchange order
  (04_implementation/01_acceptance_criteria.md should include this as a
  property-based test).
- The tradeoff being made explicitly: if this app ever needed true concurrent
  multi-user editing (it does not -- 01_principles/02_non_goals.md), this
  decision would need revisiting. Nothing here is designed to make that
  transition free; that would be premature generality for a problem this app
  doesn't have.
- Deletes must be tombstoned, never hard-deleted, so a late-arriving update
  from another device can't resurrect a row the user removed -- this is the
  one place the simpler model still requires real care.
```
