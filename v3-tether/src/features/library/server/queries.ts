import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
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
import {
  escapeLikeWildcards,
  FTS_MATCH_MIN_LENGTH,
  sanitizeSearchText,
  toFtsPhraseQuery,
} from "@/server/query/search-text";

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
 * The shared "does this row's title or body match" fragment -- built once,
 * used both as a WHERE membership check (libraryFilterSpec.search below)
 * and, unchanged, as the middle rung of buildSearchRank's confidence
 * ladder, so the two can never quietly drift out of sync with each other.
 *
 * FTS5 trigram MATCH against work_fts (title, description, summary --
 * server/db/search-index.ts, now actually maintained by create/update/
 * delete work actions via work-fts.ts, which it wasn't before). Below
 * FTS_MATCH_MIN_LENGTH a trigram can't be formed at all, so a LIKE
 * substring scan over title stands in instead, same reasoning as
 * taxonomy/server/actions.ts's searchTaxonomyTermsByFts/ByLike split.
 *
 * FTS5's MATCH/bm25() magic column resolution only recognizes the FTS
 * table's real name, not an alias (verified empirically -- see the
 * identical note on searchTaxonomyTermsByFts) -- work_fts is referenced
 * directly here, not aliased.
 */
const buildTitleOrBodyMatch = (value: string) =>
  value.length >= FTS_MATCH_MIN_LENGTH
    ? sql`${work.id} in (
        select w.id from work_fts
        inner join ${work} w on w.rowid = work_fts.rowid
        where work_fts match ${toFtsPhraseQuery(value)}
      )`
    : sql`${work.title} like ${`%${escapeLikeWildcards(value)}%`} escape '\\'`;

/**
 * Multi-tiered matching: three independent match sources (below), OR'd
 * together into one WHERE membership check. Tier 1: an exact
 * (case-insensitive, via title's COLLATE NOCASE) title match -- cheap, and
 * catches the single most common search shape (typing the title verbatim).
 * Tier 2: buildTitleOrBodyMatch above. Tier 3: effective taxonomy term
 * names -- tags don't have their own filter UI (they can grow without
 * bound), so the search box is the only way to narrow by tag too.
 */
