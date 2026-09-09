# Query and N+1 Policy

## The Rule

No query function ever awaits a database call inside a loop over already-fetched rows. Every "this row also needs its taxonomy terms / contributors / relations" need is satisfied one of three ways, in order of preference:

```text
1. A single query with in-row aggregation (array_agg/json_agg over a JOIN,
   GROUP BY the parent key) when the child collection is small and always needed.

2. Drizzle's relational query API (db.query.work.findMany({ with: { ... } }))
   when the shape is a straightforward nested read and doesn't need custom
   pagination/filtering on the child collection itself.

3. A page-level batch: fetch the page of parent rows first, collect their ids,
   then one (or a small constant number of) queries scoped to
   inArray(parentId, collectedIds), grouped in application code into a
   Map<parentId, Child[]>. This is for cases (1) and (2) don't cover cleanly --
   e.g. a child collection that itself needs independent filtering/aggregation
   logic per source.
```

What's never acceptable: `for (const row of rows) { await db.select()... }`. That's an N+1 by construition, and it's exactly the shape that turns a 20-row page into 20+ round trips against a pooled connection that's already the scarcest resource in the stack (`02_connections_and_scaling_limits.md`).

## The Shared Batch Loader

Where option 3 applies, it goes through one generic utility instead of being hand-written per feature:

```typescript
// server/query/hydrate.ts
export async function hydrateByParent<TChild, TKey extends string>(
  parentIds: TKey[],
  fetchChildren: (ids: TKey[]) => Promise<(TChild & { parentId: TKey })[]>
): Promise<Map<TKey, TChild[]>> {
  if (parentIds.length === 0) return new Map();
  const rows = await fetchChildren(parentIds);
  const byParent = new Map<TKey, TChild[]>();
  for (const row of rows) {
    const bucket = byParent.get(row.parentId) ?? [];
    bucket.push(row);
    byParent.set(row.parentId, bucket);
  }
  return byParent;
}
```

Every "batch-fetch this child collection for a page of parents" need calls this one function. There is exactly one place the Map-grouping logic is written, not one copy per feature that each needs to be kept correct independently.

## Collapsing Round Trips, Not Just Avoiding Per-Row Queries

A page-level batch that fires two or three separate queries in parallel (`Promise.all`) is already correct -- it's O(1) round trips relative to page size, not O(n). But separate round trips still cost real budget on a pooled free-tier connection, so collapse them further where the shape allows it:

```text
- Two queries fetching two subsets of the same child table (e.g. "direct"
  assignments and "effective/inferred" assignments from the same taxonomy
  tables) collapse into one query with a UNION ALL and a discriminator column
  (is_direct boolean), grouped client-side into both buckets from one result set.
- A child collection that's small and always needed on every row (contributor
  names, a status label) belongs directly in the main query's SELECT via
  array_agg, not as a separate batched fetch at all -- reserve the batch-fetch
  pattern for child collections that are conditionally needed, independently
  filtered, or large enough that aggregating them inline would bloat every row
  of the main result set.
```

## Drizzle's Relational API Is Not a License to Fetch Everything

Option 2 (`db.query.work.findMany({ with: {...} })`) is convenient exactly because it hides the joins it generates -- which is also the risk. A `with` clause that nests every relation a table has "because it's there" produces the same wide, expensive join an ORM gets criticized for, just with better ergonomics than hand-written SQL. Every relational-API read specifies exactly the relations that specific read actually needs, not a generic "fetch the work with everything" helper reused everywhere regardless of what the caller displays. If two different reads of the same entity need different relation shapes (a list-row read needs contributor names and effective taxonomy; a detail-page read additionally needs work_source and reading_event history), they are two distinct query functions in `queries.ts`, not one over-fetching function with an unused-data cost paid by the cheaper caller.

## Aggregates Are Always One SQL Query

Stats (counts, sums, breakdowns by status) are computed via a single SQL aggregate query (`COUNT`, `SUM`, `CASE`-based conditional aggregation, or a `FILTER` clause) against the relevant tables -- never by fetching rows into application code and reducing them there. This matters doubly under the hosting constraints: pulling full row sets to sum them client-side both burns egress and does the database's own job worse than the database does it.

## Verifying the Policy

Before a new list/aggregate query is considered done:

```text
- EXPLAIN (ANALYZE, BUFFERS) it against a realistically-sized local dataset.
  Confirm it hits the trigram/composite indexes it should (Index Scan/Bitmap
  Index Scan on the expected index), not a Seq Scan on a table sized to matter.
- Count actual round trips for a representative request (page load with
  filters + taxonomy hydration) via the Postgres query log or Drizzle's own
  query logging in development. A library list page should be a small,
  constant number of queries regardless of how many rows are on the page.
```

This check is part of `05_quality/00_gates.md`'s manual verification flow for any new or changed list query.
