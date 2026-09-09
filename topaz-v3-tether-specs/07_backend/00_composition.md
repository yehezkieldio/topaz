# Backend Composition

There is no router layer (`02_stack/00_stack_contract.md`), so the discipline that would normally live in procedure middleware has to live somewhere else: in a small set of shared, generic utilities that every feature's `queries.ts`/`actions.ts` builds on, instead of every feature hand-rolling its own cursor codec, filter builder, and batch-loading glue. This file specifies that shared layer.

## Layout

```text
server/
  db/
    client.ts                - the pooled connection, see 02_connections_and_scaling_limits.md
    schema/                  - Drizzle tables + relations(), one file per aggregate
  query/
    cursor.ts                 - generic opaque-cursor encode/decode (keyset pagination)
    filters.ts                - a typed WHERE-condition builder (AND-composition helper)
    hydrate.ts                 - the batched parent->children loader (see 01_query_and_n_plus_one_policy.md)
    paginate.ts                - createCursorPaginatedQuery(), the shared list-query shape
  auth/
    require-admin.ts           - the one shared authorization check (02_stack/04_auth_and_authorization.md)

features/
  library/server/{queries.ts,actions.ts,bulk-actions.ts,cache-tags.ts}
  taxonomy/server/{queries.ts,actions.ts,cache-tags.ts}
```

`server/query/*` is the only place generic data-access machinery lives. A feature's `queries.ts`/`actions.ts` compose these utilities with feature-specific schema and business rules; they do not reimplement cursor encoding, filter-condition assembly, or batch loading themselves. If a second feature needs the same shape of pagination or hydration a first feature already built inline, that inline code was wrong -- it belongs in `server/query/`.

## The Shape Every List Query Follows

```typescript
createCursorPaginatedQuery({
  baseQuery: (db) => db.select({...}).from(...).innerJoin(...).leftJoin(...),
  filters: (input) => buildConditions(input, filterSpec),   // server/query/filters.ts
  sortableColumns: { title: works.sortTitle, updatedAt: libraryEntries.updatedAt, ... },
  cursorKey: (row) => row.libraryEntryPublicId,
})
```

This is the same problem four times over (library list, taxonomy search, relation list, any future paginated read) previously solved four separate times with hand-rolled cursor encode/decode and sort-column switch statements per repository file. One generic implementation, parameterized by the base query, the sortable-column map, and the filter spec, replaces all four.

## The Shape Every Mutation Follows

```typescript
"use server";
export async function toggleFavoriteAction(libraryEntryId: string) {
  const session = await requireAdmin();
  const result = await db.transaction(async (tx) => { ... });
  revalidateTag(`library-entry:${libraryEntryId}`, "max");
  return result;
}
```

```text
1. requireAdmin() (or a public no-op for reads) -- always first, always explicit.
2. The actual write, in a transaction if it touches more than one table.
3. Scoped revalidateTag calls for exactly the entities touched (ADR-0005).
4. A typed return value -- the Server Action's inferred return type is the
   contract; there is no separate response schema to keep in sync with it.
```

## Feature Boundaries

Each feature's `server/queries.ts` and `server/actions.ts` are its public API -- the only files another feature is allowed to import from. Nothing else under `features/library/` or `features/taxonomy/` (internal helpers, schema-shaping utilities, component-local hooks) is imported from outside that feature's own folder, even though both live in the same repository and nothing technically stops a deep import.

```text
- features/library/server/ never imports features/taxonomy/server/ internals --
  it calls features/taxonomy/server/queries.ts's exported functions (e.g.
  resolving effective taxonomy for a set of works) the same way any external
  caller would, even though both live in the same codebase.
- No deep imports across a feature boundary (e.g. reaching into
  features/taxonomy/server/hydrate-helpers.ts from features/library/) --
  if a second feature needs something a first feature built for internal use,
  that logic is promoted to server/query/ (07_backend/00_composition.md's
  shared layer) or lib/, not imported across the boundary in place.
- Cross-feature writes that must be atomic (creating a work + assigning initial
  taxonomy terms) happen inside one Server Action that opens one transaction and
  calls into both features' lower-level write functions within it -- the
  transaction boundary is owned by the action that knows it needs one, not
  pushed down into each feature's individual write function.
```
