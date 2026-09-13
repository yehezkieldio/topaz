# Design Philosophy

## Small Personal Library, Not Enterprise Metadata

V3 changes the architecture, not the ambition. It should stay sized for a single-user app embedded in a personal website, not grow toward a multi-tenant SaaS shape just because better-auth or Cache Components make the primitives easy to reach for.

## Server-First, Client Where It Earns Its Keep

The default is a Server Component. A component becomes a Client Component only when it needs one of: local interactive state, a browser API, an effect, or a hook. Push `'use client'` as deep into the tree as possible -- leaf nodes (a toggle button, a search input, a virtualized list), not whole pages or whole sections.

```text
default: Server Component
promote to Client Component only for: interactivity, browser APIs, hooks, effects
push 'use client' to the leaf, never the root
```

## Static Shell, Streamed Holes

Every route has a static shell (layout, nav, filters UI, search input) that Next.js can prerender, and dynamic holes (search results, user-scoped reads) that stream in behind Suspense. A page is not allowed to force the whole route dynamic by reading `searchParams`/`cookies()`/`headers()` at the top level -- that read has to happen inside the Suspense boundary that needs it.

## Data Fetching Has One Home Per Shape

```text
initial server-rendered read      -> Server Component, cache()-wrapped fetcher
client-owned, re-fetchable read    -> TanStack Query, queryFn calls a Server Action
                                     or Route Handler directly
mutation                          -> Server Action, called via action prop or
                                     useActionState, never a client-side fetch to a
                                     hand-rolled API route
```

There is exactly one way to do each of these. Do not let a second pattern grow next to it because it was faster to write in the moment.

## Optimistic by Default, Never Silently Stale

Any user-triggered mutation with visible state (favorite, status, rating, reading progress) gets instant feedback via `useOptimistic`, with the underlying Server Action call sequenced through `useActionState` so rapid repeated actions on the same item resolve in order, not in a race.

## Cache Precisely, Not Broadly

Every cached read is tagged at the entity level it actually depends on. Every mutation revalidates only the tags it touched. There is no acceptable version of "just invalidate everything to be safe."

## Build Vertical Slices

Each implementation slice should leave the app closer to usable end to end:

```text
schema/query function compiles
Server Component or Server Action works
UI renders and streams correctly
mutation is optimistic and revalidates the right tags
acceptance can be manually verified in the browser
```

Avoid long backend-only or architecture-only marathons with nothing visibly working.

## Prove Before You Add Machinery

Do not add a denormalized read table, a second cache layer, or a bespoke state-coordination context until a real, measured problem shows up. TanStack Query, Cache Components, and plain `useState`/`useMemo` cover almost everything at this scale.
