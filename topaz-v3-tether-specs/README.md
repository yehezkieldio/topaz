# Topaz V3 Canonical Specification

**Status:** actionable rewrite contract
**Canonical location:** `topaz/topaz-v3-specs`
**Intended reader:** human implementer, AI coding agent, reviewer

Topaz is a single-user, self-hosted reading tracker for fanfiction, webnovels, and online fiction, engineered from the ground up. No data migration path exists or is needed. Nothing in this spec references or depends on an earlier codebase.

The target product shape:

```text
personal fiction library
+ source-aware works
+ contributors
+ a taxonomy graph with typed relations and effective inferred tags
+ per-user library state and an append-only reading-event history
+ cheap, non-blocking aggregate stats
+ mounted at /library inside a personal website, on Vercel Free + Supabase Free
```

The engineering posture: this is deliberately over-engineered for its traffic. Correctness under concurrency, referential stability under virtualization, precise cache boundaries, and a real selection-state model are treated as first-class requirements, not nice-to-haves for a "just a personal app."

## Agent Ingestion Order

```text
1. AGENT_INDEX.md
2. 00_context/00_project_summary.md
3. 01_principles/00_design_philosophy.md
4. 01_principles/01_invariants.md
5. 02_stack/00_stack_contract.md
6. 02_stack/01_rsc_component_architecture.md
7. 02_stack/02_data_and_mutation_flow.md
8. 02_stack/03_caching_and_streaming.md
9. 02_stack/04_auth_and_authorization.md
10. 02_stack/05_advanced_react_patterns.md
11. 02_stack/06_effects_and_hooks_policy.md
12. 02_stack/07_typescript_conventions.md
13. 03_data/00_schema_contract.md
14. 06_library/00_architecture.md
15. 06_library/01_state_and_providers.md
16. 06_library/02_sheets_and_dialogs.md
17. 06_library/03_row_selection.md
18. 06_library/04_taxonomy_picker.md
19. 06_library/05_taxonomy_in_sheets.md
20. 06_library/06_mutation_lifecycle_and_transitions.md
21. 07_backend/00_composition.md
22. 07_backend/01_query_and_n_plus_one_policy.md
23. 07_backend/02_connections_and_scaling_limits.md
24. 07_backend/03_search_and_filtering.md
25. 07_backend/04_audit_logging.md
26. 04_implementation/00_roadmap.md
27. 04_implementation/01_acceptance_criteria.md
28. 05_quality/00_gates.md
29. 10_adr/ADR-0001-hard-cut-v3.md
```

Load remaining ADRs after that.

## Directory Map

```text
00_context/        Project summary and product shape
01_principles/     Design principles, invariants, and non-goals
02_stack/          Stack contract, RSC architecture, data flow, caching, auth,
                    advanced React engineering patterns
03_data/           Schema contract
06_library/         The library feature's architecture: providers, component tree,
                    sheets/dialogs, and the multiselect state model
07_backend/         Server-side composition, N+1 policy, connection limits,
                    search/filter/pagination architecture
04_implementation/ Roadmap and acceptance criteria
05_quality/        Validation gates
10_adr/            Accepted architecture decisions
```

## Canonical Decisions

```text
- Hard cut. No compatibility shims, no dual-write paths, no data migration.
- No API router framework. Reads go through Server Components or Server
  Actions/Route Handlers consumed by TanStack Query. There is no generated client.
- better-auth with real role-based admin authorization.
- TanStack Form via @tanstack/react-form-nextjs for the Server Action interop.
- Cache Components stay on. Every dynamic read lives inside a Suspense boundary;
  the page shell is part of the static shell, not the stream.
- Cache invalidation is per-entity (cacheTag per work/library-entry/taxonomy-term id).
- Zustand holds only genuine cross-component client UI state.
- Selection/multiselect state is a typed include/exclude model, never a raw
  toggled array.
- The taxonomy term picker (combobox + multiselect) is one shared state machine
  with two thin variants, never a multiselect abused as single-select.
- There is no standalone taxonomy admin page or route. Every taxonomy operation
  (assign, create, merge, manage relations) happens inside a library sheet or a
  term chip's own context menu.
- No query awaits inside a loop over already-fetched rows. Related data is
  hydrated via joined aggregation, Drizzle relations, or one page-level batch
  through a single shared loader -- never per-row.
- Cursor (keyset) pagination everywhere, never OFFSET/LIMIT page-number
  pagination, with a stable-id tie-breaker on every sort.
- All DB access goes through the Supavisor pooler in transaction mode, with a
  minimal per-invocation connection pool -- never a direct connection from a
  serverless function.
- A version conflict is a distinct, recoverable UI state, never folded into a
  generic error toast. Every mutation follows one fixed success sequence with
  no incidental side effects on unrelated state (e.g. clearing search on save).
- Sheets bound to a specific entity are keyed by that entity's id, forcing a
  remount on identity change -- never left to reuse stale form state.
- Stay single-user. No org/team/multi-tenant plumbing.
```
