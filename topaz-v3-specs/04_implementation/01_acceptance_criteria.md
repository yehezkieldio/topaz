# Acceptance Criteria

## P0 -- Must be true before anything else ships

```text
- No tRPC, NextAuth, or React Hook Form import exists anywhere in src/.
- app/(main)/library/page.tsx does not await searchParams/cookies()/headers()
  at its own top level.
- better-auth admin sign-in works via Discord; a non-admin session cannot call
  any mutation Server Action (verified, not assumed).
- Library list renders via a Server Component read, first page visible without
  client JS having run.
```

## P1 -- Core browsing flow

```text
- Search input updates results via useDeferredValue + transition, without a
  skeleton flash on every keystroke (stale results fade, not disappear).
- Filters (nuqs-driven) compose correctly with search and are reflected in the URL.
- Infinite scroll loads subsequent pages via useInfiniteQuery + TanStack Virtual,
  with correct row height measurement for variable-length cards.
- Favorite/status/rating toggles show instant optimistic feedback and resolve
  correctly under rapid repeated clicks (no lost/out-of-order update).
```

## P2 -- Authoring flow

```text
- Create/edit work form (TanStack Form + Server Action) creates work, work_source,
  contributor, library_entry, and taxonomy assignments in one submission.
- Taxonomy suggestion (trigram similarity) surfaces existing terms before a
  duplicate is created.
- Effective-taxonomy rebuild runs correctly after a taxonomy assignment or
  relation change and is reflected in filtered results.
```

## P3 -- Caching, stats, embed

```text
- Mutating one work's favorite status does not invalidate unrelated cache tags
  (verified by observing which tags a revalidateTag call touches per mutation).
- library-stats renders in its own Suspense boundary and does not block
  LibraryResults from streaming when the stats query is artificially slowed.
- The personal-website homepage stats widget and the /library page's own stats
  section call the identical shared query function.
```

## Explicit Non-Criteria

```text
- No requirement to support more than one authenticated user.
- No requirement for a public API beyond what TanStack Query's own Route
  Handlers need for client-owned reads.
- No requirement to migrate any prior data -- there is none.
```
