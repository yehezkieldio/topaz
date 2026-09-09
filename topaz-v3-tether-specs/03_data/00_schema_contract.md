# Schema Contract

SQLite (`bun:sqlite`) via Drizzle ORM, one file per device. Every table gets a `text` primary key (a generated id, stored as a string -- SQLite has no native UUID type) plus a `publicId` (cuid2) exposed to clients instead of the raw id, and `created_at`/`updated_at` timestamps. `relations()` is defined alongside every table so Drizzle's relational query API (`db.query.work.findMany({ with: {...} })`) is available from the first migration, not retrofitted later.

## Postgres -> SQLite Type Translation

This is a straight port from the original Postgres-shaped contract, table structure and constraints unchanged, with these type-level substitutions applied everywhere the Postgres type appeared:

```text
citext                 -> text with an explicit COLLATE NOCASE on the column
                          declaration. Matches the existing "no function-wrapped
                          index lookups" discipline below -- COLLATE is part of
                          the column, not a runtime lower()/cast at query time.
                          Accepted tradeoff: NOCASE folds ASCII case only, not
                          full Unicode case-folding the way citext's ICU-backed
                          comparison does. Fine for this library's actual content.

jsonb + CHECK           -> text with CHECK (json_valid(x)), read/written via
  jsonb_typeof = 'object'  JSON.parse/JSON.stringify at the Drizzle schema
                          boundary (a custom Drizzle column type), never passed
                          through as an unvalidated string.

pg_trgm GIN indexes on   -> SQLite FTS5 virtual tables using the `trigram`
title/description/         tokenizer, external-content mode (references the
summary                    base table's rowid rather than duplicating text).
                          See 07_backend/03_search_and_filtering.md for the
                          full rework -- this is the one place the port is a
                          genuine redesign, not a type substitution.

uuid primary keys        -> text primary keys (generated id string). No
                          behavioral difference; SQLite has no native UUID type.
```

CHECK constraints, partial unique indexes, and composite primary keys are all supported natively in SQLite and port over unchanged. Recursive taxonomy inference (`WITH RECURSIVE`, bounded to maxDepth = 4) also ports unchanged -- SQLite's recursive CTE support is equivalent to Postgres's for this query shape.

## Sync-Related Additions

Two things exist in this schema that had no Postgres-era equivalent, specified fully in `08_sync/00_oplog_and_clock.md`:

```text
oplog          - append-only: (seq, device_id, table_name, row_id,
                 column_diffs (json), hlc_timestamp, tombstone). Every mutation
                 in a feature's actions.ts appends here in the same transaction
                 as the row write -- one commit, not two.

known_peer     - per-device table of paired peers: device_id, tailnet hostname,
                 public key fingerprint, last_synced_seq. Never synced itself
                 (each device's peer list is its own local configuration).
```

`version` columns (below) are unchanged in purpose but now also double as sync-relevant state: a bumped `version` is itself an oplog-recorded change, and the oplog's HLC timestamp -- not the `version` integer -- is what actually orders conflicting writes across devices during a sync round.

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
None. citext and pg_trgm were Postgres extensions this design no longer needs --
COLLATE NOCASE and FTS5 (bundled with SQLite, no separate install) cover the
same ground. See the type-translation table above.
```
