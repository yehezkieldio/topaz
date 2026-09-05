/**
 * The one shared batch loader for "fetch this child collection for a page of
 * parents" reads (option 3 in topaz-v3-specs/07_backend/01_query_and_n_plus_
 * one_policy.md) -- a single query scoped to inArray(parentId, parentIds),
 * grouped here into a Map so no feature hand-rolls its own grouping loop.
 *
 * Prefer options 1 (in-row array_agg/json_agg) or 2 (Drizzle's relational
 * `with`) first; reach for this only when the child collection needs
 * filtering/aggregation independent of the parent row's own query.
 */
export const hydrateByParent = async <
  TChild extends object,
  TKey extends string,
>(
  parentIds: TKey[],
  fetchChildren: (ids: TKey[]) => Promise<(TChild & { parentId: TKey })[]>
): Promise<Map<TKey, TChild[]>> => {
  if (parentIds.length === 0) {
    return new Map();
  }

  const rows = await fetchChildren(parentIds);
  const byParent = new Map<TKey, TChild[]>();
  for (const row of rows) {
    const bucket = byParent.get(row.parentId) ?? [];
    bucket.push(row);
    byParent.set(row.parentId, bucket);
  }
  return byParent;
};
