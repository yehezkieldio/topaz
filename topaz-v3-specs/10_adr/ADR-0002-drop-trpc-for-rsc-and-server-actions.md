# ADR-0002: No API Router Framework

## Status

Accepted.

## Decision

There is no tRPC, no REST/GraphQL router, no generated client. Reads happen through Server Components (initial render) and TanStack Query (client-owned re-fetching), with `queryFn` calling Server Actions or Route Handlers directly. Mutations happen through Server Actions.

## Context

A router/procedure framework's core value -- end-to-end type inference between server and client without hand-written contracts -- is already provided natively by Server Components and Server Actions: a Server Action's return type is inferred on the client with no code generation and no router tree to maintain. Adding a router layer on top would introduce indirection (procedures, middleware chains, a client adapter) that does not add type safety or logic organization beyond what plain typed functions in `features/*/queries.ts` and `features/*/actions.ts` already provide.

The one gap Server Components alone don't cover is client-triggered, re-fetchable reads (infinite scroll, live search). TanStack Query fills this directly, with its `queryFn` calling a Server Action or Route Handler -- no router layer required.

## Consequences

```text
- No generated client, no router tree, no procedure middleware chain to reason about.
- Plain typed functions in features/*/queries.ts and features/*/actions.ts ARE the
  contract -- there is no separate schema/contract layer to keep in sync with them.
- Client-side reads that need re-fetching go through TanStack Query explicitly.
- Authorization checks are written explicitly in each Server Action via a shared
  requireAdmin() helper, since there is no procedure middleware to inherit from.
```
