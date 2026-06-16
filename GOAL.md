# GOAL: Topaz V2 Usable Vertical Slice

## Objective

Make the completed V2 domain foundation usable through the Topaz app.

The previous phase replaced the active schema/backend foundation. This next phase must turn that into a working product slice:

```text
public user can browse/search/filter the V2 library
admin can create/edit/delete a work
admin can attach source and contributor data
admin can assign taxonomy terms
effective taxonomy inference is visible through filters/API
admin can update reading state
reading_event rows are written for reading changes
home stats render from V2 data
```

This is still not a redesign. Keep the existing UI structure where it helps and rewire it to V2.

## Required Reading

Before changing code, read:

```text
topaz-v2-specs/AGENT_INDEX.md
topaz-v2-specs/03_implementation/00_roadmap.md
topaz-v2-specs/03_implementation/01_acceptance_criteria.md
topaz-v2-specs/02_data/02_query_and_index_policy.md
topaz-v2-specs/04_quality/00_gates.md
```

Also inspect the current V2 implementation before editing:

```text
src/server/db/schema/
src/server/db/repositories/
src/server/api/root.ts
src/server/api/routers/
src/features/library/
src/app/(main)/library/page.tsx
src/app/(main)/page.tsx
```

## Current Ledger From Previous Goal

Status: V2 backend foundation implemented.

Completed:

```text
- Replaced active Drizzle domain schema with the 14 V2 tables:
  work, source_platform, work_source, contributor, work_contributor,
  library_entry, reading_state, reading_event,
  taxonomy_kind, taxonomy_term, taxonomy_label, taxonomy_relation,
  work_taxonomy_assignment, work_taxonomy_effective.
- Removed active materialized-view schema export/registration.
- Removed old story/progress/story_taxonomy_term/taxonomy_alias table exports.
- Kept source_platform and taxonomy_kind table-driven, not Postgres enums.
- Added DB uniqueness for work_source (source_platform_id, normalized_url).
- Added partial unique indexes for work_source external_id, active taxonomy term names, and primary taxonomy labels.
- Added FK indexes and checks for V2 library/taxonomy/source tables.
- Added seed constants/helpers for source platforms, taxonomy kinds, taxonomy relation types, and reading event types.
- Added repository primitives for creating a library item, linking contributors, assigning taxonomy, and rebuilding effective taxonomy.
- Replaced root tRPC surface with work, library, taxonomy, and view stats facade.
- Rewired current library call sites from story/progress routers to work/library routers.
```

Validation:

```text
- bun run typecheck: passed
- bunx biome check src scripts: passed
- bun run lint: blocked by pre-existing .agents/skills JSON-with-comments files being included by Biome
```

Notes:

```text
- scripts/populate-database-for-testing.ts no longer seeds V1 story/progress data; it now exits with a V2 fixture-loader notice.
- No migration reset/generation was performed in the previous pass.
```

## Next Phase Scope

### 1. Database Reset/Migration Readiness

Make local V2 schema usable.

Tasks:

```text
- Decide the cleanest local hard-cut path for Drizzle migrations.
- Generate or reset migrations only if needed for the app to run locally.
- Keep this as a hard cut; do not preserve V1 migration compatibility.
- Add a minimal V2 fixture/seed path if the app needs sample data for verification.
```

Acceptance:

```text
- local database can be brought to the V2 schema
- source platforms and taxonomy kinds can be seeded
- a minimal fixture library item can exist for UI verification
```

### 2. V2 Library Query Contract

Make the library list query return the exact shape the UI needs.

Tasks:

```text
- Verify or complete library list repository query over normal indexed joins.
- Include work, primary source, contributors, reading state, direct terms, effective terms, and versions.
- Preserve keyset pagination.
- Preserve useful search behavior where feasible: full-text, ILIKE, trigram.
- Implement filters from the V2 query policy as far as current UI supports them.
```

Acceptance:

```text
- library query returns stable item shape
- search works by title, contributor/source author, taxonomy label, and notes
- filters work for status, source platform, direct/effective taxonomy, rating, favorite, nsfw, and notes
- no library_entry_index table is introduced
```

### 3. Create/Edit/Delete Work Flow

Rewire admin mutation flows to V2.

Tasks:

```text
- Update create form data mapping to work + source + contributor + library_entry + reading_state + taxonomy assignments.
- Update edit form data mapping to V2 versions and fields.
- Ensure update writes reading_event rows when status/chapter/rating/notes change.
- Ensure taxonomy assignment changes rebuild work_taxonomy_effective synchronously.
- Ensure delete removes dependent rows correctly through FK cascade or explicit transaction.
```

Acceptance:

```text
- admin can create a library item from UI
- admin can edit work/source/contributor/reading/taxonomy fields
- admin can delete a library item
- taxonomy effective rows update after assignment changes
- reading events are written for meaningful reading-state changes
```

### 4. Taxonomy UI and Inference

Make the taxonomy graph useful, not just present.

Tasks:

```text
- Update taxonomy multiselect/search to use taxonomy_label and taxonomy_kind.
- Keep quick-create if practical, but do not block the slice on a perfect taxonomy editor.
- Add or verify relation mutation support for implies/broader/equivalent_to.
- Make effective taxonomy filters usable through API, UI, or both.
```

Acceptance:

```text
- assigning a direct term works
- adding an implies/broader/equivalent_to relation can infer terms
- filtering by an inferred effective term can find the work
```

### 5. Home Stats and Public Read Path

Restore the public-facing product surface.

Tasks:

```text
- Update home page stats to read V2 tables/events.
- Keep public library browsing read-only.
- Keep admin-only controls gated by existing auth.
```

Acceptance:

```text
- home page renders without V1 materialized views
- library page renders for public users
- write controls remain admin-only
```

## Hard-Cut Rules

