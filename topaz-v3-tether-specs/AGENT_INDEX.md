# Agent Index

Read files in the order given in `README.md`. This file states the implementation rules an agent must follow while working from this spec.

## Rules

```text
1. Do not reintroduce tRPC. Not a router, not a procedure, not a client hook that
   wraps one. If a data need looks like it wants tRPC, it wants a Server Action, a
   cache()-wrapped query function, or a Route Handler behind TanStack Query.

2. Do not reintroduce NextAuth or React Hook Form. Both are fully removed. Grep for
   them before considering a feature done; their presence means a leftover.

3. Every page.tsx stays a synchronous compositor. It arranges Suspense boundaries; it
   does not itself await searchParams, cookies(), or a data fetch at the top level.

4. Every dynamic read (search, filters, user-scoped data) lives inside a Suspense
   boundary, resolved by the component that actually needs it, not hoisted to the page.

5. Every Server Action mutation calls revalidateTag with an explicit profile
   ("max" for stale-while-revalidate) and a scoped tag (per work/entry/term id), never
   a blanket invalidation sweep and never revalidateTag(tag) with no profile argument.

6. Every reusable interactive component that triggers a mutation takes the action as a
   prop named with an Action suffix (e.g. toggleFavoriteAction), manages its own
   useOptimistic/useTransition internally, and lets errors bubble to the nearest
   catchError boundary instead of local try/catch.

7. Zustand stores hold only state genuinely shared across components that isn't server
   state. If a store could be replaced by useState in the one component that reads it,
   it must be.

8. Stay single-user. Do not add organization, team, or multi-tenant tables or plugin
   config, even where better-auth makes it easy to.

9. This is a ground-up design, not a migration. Do not frame decisions as "replacing X"
   or reference any earlier iteration of this app in code, comments, or docs. Prior
   iterations may exist as private background context for the person writing this spec,
   but the spec and the code must read as self-contained.

10. No data migration logic. There is no production data to migrate. Do not write
    backfill scripts, dual-write paths, or compatibility views.

11. Selection state (multiselect) is never a raw array of ids toggled with
    includes()/splice(). Use the include/exclude Set model in
    06_library/03_row_selection.md. Any bulk-action UI must go through it.

12. Treat every render-path decision (memoization, context shape, selector shape,
    virtualization callback identity) as load-bearing, not incidental. See
    02_stack/05_advanced_react_patterns.md before writing a new hook or store slice.

13. No query awaits inside a loop over rows. Use joined aggregation, Drizzle
    relations, or the shared hydrateByParent batch loader (07_backend/01_query_and_n_plus_one_policy.md).

14. Every list query uses cursor (keyset) pagination via the shared codec in
    server/query/cursor.ts, with a stable-id tie-breaker on every sort -- never
    a hand-rolled cursor implementation per feature, never OFFSET pagination.

15. Every filter set is a declarative FilterSpec (07_backend/03_search_and_filtering.md),
    not an imperative chain of if-statements building a conditions array by hand.

16. This is local-first, not client-server. There is no shared database and no
    "the server" -- every device runs its own full copy of the app against its
    own SQLite file. Do not write code that assumes a single always-reachable
    database or a single source of truth other than "the local device's own
    file, reconciled via sync."

17. Every mutation that writes to a synced table appends exactly one oplog row
    (08_sync/00_oplog_and_clock.md) in the same transaction as the write. A
    Server Action that writes to the database without also appending to the
    oplog is incomplete, not just under-tested.

18. Never hard-DELETE a row in a synced table. Use a tombstone. A hard delete
    can be silently resurrected by a late-arriving update from another device.

19. Do not reach for a CRDT library, a vector clock, or a WebSocket/persistent
    socket for sync. The conflict model is last-write-wins by HLC timestamp
    over a plain Route Handler (08_sync/) -- reintroducing either is solving a
    problem (concurrent multi-actor merge, live push) this app doesn't have.

20. Do not reintroduce Discord OAuth or any social-login provider. Auth is
    local credential/passkey only (02_stack/04_auth_and_authorization.md), so
    a device can unlock its own library with no internet reachable.
```
