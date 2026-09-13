# Stack Contract

## Hosting

```text
No shared server. Each device (currently: two laptops, one phone-reachable host)
runs its own copy of the app as a local Bun binary, built by next-bun-compile.
SQLite (@libsql/client) is the datastore -- one file per device, no network hop to a
database at all. Tailscale is the network fabric between devices for sync.
```

Consequences:

```text
- There is no pooler, no serverless cold start, no idle-pause, no egress cap --
  the "free-tier-conscious" posture from the Vercel/Supabase era is replaced by
  a "local-resource-conscious" posture: every byte and every allocation on the
  admin's own laptops/phone still counts, just against RAM/disk instead of a
  vendor's free-tier ceiling. See 07_backend/02_connections_and_scaling_limits.md.
- The app is "opened on demand," not always-on: the admin starts the binary when
  they want to use the library, it serves the UI locally, attempts sync against
  known peers on startup/shutdown, and there is no background daemon required on
  any device for correctness -- a peer that isn't running just doesn't sync this
  round, and catches up whenever it and another device are next both up.
- Any future public read-only embed of the library on a personal website is a
  separate, later concern -- it would read from one device's SQLite file (or a
  periodic export), not change the core local-first design.
```

## Dependencies

| Layer | Choice |
|---|---|
| API/request layer | none -- Server Components + Server Actions + Route Handlers |
| Client server-state | TanStack Query (plain @tanstack/react-query, queryFn calls Server Actions/Route Handlers directly) |
| List virtualization | @tanstack/react-virtual, integrated with useInfiniteQuery |
| Auth | better-auth + its own Drizzle adapter (sqlite provider), admin plugin for RBAC, local credential/passkey provider (no Discord/social OAuth -- see 02_stack/04_auth_and_authorization.md) |
| Forms | @tanstack/react-form + @tanstack/react-form-nextjs |
| URL state | nuqs |
| Client UI state | Zustand, scoped strictly to cross-component client UI state |
| Selection state | typed include/exclude Set model, see 06_library/03_row_selection.md |
| ORM | Drizzle ORM, relations() defined for every table, `drizzle-orm/libsql` driver |
| Database | SQLite via `@libsql/client` (ADR-0010), one file per device, WAL journal mode |
| Full-text/fuzzy search | SQLite FTS5, `trigram` tokenizer (replaces pg_trgm -- see 07_backend/03_search_and_filtering.md) |
| Sync substrate | Append-only oplog table + per-device Hybrid Logical Clock, exchanged over a signed HTTP Route Handler (see 08_sync/) |
| Peer transport/discovery | Tailscale (tailnet hostnames as peer addresses); no custom discovery service, no mDNS, no Bluetooth |
| Packaging | `next-bun-compile` Next.js Build Adapter -- `next build` emits one self-contained Bun executable per device, no `bun install` step on target devices |
| Fanfiction metadata fetch | Tier 1: a local Obscura (CDP) process; Tier 2: FicHub's public API -- see 09_fetch/00_metadata_fetch_tiers.md |
| Validation | Zod v4 + drizzle-zod |
| Rendering model | Cache Components: static shell + streamed holes, designed in from the start |
| UI kit | shadcn/ui + Tailwind v4 + Radix + lucide-react + next-themes |
| Tooling | Bun, Oxlint/Ultracite (+ Oxfmt), tsgo, Drizzle Kit |

## Linting and Formatting: Ultracite on Oxlint, Not Biome

Ultracite stays as the zero-config preset wrapper, but its backend moves from Biome to **Oxlint** (+ **Oxfmt** for formatting), configured via `oxlint.config.ts` extending `ultracite/oxlint/core` (plus `ultracite/oxlint/react` and `ultracite/oxlint/next` for this stack). `biome.jsonc` is deleted, not kept alongside the new config -- there is exactly one linter config in the repository, per the hard-cut posture (`01_principles/01_invariants.md`).

```text
- Type-aware linting is enabled via oxlint-tsgolint (Ultracite's --type-aware
  flag for the Oxlint backend), keeping type-aware rules available without
  reintroducing a second type-checking pass beyond tsgo.
- bun run check / bun run fix (via `ultracite check`/`ultracite fix`) work
  identically to before from the command-line surface -- this is a backend
  swap, not a workflow change for anyone running the scripts.
- Ultracite's code-standards rules (explicit-over-any typing, async/await
  correctness, React hook/accessibility rules, no console.log/debugger in
  production code, no dangerouslySetInnerHTML/eval()) apply exactly as before
  -- the rules are enforced by a different engine, not relaxed by this migration.
```

## Packaging: next-bun-compile

```text
- next.config.ts sets adapterPath: "next-bun-compile" (Next.js Build Adapter);
  no output: "standalone" needed, the adapter supersedes it.
- `next build` emits ./dist/app -- a single Bun executable, assets embedded,
  dev-only modules and non-turbo runtimes stripped. This is the shippable unit
  for every device; there is no separate "deploy" step beyond copying this
  one file over and running it.
- The database driver is @libsql/client, not bun:sqlite (ADR-0010) --
  bun:sqlite does not survive Next's jest-worker-based page-data-collection
  phase in dev *or* build, verified by actually running it, not assumed.
  @libsql/client is a real npm package (on Next's own serverExternalPackages
  default allow-list already) with prebuilt per-platform native bindings, no
  compile-from-source step -- a materially different risk profile than a
  node-gyp-based addon like better-sqlite3, and one that's actually verified
  to work end to end: a real `next dev` server, a real signed request to
  `/api/sync`, and a full two-device sync round over actual HTTP all confirmed
  working (docs/BUN_SQLITE_NEXT_BUILD.md in the app repo has the full log).
- No custom Bun.serve wrapper and no WebSocket server. The sync endpoint is an
  ordinary Route Handler (08_sync/01_transport_and_pairing.md), which
  next-bun-compile bundles into the same binary with zero extra plumbing.
```

## Why These Choices

See `10_adr/` for the full reasoning per decision. Summary:

```text
no API router    -> Server Components already give typed, zero-boilerplate reads;
                   Server Actions already give typed, zero-boilerplate mutations.
                   A router/procedure layer adds indirection without adding safety.

SQLite over       -> a single-user local-first app has no concurrent-writer problem
Postgres            a pooler solves, and it removes the entire hosting-constraint
                   category (idle pausing, connection caps, free-tier egress) that
                   motivated this rework in the first place.

oplog + HLC       -> the only conflict shape that exists is "the same user, editing
over CRDTs          from a different device, not at the same instant." Last-write-
                   wins by a per-device logical clock resolves that correctly and
                   is far cheaper to build, test, and debug than a CRDT library.

Tailscale over    -> a custom discovery service (mDNS, Bluetooth, or a hosted
custom discovery    rendezvous server) reintroduces exactly the hosting-and-
                   networking surface this rework exists to remove. Tailscale
                   already solves NAT traversal, discovery, and transport
                   encryption for a fixed set of trusted devices.

better-auth      -> native Drizzle adapter, admin plugin with real roles, so
                   authorization is an explicit, checkable field, not an
                   implicit side effect of who was allowed to sign in.

TanStack Form    -> first-class Standard Schema (Zod) support, and a documented
                   React 19 useActionState interop path via @tanstack/react-form-nextjs.

granular cache   -> every mutation revalidates only the entities it touched;
tags               there is no acceptable "invalidate everything to be safe" path.

typed selection   -> multiselect over a virtualized, paginated list cannot be a
model              plain array of ids without becoming O(n) per interaction and
                   incapable of expressing "select all 4000 matching, except these 3."
```
