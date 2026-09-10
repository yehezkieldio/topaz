# `bun:sqlite` vs. Next.js's build/dev pipeline

**Status as of this writing: unresolved, blocking.** `bun run dev` and `bun run build` both fail on every route that transitively imports `src/server/db/client.ts` (which is nearly every route in the app). This is not a guess -- it was reproduced and root-caused by actually running the commands, on Next 16.3.4, `next-bun-compile` 2.0.0, and both Bun 1.3.11 and 1.4.2.

## The failure

```
Error: Failed to load external module bun:sqlite: Error: Cannot find module 'bun:sqlite'
Require stack:
- .next/server/chunks/[root-of-the-server]__....js
- .next/server/chunks/[turbopack]_runtime.js
- .next/server/app/api/sync/route.js
- node_modules/next/dist/server/require.js
- node_modules/next/dist/server/load-components.js
- node_modules/next/dist/build/utils.js
- node_modules/next/dist/build/worker.js
- node_modules/next/dist/compiled/jest-worker/processChild.js   (or threadChild.js)
```

Happens in two places:
- `next dev` (Turbopack dev server), on the first request to any route touching the DB client.
- `next build`'s "Collecting page data" phase, which fails the build outright before it ever reaches `next-bun-compile`'s own compile step.

## Root cause (confirmed, not theorized)

Next.js's build tooling uses **jest-worker** to load each route module out-of-process for both dev-server setup and build-time page-data collection -- either as a forked child process (`processChild.js`) or, with `experimental.workerThreads: true`, a worker thread (`threadChild.js`). Both were tested. Both fail identically.

`bun:sqlite` is a Bun runtime built-in (a `bun:` protocol specifier), not an npm package. Whatever module-loading path jest-worker's child/thread uses to `require()` the target route module does not resolve `bun:` protocol specifiers -- even though the *outer* process is genuinely running under Bun (confirmed: `bun --version` inside the same shell, `bun run dev`/`bun run build` both launched via Bun). This is specific to jest-worker's forked/threaded execution context, not a general "Bun can't do this" limitation:

- A plain Bun script (`bun -e '...'`, or `bun --preload ... scripts/sync-cli.ts`) resolves `bun:sqlite` perfectly. Verified repeatedly this session -- the entire sync/pairing CLI test suite runs this way.
- `bun build --compile` (the actual primitive `next-bun-compile` uses for its final compilation step) also resolves and runs `bun:sqlite` correctly in the resulting binary -- verified with a standalone throwaway script compiled and executed.
- Only jest-worker's child-process/thread loading of a route module for Next's own build machinery fails.

## What was tried and didn't help

