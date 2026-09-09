# ADR-0006: SQLite (bun:sqlite) Over Supabase Postgres

## Status

Accepted.

## Context

Free Postgres hosting is scarce and constrained: connection caps, idle-pausing after inactivity, and storage ceilings shaped a meaningful amount of the prior design (Supavisor pooler config, `max: 1` connection posture, cache-first query strategy to avoid egress). Separately, the admin's actual workflow depends on Obscura (`09_fetch/00_metadata_fetch_tiers.md`), a long-running native binary that cannot run on a serverless platform like Vercel at all. Rather than keep engineering around a shared-server hosting ceiling, the app moves off a shared server entirely.

## Decision

Each device runs its own copy of the app against its own local SQLite file via `bun:sqlite`, no shared database, no pooler, no serverless function. Data is reconciled between the admin's own devices via an oplog-based sync protocol (`08_sync/00_oplog_and_clock.md`), not shared at query time.

`bun:sqlite` specifically, over `better-sqlite3` or libsql's native bindings, because it's a Bun-runtime-native module rather than a dynamically-required native (N-API) addon -- the class of dependency most likely to break under `next-bun-compile`'s single-file bundling (ADR-0008).

## Consequences

```text
- The entire "free-tier-conscious" query/connection posture from
  02_stack/00_stack_contract.md and 07_backend/02_connections_and_scaling_limits.md
  is replaced by a local resource-conscious posture -- the constraint moves
  from a vendor's free tier to the admin's own device RAM/CPU, and is taken
  just as seriously.
- citext, pg_trgm, and jsonb-with-CHECK all need type-level translation to
  SQLite equivalents (03_data/00_schema_contract.md) -- structure and
  constraints are otherwise unchanged, this is a type port, not a redesign,
  except for free-text search (ADR-0006's sibling concern, detailed in
  07_backend/03_search_and_filtering.md).
- There is no more multi-tenant or high-concurrency ceiling to design for at
  all -- a single-writer, single-user SQLite file has no pooler-shaped problem
  to solve, which is a genuine simplification, not just a hosting-cost move.
- A new problem is introduced that didn't exist before: multiple independent
  copies of the data now exist and must be reconciled. See ADR-0007.
```
