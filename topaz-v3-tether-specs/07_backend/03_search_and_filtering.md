# Search and Filtering

Search and filtering are the highest-variance part of the query surface -- free-text search, status/source/rating/word-count filters, and taxonomy-term filters (both direct and effective/inferred) all compose on the same list query. This file specifies how that composition stays typed, testable, and cheap.

## Filter Builder

`server/query/filters.ts` exports small, individually testable condition builders, composed by the feature's query function -- not one large inline `and(...)` block reconstructed by hand for every new filter added:

```typescript
type FilterSpec<TInput> = {
  [K in keyof TInput]?: (value: NonNullable<TInput[K]>) => SQL | undefined;
};

function buildConditions<TInput extends object>(input: TInput, spec: FilterSpec<TInput>): SQL[] {
  const conditions: SQL[] = [];
  for (const key of Object.keys(spec) as (keyof TInput)[]) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    const condition = spec[key]?.(value as NonNullable<TInput[typeof key]>);
    if (condition) conditions.push(condition);
  }
  return conditions;
}
```

A feature defines its own `FilterSpec` (e.g. `libraryFilterSpec = { status: (s) => inArray(...), minRating: (r) => gte(...), directTaxonomyTermIds: (ids) => exists(...) }`) as a declarative map, not an imperative chain of `if` statements mutating an array -- new filters are added by adding one entry, and each entry is unit-testable in isolation from the rest of the query.

## Free-Text Search

```text
- Trigram (pg_trgm) similarity/ILIKE search against citext columns, using the
  GIN indexes defined in 03_data/00_schema_contract.md -- no external search
  service at this scale.
- Input sanitization (strip control characters, cap length, collapse
  whitespace) happens once, in one shared function, applied identically
  wherever free-text search is accepted -- not reimplemented per feature.
- A minimum query length (2+ characters) is enforced before a search actually
  hits the database; shorter queries return an empty result immediately
  without a query, both because a 1-character trigram search is expensive and
  because it's rarely a useful result for the user.
- Search combines with structural filters (status, taxonomy, rating) in the
  same WHERE clause via the same filter-builder composition -- search is not a
  separate code path from filtering, it's one more entry in the same spec.
```

## Taxonomy Filtering: Direct vs. Effective

Filtering by taxonomy term has two distinct semantics that must stay distinguishable in both the query layer and the UI:

```text
directTaxonomyTermIds     -> only works with an explicit work_taxonomy_assignment
                             row for this term (an EXISTS subquery or a join
                             against work_taxonomy_assignment).

effectiveTaxonomyTermIds   -> works with this term in their materialized
                             work_taxonomy_effective set, i.e. direct OR
                             inferred through a taxonomy relation (an EXISTS
                             subquery or join against work_taxonomy_effective).
```

The default filter UI exposed to the user should filter on **effective** taxonomy (it's the more useful, inference-aware behavior and the entire reason the effective-taxonomy table exists) -- direct-only filtering is a secondary, more precise option for cases where inference produces too broad a result.

## Cursor Pagination

One generic keyset-cursor implementation (`server/query/cursor.ts`), used by every paginated list (library, taxonomy search results, relation lists):

```typescript
type CursorPayload = { id: string; sortValue: string | number | boolean | null; sortBy: string; sortOrder: "asc" | "desc" };

function encodeCursor(payload: CursorPayload): string { /* base64url(JSON.stringify(payload)) */ }
function decodeCursor(cursor: string | undefined): CursorPayload | null { /* parse + validate shape */ }
function cursorCondition(payload: CursorPayload, sortColumn: AnyColumn, idColumn: AnyColumn): SQL {
  // (sortColumn, id) > (cursorValue, cursorId) in the sort direction -- true keyset
  // pagination, not OFFSET, so performance doesn't degrade on deep pages.
}
```

Keyset (cursor) pagination, never `OFFSET`/`LIMIT` page-number pagination -- offset pagination degrades linearly with page depth (the database still has to scan and discard every skipped row) and is exactly the kind of cost that compounds badly on a free-tier compute budget. The sortable-column map (`{ title: works.sortTitle, updatedAt: libraryEntries.updatedAt, ... }`) is supplied per feature; the cursor codec and the comparison-condition logic are shared.

## Multi-Column Sort Requires a Tie-Breaker

Every sort order includes the row's stable id as a final tie-breaker column (`ORDER BY <sortColumn> <dir>, id <dir>`), and the cursor condition compares both. Sorting on a non-unique column alone (title, rating) without a tie-breaker produces skipped or duplicated rows across a page boundary whenever multiple rows share the same sort value -- a correctness bug, not just a performance one, and one that only shows up with real data at the boundary between two pages.
