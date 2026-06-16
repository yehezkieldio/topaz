# GOAL: Topaz V2 Performance and Architecture Review

## Objective

Review and improve the V2 implementation before release-readiness work.

The app works, but this phase should check whether the shape is actually good enough to live with: fast enough, cleanly structured, predictable under daily use, and not hiding expensive query/UI patterns.

This is a review-first phase. Find concrete problems, then fix the highest-value ones. Do not turn this into a new domain rewrite.

## Required Reading

Before changing code, read:

```text
topaz-v2-specs/AGENT_INDEX.md
topaz-v2-specs/01_principles/01_invariants.md
topaz-v2-specs/02_data/02_query_and_index_policy.md
topaz-v2-specs/04_quality/00_gates.md
GOAL.md
```

Inspect these areas first:

```text
src/server/api/root.ts
src/server/api/routers/
src/server/api/procedures/
src/server/api/schemas/
src/server/db/repositories/
src/server/db/schema/
src/features/library/
src/components/ui/multiselect.tsx
src/features/library/components/ui/library-taxonomy-multiselect.tsx
src/features/library/components/list/
src/features/library/components/forms/
src/features/library/api/
src/features/library/hooks/
```

## Review Targets

### 1. tRPC Route Shape

Review:

```text
- router boundaries and naming
- public vs protected procedure split
- input schema ownership
- duplicated validation
- mutation transaction shape
- error messages and conflict behavior
- cache invalidation/refetch behavior
- DTO shape exposed to React
```

Acceptance:

```text
- routes are grouped by V2 domain, not V1 leftovers
- public reads and protected writes are explicit
- mutations validate once at the correct boundary
- transaction boundaries are clear
- UI-facing result shapes are stable and not raw accidental joins
```

### 2. Query and Data Efficiency

Review:

```text
- library list query
- taxonomy search/query routes
- effective taxonomy rebuild
- stats queries
- keyset pagination and cursor stability
- URL normalization lookup paths
- indexes used by common filters/sorts
```

Look for:

```text
- N+1 queries
- overfetching
- unnecessary joins
- unstable sort/cursor combinations
- expensive aggregation in hot paths
- missing FK/filter/sort indexes
- unbounded taxonomy traversal
```

Acceptance:

```text
- library query avoids obvious N+1 and overfetching
- pagination remains deterministic under sort changes
- taxonomy search is bounded
- effective taxonomy rebuild is cycle-safe and depth-bounded
- no library_entry_index is added unless measured evidence justifies it
```

### 3. React Performance and State Boundaries

Review:

```text
- library data provider boundaries
- TanStack/tRPC query keys
- search/filter URL state
- virtualized list behavior
- list item props and rerender patterns
- dynamic sheet/dialog mounting
- form state ownership
- memoization that helps vs memoization noise
```

Acceptance:

```text
- search/filter changes do not cause avoidable full-tree churn
- virtualized list item rendering remains bounded
- edit/view/delete sheets do not force unnecessary list rerenders
- form models are not tightly coupled to accidental backend row shape
- cache keys are stable and scoped to actual inputs
```

### 4. Multiselect and Taxonomy UX

Review:

```text
- generic multiselect component
- taxonomy multiselect wrapper
- debounce behavior
- selected-value rendering
- keyboard behavior
- loading and empty states
- quick-create flow
- hot terms behavior
- taxonomy kind/label display
- server query shape and cache behavior
```

Acceptance:

```text
- taxonomy search is debounced or otherwise bounded
- selected terms render predictably with kind/name context
- quick-create does not create duplicates accidentally
- keyboard and mouse interactions remain usable
- loading/empty states are clear
- queries do not refetch aggressively without input changes
```

### 5. Component and Data Model Boundaries

Review:

```text
- API DTOs vs DB rows
- form data models
- view models for library items
- source/contributor/taxonomy control boundaries
- duplicated mapping logic across create/edit/view
```

Acceptance:

```text
- DB row shape is not leaked unnecessarily into UI forms
- create/edit forms share intentional mapping logic where practical
- library item view model is explicit
- taxonomy/source/contributor controls can evolve without rewriting the whole form
```