- `serverExternalPackages: ["bun:sqlite"]` -- no effect. Confirmed via Next's own bundled docs (`node_modules/next/dist/docs/.../serverExternalPackages.md`) that this option only affects Node-style `node_modules` package resolution (its default allow-list includes real packages like `better-sqlite3`, `@libsql/client`, `pg`); it has no mechanism for a non-npm `bun:` protocol specifier.
- `experimental.workerThreads: true` -- changes jest-worker from fork-based to thread-based children; the failure mode is identical (thread-based `threadChild.js` fails the same way processChild.js does).
- Upgrading `next-bun-compile` 0.1.1 → 2.0.0 -- no effect, and couldn't have helped: the failure happens during Next's own core build step (`next build`'s "Collecting page data"), before the adapter's own compile step ever runs.
- Upgrading Bun 1.3.11 → 1.4.2 -- no effect. Identical error, identical stack.

## Why this matters more than "dev is broken"

Because `next build` fails during Next's own core page-data-collection phase -- upstream of anything `next-bun-compile` controls -- **this blocks the compiled binary too, not just `next dev`.** There is currently no path from this codebase to a working `next-bun-compile` binary while `bun:sqlite` is the database driver.

## The real fix (recommended, not yet done)

Switch the database driver from `bun:sqlite` to **`@libsql/client`** in local-file mode. Concretely:
- `@libsql/client` is on Next's own `serverExternalPackages` default allow-list (confirmed in the bundled docs above) -- it's a real npm package jest-worker's `require()` can resolve normally, sidestepping this entire class of problem.
- It's SQLite-file-compatible and supports FTS5 (verify the trigram tokenizer specifically once switched -- this session verified trigram FTS5 against Bun's *bundled* SQLite build specifically, not libsql's).
- Drizzle has a first-class `drizzle-orm/libsql` driver with a very similar API surface to `drizzle-orm/bun-sqlite` -- `src/server/db/client.ts` is the main file that changes; the schema files (`sqlite-core` table definitions) do not need to change at all.
- This does give up the "bun:sqlite is a runtime built-in, not a native addon that might not bundle" rationale from ADR-0006/ADR-0008 -- but that rationale is moot now that we know `bun:sqlite` doesn't even survive Next's own build tooling, regardless of native-addon bundling risk. `@libsql/client` ships prebuilt native bindings per-platform (no compile-from-source step), which is a materially different risk profile than `better-sqlite3`'s node-gyp-based build.

This has **not been implemented** -- it's the recommended next step, pending a decision, since it touches ADR-0006/ADR-0008's stated rationale and deserves an explicit go-ahead rather than a silent swap.

## Other things discovered while root-causing this (fixed, unrelated to the above)

These were real bugs, independent of the bun:sqlite/Next issue, found while getting a clean `bun run build`/`bun run typecheck` and while running actual two-device sync tests:

1. **`enumCheck()`'s CHECK constraint used bound parameters** (`sql`${column} in (${sql.join(values.map(v => sql`${v}`), ...)})``) -- SQLite rejects parameters inside a CHECK constraint's DDL outright ("parameters prohibited in CHECK constraints"). Fixed to inline values as escaped SQL string literals via `sql.raw()` (safe here because every caller passes this module's own hardcoded value arrays, never external input).
2. **FTS5 external-content DELETE must run before the content row changes, not after.** `indexTermFts`'s delete-then-insert pattern, called *after* `UPDATE taxonomy_term SET name = ...`, corrupted the FTS5 shadow index (`SQLITE_CORRUPT_VTAB`, "database disk image is malformed") -- because FTS5's DELETE reads the content table's *current* row to compute which trigrams to remove, and by the time it ran, the content row already had the *new* name. Same error occurs deleting a rowid that was never indexed at all (the create path). Fixed by splitting into `insertTermFts` (create path, insert only) and `removeTermFromFts` (rename path, called *before* the content update, with `insertTermFts` called again after).
3. **FTS5's `MATCH`/`bm25()` magic column only resolves against the table's real name, not an alias.** `FROM taxonomy_term_fts fts WHERE fts MATCH ?` throws "no such column: fts"; the identical query against the unaliased table name works. Fixed by referencing `taxonomy_term_fts` directly instead of aliasing it to `fts`.
4. **`INSERT ... ON CONFLICT DO UPDATE` can't be used with a partial column set that omits a NOT NULL column** (e.g. a rename's diff has no `taxonomy_kind_id`) -- SQLite validates NOT NULL against the row an INSERT would produce *before* it resolves the conflict, so an upsert with a partial diff throws on the very first update it needs to apply, even though the row already exists. Fixed by splitting `applyRemoteOplogRow`'s per-table apply into an explicit existence check + branch (`upsertRow` in `src/server/sync/apply.ts`): INSERT only for a genuinely new row, plain `UPDATE ... SET` (which never validates omitted columns) for an existing one.
5. **Reference/seed tables (`taxonomy_kind`, `source_platform`) get independently-random ids per device.** Discovered running an actual two-device sync test: a `taxonomy_term` row created on device A references A's own randomly-generated "custom" `taxonomy_kind.id`; applying that oplog row on device B fails its foreign key, because B's independently-seeded "custom" kind has a *different* id. **Not yet fixed.** The right fix is likely giving these small, fixed, seeded reference tables deterministic ids (e.g. the slug itself, or a fixed UUID per seed entry) instead of `crypto.randomUUID()`, so every device's seed script produces identical ids by construction -- avoiding the need to sync these tables through the oplog at all. Needs a decision before implementing (it's a schema change to `idColumns()` usage for exactly these two tables, not the general case).
6. Several pre-existing Postgres-only SQL fragments left over from the Phase 1 schema port (not caught by earlier greps because they were embedded in raw `sql` template strings, not schema files): `db.execute()` (postgres.js-only) → `db.all()`/`db.get()`; `filter (where ...)` aggregates kept as-is (SQLite supports this); `extract(epoch from ...)` → plain integer-ms arithmetic (timestamps are already epoch milliseconds under the SQLite port); `percentile_cont() within group` (no SQLite equivalent) → median computed in JS over a small result set; `select distinct on (...)` (no SQLite equivalent) → `row_number() over (partition by ...)` CTE filtered to `rn = 1`; `json_agg`/`json_build_object` → `json_group_array`/`json_object`, parsed with `JSON.parse()` at the JS boundary since SQLite's JSON1 functions return text, not an auto-deserialized value the way some Postgres drivers do; a work-list free-text filter still using Postgres's `<%` word-similarity operator → a `LIKE` substring match pending the FTS5 rewrite `07_backend/03_search_and_filtering.md` describes.

## What was verified working, end to end, this session

Using `scripts/sync-cli.ts` and direct in-process calls (all under plain `bun`, sidestepping the Next.js issue above entirely):

- Full migration generation and application (`bun run db:generate`, then applying the resulting SQL directly) against a real SQLite file -- 23 tables, all constraints, all indexes.
- Device identity + Ed25519 keypair generation and persistence (`getDeviceIdentity`).
- Pairing code generation, encoding/decoding, and fingerprint computation.
- `createTaxonomyTermAction` → row insert + FTS5 index + oplog append, in one transaction.
- FTS5 trigram search (`searchTaxonomyTermsAction`) finding the term immediately after creation.
- `renameTermAction` → correct FTS5 re-index order + oplog append with the right column diff.
- FTS5 search finding the term under its *new* name after rename, confirming the index actually updated.
- A full two-device convergence test: create + rename on device A, oplog rows extracted, applied via `applyRemoteOplogRow` on an independent device B's SQLite file, resulting in **byte-for-byte identical final state** (name, slug, version) on both devices.
- Idempotency: re-applying the same oplog rows a second time (simulating an overlapping sync round) is a correct no-op, both for the base table state and for not duplicating oplog rows (the `hlc_timestamp` unique index deduplicates via `onConflictDoNothing()`).

The sync *algorithm* -- oplog, HLC ordering, apply, pairing -- is real and correct, verified against actual execution, not just typechecked. The blocker is entirely in getting a Next.js server (dev or the compiled binary) to actually serve it over HTTP, which is the `bun:sqlite` issue documented above.
