# Non-Goals

Explicitly out of scope for V3. Listed so an agent does not "helpfully" add them.

```text
- Multi-tenancy, organizations, teams, or shared libraries. Topaz stays single-user.
  better-auth's org plugin is available in the library; it is not used here.

- A generic public API. There is no need for an external-facing REST/GraphQL surface.
  Route Handlers exist only where TanStack Query needs a fetchable endpoint for
  client-owned reads (infinite scroll, live search); they are not a general API.

- Re-adding tRPC "for type safety." Server Actions and cache()-wrapped query
  functions already give end-to-end type inference without a router/client split.

- A Redis or other external cache layer. Vercel Free + Supabase Free has no bundled
  cache service; Next.js's own Cache Components data cache covers this app's scale.

- Import jobs, external taxonomy references, participant parsing, or dirty queues.
  Not until the core flow works end to end.

- A denormalized library read index/materialized view. Indexed relational queries
  via Drizzle's db.query are the first and, at this scale, likely only implementation.

- A full design system or component library extraction. Components live in the app;
  they are not published or versioned separately.

- A standalone taxonomy admin page/route. Term creation, editing, merging, and
  relation management all happen inside library sheets and term-chip context
  menus -- see 06_library/05_taxonomy_in_sheets.md. If a future need for a
  dedicated browse-all-terms view arises, it is a new scoped feature request,
  not a default.

- Real-time/subscription features (live co-reading, presence, websockets). Nothing
  in the current feature set needs push updates; TanStack Query's refetch/staleness
  model is sufficient.

- Data migration tooling. There is no production data to migrate from anywhere.
```
