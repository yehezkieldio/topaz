# ADR-0005: Granular Cache Tags

## Status

Accepted.

## Decision

Every `"use cache"` boundary is tagged at the entity level it depends on (`work:{id}`, `library-entry:{id}`, `taxonomy-term:{id}`, etc.). Every mutation's `revalidateTag` call is scoped to only the tags it actually touched, and always passes an explicit `"max"` profile.

## Context

Blanket cache invalidation -- one or two broad tags swept on nearly every mutation -- is a shortcut that trades correctness for convenience: it's easy to write, and it silently defeats caching by making every write expensive and every unrelated read unnecessarily fresh. Next.js's Cache Components model supports per-entity tags natively via `cacheTag()`, and `revalidateTag(tag, profile)` takes an explicit staleness profile -- calling it without one forces an immediate blocking revalidation instead of stale-while-revalidate, which is deprecated behavior.

## Consequences

```text
- Query functions in features/*/queries.ts call cacheTag() with a specific,
  parameterized tag inside every "use cache" boundary -- never a shared, generic tag.
- Server Actions know exactly which entities they touched and revalidate only
  those tags, with the "max" profile.
- Verification of this is part of 05_quality/00_gates.md's manual flow: mutating
  one entity must not cause an unrelated entity's cached page to refetch.
```
