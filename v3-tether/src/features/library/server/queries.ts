import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
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
import { escapeLikeWildcards, sanitizeSearchText } from "@/server/query/search-text";

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
 * A plain LIKE substring match, case-insensitive via `title`'s COLLATE
 * NOCASE (03_data/00_schema_contract.md's citext translation) -- an interim
 * stand-in for the FTS5 trigram/bm25 path from
 * 07_backend/03_search_and_filtering.md, which searchTaxonomyTermsAction
 * (taxonomy/server/actions.ts) already uses. Wiring this list query through
 * work_fts (src/server/db/search-index.ts) the same way is real follow-up
 * work, not done here -- this at least searches correctly today rather
 * than emitting Postgres-only `<%` syntax that isn't valid SQL under
 * SQLite at all.
 *
 * `search` also matches against effective taxonomy term names -- tags don't
 * have their own filter UI (they can grow without bound), so the one search
 * box is the only way to narrow by tag as well as by title.
 */
const libraryFilterSpec: FilterSpec<LibraryListFilters> = {
  contentRating: (value) => eq(work.contentRating, value),
  minRating: (value) => gte(readingState.rating, value),
  publicationStatus: (value) => eq(work.publicationStatus, value),
  search: (value) => {
    const pattern = `%${escapeLikeWildcards(value)}%`;
    return sql`(
      ${work.title} like ${pattern} escape '\\'
      or exists (
        select 1 from ${workTaxonomyEffective}
        inner join ${taxonomyTerm} on ${taxonomyTerm.id} = ${workTaxonomyEffective.taxonomyTermId}
        where ${workTaxonomyEffective.workId} = ${work.id}
          and ${taxonomyTerm.name} like ${pattern} escape '\\'
      )
    )`;
  },
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

  // json_agg/json_build_object (Postgres) -> json_group_array/json_object
  // (SQLite's JSON1 equivalents). Term order within a work's chip list
  // isn't semantically load-bearing (unlike the keyset-paginated outer
  // query), so this drops the Postgres version's `order by name` inside
  // the aggregate rather than reach for a correlated-subquery workaround
  // just to preserve an ordering nothing depends on.
  const taxonomyAgg = db
    .select({
      terms: sql<string>`json_group_array(json_object('id', ${taxonomyTerm.publicId}, 'label', ${taxonomyTerm.name}))`.as(
        "terms"
      ),
      workId: workTaxonomyEffective.workId,
    })
    .from(workTaxonomyEffective)
    .innerJoin(
      taxonomyTerm,
      eq(taxonomyTerm.id, workTaxonomyEffective.taxonomyTermId)
    )
    .groupBy(workTaxonomyEffective.workId)
    .as("taxonomy_agg");

  // Postgres's DISTINCT ON has no SQLite equivalent -- a
  // row_number()-over-partition CTE, filtered to rn = 1, gets the same
  // "one row per group, picked by this order" result.
  /** One row per work: its earliest-added source, for a compact source pill. */
  const primarySourceAgg = db
    .select({
      chapterCount: sql<number | null>`ps.chapter_count`.as("chapter_count"),
      sourcePlatformName: sql<
        string | null
      >`ps.source_platform_name`.as("source_platform_name"),
      wordCount: sql<number | null>`ps.word_count`.as("word_count"),
      workId: sql<string>`ps.work_id`.as("work_id"),
    })
    .from(sql`(
      select
        ${workSource.workId} as work_id,
        ${workSource.chapterCount} as chapter_count,
        ${workSource.wordCount} as word_count,
        ${sourcePlatform.name} as source_platform_name,
        row_number() over (
          partition by ${workSource.workId} order by ${workSource.createdAt} asc
        ) as rn
      from ${workSource}
      inner join ${sourcePlatform} on ${sourcePlatform.id} = ${workSource.sourcePlatformId}
    ) ps`)
    .where(sql`ps.rn = 1`)
    .as("primary_source");

  /** One row per work: its first-listed author, for the byline. */
  const primaryAuthorAgg = db
    .select({
      authorName: sql<string | null>`pa.author_name`.as("author_name"),
      workId: sql<string>`pa.work_id`.as("work_id"),
    })
    .from(sql`(
      select
        ${workContributor.workId} as work_id,
        ${contributor.name} as author_name,
        row_number() over (
          partition by ${workContributor.workId} order by ${contributor.name} asc
        ) as rn
      from ${workContributor}
      inner join ${contributor} on ${contributor.id} = ${workContributor.contributorId}
      where ${workContributor.role} = 'author'
    ) pa`)
    .where(sql`pa.rn = 1`)
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
    // SAFETY: taxonomyAgg's raw sql`json_group_array(json_object('id', ...,
    // 'label', ...))` above builds this JSON text itself with exactly
    // TaxonomyChip's two fields, so the shape is guaranteed by the query,
    // not by anything untrusted. json_group_array returns a JSON-encoded
    // string column (unlike a driver that auto-deserializes jsonb), so it
    // needs an explicit parse here; null (no effective taxonomy terms --
    // the left join found nothing to aggregate) maps to an empty list.
    taxonomyTerms:
      typeof row.taxonomyTerms === "string"
        ? (JSON.parse(row.taxonomyTerms) as TaxonomyChip[])
        : [],
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
