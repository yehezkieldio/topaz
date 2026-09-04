# Quality Gates

## Automated Checks (must pass before a slice is considered done)

```text
bun run check       (Ultracite on Oxlint + Oxfmt)
bun run typecheck    (tsgo)
grep -rE "@trpc/|next-auth|react-hook-form" src/     -> must return nothing
find . -maxdepth 1 -name "biome.json*"               -> must return nothing
  (a leftover Biome config alongside oxlint.config.ts means the migration
  wasn't a hard cut -- see 02_stack/00_stack_contract.md)
```

## Manual Verification Flow (per slice, in the browser)

```text
1. Load /library cold (no cache) -- confirm the static shell (nav, filters,
   search input) paints before results, and results stream in behind a skeleton
   that matches real content dimensions.
2. Type in the search box -- confirm no full-page reload/flash, stale results
   visibly fade rather than snap to a skeleton.
3. Scroll to the bottom of the list -- confirm the next page loads without a
   layout jump, and scroll position is preserved.
4. Toggle favorite on an item twice quickly -- confirm the final state matches
   the last click, not a race-lost intermediate state.
5. Sign in as the admin, attempt a mutation -- succeeds. Sign in (or inspect via
   a forged session) as a non-admin role -- mutation is rejected server-side, not
   just hidden in the UI.
6. Submit the create/edit work form with an invalid field -- confirm server-side
   validation errors surface via the useActionState/mergeForm path, not just
   client-side.
7. Trigger a mutation on one work, then load a different, unrelated work's page
   -- confirm its cache was not invalidated (e.g. via a request-count/log check
   that the unrelated page served from cache, not a fresh DB hit).
```

## Formal Test Coverage

```text
- Server Action unit tests for authorization checks (admin vs. non-admin reject).
- Server Action unit tests for cursor pagination correctness (page boundaries,
  empty results, single-item results).
- A scripted end-to-end flow (Playwright or the existing verify-script pattern,
  ported off tRPC) covering: browse -> filter -> search -> favorite -> create work.
```
