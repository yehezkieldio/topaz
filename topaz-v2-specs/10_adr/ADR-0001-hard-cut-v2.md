# ADR-0001: Hard-Cut V2 Rewrite

## Status

Accepted.

## Decision

Topaz V2 will replace the old domain model directly instead of preserving compatibility with the current `story`, `progress`, flat taxonomy, and materialized-view read model.

## Context

The current app is single-user and self-hosted. Legacy compatibility is not required. The current schema is workable, but it blocks the desired improvements:

```text
source-aware works
database URL uniqueness
taxonomy inference
reading history
event-derived stats
cleaner library queries
```

## Consequences

```text
- Drizzle migrations may be reset during the rewrite.
- Existing local data can be discarded unless explicitly exported first.
- Final implementation must not keep schema-v2 beside old schema.
- Routers and UI should adopt the new domain names.
```

