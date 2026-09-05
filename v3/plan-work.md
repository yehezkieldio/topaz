# Plan Work — Cheap Time-Series / Audit Trail for Personal Analytics (v3)

> Self-contained handoff doc. The agent executing this plan works **only inside `v3/`** (this directory). Do not touch repo root (`../`) except to read `../topaz-v3-specs/` for background. No extra context gathering needed — everything you need is below.

## 0. Goal

Make v3's Postgres data **statistics-ready from simple → super-advanced** while staying **cheap to store on Supabase Free tier** (~500 MB DB limit, pooled connections, egress-billed reads).

Concretely:

1. **Wire the existing append-only ledger** (`reading_event`) — table exists, no production writes yet.
2. **Add one cheap observation log** for source refreshes over time (`work_source_observation`) — insert-only-on-change, tiny rows.
3. **Add one cheap shared audit log** (`audit_log`) for catalog/library edits — minimal diffs, not full-row dumps.
4. **Add an analytics query ladder** L1 (counts) → L2 (velocity/completion) → L3 (affinity/staleness heuristics) → L4 (export view for notebooks/advanced ML). No new infra, no extensions, no cron, no Timescale.

Non-goals: realtime pipelines, per-chapter row tables, full-text reindexing, Timescale hypertables, `pg_cron`, external warehouse, backfilling scraped history.

## 1. Starting Point (do not re-discover)

### 1.1 Stack & commands

- Next.js 16.3 + React 19, Drizzle ORM 0.45 + `postgres-js`, Postgres 17, Better-Auth, TanStack Query/Form/Virtual, Bun 1.4.1 as package manager.
- Key scripts in `package.json` (run from `v3/`): `bun run dev`, `bun run typecheck` (`tsgo --noEmit`), `bun run check` / `bun run fix` (ultracite), `bun run test` (vitest), `bun run db:generate`, `bun run db:migrate`, `bun run db:push`, `bun run db:seed`, `bun run verify` (auth + authoring flows).
- Local DB: `docker-compose.yml` → `postgres:17-alpine`, db `topaz`, test db `topaz_test`, extensions only `citext` + `pg_trgm` (see `docker/init-extensions.sql`, `docker/init-test-db.sql`). Prod target: Supabase + Supavisor pooler, transaction mode (port 6543). Template: `.env.example`. Local/dev: `.env.local`. Tests: `.env.test`.
- DB client: `src/server/db/client.ts` — `postgres(DATABASE_URL, { max: 1, prepare: false })` + `drizzle(conn, { casing: "snake_case", schema })`. Never change `max`/`prepare` (pooler requirement).
- Drizzle config: `drizzle.config.ts` — schema `./src/server/db/schema/index.ts`, out `./drizzle`. Migrations in `drizzle/` (`0000_*.sql`, `0001_*.sql`, `meta/`).

### 1.2 Schema conventions (follow them)

- Snake-case in DB, camelCase in TS (`casing: "snake_case"`).
- Normal domain tables use factory helpers in `src/server/db/schema/_shared.ts`: `idColumns()` = `uuid PK defaultRandom()` + `publicId text unique $defaultFn(cuid2)`, plus `timestampColumns()` = `createdAt/updatedAt`.
- `relations()` in `src/server/db/schema/relations.ts` for every table.
- Indexing policy (from specs): CHECKs for jsonb shape / non-negativity, partial unique indexes for "one active X", trigram GIN only where fuzzy search needs it, never wrap an indexed column in a function at query time, aggregates in single SQL (no app-side reduce), no N+1 (single query with agg, relational API with exact `with`, or one batched `inArray` + `hydrateByParent`).
- Env validation: `src/lib/env.ts` (zod). Query helpers: `src/server/query/{cursor,filters,paginate,search-text,mutation-result}.ts`.
- Mutations: Server Actions in `src/features/*/server/actions.ts`, `"use server"`, `requireAdmin()` first, version-checked read-modify-write inside `db.transaction`, return `MutationResult` discriminated union (`success | version-conflict | not-found`), then `revalidateTag(..., "max")`. Client uses `useActionState` (sequential queue) + input disabled while pending.
- Reads: `cache()`-wrapped fetchers in `src/features/*/server/queries.ts` with `"use cache"`, `cacheLife`, `cacheTag`. Existing examples: `src/features/library/server/{queries.ts,stats-query.ts,cache-tags.ts}`.
- Tests: `vitest.config.ts`, helpers in `test/{db-helpers,mock-next-runtime, fixtures}.ts`, example `src/features/library/server/actions.test.ts`. Always truncate app data in `beforeEach`, create admin vs non-admin users to test `requireAdmin`.

