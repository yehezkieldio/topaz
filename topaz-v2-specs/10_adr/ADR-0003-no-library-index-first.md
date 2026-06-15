# ADR-0003: No Denormalized Library Index First

## Status

Accepted.

## Decision

Topaz V2 will not create `library_entry_index` in the initial rewrite.

## Rationale

The current read-model problem is full materialized-view refresh after mutations, not proven join-scale failure. For a single-user app with hundreds or low-thousands of entries, indexed joins are the correct first implementation.

## Activation Criteria

Add a denormalized library index only when:

```text
real library query is slow
query plan shows join/search cost is the cause
target projection is clear
normal indexes cannot fix it cleanly
```

