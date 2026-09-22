# Acceptance Criteria

All criteria below are met by the current codebase, except where a line says otherwise. Two corrections against the original text: auth is local credential and passkey only, not Discord (ADR-0003, `02_stack/04_auth_and_authorization.md`), and the datastore is SQLite, not Postgres (ADR-0006, ADR-0010). A new Sync section covers criteria the original document did not anticipate.

## P0: Must be true before anything else ships

```text
- No tRPC, NextAuth, or React Hook Form import exists anywhere in src/.
- app/(main)/library/page.tsx does not await searchParams, cookies(), or
  headers() at its own top level.
- better-auth admin sign-in works through a local credential or passkey,
  not Discord. A non-admin session cannot call any mutation Server Action.
  This is verified by require-admin.test.ts and by admin-versus-non-admin
  coverage inside each mutation action's own test.
- The library list renders through a Server Component read. The first
  page is visible before client JS has run.
```

## P1: Core browsing flow

```text
- The search input updates results through useDeferredValue and a
  transition, with no skeleton flash on every keystroke. Stale results
  fade, they do not disappear.
- Filters (nuqs-driven) compose correctly with search and appear in the
  URL.
- Infinite scroll loads subsequent pages through useInfiniteQuery and
  TanStack Virtual, with correct row height measurement for
  variable-length cards.
- Favorite, status, and rating toggles show instant optimistic feedback
  and resolve correctly under rapid repeated clicks. No update is lost or
  applied out of order.
- Note: the search input matches by a case-insensitive LIKE pattern
  against work.title, plus effective taxonomy term names, not the FTS5
  trigram and bm25 path 07_backend/03_search_and_filtering.md describes.
  See the roadmap's Slice 2 note.
```

## P2: Authoring flow

```text
- The create and edit work form (TanStack Form plus a Server Action)
  creates a work, work_source, contributor, library_entry, and taxonomy
  assignments in one submission.
- Taxonomy suggestion surfaces existing terms before a duplicate is
  created, through the FTS5-backed searchTaxonomyTermsAction.
- The effective-taxonomy rebuild runs correctly after a taxonomy
  assignment or relation change, and the change appears in filtered
  results.
```

## P3: Caching, stats, embed

```text
- Mutating one work's favorite status does not invalidate unrelated cache
  tags. This is verified by observing which tags a revalidateTag call
  touches per mutation.
- library-stats renders in its own Suspense boundary. It does not block
  LibraryResults from streaming when the stats query is artificially
  slowed.
- The personal-website homepage stats widget and the /library page's own
  stats section call the identical shared query function.
```

## P4: Sync

Not in the original document. Local-first sync (`08_sync/`) was decided and built after this document was first written.

```text
- Two paired devices exchange changes through /api/sync. A change made on
  one device appears on the other after a sync round, without both
  devices being online at the same moment.
- A sync round applies incoming rows in strict HLC order inside one
  transaction. The peer checkpoint (known_peer.last_synced_hlc) advances
  only after every row in that batch is durably applied.
- A row edited on two devices independently resolves through last-write-
  wins by HLC, at row granularity. Neither device needs the admin to pick
  a winner.
- Deleting a library entry propagates to other devices as a real removal,
  not an error. The entry disappears from every browse, stats, and detail
  query on every device once synced (server/sync/apply.ts's
  applyTombstoneToTable; deleteLibraryEntryAction). This did not hold
  before the tombstone support landed, when a delete-shaped oplog row
  caused a sync round to throw.
- A digest comparison between two devices with identical data reports no
  mismatched tables. A digest comparison after one device diverges (for
  example, restored from an older backup) correctly names the divergent
  table and the divergent id-hash buckets within it.
- A manual "Repair now" run against a peer with a known mismatch pulls
  and reconciles only the rows in the mismatched buckets, not the peer's
  whole table, and the table shows converged on the next check.
- Every synced-table mutation (favorite, status, rating, progress,
  create, edit, delete, taxonomy changes) writes a matching oplog row
  inside the same transaction as the row change itself, through
  recordAudit or an explicit appendOplogEntry call. No synced-table write
  path exists that skips this.
```

## Explicit Non-Criteria

```text
- No requirement to support more than one authenticated user.
- No requirement for a public API beyond what TanStack Query's own Route
  Handlers need for client-owned reads.
- No requirement to migrate any prior data. None exists.
- No requirement for work, work_source, or taxonomy_term to support
  delete or soft-delete. See the roadmap's Open Items.
- No requirement for oplog compaction or pruning at the current scale.
  See the roadmap's Open Items.
```
