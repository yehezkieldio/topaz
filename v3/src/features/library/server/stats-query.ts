import "server-only";
import { eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";

import { db } from "@/server/db/client";
import {
  libraryEntry,
  readingState,
  work,
  workSource,
} from "@/server/db/schema";
import { workTaxonomyEffective } from "@/server/db/schema/taxonomy";

import { libraryStatsTag } from "./cache-tags";

export interface LibraryStats {
  workCount: number;
  completedCount: number;
  readingCount: number;
  pausedCount: number;
  droppedCount: number;
  favoriteCount: number;
  averageRating: number;
  totalChaptersRead: number;
  totalWordsRead: number;
  taxonomyTermCount: number;
}

const fetchAggregateStats = () => {
  const workTotals = db
    .select({
      wordCount: sql<number>`sum(${workSource.wordCount})`.as("word_count"),
      workId: workSource.workId,
    })
    .from(workSource)
    .groupBy(workSource.workId)
    .as("work_totals");

  return db
    .select({
      averageRating: sql<string>`coalesce(avg(${readingState.rating}), 0)`,
      completedCount: sql<number>`count(*) filter (where ${libraryEntry.status} in ('completed', 'completed_as_axed'))`,
      droppedCount: sql<number>`count(*) filter (where ${libraryEntry.status} in ('dropped', 'dropped_as_abandoned'))`,
      favoriteCount: sql<number>`count(*) filter (where ${libraryEntry.favorite})`,
      pausedCount: sql<number>`count(*) filter (where ${libraryEntry.status} = 'paused')`,
      readingCount: sql<number>`count(*) filter (where ${libraryEntry.status} = 'reading')`,
      totalChaptersRead: sql<string>`coalesce(sum(${readingState.currentChapter}), 0)`,
      totalWordsRead: sql<string>`coalesce(sum(work_totals.word_count), 0)`,
      workCount: sql<number>`count(distinct ${libraryEntry.workId})`,
    })
    .from(libraryEntry)
    .leftJoin(readingState, eq(readingState.libraryEntryId, libraryEntry.id))
    .leftJoin(workTotals, sql`work_totals."work_id" = ${libraryEntry.workId}`)
    .where(eq(libraryEntry.private, false));
};

const fetchTaxonomyTermCount = () =>
  db
    .select({
      taxonomyTermCount: sql<number>`count(distinct ${workTaxonomyEffective.taxonomyTermId})`,
    })
    .from(workTaxonomyEffective)
    .innerJoin(work, eq(work.id, workTaxonomyEffective.workId));

type AggregateRow = Awaited<ReturnType<typeof fetchAggregateStats>>[number];

const toLibraryStats = (
  row: AggregateRow | undefined,
  taxonomyTermCount: number
): LibraryStats => ({
  averageRating: Number(row?.averageRating ?? 0),
  completedCount: Number(row?.completedCount ?? 0),
  droppedCount: Number(row?.droppedCount ?? 0),
  favoriteCount: Number(row?.favoriteCount ?? 0),
  pausedCount: Number(row?.pausedCount ?? 0),
  readingCount: Number(row?.readingCount ?? 0),
  taxonomyTermCount,
  totalChaptersRead: Number(row?.totalChaptersRead ?? 0),
  totalWordsRead: Number(row?.totalWordsRead ?? 0),
  workCount: Number(row?.workCount ?? 0),
});

/**
 * Deliberately kept broad (single "library-stats" tag) per
 * 02_stack/03_caching_and_streaming.md -- this is an aggregate, not an
 * entity-scoped read, so per-row tagging would defeat the point of caching it.
 */
const fetchLibraryStats = async (): Promise<LibraryStats> => {
  "use cache";
  cacheTag(libraryStatsTag);
  cacheLife("hours");

  const [aggregate, taxonomy] = await Promise.all([
    fetchAggregateStats(),
    fetchTaxonomyTermCount(),
  ]);

  return toLibraryStats(
    aggregate.at(0),
    Number(taxonomy.at(0)?.taxonomyTermCount ?? 0)
  );
};

/**
 * The single shared library-stats access path -- called identically from the
 * /library page's stats hole and the personal-website homepage widget.
 */
export const getLibraryStats = cache(fetchLibraryStats);

export interface FeaturedWorkRow {
  libraryEntryPublicId: string;
  workPublicId: string;
  title: string;
  sortTitle: string;
}

const MAX_FEATURED = 6;

const fetchFeaturedWorks = async (): Promise<FeaturedWorkRow[]> => {
  "use cache";
  cacheTag(libraryStatsTag);
  cacheLife("hours");

  return await db
    .select({
      libraryEntryPublicId: libraryEntry.publicId,
      sortTitle: work.sortTitle,
      title: work.title,
      workPublicId: work.publicId,
    })
    .from(libraryEntry)
    .innerJoin(work, eq(work.id, libraryEntry.workId))
    .where(
      sql`${libraryEntry.isFeatured} = true and ${libraryEntry.private} = false`
    )
    .orderBy(
      sql`${libraryEntry.displayOrder} asc nulls last`,
      sql`${work.sortTitle} asc`
    )
    .limit(MAX_FEATURED);
};

export const getFeaturedWorks = cache(fetchFeaturedWorks);
