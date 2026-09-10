# `bun:sqlite` vs. Next.js's build/dev pipeline

**Status: resolved.** The app now uses `@libsql/client` instead of `bun:sqlite` (ADR-0010 in `topaz-v3-tether-specs/10_adr/`). This doc is kept as the record of what was tried, why `bun:sqlite` doesn't work here, and the verification that the switch to `@libsql/client` actually fixes it -- not just typechecks, but a real `next dev` server, a real signed `/api/sync` request, and a full two-device sync round over actual HTTP, all confirmed working (see "Verified after switching to @libsql/client" at the bottom).

Checked GitHub issue oven-sh/bun#5382 first, per a direct request to try it before switching drivers -- it's an unrelated, already-resolved TypeScript type-declaration issue (missing `@types/bun`, fixed earlier in this same investigation) and has no bearing on the jest-worker/`bun:` protocol problem documented below.

The `bun:sqlite` failure below was reproduced and root-caused by actually running the commands, on Next 16.3.4, `next-bun-compile` 2.0.0, and both Bun 1.3.11 and 1.4.2 -- upgrading Bun did not change the outcome.

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

## The fix (applied)

Switch the database driver from `bun:sqlite` to **`@libsql/client`** in local-file mode. Concretely:
- `@libsql/client` is on Next's own `serverExternalPackages` default allow-list (confirmed in the bundled docs above) -- it's a real npm package jest-worker's `require()` can resolve normally, sidestepping this entire class of problem.
- It's SQLite-file-compatible and supports FTS5 (verify the trigram tokenizer specifically once switched -- this session verified trigram FTS5 against Bun's *bundled* SQLite build specifically, not libsql's).
- Drizzle has a first-class `drizzle-orm/libsql` driver with a very similar API surface to `drizzle-orm/bun-sqlite` -- `src/server/db/client.ts` is the main file that changes; the schema files (`sqlite-core` table definitions) do not need to change at all.
- This does give up the "bun:sqlite is a runtime built-in, not a native addon that might not bundle" rationale from ADR-0006/ADR-0008 -- but that rationale is moot now that we know `bun:sqlite` doesn't even survive Next's own build tooling, regardless of native-addon bundling risk. `@libsql/client` ships prebuilt native bindings per-platform (no compile-from-source step), which is a materially different risk profile than `better-sqlite3`'s node-gyp-based build.

**Implemented.** `src/server/db/client.ts` and `src/server/db/search-index.ts` were the only files that changed -- every schema file, every feature's queries/actions, and the whole oplog/apply/sync module set were unaffected, since none of it ever depended on which client library talks to the SQLite file. See "Verified after switching to @libsql/client" below for the confirmation this actually fixes the problem, and `topaz-v3-tether-specs/10_adr/ADR-0010-libsql-over-bun-sqlite.md` for the formal decision record.

## Other things discovered while root-causing this (fixed, unrelated to the above)

These were real bugs, independent of the bun:sqlite/Next issue, found while getting a clean `bun run build`/`bun run typecheck` and while running actual two-device sync tests:

1. **`enumCheck()`'s CHECK constraint used bound parameters** (`sql`${column} in (${sql.join(values.map(v => sql`${v}`), ...)})``) -- SQLite rejects parameters inside a CHECK constraint's DDL outright ("parameters prohibited in CHECK constraints"). Fixed to inline values as escaped SQL string literals via `sql.raw()` (safe here because every caller passes this module's own hardcoded value arrays, never external input).
2. **FTS5 external-content DELETE must run before the content row changes, not after.** `indexTermFts`'s delete-then-insert pattern, called *after* `UPDATE taxonomy_term SET name = ...`, corrupted the FTS5 shadow index (`SQLITE_CORRUPT_VTAB`, "database disk image is malformed") -- because FTS5's DELETE reads the content table's *current* row to compute which trigrams to remove, and by the time it ran, the content row already had the *new* name. Same error occurs deleting a rowid that was never indexed at all (the create path). Fixed by splitting into `insertTermFts` (create path, insert only) and `removeTermFromFts` (rename path, called *before* the content update, with `insertTermFts` called again after).
3. **FTS5's `MATCH`/`bm25()` magic column only resolves against the table's real name, not an alias.** `FROM taxonomy_term_fts fts WHERE fts MATCH ?` throws "no such column: fts"; the identical query against the unaliased table name works. Fixed by referencing `taxonomy_term_fts` directly instead of aliasing it to `fts`.
4. **`INSERT ... ON CONFLICT DO UPDATE` can't be used with a partial column set that omits a NOT NULL column** (e.g. a rename's diff has no `taxonomy_kind_id`) -- SQLite validates NOT NULL against the row an INSERT would produce *before* it resolves the conflict, so an upsert with a partial diff throws on the very first update it needs to apply, even though the row already exists. Fixed by splitting `applyRemoteOplogRow`'s per-table apply into an explicit existence check + branch (`upsertRow` in `src/server/sync/apply.ts`): INSERT only for a genuinely new row, plain `UPDATE ... SET` (which never validates omitted columns) for an existing one.
5. **Reference/seed tables (`taxonomy_kind`, `source_platform`) get independently-random ids per device.** Discovered running an actual two-device sync test: a `taxonomy_term` row created on device A references A's own randomly-generated "custom" `taxonomy_kind.id`; applying that oplog row on device B fails its foreign key, because B's independently-seeded "custom" kind has a *different* id. **Fixed** in `src/server/db/seed.ts`: each reference row now gets an explicit, slug-derived id (e.g. `taxonomy-kind:custom`, `source-platform:ao3`) instead of `idColumns()`'s `crypto.randomUUID()` default, so every device's seed script produces identical ids by construction -- these tables never need to go through the oplog at all.
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

