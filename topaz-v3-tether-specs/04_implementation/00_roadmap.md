# Roadmap

Slices are ordered so each leaves the app closer to usable end to end, per the design philosophy. Each slice is hours-scale, not days-scale.

Slices 0 to 8 below are the original plan. All of them are done. Two facts in the original text are now wrong, because of later decisions recorded in `10_adr/`. Slice 0 named Supabase, Postgres, and a Discord auth provider. The actual stack uses SQLite (`@libsql/client`, ADR-0006, ADR-0010) and local credential and passkey auth only (`02_stack/04_auth_and_authorization.md`). The local-first pivot (`00_context/00_project_summary.md`) drove this change. Slices 9 and 10 are later additions. The original roadmap did not plan local-first sync, so it does not list them.

## Slice 0: Foundation (done)

```text
- Remove tRPC, NextAuth, React Hook Form packages and all their call sites.
- Set up better-auth (Drizzle adapter, admin plugin, local credential and
  passkey provider, no social OAuth -- see ADR-0003 and
  02_stack/04_auth_and_authorization.md).
- Use SQLite (@libsql/client) as the per-device datastore, not
  Postgres or Supabase (see ADR-0006, ADR-0010).
- Reset Drizzle migrations against the diffed schema
  (03_data/00_schema_contract.md).
- Add relations() to every table.
- Confirm next.config.ts does not set typescript.ignoreBuildErrors: true.
```

## Slice 1: Read Path for One Route (done)

```text
- features/library/server/queries.ts holds the cache()-wrapped
  fetchLibraryList function.
- app/(main)/library/page.tsx is a synchronous compositor with a Suspense
  boundary around the results region.
- The static shell (layout and nav) prerenders. Only the results region is
  a dynamic hole under Cache Components.
```

## Slice 2: Search, Filters, URL State (done)

```text
- LibrarySearch (client) and LibraryFilters (client, nuqs-driven) exist.
- Filters compose with search. Both are reflected in the URL.
- Search today runs a COLLATE NOCASE LIKE match against work.title, plus
  an EXISTS check against effective taxonomy term names. This is not the
  FTS5 trigram and bm25 path that 07_backend/03_search_and_filtering.md
  describes. FTS5 tables (work_fts, taxonomy_term_fts, work_source_fts,
  contributor_fts) exist and back taxonomy term search
  (searchTaxonomyTermsAction). The library list query itself does not use
  them yet. This is a known, accepted gap. queries.ts documents it as real
  follow-up work.
```

## Slice 3: Infinite Scroll and Virtualization (done)

```text
- Cursor-paginated pages use a keyset condition (server/query/paginate.ts).
- useInfiniteQuery starts from the server-rendered first page.
- TanStack Virtual uses measureElement for variable row height.
```

## Slice 4: Mutations, Favorite and Status and Rating Toggles (done)

```text
- Server Actions in features/library/server/actions.ts (toggleFavoriteAction,
  toggleFeaturedAction, updateStatusAction, updateRatingAction,
  updateProgressAction) each call requireAdmin(). Each checks optimistic
  concurrency against an expectedVersion. Each revalidates scoped cacheTags
  with the "max" profile.
- Leaf client components (StatusSelect, RatingStars, progress-input) use
  useActionState and useOptimistic internally.
- Every mutation also appends a matching oplog entry through recordAudit
  (server/db/audit.ts). This step was not part of the original slice, but
  every synced-table write needs one. It has been true since sync landed.
```

## Slice 5: Create and Edit Work Form (done)

```text
- A multi-entity form (work, work_source, contributor, library_entry, and
  taxonomy assignment) uses TanStack Form with @tanstack/react-form-nextjs.
- Taxonomy suggestion surfaces existing terms before a duplicate is
  created, through the FTS5-backed searchTaxonomyTermsAction. This is
  SQLite's equivalent of Postgres trigram similarity, not the same
  function.
- The conditional-hooks pattern (an enabled param) governs picker
  sub-behavior.
```

