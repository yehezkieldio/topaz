# Roadmap

Slices are ordered so each leaves the app closer to usable end to end, per the design philosophy. Hours-scale, not days-scale, per slice.

## Slice 0 -- Foundation

```text
- Remove tRPC, NextAuth, React Hook Form packages and all their call sites.
- Set up better-auth (Drizzle adapter, admin plugin, Discord provider, role field).
- Set up Supabase project, Supavisor pooler connection string, env vars.
- Reset Drizzle migrations against the diffed schema (03_data/00_schema_diff.md).
- Add relations() to every table.
- Confirm next.config.ts does not set typescript.ignoreBuildErrors: true.
```

## Slice 1 -- Read Path for One Route

```text
- Build features/library/queries.ts with cache()-wrapped fetchers for a single
  work list read (no filters yet).
- Build app/(main)/library/page.tsx as a synchronous compositor with one Suspense
  boundary around a LibraryResults Server Component.
- Confirm the static shell (layout/nav) prerenders and only the results region
  is a dynamic hole under Cache Components.
```

## Slice 2 -- Search, Filters, URL State

```text
- Add LibrarySearch (client, useDeferredValue + useTransition + router.replace)
  and LibraryFilters (client, nuqs-driven) outside the Suspense boundary.
- Resolve searchParams inside LibraryResults, not at the page level.
- Verify typing in the search box does not force full-page dynamic rendering.
```

## Slice 3 -- Infinite Scroll + Virtualization

```text
- Build a Route Handler or Server Action returning cursor-paginated pages.
- Wire useInfiniteQuery (initialPageParam required, getNextPageParam) seeded from
  the server-rendered first page.
- Wire TanStack Virtual with the "+1 sentinel row" fetch-on-scroll pattern and
  measureElement for variable row height.
```

## Slice 4 -- Mutations: Favorite/Status/Rating Toggles

```text
- Build Server Actions in features/library/actions.ts (toggleFavorite,
  updateStatus, updateRating), each calling requireAdmin() and revalidating
  scoped cacheTags with the "max" profile.
- Build the action-prop leaf components (FavoriteToggle, StatusSelect,
  RatingStars) using useActionState internally for sequential correctness.
- Wrap each in a catchError boundary at the card level.
```

## Slice 5 -- Create/Edit Work Form

```text
- Build the multi-entity form (work + work_source + contributor + library_entry +
  taxonomy assignment) with TanStack Form + @tanstack/react-form-nextjs
  (createServerValidate/mergeForm/useActionState).
- Implement taxonomy-suggestion (trigram similarity) in the new query layer to
  surface existing terms before a duplicate is created.
- Apply the conditional-hooks pattern (enabled param) to any picker sub-behavior
  (outside-click, keyboard nav) rather than branching hook calls.
```

## Slice 6 -- Taxonomy Management UI

```text
- Port term/relation CRUD, term merging, and effective-taxonomy rebuild trigger
  to Server Actions + the split taxonomy repository modules.
```

## Slice 7 -- Stats + Homepage Embed

```text
- Build the single shared library-stats query (cache()-wrapped, own cacheTag,
  longer cacheLife), consumed identically by the /library page's stats hole and
  the personal-website homepage widget, so there is exactly one access path.
- Add is_featured/display_order support and a small featured-picks query.
```

## Slice 8 -- Auth Hardening + Manual Verification

```text
- Confirm role checks are real (test as a non-admin session gets rejected).
- Write manual verify scripts (scripts/verify-*.ts) that exercise Server Actions
  directly, covering the same admin/public flows the acceptance criteria list.
- Run through 05_quality/00_gates.md end to end.
```
