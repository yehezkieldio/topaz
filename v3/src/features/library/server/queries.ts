import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";

import { db } from "@/server/db/client";
import {
  contributor,
  libraryEntry,
  readingState,
  sourcePlatform,
  taxonomyTerm,
  work,
  workContributor,
  workSource,
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
  authorName: string | null;
  description: string | null;
  summary: string | null;
  sourcePlatformName: string | null;
  wordCount: number | null;
  latestChapterCount: number | null;
  status: (typeof libraryEntry.status.enumValues)[number];
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
}

/**
 * Word-similarity (`<%`) rather than plain similarity (`%`): it matches when
 * the search term is similar to *any substring* of the title, which is a
 * much closer approximation of the old ILIKE "contains" behavior than full-
 * string similarity would be -- and it still uses the title's GIN trgm
 * index (work_title_trgm_idx), unlike ILIKE.
 *
 * `search` also matches against effective taxonomy term names -- tags don't
 * have their own filter UI (they can grow without bound), so the one search
 * box is the only way to narrow by tag as well as by title.
 */
const libraryFilterSpec: FilterSpec<LibraryListFilters> = {
  contentRating: (value) => eq(work.contentRating, value),
  minRating: (value) => gte(readingState.rating, value),
  publicationStatus: (value) => eq(work.publicationStatus, value),
  search: (value) => sql`(
    ${value} <% ${work.title}
    or exists (
      select 1 from ${workTaxonomyEffective}
      inner join ${taxonomyTerm} on ${taxonomyTerm.id} = ${workTaxonomyEffective.taxonomyTermId}
      where ${workTaxonomyEffective.workId} = ${work.id}
        and ${value} <% ${taxonomyTerm.name}
    )
  )`,
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

interface FetchLibraryListArgs {
  cursor?: string;
  limit?: number;
  search?: string;
  status?: (typeof libraryEntry.status.enumValues)[number];
  minRating?: number;
  sourcePlatformId?: string;
  contentRating?: ContentRating;
  publicationStatus?: PublicationStatus;
}

const fetchLibraryList = async ({
  contentRating,
  cursor,
  limit,
  minRating,
  publicationStatus,
  search,
  sourcePlatformId,
  status,
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
      minRating,
      publicationStatus,
      search: sanitizedSearch ?? undefined,
      sourcePlatformId,
      status,
    },
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
        // SAFETY: decodeCursor already rejected any cursor whose sortBy
        // doesn't match SORT_BY ("updatedAt"); every cursor minted for that
        // sort encodes libraryEntry.updatedAt.toISOString() as sortValue
        // (see the mappedRows/paginateRows below), so it's always a string
        // here even though CursorPayload's sortValue is a wider union.
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

  /** One row per work: its earliest-added source, for a compact source pill. */
  const primarySourceAgg = db
    .selectDistinctOn([workSource.workId], {
      chapterCount: workSource.chapterCount,
      sourcePlatformName: sourcePlatform.name,
      wordCount: workSource.wordCount,
      workId: workSource.workId,
    })
    .from(workSource)
    .innerJoin(
      sourcePlatform,
      eq(sourcePlatform.id, workSource.sourcePlatformId)
    )
    .orderBy(workSource.workId, asc(workSource.createdAt))
    .as("primary_source");

  /** One row per work: its first-listed author, for the byline. */
  const primaryAuthorAgg = db
    .selectDistinctOn([workContributor.workId], {
      authorName: contributor.name,
      workId: workContributor.workId,
    })
    .from(workContributor)
    .innerJoin(contributor, eq(contributor.id, workContributor.contributorId))
    .where(eq(workContributor.role, "author"))
    .orderBy(workContributor.workId, asc(contributor.name))
    .as("primary_author");

  const rows = await db
    .select({
      authorName: primaryAuthorAgg.authorName,
      contentRating: work.contentRating,
      currentChapter: readingState.currentChapter,
      description: work.description,
      latestChapterCount: primarySourceAgg.chapterCount,
      libraryEntryPublicId: libraryEntry.publicId,
      publicationStatus: work.publicationStatus,
      rating: readingState.rating,
      readingStateVersion: readingState.version,
      sortTitle: work.sortTitle,
      sourcePlatformName: primarySourceAgg.sourcePlatformName,
      status: libraryEntry.status,
      summary: work.summary,
      taxonomyTerms: taxonomyAgg.terms,
      title: work.title,
      updatedAt: libraryEntry.updatedAt,
      version: libraryEntry.version,
      wordCount: primarySourceAgg.wordCount,
      workPublicId: work.publicId,
    })
    .from(libraryEntry)
    .innerJoin(work, eq(libraryEntry.workId, work.id))
    .leftJoin(readingState, eq(readingState.libraryEntryId, libraryEntry.id))
    .leftJoin(taxonomyAgg, eq(taxonomyAgg.workId, work.id))
    .leftJoin(primarySourceAgg, eq(primarySourceAgg.workId, work.id))
    .leftJoin(primaryAuthorAgg, eq(primaryAuthorAgg.workId, work.id))
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
    // SAFETY: taxonomyAgg's raw sql`json_agg(json_build_object('id', ...,
    // 'label', ...))` above builds this JSON itself with exactly
    // TaxonomyChip's two fields (coalescing to '[]' when there are none),
    // so the shape is guaranteed by the query, not by anything untrusted.
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
