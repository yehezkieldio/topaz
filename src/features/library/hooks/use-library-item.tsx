import { useMemo } from "react";
import { estimateWordCount, formatDate } from "#/lib/utils";
import type { RouterOutputs } from "#/trpc/react";

export type LibraryItem = RouterOutputs["progress"]["all"]["data"][number];

export interface LibraryItemValues {
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
}

export function useLibraryItemValues(item: LibraryItem): LibraryItemValues {
    return useMemo(() => {
        const totalChapters = item.storyChapterCount || 0;
        const currentChapter = Math.max(0, item.progressCurrentChapter || 0);
        const hasValidChapterData = totalChapters > 0 && currentChapter > 0;
        const hasCurrentChapterOnly = totalChapters === 0 && currentChapter > 0;
        const progressPercentage = hasValidChapterData ? Math.round((currentChapter / totalChapters) * 100) : 0;
        const isComplete = item.storyStatus?.toLowerCase() === "complete";
        const hasWordCount = (item.storyWordCount ?? 0) > 0;
        const wordCount = estimateWordCount(item.storyWordCount);
        const hasValidUrl = Boolean(item.storyUrl?.trim());
        const hasNotes = Boolean(item.progressNotes?.trim());
        const hasDescription = Boolean(item.storyDescription?.trim());
        const lastUpdated = formatDate(item.updatedAt);
        const isNsfw = item.storyIsNsfw ?? false;

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
        };
    }, [
        item.storyChapterCount,
        item.progressCurrentChapter,
        item.storyStatus,
        item.storyWordCount,
        item.storyUrl,
        item.progressNotes,
        item.storyDescription,
        item.updatedAt,
        item.storyIsNsfw,
    ]);
}
