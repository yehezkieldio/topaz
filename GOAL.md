# GOAL: Topaz V2 Finish and Hardening

## Objective

Finish Topaz V2 so it is stable enough for daily personal use.

The previous phase made the V2 domain foundation usable through the app. This phase should tighten the product, remove leftover V1 assumptions, harden the local reset/seed path, and verify the core workflows end to end.

This is not a feature-expansion phase. Do not add import systems, denormalized search indexes, background queues, taxonomy participant parsing, contributor identities, or source-specific external taxonomy mapping. Make the current V2 shape solid.

## Required Reading

Before changing code, read:

```text
topaz-v2-specs/AGENT_INDEX.md
topaz-v2-specs/03_implementation/01_acceptance_criteria.md
topaz-v2-specs/04_quality/00_gates.md
GOAL.md
```

Inspect only the implementation areas needed for this phase:

```text
src/server/db/schema/
src/server/db/repositories/
src/server/api/routers/
src/features/library/
src/app/(main)/
scripts/
README.md
```

## Current Ledger From Previous Goal

Status: V2 usable vertical slice completed by handoff.

Completed surface:

```text
- public user can browse/search/filter the V2 library
- admin can create/edit/delete a work
- admin can attach source and contributor data
- admin can assign taxonomy terms
- effective taxonomy inference is visible through filters/API
- admin can update reading state
- reading_event rows are written for reading changes
- home stats render from V2 data
```

Treat this ledger as the starting point. Verify exact behavior only where it affects the work in this phase.

## Next Phase Scope

### 1. Remove V1 Residue

Make active code read as V2, not V1 with patches.

Tasks:

```text
- remove dead V1 story/progress imports, types, comments, and naming where they affect active code
- rename user-facing or developer-facing labels that still imply the old model
- remove obsolete materialized-view refresh paths from active mutation flows
- keep historical migrations/docs untouched unless they actively break current work
```

Acceptance:

```text
- active app code no longer depends on V1 story/progress/read-model concepts
- old names remain only in historical migrations, specs, changelog, or explicit compatibility notes
- mutation flows do not refresh old materialized views
```

### 2. Local Reset and Seed Path

Make a fresh local V2 instance easy to bring up.

Tasks:

```text
- provide a clear V2 local reset path using the repo's existing scripts/justfile style
- seed source platforms and taxonomy kinds
- seed a small fixture set only if useful for manual verification
- document destructive reset expectations clearly
```

Acceptance:

```text
- a fresh local DB can reach the V2 schema
- required reference rows exist after seeding
- manual verification does not require hand-inserting source platforms or taxonomy kinds
- docs explain the reset/seed command path
```

### 3. Workflow Hardening

Tighten the daily-use workflows.

Tasks:

```text
- create work flow handles duplicate normalized URLs cleanly
- edit flow handles optimistic version conflicts clearly
- delete flow removes dependent rows without orphaned data
- reading-state updates create correct event rows without duplicate noise
- taxonomy assignment updates rebuild effective terms deterministically
- public users cannot trigger write mutations through UI affordances
```

Acceptance:

```text
- duplicate URL gives a clear error
- stale edit gives a clear conflict error
- delete leaves no orphaned library/taxonomy/source rows for the deleted work
- status/chapter/rating/notes changes write expected reading_event rows
- effective taxonomy results are stable after repeated rebuilds
- admin controls remain hidden or disabled for public users
```

### 4. Search, Filters, and Stats Polish

Make core library browsing reliable.

Tasks:

```text
- verify search covers title, source author text, contributor names, taxonomy labels, and notes
- verify filters cover status, source platform, direct/effective taxonomy, rating, favorite, nsfw, and notes where UI supports them
- verify keyset pagination remains stable with sort changes
- make home stats and library stats derive from V2 tables/events
- keep normal indexed joins; do not add library_entry_index
```

Acceptance:

```text
- search finds expected fixture/library data by multiple text fields
- effective taxonomy filter can find inferred matches
- sorting does not duplicate or skip visible rows across pages
- home stats render without V1 materialized views
- no denormalized library_entry_index exists
```

### 5. Documentation and Handoff

