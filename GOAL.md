# GOAL: Topaz V2 Start Phase

## Objective

Hard-cut Topaz from the current `story + progress + flat taxonomy + materialized views` model into the lean V2 foundation described in `topaz-v2-specs/`.

This first phase is not the full rewrite. It is the schema and backend foundation needed to make the next vertical UI slice possible.

## Required Reading

Before changing code, read:

```text
topaz-v2-specs/AGENT_INDEX.md
topaz-v2-specs/00_context/00_project_summary.md
topaz-v2-specs/01_principles/01_invariants.md
topaz-v2-specs/02_data/00_schema_contract.md
topaz-v2-specs/02_data/01_table_catalog.md
topaz-v2-specs/03_implementation/00_roadmap.md
topaz-v2-specs/03_implementation/01_acceptance_criteria.md
```

## Start Phase Scope

Implement the V2 domain foundation:

```text
Core
- work
- source_platform
- work_source
- contributor
- work_contributor

Library
- library_entry
- reading_state
- reading_event

Taxonomy
- taxonomy_kind
- taxonomy_term
- taxonomy_label
- taxonomy_relation
- work_taxonomy_assignment
- work_taxonomy_effective
```

## Hard-Cut Rules

```text
- Do not preserve old story/progress compatibility.
- Do not keep schema-v2 beside schema in final code.
- Do not add library_entry_index in this phase.
- Do not add dirty queues, import jobs, external taxonomy refs, participant parsing, or contributor identities.
- Replace old domain exports with the V2 canonical shape.
- Prefer one complete working shape over adapters and dual models.
```

## Implementation Tasks

1. Replace the Drizzle schema with the 14 V2 domain tables.
2. Update schema exports so old domain tables are no longer canonical.
3. Add constraints and indexes from `topaz-v2-specs/02_data/01_table_catalog.md`.
4. Add seedable constants/helpers for:
   - source platforms
   - taxonomy kinds
   - taxonomy relation types
   - reading event types
5. Implement repository primitives for:
   - creating a work with a primary source
   - creating/linking a contributor
   - creating a library entry and reading state
   - assigning taxonomy terms to a work
   - rebuilding effective taxonomy rows for one work
6. Replace or stub routers toward V2 names:
   - `work`
   - `library`
   - `taxonomy`
7. Keep the app compiling, even if some UI wiring is temporarily minimal.

## Acceptance Criteria

This phase is done when:

```text
14 V2 domain tables exist in active Drizzle schema
old story/progress/story_taxonomy_term/taxonomy_alias shape is removed from active schema exports
source_platform and taxonomy_kind are tables, not Postgres enums
work_source has DB-level uniqueness for normalized URLs
reading_event exists
work_taxonomy_effective exists
foreign-key columns have indexes
repository code can create one usable library item
repository code can rebuild effective terms for one work
bun run typecheck passes
```

If time allows, also get:

```text
bun run lint
```

## Stop Conditions

Stop and report clearly if:

```text
- the current migration chain blocks a clean hard cut
- Drizzle cannot express a required partial unique/index cleanly
- existing UI imports make a minimal compile impossible without a broader router rewrite
- auth/user table changes would risk breaking NextAuth unexpectedly
```

## Out of Scope

```text
- full UI redesign
- import/export system
- denormalized library search index
- background dirty queue
- taxonomy participant parser
- source-specific external taxonomy mapping
- multi-user sharing/social features
- careful old-data migration
```

## Ledger

Status: Start Phase backend foundation implemented.

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
- No migration reset/generation was performed in this pass.
```
