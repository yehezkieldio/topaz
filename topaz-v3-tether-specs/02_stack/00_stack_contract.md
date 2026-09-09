# Stack Contract

## Hosting

```text
Vercel Free tier      - serverless functions, no long-running processes
Supabase Free tier     - Postgres, pauses after 7 days idle, Supavisor pooler required
```

Consequences:

```text
- All DB access from serverless/edge functions goes through the Supavisor pooler in
  transaction mode (port 6543), not the direct connection (port 5432).
- Use postgres.js or pg with prepare: false against the pooler.
- No bundled Redis. Cache layer is Next.js Cache Components' own data cache.
- App is mounted at /library inside an existing personal website, not a standalone
  deployment -- it shares the site's root layout, theming, and domain.
```

## Dependencies

| Layer | Choice |
|---|---|
| API/request layer | none -- Server Components + Server Actions + Route Handlers |
| Client server-state | TanStack Query (plain @tanstack/react-query, queryFn calls Server Actions/Route Handlers directly) |
| List virtualization | @tanstack/react-virtual, integrated with useInfiniteQuery |
| Auth | better-auth + its own Drizzle adapter, admin plugin for RBAC |
| Forms | @tanstack/react-form + @tanstack/react-form-nextjs |
| URL state | nuqs |
| Client UI state | Zustand, scoped strictly to cross-component client UI state |
| Selection state | typed include/exclude Set model, see 06_library/03_row_selection.md |
| ORM | Drizzle ORM, relations() defined for every table |
| Database | PostgreSQL via Supabase (Supavisor pooler) |
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

## Why These Choices

See `10_adr/` for the full reasoning per decision. Summary:

```text
no API router    -> Server Components already give typed, zero-boilerplate reads;
                   Server Actions already give typed, zero-boilerplate mutations.
                   A router/procedure layer adds indirection without adding safety.

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
