# ADR-0001: Ground-Up Application Architecture

## Status

Accepted.

## Decision

Topaz is engineered as a self-contained application architecture: Server Components and Server Actions as the primary data layer, better-auth for authorization, TanStack Form for authoring, Cache Components for rendering/caching, and a purpose-built selection model for multiselect. No compatibility shims, dual-write paths, or migration tooling exist anywhere in the codebase.

## Context

Topaz has no production data or real users. This is the moment to build the application layer to the standard the domain deserves: a taxonomy graph with inference, source-aware works, and an event-sourced reading history are all non-trivial domain features that were previously underserved by thin, pass-through request handling, an authorization check that didn't actually check anything, and cache invalidation coarse enough to defeat its own purpose. Building the request layer, auth, forms, caching, and client state model correctly from the start costs little now and a great deal later.

## Consequences

```text
- Every decision in this spec is justified on its own terms, not as a delta from
  something else. There is nothing to migrate and nothing to stay compatible with.
- The bar for "done" on any slice includes: correct under concurrent mutation,
  referentially stable where it feeds a virtualized/memoized consumer, and
  precisely cache-tagged -- not just "renders correctly once."
- Repository/query logic is organized by aggregate and by read/write shape
  (features/*/queries.ts, features/*/actions.ts) from the first line written.
```
