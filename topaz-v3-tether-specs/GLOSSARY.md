# Glossary

```text
Server Component (RSC)   Async React component rendered on the server, fetches its
                          own data given only IDs/params, never ships its own JS.

Server Action             A "use server" function callable from a form action or a
                          client event handler; the primary mutation path in V3.

Server Function            Broader term covering Server Actions and any "use server"
                          exported function, including ones returning JSX/data to a
                          client component via a Route Handler-free path.

Static shell               The part of a route Next.js can prerender: layout, nav,
                          filters UI, search input. Must not contain a direct read of
                          searchParams/cookies/headers at the boundary that defines it.

Dynamic hole               A Suspense boundary inside the static shell where a real
                          per-request read happens (search results, user-scoped data).

cache()                    React 19 request-scoped memoization. Dedupes identical calls
                          within one render pass; does not persist across requests.

"use cache"                 Next.js Cache Components directive. Marks a function/component
                          as cacheable across requests, tagged and revalidated explicitly.

"use cache: private"        Variant that may read cookies()/session data inside an
                          otherwise-cacheable function; scoped per-user.

cacheTag / cacheLife       Next.js APIs called inside a "use cache" boundary to tag the
                          cache entry and set its stale/revalidate/expire profile.

revalidateTag              Server-side call that invalidates cache entries by tag. In V3
                          always called with a profile ("max"), never bare.

Action prop                A component prop suffixed Action (e.g. toggleFavoriteAction)
                          accepting a Server Action; the component owns its own
                          useOptimistic/useTransition around calling it.

useActionState              React 19 hook combining state + pending + queued/sequential
                          dispatch for a Server Action; used for form submits and any
                          mutation where ordering must be preserved (e.g. rapid re-rating).

useOptimistic               React 19 hook for instant UI feedback ahead of a Server
                          Action's resolution, with automatic rollback on failure.

useTransition               React hook marking a state update as non-blocking. In V3,
                          used for pure client-side rendering deferral only, never as a
                          substitute for TanStack Query's own request lifecycle.

useDeferredValue             React hook that lets a value lag behind its source without a
                          transition; used where the expensive value is externally owned
                          (e.g. a prop from a parent) rather than a state setter you call.

Referential stability       Whether a value keeps the same reference across renders.
                          Load-bearing for TanStack Virtual row callbacks and any value
                          passed into a memoized component or React Context.

Effective taxonomy          The materialized, graph-inferred set of taxonomy terms that
                          apply to a work (direct assignment + inferred via relations),
                          stored in work_taxonomy_effective and rebuilt on assignment
                          or relation change.

Local-first                An architecture where each device holds a full, independently
                          usable replica of the data, with sync as a background
                          reconciliation process rather than a requirement for the app
                          to function. See 00_context/00_project_summary.md.

Store-and-forward           A replication model where devices exchange changes
  replication                whenever they happen to be reachable, with no requirement
                          that any two devices be online at the same time.

Oplog                     The append-only table of row-level changes (08_sync/00_oplog_and_clock.md)
                          that sync exchanges between devices, instead of diffing full
                          tables at sync time.

HLC (Hybrid Logical         A clock combining physical time and a logical counter,
  Clock)                    giving a total, monotonic order across events from
                          different devices even when their wall clocks disagree.
                          Used to order oplog rows for last-write-wins resolution.

Tombstone                  A row marked deleted (rather than physically removed) so a
                          late-arriving update from another device can't silently
                          resurrect it during sync.

Known peer                 A device the admin has explicitly paired with (Ed25519 key
                          exchange), stored locally per device, never itself synced.

Tether                     This fork's working name (topaz-v3-tether) -- the sync layer
                          is what tethers the admin's devices together over Tailscale.
```
