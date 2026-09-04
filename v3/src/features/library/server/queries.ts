import "server-only";
import { and, eq, ilike } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";

import { db } from "@/server/db/client";
import { libraryEntry, readingState, work } from "@/server/db/schema";
import { decodeCursor } from "@/server/query/cursor";
import { buildConditions } from "@/server/query/filters";
import type { FilterSpec } from "@/server/query/filters";
import {
  keysetCondition,
  orderByKeyset,
  paginateRows,
  resolvePageSize,
} from "@/server/query/paginate";
import { sanitizeSearchText } from "@/server/query/search-text";

import {
  libraryEntryTag,
  libraryListTag,
  readingStateTag,
  workTag,
} from "./cache-tags";

/**
 * `updatedAt` is a plain ISO string, not a Date -- this row shape crosses
 * both the RSC-to-Client-Component boundary (first page) and a JSON Route
 * Handler response (subsequent pages), and must be identical either way.
 */
export interface LibraryListRow {
  libraryEntryPublicId: string;
  workPublicId: string;
  title: string;
  sortTitle: string;
  status: (typeof libraryEntry.status.enumValues)[number];
  favorite: boolean;
  contentRating: (typeof work.contentRating.enumValues)[number];
  updatedAt: string;
  version: number;
  rating: number | null;
  readingStateVersion: number | null;
}

export interface LibraryListPage {
  items: LibraryListRow[];
  nextCursor: string | null;
}

const SORT_BY = "updatedAt";
const SORT_ORDER = "desc" as const;

interface LibraryListFilters {
  search?: string;
  status?: (typeof libraryEntry.status.enumValues)[number];
}

const libraryFilterSpec: FilterSpec<LibraryListFilters> = {
  search: (value) => ilike(work.title, `%${value}%`),
  status: (value) => eq(libraryEntry.status, value),
};

const fetchLibraryList = async ({
  cursor,
  limit,
  search,
  status,
}: {
  cursor?: string;
  limit?: number;
  search?: string;
  status?: (typeof libraryEntry.status.enumValues)[number];
}) => {
  "use cache";
  cacheLife("minutes");

  const decoded = decodeCursor(cursor, {
    sortBy: SORT_BY,
    sortOrder: SORT_ORDER,
  });
  const pageSize = resolvePageSize(limit);
  const sanitizedSearch = sanitizeSearchText(search);

  const filterConditions = buildConditions(
    { search: sanitizedSearch ?? undefined, status },
    libraryFilterSpec
  );

  const condition = and(
    eq(libraryEntry.private, false),
    ...filterConditions,
    keysetCondition({
      // libraryEntry.updatedAt is a timestamp column -- its driver-value
      // mapper expects a Date, not the cursor's JSON-safe ISO string.
      cursor: decoded && {
        id: decoded.id,
        sortValue: new Date(decoded.sortValue as string),
      },
      direction: SORT_ORDER,
      idColumn: libraryEntry.publicId,
      sortColumn: libraryEntry.updatedAt,
    })
  );

  const rows = await db
    .select({
      contentRating: work.contentRating,
      favorite: libraryEntry.favorite,
      libraryEntryPublicId: libraryEntry.publicId,
      rating: readingState.rating,
      readingStateVersion: readingState.version,
      sortTitle: work.sortTitle,
      status: libraryEntry.status,
      title: work.title,
      updatedAt: libraryEntry.updatedAt,
      version: libraryEntry.version,
      workPublicId: work.publicId,
    })
    .from(libraryEntry)
    .innerJoin(work, eq(libraryEntry.workId, work.id))
    .leftJoin(readingState, eq(readingState.libraryEntryId, libraryEntry.id))
    .where(condition)
    .orderBy(
      ...orderByKeyset(
        libraryEntry.updatedAt,
        libraryEntry.publicId,
        SORT_ORDER
      )
    )
    .limit(pageSize + 1);

  const mappedRows: LibraryListRow[] = rows.map((row) => ({
    ...row,
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : new Date(row.updatedAt).toISOString(),
  }));

  const tags = mappedRows.flatMap((row) => [
    libraryEntryTag(row.libraryEntryPublicId),
    workTag(row.workPublicId),
    readingStateTag(row.libraryEntryPublicId),
  ]);
  // libraryListTag is a page-shape tag, not an entity tag -- a newly created
  // work has no library-entry:{id}/work:{id} tag on this cache entry yet
  // (those didn't exist when this page was cached), so per-row tagging alone
  // can never invalidate a list on creation. Same deliberate-broadness
  // rationale as library-stats in 02_stack/03_caching_and_streaming.md.
  cacheTag(libraryListTag, ...tags);

  return paginateRows(mappedRows, pageSize, {
    getId: (row) => row.libraryEntryPublicId,
    getSortValue: (row) => row.updatedAt,
    sortBy: SORT_BY,
    sortOrder: SORT_ORDER,
  }) satisfies LibraryListPage;
};

export const getLibraryList = cache(fetchLibraryList);

export const preloadLibraryList = (
  args: Parameters<typeof getLibraryList>[0]
) => {
  void getLibraryList(args);
};
