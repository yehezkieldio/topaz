# Specification Manifest

| File | Purpose |
|---|---|
| `README.md` | Human entry point and canonical decisions |
| `AGENT_INDEX.md` | Agent ingestion path and implementation rules |
| `00_context/00_project_summary.md` | Product shape and engineering posture |
| `01_principles/00_design_philosophy.md` | Lean-but-rigorous design posture |
| `01_principles/01_invariants.md` | Non-negotiable architectural and domain rules |
| `01_principles/02_non_goals.md` | Explicitly deferred features and rejected shapes |
| `02_stack/00_stack_contract.md` | Full dependency list and hosting constraints |
| `02_stack/01_rsc_component_architecture.md` | Server/Client component boundaries, Suspense granularity, file shape |
| `02_stack/02_data_and_mutation_flow.md` | Reads via RSC/cache(), infinite scroll via TanStack Query, mutations via Server Actions |
| `02_stack/03_caching_and_streaming.md` | Cache Components usage, cacheTag scheme, revalidation, streaming shell design |
| `02_stack/04_auth_and_authorization.md` | better-auth setup, admin plugin, role guarding |
| `02_stack/05_advanced_react_patterns.md` | Concurrent-safe state, scheduling, referential stability, render budgets |
| `02_stack/06_effects_and_hooks_policy.md` | When an effect is the right tool, useEffectEvent, useOptimistic ordering, compound-component fit |
| `02_stack/07_typescript_conventions.md` | DistributiveOmit, assertNever exhaustiveness, derived field-error types, cast discipline |
| `03_data/00_schema_contract.md` | Final table target: columns, constraints, indexes, relations |
| `06_library/00_architecture.md` | Library feature module boundaries and component tree |
| `06_library/01_state_and_providers.md` | Provider composition, Zustand slices, context shape |
| `06_library/02_sheets_and_dialogs.md` | Sheet/dialog architecture, form-close guard, async state |
| `06_library/03_row_selection.md` | The include/exclude row-selection model and bulk-action flow |
| `06_library/04_taxonomy_picker.md` | The shared combobox/multiselect state machine for taxonomy terms |
| `06_library/05_taxonomy_in_sheets.md` | Why there is no standalone taxonomy page, and where each operation lives instead |
| `06_library/06_mutation_lifecycle_and_transitions.md` | Version-conflict recovery, mutation side-effect ordering, identity-keyed remounts, granular filter subscriptions |
| `07_backend/00_composition.md` | Shared query/mutation utilities and the feature-module contract they enforce |
| `07_backend/01_query_and_n_plus_one_policy.md` | The N+1 policy, the shared batch loader, and how to verify a query is cheap |
| `07_backend/02_connections_and_scaling_limits.md` | Pooler config and free-tier-conscious query posture |
| `07_backend/03_search_and_filtering.md` | Filter builder, trigram search, direct-vs-effective taxonomy filtering, cursor pagination |
| `07_backend/04_audit_logging.md` | Proxy-enforced audit-context pattern for version-tracked tables, added when the need arises |
| `04_implementation/00_roadmap.md` | Implementation slices |
| `04_implementation/01_acceptance_criteria.md` | P0-P3 acceptance criteria |
| `05_quality/00_gates.md` | Check commands and manual verification flow |
| `10_adr/ADR-0001-hard-cut-v3.md` | Decision to build a fresh application architecture |
| `10_adr/ADR-0002-drop-trpc-for-rsc-and-server-actions.md` | Decision against an API router framework |
| `10_adr/ADR-0003-better-auth-over-nextauth.md` | Decision on the auth library |
| `10_adr/ADR-0004-tanstack-form-over-react-hook-form.md` | Decision on the form library |
| `10_adr/ADR-0005-granular-cache-tags.md` | Decision on cache invalidation granularity |
| `GLOSSARY.md` | Canonical vocabulary |