Make the current V2 state understandable for the next pass.

Tasks:

```text
- update README or a short V2 note with setup/reset/seed/check commands
- update GOAL.md ledger at the end of the pass
- note any deferred issues with exact files or behaviors
- do not create sprawling docs; keep it operational
```

Acceptance:

```text
- next worker can bring up the app from docs
- remaining work is listed as concrete follow-up, not vague cleanup
- GOAL.md accurately reflects completed and blocked items
```

## Hard-Cut Rules

```text
- Do not reintroduce V1 story/progress compatibility.
- Do not add library_entry_index.
- Do not add dirty queues, import jobs, external taxonomy refs, participant parsing, contributor identities, or merge audit tables.
- Do not revive full materialized-view refresh after normal mutations.
- Do not broaden into UI redesign unless a small UI fix is required for usability.
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
1. fresh local V2 reset/seed path works
2. home page renders V2 stats
3. library page renders public read-only view
4. admin can create a work with source, contributor, reading state, and taxonomy
5. duplicate source URL is rejected clearly
6. admin can edit work/source/contributor/reading/taxonomy fields
7. reading updates create reading_event rows
8. taxonomy relation inference updates effective terms
9. effective taxonomy filter finds inferred matches
10. admin can delete the item without orphaned active rows
```

## Stop Conditions

Stop and report clearly if:

```text
- local reset would destroy data without an explicit user-approved path
- migration state is inconsistent enough to require a separate database-only pass
- V2 workflow bugs require redesigning the schema contract
- typecheck exposes a broad architectural mismatch that should not be papered over
```

## Current Ledger

Status: V2 hardening pass completed for code-level cleanup and compile/lint gates; destructive/manual verification deferred.

Completed in this pass:

```text
- renamed active schema modules from story/progress to work/library-entry
- renamed active create/edit form hooks and form sections away from story/progress vocabulary
- changed library API result fields to work/libraryEntry/source/reading names
- removed obsolete view.refreshAll/view.refreshLibrary/view.refreshLibraryStats tRPC mutation surface
- removed no-op refreshLibraryView/refreshLibraryStatsView/refreshLibraryReadModels repository helpers
- added preflight duplicate normalized source URL conflict checks on create and edit
- kept optimistic version conflict checks for work and library_entry updates
- preserved synchronous effective taxonomy rebuild in create/edit/assignment flows
- fixed keyset cursor payloads to include sort key/order/value and ignore stale cursors after sort changes
- updated admin/public verification scripts for the renamed API contract
- improved library virtualization with stable getItemKey and memoized estimateSize
- replaced the virtualized library row hot path with compact fixed-height rows instead of full card/detail composition
- added a typed library data context shape with status/meta/actions while preserving existing form/dialog consumers
- changed library invalidation to use the active tRPC/TanStack query filter without a second forced refetch
- replaced edit quick-update broad form.watch reads with useWatch for chapter fields
- updated active UI copy from story/progress wording to work/library/reading wording
- verified bun run typecheck passes after the rename and React changes
- verified bunx biome check src scripts passes after the library React rework
- verified bunx biome check src scripts passes
```

Not run in this pass:

```text
- destructive fresh local database reset; requires explicit user approval before data destruction
- manual browser/admin verification flow; run after final gates with a known disposable DB/server
```

Known gate note:

```text
- bun run lint still fails because biome check . scans .agents/skills JSON-with-comments assets and reports a deprecated biome.json recommended field
- scoped required source gate bunx biome check src scripts passes
```

Recommended next pass:

```text
- rework the library React layer around the cleaned LibraryEntry view model
- split create/edit forms into smaller React Hook Form field sections with isolated useWatch/useController subscriptions
- replace the current card-heavy virtual row with a denser virtualized row/list design
- keep TanStack Virtual stable keys, memoized estimates, dynamic measurement only where needed, and explicit empty/error/loading states
- consider this a UI architecture pass, not more V2 domain migration work
```

## Out of Scope

```text
- import/export system
- denormalized library search index
- background dirty queue
- taxonomy participant parser
- source-specific external taxonomy mapping
- multi-user sharing/social features
- visual redesign
- careful old-data migration
```
