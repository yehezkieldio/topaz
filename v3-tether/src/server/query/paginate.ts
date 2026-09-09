import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { encodeCursor } from "./cursor";

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 24;

type SortDirection = "asc" | "desc";

/**
 * A decoded cursor's `sortValue` is always a JSON-safe primitive (the cursor
 * crosses the wire as a string), but the query comparison needs the sort
 * column's actual driver-mapped type -- a timestamp column's driver value
 * mapper calls `.toISOString()` and throws on a plain string. The caller
 * (which knows the column's real type) is responsible for coercing
 * `sortValue` before it reaches here; this type is intentionally `unknown`
 * to make that coercion an explicit, visible step at every call site.
 */
interface KeysetCursor {
  id: string;
  sortValue: unknown;
}

/**
 * The keyset (sortColumn, idColumn) > (cursor.sortValue, cursor.id) predicate
 * -- the stable-id tie-breaker is what makes pagination correct when
 * sortColumn has duplicate values across rows.
 */
export const keysetCondition = ({
  cursor,
  direction,
  idColumn,
  sortColumn,
}: {
  sortColumn: AnyPgColumn;
  idColumn: AnyPgColumn;
  direction: SortDirection;
  cursor: KeysetCursor | null;
}): SQL | undefined => {
  if (!cursor) {
    return;
  }

  const compare = direction === "asc" ? gt : lt;

  return or(
    compare(sortColumn, cursor.sortValue),
    and(eq(sortColumn, cursor.sortValue), compare(idColumn, cursor.id))
  );
};

export const orderByKeyset = (
  sortColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  direction: SortDirection
): SQL[] => {
  const order = direction === "asc" ? asc : desc;
  return [order(sortColumn), order(idColumn)];
};

export const resolvePageSize = (requested?: number): number => {
  if (!requested || requested <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(requested, MAX_PAGE_SIZE);
};

/**
 * Splits an over-fetched (limit + 1) row set into the page and the next
 * cursor. `getSortValue`/`getId` must read the same columns `keysetCondition`
 * and `orderByKeyset` were built from.
 */
export const paginateRows = <T>(
  rows: T[],
  limit: number,
  opts: {
    sortBy: string;
    sortOrder: SortDirection;
    getSortValue: (row: T) => string | number | boolean | null;
    getId: (row: T) => string;
  }
) => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  const nextCursor =
    hasMore && last
      ? encodeCursor({
          id: opts.getId(last),
          sortBy: opts.sortBy,
          sortOrder: opts.sortOrder,
          sortValue: opts.getSortValue(last),
        })
      : null;

  return { items, nextCursor };
};