### 1.3 Current domain tables

- Auth (Better-Auth shape + `user.role user|admin`): `user, session, account, verification`.
- Catalog: `source_platform` (8 seeded rows), `work` (canonical, citext title, `version`), `work_source` (per-platform posting: `url, normalized_url, external_id, raw_metadata jsonb, word_count, chapter_count`), `contributor`, `work_contributor` (composite PK work+contributor+role).
- Taxonomy graph: `taxonomy_kind` (10 seeded), `taxonomy_term` (`version`, soft-merge), `taxonomy_label`, `taxonomy_relation`, `work_taxonomy_assignment` (direct, composite PK), `work_taxonomy_effective` (materialized direct+inferred, `depth <= 4`).
- Library: `library_entry` (unique user+work, status enum 7 values, favorite/priority/private/is_featured/display_order, `version`), `reading_state` (1:1 PK = `library_entry_id`, chapter/percent/rating 1–5, `version`), `reading_event` (append-only, see §2).
- Seed: `src/server/db/seed.ts` inserts taxonomy kinds + source platforms with `onConflictDoNothing`.

## 2. Gap Analysis (why analytics is weak today)

- `reading_event` schema exists (`library_entry_id FK CASCADE, event_type 7 values: started/progressed/ rating_changed/reread_started/status_changed/completed/dropped, from_snapshot/to_snapshot jsonb, metadata jsonb, created_at`, indexes on `library_entry_id` + `created_at`) but **zero writes** outside schema/relations. `src/features/library/server/actions.ts` (`toggleFavoriteAction`, `updateStatusAction`, `updateRatingAction`) only does version-checked `UPDATE`s on `library_entry` / `reading_state`.
- Catalog updates (new chapters, word-count bumps, status flips) are **in-place overwrites** on `work` / `work_source` + `version+1`. `updated_at` keeps only the last touch; intermediate values are lost. No trajectory → no cadence / growth / lag analysis.
- No generic audit table. The spec's future `audit_log` pattern (type-enforced audit context, per-version `before/after`) was documented but never built — correctly, to avoid trigger magic and session-variable plumbing.
- `stats-query.ts` proves the L1 pattern (single-SQL `COUNT FILTER`, `AVG`, `SUM`, one `GROUP BY work_id` subquery) but only serves current snapshots, no time dimension.

## 3. Design Principles (cheap on Free tier)

1. **Insert-only-on-change, never pollute.** Log rows are created only when a value actually changed (app-layer `if (old !== next)` guard). A refresh that finds identical counts writes nothing. This is the #1 storage saver.
2. **Tiny rows, no pretty payloads.** New log tables: NO `publicId`, NO `updatedAt`, NO trigram indexes, NO citext, NO full-row dumps. Only `uuid PK + 2 FKs + 2–3 small ints/enums + created_at`. Snapshots store the minimal diff-relevant columns (2–4 ints), never `raw_metadata`.
3. **Cheap indexes only.** `btree(work_source_id, created_at DESC)` + `BRIN(created_at)` for time scans. BRIN is ~10–100× smaller than btree for append-only time series. No covering `INCLUDE` unless `EXPLAIN` proves it.
4. **No new extensions, no background jobs.** No Timescale, no `pg_cron`, no materialized-view refresh workers. Rollups are plain-SQL aggregates behind the existing `"use cache"` + `cacheLife("hours")` layer.
5. **Bounded growth by construction.** Estimate below: even at 2× daily refresh churn, < 5 MB/year. Add a documented `DELETE ... WHERE created_at < now() - interval '2 years'` one-shot script (manual, not cron) + a `*_daily` rollup view so raw pruning never breaks L1/L2 stats.
6. **Explicit over implicit.** Audit context passed as function args in Server Actions (actor + action name), never Postgres triggers / `SET LOCAL`.

### Storage budget (show your math in the PR)

Approximate per-row sizes (Postgres 17, no TOAST for these narrow rows):

