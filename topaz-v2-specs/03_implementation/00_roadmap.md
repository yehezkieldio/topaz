# Roadmap

This roadmap is optimized for hours-scale implementation slices.

## Slice 0 — Cut Contract

Goal: make the repo agree on the rewrite target.

Work:

```text
- keep this spec as the active contract
- create or update GOAL/TODO only if needed
- decide whether to reset drizzle migrations immediately or after schema compiles
```

Acceptance:

```text
- no ambiguity about table target
- no plan to preserve old story/progress compatibility
```

## Slice 1 — Schema Hard Cut

Goal: replace old domain schema with V2 tables.

Work:

```text
- replace schema/story.ts with work/source/contributor tables or split into new files
- replace schema/progress.ts with library_entry/reading_state/reading_event
- replace schema/taxonomy.ts with kind/term/label/relation/assignment/effective
- update schema/index.ts exports
- remove old materialized view schema
- add constraints and indexes from table catalog
```

Acceptance:

```text
- Drizzle schema typechecks
- old story/progress/table names are gone from schema exports
- V2 domain tables are the only canonical shape
```

## Slice 2 — Seeds and Repository Primitives

Goal: create enough backend helpers to write and read the new domain.

Work:

```text
- seed source platforms
- seed taxonomy kinds
- create work with primary source
- create contributor and link to work
- create library entry and reading state
- assign taxonomy terms to work
- rebuild effective taxonomy for a work
```

Acceptance:

```text
- one repository call can create a usable library item
- assigning a relationship/fandom/tag can produce effective terms through relation rules
- URL uniqueness is enforced by DB constraints
```

## Slice 3 — tRPC Router Replacement

Goal: expose the V2 backend through domain routers.

Work:

```text
- replace story/progress routers with work/library/taxonomy routers
- keep view router only if it still has meaningful V2 responsibilities
- implement list library query over normal joins
- implement create/update/delete work entry flow
- implement update reading state flow
- write reading_event rows for meaningful state changes
```

Acceptance:

```text
- API can create/edit/delete a library work
- API can update status/chapter/rating/notes
- event rows are written when reading state changes
- API can list/search/filter library entries
```

## Slice 4 — UI Rewire

Goal: make the app usable again on the V2 API.

Work:

```text
- update library query hooks
- update create/edit forms to V2 fields
- update list item mapping
- update taxonomy multiselect to labels/kinds
- keep admin gating intact
- keep public read-only library browsing intact
```

Acceptance:

```text
- home page loads
- library page loads
- public user can browse/search/filter
- admin can create/edit/delete
- admin can update reading state
- inferred taxonomy filters work in UI or through API
```

## Slice 5 — Stats and Polish

Goal: restore useful stats without rebuilding the old materialized-view pattern.

Work:

```text
- compute basic counts from V2 tables
- compute reading-event based recent activity
- expose stats through router/server query
- preserve current visual quality where possible
```

Acceptance:

```text
- home stats work again
- library controls do not regress badly
- no full materialized view refresh is needed after normal mutations
```

