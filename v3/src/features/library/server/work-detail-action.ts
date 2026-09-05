"use server";

import { asc, eq } from "drizzle-orm";

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

export interface WorkDetailSource {
  sourcePlatformName: string;
  url: string;
  chapterCount: number | null;
  wordCount: number | null;
}

export interface WorkDetailTaxonomyTerm {
  id: string;
  label: string;
}

export interface WorkDetail {
  workPublicId: string;
  libraryEntryPublicId: string;
  title: string;
  description: string | null;
  summary: string | null;
  contentRating: (typeof work.contentRating.enumValues)[number];
  publicationStatus: (typeof work.publicationStatus.enumValues)[number];
  authorName: string | null;
  status: (typeof libraryEntry.status.enumValues)[number];
  rating: number | null;
  currentChapter: number | null;
  sources: WorkDetailSource[];
  taxonomyTerms: WorkDetailTaxonomyTerm[];
}

/**
 * Feeds the read-only "view work" sheet -- unlike getWorkEditDetailAction,
 * this is not admin-gated: it's the same public-safe data the library list
 * already renders, just fuller (description, sources, all taxonomy terms).
 * Scoped by libraryEntryPublicId (not workPublicId) so the `private` guard
 * that already hides private entries from the list also applies here.
 */
export const getWorkDetailAction = async (
  libraryEntryPublicId: string
): Promise<WorkDetail | null> => {
  const [entryRow] = await db
    .select({
      contentRating: work.contentRating,
      currentChapter: readingState.currentChapter,
      description: work.description,
      libraryEntryPublicId: libraryEntry.publicId,
      private: libraryEntry.private,
      publicationStatus: work.publicationStatus,
      rating: readingState.rating,
      status: libraryEntry.status,
      summary: work.summary,
      title: work.title,
      workId: work.id,
      workPublicId: work.publicId,
    })
    .from(libraryEntry)
    .innerJoin(work, eq(libraryEntry.workId, work.id))
    .leftJoin(readingState, eq(readingState.libraryEntryId, libraryEntry.id))
    .where(eq(libraryEntry.publicId, libraryEntryPublicId))
    .limit(1);

  if (!entryRow || entryRow.private) {
    return null;
  }

  const [contributorRow] = await db
    .select({ name: contributor.name })
    .from(workContributor)
    .innerJoin(contributor, eq(contributor.id, workContributor.contributorId))
    .where(eq(workContributor.workId, entryRow.workId))
    .limit(1);

  const sourceRows = await db
    .select({
      chapterCount: workSource.chapterCount,
      sourcePlatformName: sourcePlatform.name,
      url: workSource.url,
      wordCount: workSource.wordCount,
    })
    .from(workSource)
    .innerJoin(
      sourcePlatform,
      eq(sourcePlatform.id, workSource.sourcePlatformId)
    )
    .where(eq(workSource.workId, entryRow.workId))
    .orderBy(asc(workSource.createdAt));

  const taxonomyRows = await db
    .select({ id: taxonomyTerm.publicId, label: taxonomyTerm.name })
    .from(workTaxonomyEffective)
    .innerJoin(
      taxonomyTerm,
      eq(taxonomyTerm.id, workTaxonomyEffective.taxonomyTermId)
    )
    .where(eq(workTaxonomyEffective.workId, entryRow.workId))
    .orderBy(asc(taxonomyTerm.name));

  return {
    authorName: contributorRow?.name ?? null,
    contentRating: entryRow.contentRating,
    currentChapter: entryRow.currentChapter,
    description: entryRow.description,
    libraryEntryPublicId: entryRow.libraryEntryPublicId,
    publicationStatus: entryRow.publicationStatus,
    rating: entryRow.rating,
    sources: sourceRows,
    status: entryRow.status,
    summary: entryRow.summary,
    taxonomyTerms: taxonomyRows,
    title: entryRow.title,
    workPublicId: entryRow.workPublicId,
  };
};