### 6. Aesthetic and Usability Polish

Review:

```text
- dense library browsing hierarchy
- selected filters visibility
- admin actions placement
- mobile bottom controls
- edit/create sheet ergonomics
- empty/loading/error states
- metadata readability
```

Acceptance:

```text
- no broad visual redesign
- small polish improves daily use
- controls remain scannable on desktop and mobile
- text does not overflow compact controls
- admin actions are discoverable but not noisy
```

## Algorithm Checks

Specifically inspect and fix if needed:

```text
- work_taxonomy_effective rebuild traversal
- taxonomy relation cycle handling
- max recursion/depth behavior
- duplicate effective-row prevention
- search ranking and fallback order
- cursor generation and parsing
- normalized URL generation and comparison
- taxonomy quick-create duplicate detection
```

## Work Style

Use this order:

```text
1. review target files
2. write findings into a temporary checklist in GOAL.md under Ledger
3. fix high-impact issues first
4. keep changes scoped
5. update Ledger with completed fixes and deferred issues
```

Do not fix low-value cosmetic issues while leaving route/query/state problems untouched.

## Hard-Cut Rules

```text
- Do not reintroduce V1 story/progress compatibility.
- Do not add library_entry_index without measured evidence.
- Do not add dirty queues, import jobs, external taxonomy refs, participant parsing, contributor identities, or merge audit tables.
- Do not revive full materialized-view refresh after normal mutations.
- Do not broaden into a redesign.
```

## Validation Gates

Required after code changes:

```text
bun run typecheck
bunx biome check src scripts
```

Run if the Biome config/scope has been fixed:

```text
bun run lint
```

Manual verification for touched flows:

```text
1. library search/filter still works
2. taxonomy multiselect still selects, searches, and quick-creates where supported
3. create/edit/delete work still works if forms were touched
4. reading state update still writes events if library mutations were touched
5. effective taxonomy filter still finds inferred matches if taxonomy code was touched
6. desktop and mobile controls remain usable if UI was touched
```

## Stop Conditions

Stop and report clearly if:

```text
- review finds a schema-level issue that cannot be fixed without changing the V2 table contract
- performance concern cannot be justified without running a real database profile
- fixing one UI flow requires rewriting most of the library feature
- typecheck reveals broad architectural mismatch beyond this phase
```

## Out of Scope

```text
- release/deploy readiness
- backup/export system
- import/export system
- denormalized library search index unless measured and justified
- background dirty queue
- taxonomy participant parser
- source-specific external taxonomy mapping
- multi-user sharing/social features
- full visual redesign
- careful old-data migration
```

## Ledger

Status: Completed V2 route/query/UI cleanup slices for library pagination/search, stats aggregation, contributor update ownership, multiselect focus/error handling, duplicate/dead route removal, cache header correction, taxonomy quick-create duplicate hardening, taxonomy/library cache invalidation, edit-form boundary fixes, and library item DTO typing. Remaining work is broader V2 review, not a blocker for the completed slices.

Findings:

