# Schema Contract

Postgres via Drizzle ORM. Every table gets a `uuid` primary key plus a `publicId` (cuid2) exposed to clients instead of the raw UUID, and `created_at`/`updated_at` timestamps. `relations()` is defined alongside every table so Drizzle's relational query API (`db.query.work.findMany({ with: {...} })`) is available from the first migration, not retrofitted later.

## Auth

```text
user            - better-auth's own shape, plus role (type "user" | "admin",
                  default "user", input: false via additionalFields)
session, account, verification  - better-auth's own shape
```

## Catalog

```text
source_platform      - seeded reference table (AO3, FFN, Wattpad, SpaceBattles,
                        RoyalRoad, WebNovel, ScribbleHub, NovelBin, ...)

work                  - canonical story: title (citext), sort_title, content_rating,
                        publication_status, is_nsfw, version (optimistic concurrency).
                        Trigram GIN indexes on title/description/summary.

work_source            - a work's posting on one platform: url, normalized_url
                        (unique per platform), external_id (partial-unique),
                        raw_metadata (jsonb, CHECK jsonb_typeof = object),
                        word_count/chapter_count (CHECK >= 0), trigram indexes.

contributor            - authors/translators, platform_handles (jsonb).

work_contributor        - join table, composite PK (workId, contributorId, role),
                        supports multiple roles/co-authors on one work.
```

## Taxonomy Graph

```text
taxonomy_kind          - seeded (fandom, character, relationship, genre, trope,
                        warning, source_category, format, tone, custom).

taxonomy_term           - citext name, slug, normalized_name, status (for soft
                        merge), self-referencing mergedIntoId, version.

taxonomy_label           - aliases per term; one designated is_primary per term
                        via a partial unique index.

taxonomy_relation        - typed graph edges: broader, related, implies,
                        conflicts_with, equivalent_to. CHECK prevents self-edges.

work_taxonomy_assignment  - direct tag assignment, composite PK.

work_taxonomy_effective   - materialized inference: direct + relation-inferred
                        terms, with depth and reason columns. Rebuilt by a graph
                        traversal bounded to maxDepth = 4 whenever an assignment
                        or relation changes.
```

## Library State

```text
library_entry           - per-user tracking, decoupled from work. status enum
                        (NotStarted/Reading/Paused/Completed/Dropped/PlanToRead/
                        DroppedAsAbandoned), favorite, priority, private,
                        is_featured, display_order (nullable -- personal-website
                        embed uses this to surface curated picks), unique per
                        (userId, workId), version.

reading_state            - 1:1 with library_entry: current_chapter/percent,
                        rating, reread_count, timestamps.

reading_event            - append-only history log: event_type enum
                        (started/progressed/rating_changed/reread_started/...),
                        from/to snapshots, metadata (jsonb).
```

## Constraints and Indexing Policy

```text
- CHECK constraints enforce jsonb shape (jsonb_typeof) and numeric non-negativity
  at the database level, not just in application validation.
- Partial unique indexes express "only one active X" (one primary label per term,
  one active-status name per scope) without a separate boolean-flag table.
- All index creation uses .concurrently() for zero-downtime migrations.
- Trigram (pg_trgm) + citext cover fuzzy search and case-insensitive matching;
  no external search service is introduced at this scale.
- No column an index needs to serve is wrapped in a function at query time
  (lower(), casts) -- that silently defeats a plain btree index. citext already
  solves this for exact-match case-insensitive lookups; trigram (gin_trgm_ops)
  indexes get the same discipline -- the query matches the indexed expression
  exactly, never a runtime-wrapped variant of the column.
- Partial indexes cover the common filtered case (e.g. non-deleted, active-status
  rows) instead of indexing every row unconditionally -- cheaper to write and
  smaller to store, which matters directly on Supabase Free tier's storage ceiling.
- Where a hot list query's full SELECT list is known and stable (the library
  list's card-row columns), a covering index (INCLUDE) is worth considering so
  the query can be satisfied as an index-only scan without a heap fetch per row --
  evaluated via EXPLAIN per 07_backend/01_query_and_n_plus_one_policy.md, not
  applied speculatively.
- version columns provide optimistic concurrency on work, library_entry,
  reading_state, taxonomy_term -- checked on update, paired on the client with
  useActionState's sequential dispatch so concurrent same-item mutations resolve
  deterministically (see 02_stack/02_data_and_mutation_flow.md).
```

## Extensions Required

```text
citext
pg_trgm
```