The sync *algorithm* -- oplog, HLC ordering, apply, pairing -- is real and correct, verified against actual execution, not just typechecked. The blocker was entirely in getting a Next.js server (dev or the compiled binary) to actually serve it over HTTP, which is the `bun:sqlite` issue documented above.

## Verified after switching to `@libsql/client`

Confirmed by actually running each of these, not assumed to follow from the driver swap:

- `@libsql/client` supports the trigram FTS5 tokenizer, `json_valid`/`json_type`, and `floor()` -- the three SQLite features this schema depends on -- against libsql's own bundled SQLite build (3.45.1), independently of Bun's (3.51.2).
- `bun run typecheck` is clean (aside from the pre-existing, expected `LayoutProps` divergence between standalone `tsc` and Next's own build-time type generation -- see the note near the top of this doc's history).
- `bun run dev` actually serves requests: `GET /` returns 200 with real rendered content, and `POST /api/sync` reaches the route handler and returns a real (rejecting, as expected for an unpaired caller) 403 -- no `bun:sqlite`-style crash anywhere in the request path.
- The full two-device scenario, this time for real: device A run as an actual `next dev` server on port 4001 against its own SQLite file; a taxonomy term created directly against A's database; device B (a separate `bun` process, separate SQLite file) paired with A via a real pairing-code exchange (mutual -- both `known_peer` rows written); `syncWithPeer` run from B against A's *live* HTTP server -- a real signed POST to `http://127.0.0.1:4001/api/sync`, a real Ed25519 signature verified on A's side, a real response with the oplog row -- resulting in the term appearing on B with the correct name and version, and B's `known_peer.last_synced_hlc` checkpoint correctly advanced.

This is the actual point of the whole rework, working, over real HTTP, between two independent SQLite files. Everything upstream of this doc (schema, oplog, HLC, apply engine, pairing) was correct; this doc's story was entirely about getting a working transport underneath it.

## A related gap this testing surfaced (resolved)

Reference/seed tables (`taxonomy_kind`, `source_platform`) used to get independently-random `id` values on each device (via `crypto.randomUUID()` defaults). A `taxonomy_term` row created on one device would reference that device's own random id for, e.g., the "custom" kind; applying that row's oplog entry on another device would fail its foreign key, because that device's independently-seeded "custom" kind had a *different* id. The two-device test above only succeeded because both devices' `taxonomy_kind` rows were seeded with the same id by hand, as a test setup step.

Fixed: `src/server/db/seed.ts` now assigns each reference row a fixed, slug-derived id (e.g. `taxonomy-kind:custom`, `source-platform:ao3`) instead of a random one, so every device's seed script produces identical ids by construction, and these tables never need to go through the oplog at all.

## Pairing UI, verified end-to-end

With the driver switch and the seed-id fix in place, a pairing/sync UI was added at `/sync` (admin-only, redirects to `/auth` otherwise): a pairing-code card (QR code + copyable text code + fingerprint), a form to pair with a peer's code, a paired-peer list with unpair, and a sync-now button that triggers a round against every known peer. The local email/password auth UI (`auth-action-form.tsx`) was also rewritten -- it previously still called `authClient.signIn.social({ provider: "discord" })`, a leftover from before Discord OAuth was dropped, so nobody could actually sign in through the browser.

Verified against a real running `next dev` server (not just typechecked):

- `POST /api/auth/sign-up/email` and `/sign-in/email` both succeed against a fresh database, returning a real user object, a `set-auth-token` header, and a `set-cookie: better-auth.session_token=...` cookie.
- Signing up surfaced one more real bug: `account.issuer` was `.notNull()` in the schema, but better-auth's local credential flow never populates it (`issuer` is an OAuth-provider concept) -- every sign-up threw `NOT NULL constraint failed: account.issuer`. Fixed by making the column nullable (`src/server/db/schema/auth.ts`) and regenerating the migration.
- `GET /sync`, authenticated with the session cookie, returns 200 with the pairing card (including a real base64 `data:image/png` QR code), the pair-with-peer textarea, and the peer list/sync-now button -- no redirect to `/auth`.
- `GET /library`, same session, includes the new admin-only sync link (`href="/sync"`) in the header.
