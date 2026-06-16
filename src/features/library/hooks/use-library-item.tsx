import { estimateWordCount, formatDate } from "#/lib/utils";
import type { RouterOutputs } from "#/trpc/react";

export type LibraryItem = RouterOutputs["library"]["all"]["data"][number];

export type LibraryItemValues = {
    totalChapters: number;
    currentChapter: number;
    hasValidChapterData: boolean;
    hasCurrentChapterOnly: boolean;
    progressPercentage: number;
    isComplete: boolean;
    hasWordCount: boolean;
    wordCount: string;
    hasValidUrl: boolean;
    hasNotes: boolean;
    hasDescription: boolean;
    lastUpdated: string | null;
    isNsfw?: boolean;
    hasTaxonomyTerms: boolean;
    hasReadingProgress: boolean;
    workVersion: number;
    libraryEntryVersion: number;
};

const PROGRESS_PERCENTAGE_MAX = 100;

export function getLibraryItemValues(item: LibraryItem): LibraryItemValues {
    const totalChapters = item.sourceChapterCount || 0;
    const currentChapter = Math.max(0, item.currentChapter || 0);
    const hasValidChapterData = totalChapters > 0 && currentChapter > 0;
    const hasCurrentChapterOnly = totalChapters === 0 && currentChapter > 0;
    const progressPercentage = hasValidChapterData
        ? Math.round((currentChapter / totalChapters) * PROGRESS_PERCENTAGE_MAX)
        : 0;
    const isComplete = item.workStatus?.toLowerCase() === "complete";
    const hasWordCount = (item.sourceWordCount ?? 0) > 0;
    const wordCount = estimateWordCount(item.sourceWordCount);
    const hasValidUrl = Boolean(item.sourceUrl?.trim());
    const hasNotes = Boolean(item.readingNotes?.trim());
    const hasDescription = Boolean(item.workDescription?.trim());
    const lastUpdated = formatDate(item.updatedAt);
    const isNsfw = item.workIsNsfw ?? false;

    const hasTaxonomyTerms = (item.taxonomyTerms?.length ?? 0) > 0;
    const hasReadingProgress = hasValidChapterData || hasCurrentChapterOnly;

    const workVersion = item.workVersion ?? 0;
    const libraryEntryVersion = item.libraryEntryVersion ?? 0;

    return {
        totalChapters,
        currentChapter,
        hasValidChapterData,
        hasCurrentChapterOnly,
        progressPercentage,
        isComplete,
        hasWordCount,
        wordCount,
        hasValidUrl,
        hasNotes,
        hasDescription,
        lastUpdated,
        isNsfw,
        hasTaxonomyTerms,
        hasReadingProgress,
        workVersion,
        libraryEntryVersion,
    };
}

export function useLibraryItemValues(item: LibraryItem): LibraryItemValues {
    return getLibraryItemValues(item);
}