```text
- Do not reintroduce V1 story/progress compatibility.
- Do not add library_entry_index in this phase.
- Do not add dirty queues, import jobs, external taxonomy refs, participant parsing, or contributor identities.
- Do not revive full materialized-view refresh after normal mutations.
- Prefer the existing UI structure unless a small replacement is faster and clearer.
```

## Validation Gates

Required:

```text
bun run typecheck
bunx biome check src scripts
```

Run if the Biome config/scope has been fixed:

```text
bun run lint
```

Manual verification:

```text
1. local DB is on V2 schema
2. seed/source platform/taxonomy kind path works
3. home page renders
4. library page renders publicly
5. admin can create a work
6. admin can edit a work
7. admin can assign taxonomy
8. inferred effective taxonomy filter works
9. admin can update status/chapter/rating/notes
10. reading_event rows exist for updates
11. admin can delete the item
```

## Stop Conditions

Stop and report clearly if:

```text
- the current Drizzle migration chain needs a destructive reset decision before continuing
- the local database cannot be safely reset under the user's expected workflow
- V2 repository/router shape is incomplete enough that UI work would become guesswork
- auth/session behavior breaks while rewiring public/admin surfaces
- typecheck cannot be made green without a broader second pass
```

## Out of Scope

```text
- UI redesign
- import/export system
- denormalized library search index
- background dirty queue
- taxonomy participant parser
- source-specific external taxonomy mapping
- multi-user sharing/social features
- careful old-data migration
```

## Current Ledger

Status: V2 usable vertical slice is wired and verified through public render checks, authenticated admin tRPC HTTP flow, and Chrome-driven browser admin create/edit/delete UI flow.

Completed in this pass:

```text
- Replaced the local migration chain with a hard-cut V2 baseline migration.
- Pinned the local Docker database to postgres:17 so the existing data-volume mount is stable.
- Added db:prepare:v2 to install citext and pg_trgm before drizzle-kit push on fresh local databases.
- Added script-local V2 reference/fixture seed commands that do not import server-only repository modules.
- Verified fresh local DB reset path:
  docker compose down --remove-orphans -v
  docker compose up -d topaz-dev-db
  bun run db:prepare:v2
  bun run db:push
  bun run db:seed:v2
  bun run db:seed:v2:fixture
- Seed verification showed:
  source_platforms=11
  taxonomy_kinds=10
  fixture_sources=1
  effective_terms=Character study:implies, Found family:direct
  reading_events=1
- Extended library list query for contributor names, direct taxonomy terms, direct/effective taxonomy filters, favorite, notes, NSFW, source, and range filters.
- Extended library search across work title/description/summary, source title/author, contributor names, notes, and taxonomy labels.
- Rewired edit defaults to use direct taxonomy assignments instead of effective taxonomy rows.
- Added taxonomy relation list/create/delete router support and synchronous effective taxonomy rebuild after relation changes.
- Added explicit adminProcedure usage for active write/admin routers.
- Removed active V1 story/progress routers and story procedure source files.
- Removed the unused deleteProgress compatibility alias from the V2 library repository.
- Removed materialized-view refresh work from the active view router facade.
- Added public library filter UI controls for source, favorite, NSFW, and notes.
- Fixed direct/effective taxonomy filter SQL to use parameterized IN predicates instead of ANY over scalar postgres-js params.
- Added verify:v2:admin to exercise authenticated HTTP tRPC create/update/taxonomy relation/inferred filter/reading event/delete flow against a running dev server.
- Added verify:v2:public to exercise public home/library render plus browse/search/filter cases against the seeded V2 fixture.
- Added verify:v2:browser-admin to exercise authenticated Chrome UI create/edit/delete flow against a running dev server.
- Added accessible labels to admin icon controls so the browser UI and assistive technology can target edit/more actions reliably.
- Fixed taxonomy.forMultiselect hot-term SQL by grouping taxonomy_kind.sort_order; browser logs now show taxonomy.forMultiselect returning HTTP 200 instead of the previous grouped-query SQL error.
- Verified home page and public library page return HTTP 200 under the local V2 database.
- Verified bun run verify:v2:public passed:
  homePage=true
  libraryPage=true
  browse=true
  titleSearch=true
  notesSearch=true
  statusFilter=true
  sourceFilter=true
  directTaxonomyFilter=true
  effectiveTaxonomyFilter=true
- Verified authenticated /api/auth/session returns HTTP 200 with a generated local Auth.js JWT for the fixture user.
- Verified authenticated /library render passes isAdministratorUser=true to the client provider.
- Verified bun run verify:v2:admin passed:
  createdWork=chbym31jnrvjfmi16pl6vdma
  relation=implies
  filteredByInferred=true
  readingEventsBeforeDelete=2
  deleted=true
- Verified bun run verify:v2:browser-admin passed:
  browserCreated=true
  browserEdited=true
  browserDeleted=true
  createdWork=b25xhrine5vx09eccr68210a
  readingEventsBeforeDelete=2
- Verified verify:v2:admin cleanup leaves:
  http_terms=0
  http_works=0
- Verified hard-cut regression search found no banned V1/router/materialized-view symbols in src or scripts.
```

Validation:

```text
- bun run typecheck: passed
- bunx biome check src scripts: passed
- bun run lint: still blocked by repository-wide Biome scope over .agents/skills JSON-with-comments files, plus deprecated biome.json recommended field
```

Known follow-up warnings:

```text
- Next dev server warns that /library accesses searchParams outside Suspense under Cache Components. The route still returns HTTP 200 and verifiers pass; this is a performance/framework warning, not a V2 slice correctness failure.
- React dev hydration warning appears for ReactQueryDevtools aria-hidden attributes. This is unrelated to the V2 data/admin slice and did not block browser verification.
```