```text
- P1 listLibraryEntries cursor pagination does not model PostgreSQL null ordering for nullable sorts. Trigger: infinite library pagination sorted by author/rating/progress/wordCount/chapterCount. Cost: can stop early or skip rows when a page boundary contains NULL. Evidence: source inspection of createCursorCondition and nullable left-joined sort expressions.
- P1 listLibraryEntries joins work_taxonomy_effective/taxonomy_term/taxonomy_label into the main list query only for search predicates, then fetches taxonomy DTO rows separately. Trigger: library search/list. Cost: unnecessary join fan-out before grouping and pagination. Evidence: source inspection of listLibraryEntries projection and follow-up taxonomy fetch.
- P2 cursor parser validates only part of CursorData and casts sortBy/value after JSON parse. Trigger: client-supplied cursor. Cost: weak boundary for invalid cursor payloads. Evidence: source inspection of parseCursor.
- P1 getLibraryStats joins work_taxonomy_effective into the same aggregate used for status counts, average rating, and total chapters read. Trigger: public stats query. Cost: counts and sums are multiplied by each work's effective taxonomy row count. Evidence: source inspection of getLibraryStats aggregate join.
- P1 updateLibraryItem links a newly edited author without removing the previous author relation. Trigger: editing a work author. Cost: stale contributors remain attached to the work and leak into contributorNames/search. Evidence: source inspection of updateLibraryItem calling createOrLinkContributor after updating primary source author.
- P2 library item DTO exposes source/status fields as loose strings, forcing UI casts and fallback defaults in item display/edit form code. Trigger: rendering/editing library items. Cost: weak form boundary and type assertions in React. Evidence: source inspection of LibraryQueryResult and downstream `as Source`/`as LibraryEntryStatus`/`as WorkStatus` casts.
- P2 getLibraryItemValues checks work completion with `toLowerCase() === "complete"` while the V2 work status enum uses `Completed`. Trigger: rendering metadata/progress labels for completed works. Cost: completed works may not show the complete label. Evidence: source inspection of use-library-item.tsx and workStatusEnum.
- P1 LibraryList uses one selectedItem plus three open booleans, so selecting view/edit/delete mounts all selected-item overlays even though only one is open. Trigger: opening any library item overlay. Cost: edit/view/delete sheet and dialog trees receive the selected item and can do unnecessary render work; stale commented scroll code remains in close handlers. Evidence: source inspection of LibraryList selectedItem render block.
- P1 LibraryEditForm seeds the taxonomy multiselect display from effective taxonomy terms while the form field submits direct taxonomy IDs. Trigger: editing a work with inferred taxonomy. Cost: inferred terms can appear selected even though saving submits only direct assignments. Evidence: source inspection of useLibraryEntryEdit default taxonomyTermIds and LibraryEditForm initialTaxonomyTerms.
- P1 taxonomy relation create/delete rebuilds effective taxonomy only for works directly assigned to the relation source term. Trigger: adding/removing a relation from an inferred term. Cost: works that reach the source term through another relation keep stale effective tags. Evidence: source inspection of createTaxonomyRelation/deleteTaxonomyRelation affected-work queries.
- P1 homepage LibraryStats displays total words, but getLibraryStats does not return totalWordsRead. Trigger: homepage render. Cost: public stats copy reports ~0 words even when source word counts exist. Evidence: source inspection of LibraryStats fallback and getLibraryStats projection.
- P2 root router exposes a duplicate view.getStats route that only mirrors library.getStats. Trigger: generated tRPC surface and route discovery. Cost: V1-style route boundary remains after stats moved under the library domain. Evidence: src-only search found no consumers outside root mount and the duplicate router file.
- P2 library.delete exposes a second deletion semantic that removes only a library entry while the V2 UI and admin verification flow delete works through work.delete. Trigger: generated tRPC mutation surface. Cost: overlapping delete routes make ownership ambiguous and can leave a work behind when the UI copy says the work is deleted. Evidence: src/scripts usage search found only work.delete callers and no library.delete callers.
- P2 tRPC responseMeta decides public-cache eligibility by checking whether procedure paths contain "public", but public read paths are library.all and library.getStats. Trigger: public tRPC query responses. Cost: intended cache-control header is never applied to the actual public library reads. Evidence: source inspection of responseMeta and publicProcedure callers.
- P3 work.sourceOptions and work.statusOptions expose unused admin queries while forms read enum options locally. Trigger: generated tRPC surface. Cost: dead route surface and duplicated ownership for static enum data. Evidence: source/scripts usage search found no callers.
- P1 taxonomy quick-create duplicate detection checks only taxonomy_terms.normalized_name, while taxonomy search and primary/alias ownership use taxonomy_labels.normalized_label. Trigger: multiselect quick-create using an existing alias or non-primary label. Cost: can create duplicate taxonomy concepts and search can show duplicate rows for one term when multiple labels match. Evidence: source inspection of getTaxonomyMultiselect, createTaxonomyTermForMultiselect, createTaxonomyTerm, updateTaxonomyTerm, and taxonomy_label indexes.
- P1 edit form maps unrated items to `rating: undefined` while workWithLibraryEntrySchema requires a string rating and treats empty string as the valid unrated state. Trigger: opening and saving an existing unrated work. Cost: form starts invalid or submit mapping can fail even when the user is editing unrelated fields. Evidence: source inspection of useLibraryEntryEdit defaultValues and rating schema.
- P1 taxonomy relation create/delete and term delete mutate work_taxonomy_effective or cascade taxonomy rows used by getLibraryStats.taxonomyTermCount, but invalidate only taxonomy read models. Trigger: adding/removing taxonomy relations or deleting taxonomy terms. Cost: public library stats can keep stale taxonomy term counts until the library stats cache expires. Evidence: source inspection of taxonomyRouter invalidation calls and getLibraryStats taxonomy aggregate.
- P2 rebuildEffectiveTaxonomyForWork casts taxonomy relation text to the narrower effective-reason enum after filtering. Trigger: rebuilding inferred effective taxonomy rows. Cost: type assertion hides boundary drift if relation reason sets change. Evidence: source inspection of relationType cast and taxonomyEffectiveReasonEnum.
```

