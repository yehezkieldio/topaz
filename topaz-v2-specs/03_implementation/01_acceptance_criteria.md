# Acceptance Criteria

## P0 — Schema and Domain Foundation

Done when:

```text
14 V2 domain tables exist in Drizzle schema
old story/progress/story_taxonomy_term/taxonomy_alias shape is removed
source_platform and taxonomy_kind are tables, not Postgres enums
work_source has DB-level normalized URL uniqueness
reading_event exists
work_taxonomy_effective exists
foreign-key columns have indexes
schema exports are canonical and do not expose old domain tables
```

## P1 — Backend Vertical Slice

Done when:

```text
create work with primary source works
create/link contributor works
create library_entry and reading_state works
assign direct taxonomy terms works
taxonomy relation can infer effective terms
reading state update writes reading_event rows
library list query returns usable items
library search/filter query works over V2 tables
delete removes dependent rows correctly
```

## P2 — App Usability Slice

Done when:

```text
home page renders stats
library page renders entries
admin auth still gates writes
create sheet works
edit sheet works
delete dialog works
view sheet works
taxonomy picker uses V2 terms/labels
status/chapter/rating/notes updates persist
public browsing remains read-only
```

## P3 — Rewrite Quality Gate

Done when:

```text
bun run typecheck passes
bun run lint or bun run check passes
no old domain names remain in active code except migration/history docs
no full materialized view refresh happens after normal mutations
no denormalized library_entry_index exists unless backed by profiling evidence
README or local docs mention V2 setup/reset expectations
```

