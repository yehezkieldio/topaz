# Agent Index

This directory is the implementation contract for the Topaz V2 rewrite.

## Operating Mode

Use this bundle to guide code changes in `/home/yehezkieldio/Documents/Workspace/topaz`.

Topaz V2 is expected to move quickly. Prefer complete vertical slices over perfect theoretical modeling.

## Required Posture

```text
hard cut
source-grounded
single canonical shape
hours-scale milestones
no compatibility layers
no parallel old/new domain model after cutover
```

## Read First

```text
README.md
00_context/00_project_summary.md
01_principles/00_design_philosophy.md
01_principles/01_invariants.md
02_data/00_schema_contract.md
03_implementation/00_roadmap.md
03_implementation/01_acceptance_criteria.md
04_quality/00_gates.md
```

## Implementation Rules

1. Replace old domain names with new domain names:
   - `story` becomes `work`
   - `progress` becomes `library_entry` plus `reading_state`
   - `story_taxonomy_term` becomes `work_taxonomy_assignment`
   - `taxonomy_alias` becomes `taxonomy_label`
2. Keep `reading_event` and `work_taxonomy_effective` in the first rewrite.
3. Rebuild effective taxonomy rows synchronously in the mutation path.
4. Use normal indexed joins first. Do not add `library_entry_index` in the first implementation.
5. Keep UI usable during the rewrite. A minimal working library is better than a complete backend with no path to use it.

## Done Means

The rewrite is not done when tables exist. It is done when a user can:

```text
create a work
attach a source URL
assign taxonomy terms
get inferred effective tags
update reading state
record reading events
browse/search/filter the library
admin edit/delete from the UI
```