Completed:

```text
- Required reading complete: AGENT_INDEX, invariants, query/index policy, gates, and GOAL.
- Fixed listLibraryEntries cursor parsing to reject invalid sort/value cursor payloads without type assertions.
- Fixed keyset cursor predicates for nullable sort columns under PostgreSQL NULL ordering.
- Removed taxonomy effective/term/label joins from the main library list projection; taxonomy search now uses an EXISTS predicate and the DTO taxonomy fetch remains separate.
- Removed multiselect open-focus timer and moved focus to PopoverContent onOpenAutoFocus.
- Replaced taxonomy quick-create console-only failure handling with a user-visible toast error.
- Fixed getLibraryStats row multiplication by separating library-entry stats from effective-taxonomy cardinality.
- Fixed author edits so the current work author relation is replaced instead of accumulating stale author contributors.
- Tightened library item DTO source/status fields to enum-shaped values at the repository boundary and removed downstream edit/display casts.
- Fixed completed-work detection to use the V2 `Completed` work status enum value.
- Replaced LibraryList's selected-item plus three-booleans overlay state with one active overlay state, mounting only the requested view/edit/delete overlay and removing stale commented scroll code.
- Fixed edit-form taxonomy seeding so the multiselect displays direct assignments, not inferred effective terms.
- Fixed taxonomy relation create/delete affected-work detection to rebuild works whose effective taxonomy includes the relation source term, including inferred dependents.
- Fixed homepage total-word stats by returning totalWordsRead from primary source word counts and removing stale UI-side coercion commentary.
- Removed the duplicate view.getStats router and kept public library stats under library.getStats.
- Removed unused library.delete and its deleteLibraryEntry helper so V2 has one live library work deletion path through work.delete.
- Replaced route-name substring cache detection with an explicit allowlist for cacheable public library queries.
- Removed unused work.sourceOptions and work.statusOptions admin queries.
- Fixed taxonomy exact-match checks to use normalized labels across multiselect canCreate, quick-create, create, and update paths; search now groups by term and orders by max label similarity so each term appears once.
- Fixed edit-form rating defaults for unrated works and removed redundant rating string conversion on submit.
- Marked mobile quick-progress form updates as dirty/touched/validated when the stepper changes current chapter.
- Invalidated library read models after taxonomy term deletion and relation create/delete mutations that affect effective taxonomy stats.
- Replaced effective taxonomy relation reason cast with taxonomyEffectiveReasonEnum parsing at the rebuild boundary.
- Validation passed: bun run typecheck.
- Validation passed: bunx biome check src scripts.
- Validation passed: git diff --check.
```

Deferred:

```text
- Full bun run lint is blocked by pre-existing repository-scope issues outside touched app files: biome.json deprecated linter.recommended config and parse errors in .agents/skills/typescript-best-practices/assets/tsconfig-presets/strict.json. Scoped src/scripts Biome gate passes.
- Broader V2 review targets remain for future slices: mutation transaction shape, stats query profiling, form DTO boundaries, and visual polish.
```
