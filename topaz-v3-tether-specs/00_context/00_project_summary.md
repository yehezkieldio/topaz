# Project Summary

Topaz is a single-user, self-hosted reading tracker for fanfiction, webnovels, and online fiction. One admin curates a library; the site is otherwise public and read-only. It is built to be embedded at `/library` inside a personal website, hosted on Vercel Free with Supabase Free for Postgres.

Prior iterations of this app exist and inform some of the domain modeling here, but this specification is self-contained: Topaz is being engineered from the ground up, and nothing here depends on, migrates from, or is constrained by an earlier codebase.

## Product Shape

```text
personal fiction library
+ source-aware works (a work can exist on multiple platforms, each with its own metadata)
+ contributors (authors, co-authors, translators)
+ a taxonomy graph (typed relations between terms, not flat tags)
+ effective inferred tags (direct + relation-inferred, materialized per work)
+ per-user library state, separate from the canonical work
+ an append-only reading-event history
+ cheap, non-blocking aggregate stats
```

## Engineering Posture

Topaz V3 is not a CRUD app wearing a framework. It is a deliberately over-engineered personal tool: the traffic and data volume are small, but the code is written as if it will be read, extended, and defended by someone who expects correctness under concurrency, referential stability under virtualization, and precise cache boundaries -- not "it works on my machine." See `01_principles/00_design_philosophy.md` for the full posture.

## Stack

```text
Next.js app router, React 19, React Compiler, Cache Components
Bun-first development
PostgreSQL via Supabase (Supavisor pooler), Drizzle ORM with relations() everywhere
Server Components + Server Actions as the primary data layer, no API router framework
TanStack Query for client-owned re-fetchable reads (infinite scroll, live search)
TanStack Virtual for the library list
TanStack Form (+ @tanstack/react-form-nextjs) for authoring flows
better-auth with role-based admin authorization
Zustand for cross-component client UI state only
nuqs for URL-synced filter/sort/search state
```
