# Project Summary

Topaz is a single-user, local-first reading tracker for fanfiction, webnovels, and online fiction. One admin curates a library; the site is otherwise public and read-only where it's exposed. It runs as a local Bun binary on each of the admin's own devices (currently two laptops and a phone-reachable host) and stores its data in a per-device SQLite file, reconciled opportunistically with the admin's other devices over Tailscale -- not a shared, always-online server. Where a public read-only embed is still wanted (mounted at `/library` inside a personal website), that is a separate, later concern from the local-first core described here, not a hosting requirement the core design bends around.

Prior iterations of this app exist and inform some of the domain modeling here, but this specification is self-contained: Topaz is being engineered from the ground up, and nothing here depends on, migrates from, or is constrained by an earlier codebase.

## Why Local-First

Free Postgres hosting is scarce and constrained (connection caps, idle pausing, storage ceilings), and the admin's own workflow depends on tooling (Obscura, see below) that cannot run on a serverless platform at all -- it's a long-running native process, not a stateless function. Rather than design around a hosting ceiling, Topaz drops the shared-server model entirely: each device is a full, independent replica of the library, and devices do not need to be online together. This is **local-first, store-and-forward replication between a fixed set of trusted devices**, not general peer-to-peer software and not a CRDT-based collaborative system -- there is exactly one user, so the hard problem CRDTs solve (concurrent multi-actor merge) does not exist here. Conflict resolution is last-write-wins by a per-device Hybrid Logical Clock, which is sufficient and far simpler to reason about. See `08_sync/00_oplog_and_clock.md`.

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
Bun-first development and runtime end to end (bun:sqlite, no Node.js)
next-bun-compile packages each build into one self-contained Bun binary per device
SQLite (bun:sqlite) as the per-device datastore, Drizzle ORM with relations() everywhere
An append-only oplog + Hybrid Logical Clock as the sync substrate between devices
Server Components + Server Actions as the primary data layer, no API router framework
The sync endpoint is a plain Next.js Route Handler, not a persistent socket
TanStack Query for client-owned re-fetchable reads (infinite scroll, live search)
TanStack Virtual for the library list
TanStack Form (+ @tanstack/react-form-nextjs) for authoring flows
better-auth with role-based admin authorization, local credential/passkey provider only
Zustand for cross-component client UI state only
nuqs for URL-synced filter/sort/search state
Tiered fanfiction metadata fetch: a local Obscura process first, FicHub's API as fallback
```