- `work_source_observation`: ~64 bytes/row (uuid 16 + uuid 16 + int4×3 + timestamptz 8 + overhead).
- `audit_log`: ~120–200 bytes/row (depends on small jsonb diff, keep `< 500B` by allow-listing columns).
- `reading_event`: ~150–250 bytes/row (existing shape, keep snapshots to ≤4 keys).

Personal-scale worst case: 500 works × 1 source × weekly change × 52 weeks = 26k obs/year ≈ 1.7 MB/year. 10 library mutations/day × 365 = 3.6k events/year ≈ 0.9 MB/year. Total new growth **< 5 MB/year** — negligible against 500 MB. State this calculation in the migration PR description.

## 4. Work Plan (ordered, each slice verifiable)

### Slice A — Wire `reading_event` writes (no schema change)

**Goal:** every library mutation leaves a timestamped trace.

1. In `src/features/library/server/actions.ts`, extend the three existing actions to `INSERT` into `reading_event` inside the same `db.transaction`:
   - `toggleFavoriteAction` → `event_type: progressed`? No — use `status_changed` only for status; for favorite use `progressed` with `metadata: { kind: "favorite" }`. Prefer explicit: add `from_snapshot: { favorite, status }`, `to_snapshot: { ... }`. Keep snapshots to ≤4 keys: `{ status, favorite, rating, currentChapter }`.
   - `updateStatusAction` → map new status: `reading→started` (if first), `completed→completed`, `dropped/dropped_as_abandoned→dropped`, else `status_changed`. Always include `from_snapshot/to_snapshot` `{ status }`.
   - `updateRatingAction` → `rating_changed` with `{ rating }` snapshots. Also handle progress updates the same way when `currentChapter/percent` actions are added later (same pattern).
2. Derive `event_type` via a tiny pure helper `toReadingEvent(...)` in a new `src/features/library/server/reading-events.ts` (unit-testable, no DB). Guard: if `from` deep-equals `to`, skip insert (no-op writes nothing).
3. Add `metadata: { actorId, action: "toggle-favorite" | ... }` — actor from the `requireAdmin()` session, not a trigger.
4. Tests: extend `src/features/library/server/actions.test.ts` — after each success action, assert one `reading_event` row with correct type + snapshots
   - created_at recency; assert no-op (same value) writes no row; assert version-conflict writes no row.
5. Verify: `bun run test src/features/library/server/actions.test.ts`, `bun run typecheck`, `bun run check`.

Acceptance: all library mutations produce exactly one event row on change, zero on no-op/conflict; existing version-conflict semantics unchanged.

### Slice B — Add `work_source_observation` (the cheap time-series)

**Goal:** answer "when did this fic update, how fast does it grow, am I behind?" without storing scrapes.

1. New table `work_source_observation` in `src/server/db/schema/catalog.ts` (or new `observations.ts` exported from `index.ts`):
   ```ts
   // NO publicId, NO updatedAt — append-only by design.
   export const workSourceObservation = pgTable(
     "work_source_observation",
     {
       id: uuid("id").defaultRandom().primaryKey(),
       workId: uuid("work_id")
         .notNull()
         .references(() => work.id, { onDelete: "cascade" }),
       workSourceId: uuid("work_source_id")
         .notNull()
         .references(() => workSource.id, { onDelete: "cascade" }),
       chapterCount: integer("chapter_count"),
       wordCount: integer("word_count"),
       publicationStatus: publicationStatusEnum("publication_status"),
       source: text("source", { enum: ["manual", "refresh", "import"] })
         .notNull()
         .default("manual"),
       createdAt: timestamp("created_at").defaultNow().notNull(),
     },
     (t) => [
       index("wso_source_time_idx").on(t.workSourceId, t.createdAt),
       // BRIN keeps time-range scans cheap on Free tier:
       index("wso_created_brin_idx").using("brin", t.createdAt),
       check("wso_counts_non_negative", sql`${t.wordCount} >= 0`),
     ]
   );
   ```
   Add relations in `relations.ts` (`workSource → many observations`). Do NOT add trigram/citext/publicId. Document the exception to `idColumns()` in a comment (high-volume log tables skip it deliberately).