const libraryFilterSpec: FilterSpec<LibraryListFilters> = {
  contentRating: (value) => eq(work.contentRating, value),
  minRating: (value) => gte(readingState.rating, value),
  publicationStatus: (value) => eq(work.publicationStatus, value),
  search: (value) => {
    const pattern = `%${escapeLikeWildcards(value)}%`;
    return sql`(
      ${work.title} = ${value} collate nocase
      or ${buildTitleOrBodyMatch(value)}
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

/**
 * A confidence-ladder rank for search mode: exact title match outranks a
 * title/body match, which outranks a taxonomy-only match, which outranks
 * no match at all (0 -- filtered out by libraryFilterSpec.search before
 * this ever matters, but the CASE still needs an else). Used only to pick
 * an ORDER BY when a search is active -- see fetchLibraryList's
 * isRankedSearch branch for why this intentionally doesn't try to also
 * satisfy the normal updatedAt-keyset cursor.
 */
const buildSearchRank = (value: string) =>
  sql<number>`
    case
      when ${work.title} = ${value} collate nocase then 2
      when ${buildTitleOrBodyMatch(value)} then 1
      else 0
    end
  `;

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

  const pageSize = resolvePageSize(limit);
  const sanitizedSearch = sanitizeSearchText(search);

  // A search query switches this page to relevance-ranked, single-page mode
  // (see the orderBy/limit branch below) -- the updatedAt keyset a normal
  // browse page paginates on doesn't mean anything once results are sorted
  // by match confidence instead, and a personal library's search result
  // count is small enough that "the top pageSize matches, no further
  // scrolling" is a real answer, not a limitation. Any cursor passed in
  // while a search is active is ignored: ranked mode never hands one back
  // (nextCursor is always null below), so the client never generates a
  // follow-up request with one while the search box stays populated.
  const isRankedSearch = sanitizedSearch !== null;
  const decoded = isRankedSearch
    ? null
    : decodeCursor(cursor, { sortBy: SORT_BY, sortOrder: SORT_ORDER });

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
    eq(libraryEntry.deleted, false),
    eq(work.deleted, false),
    ...filterConditions,
    isRankedSearch
      ? undefined
      : keysetCondition({
          // libraryEntry.updatedAt is a timestamp column -- its
          // driver-value mapper expects a Date, not the cursor's
          // JSON-safe ISO string.
          cursor: decoded && {
            id: decoded.id,
            // SAFETY: decodeCursor already rejected any cursor whose
            // sortBy doesn't match SORT_BY ("updatedAt"); every cursor
            // minted for that sort encodes
            // libraryEntry.updatedAt.toISOString() as sortValue (see the
            // mappedRows/paginateRows below), so it's always a string
            // here even though CursorPayload's sortValue is a wider
            // union.
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
      terms:
        sql<string>`json_group_array(json_object('id', ${taxonomyTerm.publicId}, 'label', ${taxonomyTerm.name}))`.as(
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

  // work.primarySourceId / work.primaryAuthorId are denormalized pointers,
  // maintained at write time by recomputeWorkPrimaryPointers
  // (server/db/primary-pointers.ts) on every write that can change which
  // work_source/work_contributor row is "first" for a work. Reading them
  // directly here turns what used to be a row_number()-over-partition scan
  // of the *entire* work_source/work_contributor tables, on every
  // cache-miss list fetch, into two plain indexed joins bounded by the
  // current page.
  const rows = await db
    .select({
      authorName: contributor.name,
      contentRating: work.contentRating,
      currentChapter: readingState.currentChapter,
      description: work.description,
      latestChapterCount: workSource.chapterCount,
      libraryEntryPublicId: libraryEntry.publicId,
      publicationStatus: work.publicationStatus,
      rating: readingState.rating,
      readingStateVersion: readingState.version,
      sortTitle: work.sortTitle,
      sourcePlatformName: sourcePlatform.name,
      status: libraryEntry.status,
      summary: work.summary,
      taxonomyTerms: taxonomyAgg.terms,
      title: work.title,
      updatedAt: libraryEntry.updatedAt,
      version: libraryEntry.version,
      wordCount: workSource.wordCount,
      workPublicId: work.publicId,
    })
    .from(libraryEntry)
    .innerJoin(work, eq(libraryEntry.workId, work.id))
    .leftJoin(readingState, eq(readingState.libraryEntryId, libraryEntry.id))
    .leftJoin(taxonomyAgg, eq(taxonomyAgg.workId, work.id))
    .leftJoin(workSource, eq(workSource.id, work.primarySourceId))
    .leftJoin(
      sourcePlatform,
      eq(sourcePlatform.id, workSource.sourcePlatformId)
    )
    .leftJoin(contributor, eq(contributor.id, work.primaryAuthorId))
    .where(condition)
    .orderBy(
      // SAFETY: isRankedSearch is only true when sanitizedSearch is
      // non-null (the check just above), so buildSearchRank always has a
      // real value here.
      ...(isRankedSearch
        ? [
            desc(buildSearchRank(sanitizedSearch as string)),
            ...orderByKeyset(
              libraryEntry.updatedAt,
              libraryEntry.publicId,
              SORT_ORDER
            ),
          ]
        : orderByKeyset(
            libraryEntry.updatedAt,
            libraryEntry.publicId,
            SORT_ORDER
          ))
    )
    .limit(isRankedSearch ? pageSize : pageSize + 1);

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

  // Ranked search mode fetched exactly pageSize rows (no +1 probe -- see
  // the limit() above), and never hands back a cursor: the top pageSize
  // matches by confidence is the whole answer, not page one of more.
  if (isRankedSearch) {
    return { items: mappedRows, nextCursor: null } satisfies LibraryListPage;
  }

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
