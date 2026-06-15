# Design Philosophy

## Small Personal Library, Not Enterprise Metadata

Topaz V2 should stay sized for a single-user self-hosted app. Do not add tables or infrastructure just because they are theoretically correct.

The right target is:

```text
lean relational model
directly useful graph inference
simple synchronous rebuilds
fast enough indexed joins
practical UI workflows
```

## Lean Does Not Mean Flat

The rewrite must preserve the high-value semantic upgrades:

```text
taxonomy relations
effective inferred tags
reading events
source-aware works
database URL uniqueness
```

These are not optional extras. They are the reason V2 exists.

## Build Vertical Slices

Each implementation slice should leave the app closer to usable:

```text
schema compiles
repository works
router works
UI can call it
acceptance can be manually verified
```

Avoid long backend-only schema marathons.

## Add Read Models Only After Proof

Do not build `library_entry_index` in phase 1. Normal joins over the V2 schema should be the first implementation. Add a denormalized read table only if real query plans or measured runtime prove it is needed.