2. Write path: new Server Action `recordSourceObservationAction(workSourcePublicId, { chapterCount, wordCount, publicationStatus }, source)` in `src/features/library/server/` (or `src/features/catalog/server/` if that folder exists — create it if not, following the `features/*/server/` pattern). Logic inside `db.transaction`:
   - Load latest observation for this `work_source_id` (`ORDER BY created_at DESC LIMIT 1`) + current `work_source` row (for version check if you also update it).
   - If all three values equal latest → return `{ status: "noop" }`, write nothing.
   - Else: `UPDATE work_source SET ... version+1` AND `INSERT observation`. Coalesce rapid repeats: if latest observation is < 1 hour old AND values equal, skip (second guard besides equality).
   - Call this helper from `create-work-action.ts` (initial snapshot on create) and from any manual "refresh counts" button you add (see step 4).
3. Migration: `bun run db:generate` → review `drizzle/00NN_*.sql` (must contain only this table + 2 indexes + check; no extension changes) → `bun run db:push` locally, verify in `drizzle-kit studio`.
4. Minimal UI (keep tiny): extend the existing work edit form or detail sheet with three numeric inputs (chapters/words/status) + "Record refresh" button calling the action via `useActionState`. No auto-scraper, no cron.
5. Tests: new `observations.test.ts` — change writes 1 row, no-op writes 0, sub-hour duplicate writes 0, cascade delete removes observations. Seed one fixture work + source in `test/fixtures.ts` style.

Acceptance: refreshing with identical numbers costs zero bytes; changed numbers cost one ~64B row; `EXPLAIN` on `WHERE work_source_id = X ORDER BY created_at DESC` hits `wso_source_time_idx`.

### Slice C — Add shared `audit_log` (edit traces for statistics)

**Goal:** "what did I change and when" for catalog/library/taxonomy without a table per entity.

1. New table `audit_log` in `src/server/db/schema/audit.ts`:
   ```ts
   export const auditLog = pgTable(
     "audit_log",
     {
       id: uuid("id").defaultRandom().primaryKey(),
       entityType: text("entity_type", {
         enum: ["work", "work_source", "library_entry", "taxonomy_term"],
       }).notNull(),
       entityId: uuid("entity_id").notNull(),
       action: text("action").notNull(), // e.g. "update-work", "merge-term"
       actorId: text("actor_id").notNull(),
       changedColumns: text("changed_columns").array().notNull(),
       before: jsonb("before"), // allow-listed cols only, ≤4 keys
       after: jsonb("after"),
       version: integer("version").notNull(), // entity version AFTER change
       createdAt: timestamp("created_at").defaultNow().notNull(),
     },
     (t) => [
       index("audit_entity_time_idx").on(t.entityType, t.entityId, t.createdAt),
       index("audit_created_brin_idx").using("brin", t.createdAt),
       check(
         "audit_payload_is_object",
         sql`${t.after} is null or jsonb_typeof(${t.after}) = 'object'`
       ),
     ]
   );
   ```
2. Helper `withAudit(tx, ctx, fn)` in `src/server/db/audit.ts`: `ctx = { actorId, action }`; `fn` returns `{ entityType, entityId, changedColumns, before, after, version }`; helper inserts the row. Call it from the same transactions as Slice A/B + work edit + term merge. changedColumns allow-list per entity (e.g. work: title/status/rating only — never description/summary dumps; work_source: counts/status only — never raw_metadata).
3. Tests: one audit row per mutation, `before/after` contain only allow-listed keys, payload < 500B (`JSON.stringify().length` assertion).

Acceptance: every catalog/library write leaves a bounded audit row; no trigger, no raw_metadata duplication.

### Slice D — Analytics ladder (reads only, no new tables)

Add `src/features/stats/server/` (new feature folder, same patterns):

- `queries.ts` — all single-SQL aggregates, `cache()` + `"use cache"` + `cacheLife("hours")` + one `cacheTag("stats")`:
  - **L1 simple** (extend `stats-query.ts` pattern): totals, status breakdown, favorites, avg rating, words/chapters read.
  - **L2 personal**: reading velocity (`chapters / days` from `reading_event` `started→completed`), completion & drop rates, time-to-complete p50, update lag (`latest observation.created_at` vs `reading_state.last_read_at` → "3 chapters behind" list), refresh cadence per work (`lag(created_at) OVER (PARTITION BY work_source_id ORDER BY created_at)`).
  - **L3 heuristics** (pure functions in `heuristics.ts`, unit-tested): staleDetector (source grew, no progress in N days), backlogScore (fave × rating × update-freshness, 0–100), genreAffinity (avg rating × completion per effective taxonomy term), dropRisk (paused + no event in 30d + low rating).
  - **L4 export**: one `getMlExport()` returning a narrow JSON/CSV-ready view (one row per work: ids, counts, status, rating, event counts, days active, taxonomy slugs array) + a `scripts/export-stats.ts` (`bun run`) writing `tmp/stats-export.json` for notebooks. Document columns for future simple→advanced models (logistic, embeddings on tags — out of scope here).