## Slice 6: Taxonomy Management UI (done)

```text
- Term and relation CRUD, term merging
  (features/taxonomy/server/repository/merge.ts), and effective-taxonomy
  rebuild (effective-taxonomy.ts) run as Server Actions.
```

## Slice 7: Stats and Homepage Embed (done)

```text
- A shared library-stats query (features/library/server/stats-query.ts) is
  cache()-wrapped with its own cacheTag and a longer cacheLife. The
  /library page's stats hole (library-stats.tsx) and the personal-website
  homepage widget (app/(site)/page.tsx, featured-works.tsx) both call it.
- is_featured and display_order support exist, along with getFeaturedWorks.
```

## Slice 8: Auth Hardening and Manual Verification (done)

```text
- Role checks are verified, not assumed. See require-admin.test.ts and the
  admin-versus-non-admin coverage in each mutation action's own test in
  actions.test.ts.
- scripts/verify-auth-roles.ts and scripts/verify-authoring-flow.ts run
  Server Actions directly.
- e2e/library-flow.spec.ts (Playwright) covers browse, filter, search,
  favorite, and create work end to end.
```

## Slice 9: Local-First Sync (done)

This slice is not in the original plan. It was added once the local-first pivot was decided (`00_context/00_project_summary.md`, ADR-0006 through ADR-0010). Each device holds a full replica. There is no shared server.

```text
- An append-only oplog plus a per-device Hybrid Logical Clock form the sync
  substrate (08_sync/00_oplog_and_clock.md; server/sync/hlc.ts, oplog.ts).
- Ed25519 device identity, signed requests, Tailscale-only transport, and
  QR or code pairing exist (08_sync/01_transport_and_pairing.md;
  server/sync/protocol.ts, device-identity.ts, pairing.ts, discovery.ts).
- The /api/sync pull round uses bounded batches (SYNC_BATCH_SIZE) and a
  bounded number of rounds per peer (MAX_ROUNDS_PER_PEER). Conflicts
  resolve last-write-wins at row granularity through HLC comparison
  (server/sync/round.ts, apply.ts).
- Data-integrity detection compares a per-table, bucketed digest (64
  id-hash buckets) against each peer. This runs on a periodic round
  trigger and on a manual "Check integrity" button
  (08_sync/03_data_integrity_and_reconciliation.md Part 1;
  server/sync/digest.ts).
- Data-integrity repair runs through a manual "Repair now" action. It is
  scoped to only the buckets a fresh digest diff finds mismatched, not a
  peer's whole table (Part 2; server/sync/repair.ts, full-table.ts).
- library_entry and reading_state support soft-delete through a tombstone,
  so a deletion actually propagates across devices instead of causing an
  error (server/sync/apply.ts's applyTombstoneToTable;
  deleteLibraryEntryAction). work, work_source, and taxonomy_term still
  have no delete path. This is a scope choice, not an oversight. See Open
  Items below.
- DATABASE_PATH falls back to a platform-conventional default (XDG on
  Linux, Application Support on macOS, LOCALAPPDATA on Windows) in
  production. Dev and test still require an explicit value
  (lib/default-database-path.ts, lib/env.ts).
```

## Open Items (not yet done)

```text
- Oplog compaction and pruning do not exist. The oplog table grows without
  a bound. This is a low-urgency gap at the current write volume (one
  admin, a personal library), but it is a real gap for an install that
  runs for years.
- work, work_source, and taxonomy_term have no delete or soft-delete path.
  Only library_entry and reading_state support it today. Those three
  tables hold shared, canonical catalog data with a wider referential
  reach (one work can back several library_entry rows across a shared
  taxonomy graph), so this needs its own larger design pass, not a small
  follow-up.
- The library list search still does not use work_fts (see Slice 2's
  note). LIKE-based search is correct today. It is just not the
  originally planned mechanism.
- No named test suite covers cursor-pagination edge cases (empty results,
  single-item results) on its own. Existing tests cover some of these
  cases, but only as a side effect of testing other behavior.
```
