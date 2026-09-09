# Invariants

Non-negotiable rules for V3. Any implementation that violates one of these is wrong, regardless of whether it works.

## Architecture

```text
- No tRPC. No router, no procedure, no generated client, no client hook wrapping one.
- No NextAuth. Auth is better-auth only.
- No React Hook Form. Forms are TanStack Form (+ @tanstack/react-form-nextjs for the
  Server Action interop) only.
- page.tsx files are synchronous compositors. They arrange Suspense; they do not
  themselves await a dynamic read.
- Every dynamic read (searchParams, cookies, per-user data) is resolved inside a
  Suspense boundary owned by the component that needs it.
- Every reusable component that triggers a mutation accepts the mutation as an
  Action-suffixed prop and owns its own useOptimistic/useTransition internally.
```

## Data and Caching

```text
- Repository/query functions are per-aggregate modules, not one god file per domain
  (work, library-entry, taxonomy, reading-event stay separated).
- Every "use cache" boundary is tagged with cacheTag() at the entity level it depends
  on (work:{id}, library-entry:{id}, taxonomy-term:{id}), never a single blanket tag.
- Every revalidateTag() call from a Server Action passes an explicit profile
  ("max"), scoped to only the tags the mutation actually touched.
- Drizzle relations() are defined alongside every table from day one so the
  relational query API (db.query) is available without retrofitting.
```

## Auth

```text
- Authorization is a real role check (better-auth admin plugin, session.user.role),
  never a naming convention that duplicates an existing check under a different name.
- Role assignment happens through better-auth's own admin API, not a raw field update.
- The app stays single-user. One admin role exists; no org/team model is introduced.
```

## Frontend State

```text
- Zustand stores hold only state shared across components that is not server state.
- Referentially unstable values (fresh array/object/function literals) are never
  passed into a TanStack Virtual row renderer, a React.memo'd component, or a
  Context provider without going through useMemo/useCallback or a stable selector.
- Hooks are always called unconditionally; conditional behavior lives inside the
  hook via an enabled parameter, never via a conditional hook call site.
```

## Quality

```text
- typescript.ignoreBuildErrors is not set to true in next.config.ts.
- Every P0/P1 feature (03_data schema change, mutation, or page) ships with at least
  a manual verification script or an automated test before it counts as done.
```
