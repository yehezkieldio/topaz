# Topaz V3 Tether Canonical Specification

**Status:** actionable rewrite contract
**Canonical location:** `topaz/topaz-v3-tether-specs`
**Forked from:** `topaz/topaz-v3-specs` (the Vercel/Supabase-hosted design) -- see `10_adr/ADR-0006` onward for what changed and why
**Intended reader:** human implementer, AI coding agent, reviewer

Topaz is a single-user, local-first reading tracker for fanfiction, webnovels, and online fiction, engineered from the ground up. No data migration path exists or is needed. Nothing in this spec references or depends on an earlier codebase beyond the explicit fork note above.

The target product shape:

```text
personal fiction library
+ source-aware works
+ contributors
+ a taxonomy graph with typed relations and effective inferred tags
+ per-user library state and an append-only reading-event history
+ cheap, non-blocking aggregate stats
+ runs as a local Bun binary on each of the admin's own devices, one SQLite
  file per device, reconciled via store-and-forward sync over Tailscale --
  no shared server, no always-online requirement
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
26. 08_sync/00_oplog_and_clock.md
27. 08_sync/01_transport_and_pairing.md
28. 08_sync/02_packaging_and_lifecycle.md
29. 09_fetch/00_metadata_fetch_tiers.md
30. 04_implementation/00_roadmap.md
31. 04_implementation/01_acceptance_criteria.md
32. 05_quality/00_gates.md
33. 10_adr/ADR-0001-hard-cut-v3.md
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
07_backend/         Server-side composition, N+1 policy, local resource budget,
                    search/filter/pagination architecture
08_sync/            Oplog, Hybrid Logical Clock, sync transport, device
                    pairing/trust, and the "opened on demand" lifecycle
09_fetch/           Tiered fanfiction metadata fetch (Obscura, then FicHub)
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
- No shared server or shared database. Each device runs its own copy of the app
  against its own local SQLite (@libsql/client) file; data is reconciled between
  the admin's own devices via an oplog-based sync protocol, not shared at
  query time.
- Sync is store-and-forward, not real-time: an append-only oplog, a per-device
  Hybrid Logical Clock, and last-write-wins conflict resolution -- no CRDTs
  (there is one user, not concurrent multi-actor edits) and no persistent
  socket (an ordinary Route Handler, run opportunistically on app open/close).
  Devices are paired once (Ed25519 key exchange) and discovered via Tailscale;
  no custom discovery service.
- The app is packaged via next-bun-compile into one self-contained Bun binary
  per device, run "opened on demand" -- started when the admin wants to use
  it, no always-on background daemon.
- Auth is local credential/passkey only, no social OAuth -- a device must be
  able to unlock its own library with no internet reachable.
- Fanfiction metadata fetch is tiered: a local Obscura (CDP-driven headless
  browser) process first, FicHub's public API as fallback.
- A version conflict is a distinct, recoverable UI state, never folded into a
  generic error toast. Every mutation follows one fixed success sequence with
  no incidental side effects on unrelated state (e.g. clearing search on save).
- Sheets bound to a specific entity are keyed by that entity's id, forcing a
  remount on identity change -- never left to reuse stale form state.
- Stay single-user. No org/team/multi-tenant plumbing.
```
