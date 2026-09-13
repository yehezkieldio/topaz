# ADR-0010: @libsql/client Over bun:sqlite

## Status

Accepted. Supersedes the driver choice in ADR-0006 and ADR-0008 (both remain correct on SQLite-over-Postgres and next-bun-compile packaging; only the specific driver changes).

## Context

ADR-0006 chose `bun:sqlite` specifically because it's a Bun-runtime-native module rather than a dynamically-required native (N-API) addon -- reasoning that this class of dependency was the one most likely to break under `next-bun-compile`'s single-file bundling. That reasoning turned out to be about the wrong bundling step.

Running the actual toolchain (not just typechecking it) surfaced the real problem: Next.js's own build machinery -- `next dev`'s Turbopack dev server and `next build`'s page-data-collection phase alike -- loads route modules via **jest-worker**, either as a forked child process or a worker thread. Neither resolves `bun:sqlite`'s `bun:` protocol specifier, even though the outer `next dev`/`next build` process is genuinely running under Bun. This is not a bundling-into-the-final-binary problem (a plain `bun build --compile` handles `bun:sqlite` correctly, verified directly) -- it's that `next build` fails during Next's own core page-data-collection step, before `next-bun-compile`'s compile step is ever reached. `serverExternalPackages` and `experimental.workerThreads` were both tried and neither helps: the former only affects Node-style `node_modules` resolution (confirmed against Next's own bundled docs), and the latter just swaps which jest-worker execution mode fails the same way. Full investigation: `docs/BUN_SQLITE_NEXT_BUILD.md` in the app repo.

Net effect: as long as `bun:sqlite` was the driver, there was no path to a working `next dev` *or* a working compiled binary -- the exact opposite of what ADR-0006 was trying to buy.

## Decision

Use `@libsql/client` (local file mode, `file:` URL) with `drizzle-orm/libsql` instead of `bun:sqlite` with `drizzle-orm/bun-sqlite`. `@libsql/client` is a real npm package -- it's on Next's own `serverExternalPackages` default allow-list already -- so jest-worker's `require()` resolves it the same way it resolves `better-sqlite3` or `pg`. It's SQLite-file-compatible (same file format, same FTS5 module including the trigram tokenizer, same JSON1/math functions -- all re-verified against libsql's bundled SQLite build specifically, not assumed to carry over from bun:sqlite's).

## Consequences

```text
- src/server/db/client.ts and src/server/db/search-index.ts are the only
  files that changed. Every sqlite-core schema file, every feature's
  queries/actions, the oplog/apply/sync modules -- none of it changed,
  because the port only ever depended on SQLite semantics, not on which
  client library talks to the file.
- libsql's client API is uniformly async (unlike bun:sqlite's synchronous
  API) -- client.ts's startup pragma/FTS-index setup now runs via
  top-level await instead of synchronous calls, so every other module
  that imports `db` is still guaranteed setup has completed first.
- The specific "runtime-native, not a native addon" property bun:sqlite
  had is given up. @libsql/client ships prebuilt native bindings per
  platform (no compile-from-source step), which is a materially
  different -- and, empirically, actually workable -- risk profile than
  a node-gyp-based addon like better-sqlite3 would have been.
- Verified end to end, not just typechecked: a real `next dev` server
  serving `/`, a real POST to `/api/sync` returning a real signed,
  verified response, and a full two-device pairing + sync round over
  actual HTTP resulting in identical state on both devices -- see
  docs/BUN_SQLITE_NEXT_BUILD.md for the complete verification log.
```
