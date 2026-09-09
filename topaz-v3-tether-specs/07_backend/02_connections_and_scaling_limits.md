# Local Access and Memory Budget

There is no pooler, no serverless connection limit, and no vendor free-tier egress cap to design around anymore -- `bun:sqlite` opens one file on the same machine the app is running on. That doesn't mean resource discipline goes away; it moves target. The device this runs on is the admin's own laptop or phone, often doing other things at the same time, so the same seriousness that used to go into "stay inside Supabase Free" now goes into "stay inside a memory and CPU budget a personal device won't notice." Treat this like writing for a resource-constrained embedded target, not a beefy cloud instance: every allocation, every buffered byte, every kept-alive process is a deliberate choice, not a default.

## Connection Strategy

```text
- One bun:sqlite Database handle per process, opened once at module load and
  reused as a singleton -- never re-opened per request. There is no pool to
  size because there is exactly one process talking to exactly one file.
- WAL journal mode (PRAGMA journal_mode = WAL) -- readers don't block the
  writer, and it's the right default for a single-writer, occasional-reader
  local app.
- PRAGMA synchronous = NORMAL, not FULL -- WAL mode already protects against
  corruption on a crash; NORMAL trades a small durability window (a handful of
  the most recent commits, in the event of an OS-level crash, not an app
  crash) for meaningfully less fsync overhead on every write.
- PRAGMA cache_size and PRAGMA mmap_size are set explicitly, not left at
  SQLite's defaults -- an unbounded page cache on a personal laptop that's
  also running a browser with forty tabs open is exactly the kind of "it
  works on my machine until it doesn't" failure this design exists to avoid.
  Pick a small, explicit ceiling (low tens of MB) and revisit only if a real
  workload proves it insufficient.
- No session-level features that assume a long-lived connection across
  requests beyond what a single in-process handle already provides for free.
```

```typescript
// server/db/client.ts
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

const sqlite = new Database(env.DATABASE_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA synchronous = NORMAL;");
sqlite.exec("PRAGMA cache_size = -20000;"); // ~20MB page cache, explicit ceiling
sqlite.exec("PRAGMA mmap_size = 67108864;"); // 64MB, explicit ceiling

export const db = drizzle(sqlite, { schema, relations, casing: "snake_case" });
```

## Resource-Conscious Query and Sync Posture

```text
- Never SELECT *. Every query names its columns -- this was already the rule
  for egress reasons under Postgres/Supabase; under SQLite the same discipline
  now serves the memory budget instead (less deserialized into the process's
  heap per row, which matters more on a personal device shared with everything
  else the admin has open).
- raw_metadata (large jsonb-turned-text) on work_source is still never
  included in a list query's SELECT -- fetched only on the single-work detail
  read that actually needs it.
- Pagination limits stay capped server-side regardless of what a client
  requests -- unbounded page sizes are still a real cost, just measured in
  process RSS instead of pooler slots.
- server/query/hydrate.ts's batch loader streams/pages rather than
  materializing an entire parent-to-children result set in memory at once --
  audited explicitly as part of the SQLite port, not assumed carried over.
- Every sync round (08_sync/00_oplog_and_clock.md) is bounded to a fixed
  oplog-row batch size per request/response pair. A device that was offline
  for weeks reconciling in one unbounded pull is exactly the kind of memory
  spike this budget forbids -- catch-up happens across several bounded rounds
  instead.
- Obscura (09_fetch/00_metadata_fetch_tiers.md) is capped at one in-flight
  page load at a time and killed after an idle timeout rather than kept warm
  indefinitely -- a personal single-user app has no reason to hold a browser
  engine's memory footprint open when nothing is fetching.
```

## What Happens at the Edges

```text
- There is no idle-pause behavior to plan around (07_backend/00_composition.md
  formerly noted Supabase Free's 7-day pause) -- the device is either running
  the app or it isn't, and "isn't" costs nothing since nothing is resident.
- If memory pressure is ever actually observed on a target device, the first
  lever is lowering the explicit cache_size/mmap_size ceilings above, then
  checking oplog batch size and hydrate.ts batch width -- not adding
  infrastructure, and not loosening the ceilings back to SQLite's defaults.
```