- No per-row `cacheTag`s on aggregates (deliberately broad `stats` tag, same rationale as `libraryStatsTag`). Revalidate `stats` in Slices A–C actions.
- Verify each query with `EXPLAIN (ANALYZE, BUFFERS)` locally + round-trip count (library page = constant queries regardless of rows).

### Slice E — Retention & ops (keep Free tier safe)

1. `scripts/prune-observations.ts` (manual, never cron): `DELETE FROM work_source_observation WHERE created_at < now() - interval '2 years'` + `VACUUM (ANALYZE)` note. Guard: refuse to run if `SELECT pg_total_relation_size(...)` below threshold (log + exit 0).
2. Document in README section: current DB size query (`pg_database_size` / Supabase dashboard), growth table from §3, when to prune, and that `audit_log.before/after` must stay allow-listed.
3. `bun run verify` + full `bun run test` + `bun run typecheck` + `bun run check` green before merge.

## 5. File-by-File Task List for the Implementing Agent

1. `src/features/library/server/reading-events.ts` — NEW pure mapper + tests.
2. `src/features/library/server/actions.ts` — ADD event inserts (Slice A).
3. `src/features/library/server/actions.test.ts` — EXTEND (event assertions).
4. `src/server/db/schema/catalog.ts` (+ `observations.ts` optional) — ADD `workSourceObservation` (Slice B).
5. `src/server/db/schema/relations.ts` — ADD observation relations.
6. `src/features/*/server/*observation*` — NEW record action + tiny UI hookup.
7. `drizzle/00NN_*.sql` — GENERATED, review carefully (Slice B).
8. `src/server/db/schema/audit.ts` + `src/server/db/audit.ts` — NEW (Slice C).
9. `src/features/stats/server/{queries.ts,heuristics.ts}` — NEW (Slice D).
10. `scripts/prune-observations.ts` + `scripts/export-stats.ts` — NEW (Slices D/E).
11. `test/fixtures.ts`, `test/db-helpers.ts` — EXTEND fixtures as needed.

Order: A → B → C → D → E. Do not start C before A+B transactions compile; D needs A+B data shapes; E last.

## 6. Verification Gates (must all pass)

```bash
cd v3
bun install
# local DB up:
docker compose up -d postgres
bun run db:push        # or db:migrate against local DATABASE_URL
bun run db:seed
bun run typecheck
bun run check
bun run test
bun run verify
```

- New/changed list queries: paste `EXPLAIN (ANALYZE, BUFFERS)` output in PR, confirm index hits, no Seq Scan on sized tables.
- Migration SQL review: no new extensions, no `publicId`/`updatedAt` on log tables, BRIN present, CHECKs present.
- Storage: report `pg_total_relation_size` for the three log tables on seeded
  - fixture data; confirm per-row math from §3 holds.

## 7. Risks & Guardrails

- Supavisor transaction mode: all writes go through the existing `db` client; no `LISTEN/NOTIFY`, no advisory locks, no multi-statement interactive transactions beyond `db.transaction`.
- Single-admin app: `requireAdmin()` on every new Server Action; export script is local-only (never a Route Handler without auth).
- Do not store `raw_metadata` / descriptions in logs — egress + TOAST bloat.
- If Supabase size warnings appear: prune observations first (rebuildable from current `work_source` + future refreshes), never prune `reading_event` (irreplaceable user history).

## 8. Done Definition

- [ ] Library mutations write `reading_event` (Slice A tests green).
- [ ] Source refreshes write `work_source_observation` only on change (Slice B).
- [ ] Catalog/library edits write bounded `audit_log` rows (Slice C).
- [ ] L1–L3 stats render from single-SQL queries; L4 export script runs (Slice D).
- [ ] Prune script + size docs exist (Slice E).
- [ ] All gates in §6 green; migration reviewed; storage math reported.
