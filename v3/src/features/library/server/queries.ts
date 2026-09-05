import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";

import { db } from "@/server/db/client";
import {
  libraryEntry,
  readingState,
  sourcePlatform,
  taxonomyTerm,
  work,
  workSource,
  workTaxonomyAssignment,
  workTaxonomyEffective,
} from "@/server/db/schema";
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

export interface TaxonomyChip {
  id: string;
  label: string;
}

type ContentRating = (typeof work.contentRating.enumValues)[number];
type PublicationStatus = (typeof work.publicationStatus.enumValues)[number];
type TaxonomyMode = "direct" | "effective";

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
  isFeatured: boolean;
  contentRating: ContentRating;
  publicationStatus: PublicationStatus;
  updatedAt: string;
  version: number;
  rating: number | null;
  currentChapter: number | null;
  readingStateVersion: number | null;
  taxonomyTerms: TaxonomyChip[];
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
  minRating?: number;
  sourcePlatformId?: string;
  contentRating?: ContentRating;
  publicationStatus?: PublicationStatus;
  favoriteOnly?: true;
  featuredOnly?: true;
}

/**
 * Word-similarity (`<%`) rather than plain similarity (`%`): it matches when
 * the search term is similar to *any substring* of the title, which is a
 * much closer approximation of the old ILIKE "contains" behavior than full-
 * string similarity would be -- and it still uses the title's GIN trgm
 * index (work_title_trgm_idx), unlike ILIKE.
 */
const libraryFilterSpec: FilterSpec<LibraryListFilters> = {
  contentRating: (value) => eq(work.contentRating, value),
  favoriteOnly: () => eq(libraryEntry.favorite, true),
  featuredOnly: () => eq(libraryEntry.isFeatured, true),
  minRating: (value) => gte(readingState.rating, value),
  publicationStatus: (value) => eq(work.publicationStatus, value),
  search: (value) => sql`${value} <% ${work.title}`,
  sourcePlatformId: (value) => sql`exists (
    select 1 from ${workSource}
    where ${workSource.workId} = ${work.id}
      and ${workSource.sourcePlatformId} = (
        select ${sourcePlatform.id} from ${sourcePlatform}
        where ${sourcePlatform.publicId} = ${value}
      )
  )`,
  status: (value) => eq(libraryEntry.status, value),
};

/** Any-of match against either the direct or the effective assignment table. */
const taxonomyTermsCondition = (
  taxonomyTermIds: string[],
  mode: TaxonomyMode
) => {
  const idsSql = sql.join(
    taxonomyTermIds.map((id) => sql`${id}`),
    sql`, `
  );
  const table =
    mode === "direct" ? workTaxonomyAssignment : workTaxonomyEffective;
  return sql`exists (
    select 1 from ${table}
    inner join ${taxonomyTerm} on ${taxonomyTerm.id} = ${table.taxonomyTermId}
    where ${table.workId} = ${work.id}
      and ${taxonomyTerm.publicId} in (${idsSql})
  )`;
};

interface FetchLibraryListArgs {
  cursor?: string;
  limit?: number;
  search?: string;
  status?: (typeof libraryEntry.status.enumValues)[number];
  minRating?: number;
  sourcePlatformId?: string;
  contentRating?: ContentRating;
  publicationStatus?: PublicationStatus;
  favoriteOnly?: boolean;
  featuredOnly?: boolean;
  taxonomyTermIds?: string[];
  taxonomyMode?: TaxonomyMode;
}

const fetchLibraryList = async ({
  contentRating,
  cursor,
  favoriteOnly,
  featuredOnly,
  limit,
  minRating,
  publicationStatus,
  search,
  sourcePlatformId,
  status,
  taxonomyMode = "effective",
  taxonomyTermIds,
}: FetchLibraryListArgs) => {
  "use cache";
  cacheLife("minutes");

  const decoded = decodeCursor(cursor, {
    sortBy: SORT_BY,
    sortOrder: SORT_ORDER,
  });
  const pageSize = resolvePageSize(limit);
  const sanitizedSearch = sanitizeSearchText(search);

  const filterConditions = buildConditions(
    {
      contentRating,
      favoriteOnly: favoriteOnly ? (true as const) : undefined,
      featuredOnly: featuredOnly ? (true as const) : undefined,
      minRating,
      publicationStatus,
      search: sanitizedSearch ?? undefined,
      sourcePlatformId,
      status,
    },
    libraryFilterSpec
  );

  if (taxonomyTermIds && taxonomyTermIds.length > 0) {
    filterConditions.push(
      taxonomyTermsCondition(taxonomyTermIds, taxonomyMode)
    );
  }

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

  const taxonomyAgg = db
    .select({
      terms: sql`coalesce(
        json_agg(
          json_build_object('id', ${taxonomyTerm.publicId}, 'label', ${taxonomyTerm.name})
          order by ${taxonomyTerm.name}
        ) filter (where ${taxonomyTerm.id} is not null),
        '[]'
      )`.as("terms"),
      workId: workTaxonomyEffective.workId,
    })
    .from(workTaxonomyEffective)
    .innerJoin(
      taxonomyTerm,
      eq(taxonomyTerm.id, workTaxonomyEffective.taxonomyTermId)
    )
    .groupBy(workTaxonomyEffective.workId)
    .as("taxonomy_agg");

  const rows = await db
    .select({
      contentRating: work.contentRating,
      currentChapter: readingState.currentChapter,
      favorite: libraryEntry.favorite,
      isFeatured: libraryEntry.isFeatured,
      libraryEntryPublicId: libraryEntry.publicId,
      publicationStatus: work.publicationStatus,
      rating: readingState.rating,
      readingStateVersion: readingState.version,
      sortTitle: work.sortTitle,
      status: libraryEntry.status,
      taxonomyTerms: taxonomyAgg.terms,
      title: work.title,
      updatedAt: libraryEntry.updatedAt,
      version: libraryEntry.version,
      workPublicId: work.publicId,
    })
    .from(libraryEntry)
    .innerJoin(work, eq(libraryEntry.workId, work.id))
    .leftJoin(readingState, eq(readingState.libraryEntryId, libraryEntry.id))
    .leftJoin(taxonomyAgg, eq(taxonomyAgg.workId, work.id))
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
    taxonomyTerms: (row.taxonomyTerms as TaxonomyChip[] | null) ?? [],
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
