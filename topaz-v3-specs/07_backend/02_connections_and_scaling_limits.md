# Connections and Free-Tier Limits

Vercel Free (serverless functions, no persistent process) and Supabase Free (Postgres, Supavisor pooler, capped connections, capped egress) are the actual scaling ceiling. The design goal isn't to work around them cleverly -- it's to write queries and a connection strategy that stay comfortably inside them by default, so "cheap" and "powerful" aren't in tension at this app's real traffic.

## Connection Strategy

```text
- All database access goes through the Supavisor pooler in transaction mode
  (port 6543), never the direct connection -- a serverless function that opens
  a direct connection per invocation exhausts Postgres's connection limit almost
  immediately under any concurrency.
- The postgres.js client is configured with prepare: false (transaction-mode
  pooling doesn't support session-level prepared statements) and a small max
  pool size per function instance (max: 1 is the standard serverless posture --
  each invocation gets its own short-lived connection from the pooler's shared
  pool, rather than holding a local pool that competes with other concurrent
  invocations for pooler slots).
- No session-level Postgres features that require a sticky connection: no
  LISTEN/NOTIFY, no advisory locks held across statements, no session-level
  temp tables relied upon across queries in the same logical operation.
```

```typescript
// server/db/client.ts
const conn = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
export const db = drizzle(conn, { schema, relations, casing: "snake_case" });
```

Reused as a module-level singleton within a function's lifetime (Next.js/Vercel may reuse a warm serverless instance across invocations), never re-instantiated per request inside a request handler.

## Budget-Conscious Query Posture

```text
- Never SELECT *. Every query names its columns; the client never receives
  columns it doesn't render, and the database never has to serialize/transmit
  more than needed. This matters directly for egress on Supabase Free.
- raw_metadata (jsonb, can be large) on work_source is never included in a list
  query's SELECT -- it's fetched only on the single-work detail read that
  actually needs it.
- Pagination limits are capped server-side regardless of what a client requests
  (see the existing MAX_LIMIT-style ceiling) -- a client cannot request an
  unbounded page size and force a large, expensive scan/transfer.
- Cache Components (02_stack/03_caching_and_streaming.md) is the primary lever
  for staying cheap, not query micro-optimization: a well-tagged cache serves
  most reads without touching the database or the pooler at all. Query
  efficiency matters most for the reads that can't be cached (admin mutations'
  own read-after-write, live search).
```

## What Happens at the Edges

```text
- Supabase Free pauses the project after 7 days with no API/DB activity
  (02_stack/00_stack_contract.md). This is a personal app with occasional but
  real traffic (the admin's own usage, the personal-website homepage embed
  polling stats), which is enough to avoid this in practice -- but it's worth
  knowing so a "the site is down" report is checked against this before
  assuming a code regression.
- If DB connection or egress limits are ever actually approached (they are not
  expected to be, at this app's scale), the first lever is widening cache
  profiles (cacheLife) before anything else -- not adding infrastructure.
```
