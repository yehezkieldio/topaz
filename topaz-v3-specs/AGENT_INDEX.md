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
```
