/**
 * Domain utilities for computing derived values from library stories.
 */

import { estimateWordCount, formatDate } from "#/lib/utils";
import type { ComputedStoryValues, LibraryStory } from "./types";

const PROGRESS_PERCENTAGE_MAX = 100;

/**
 * Computes all derived values for a library story.
 * This is a pure function with no dependencies on React.
 */
export function computeStoryValues(story: LibraryStory): ComputedStoryValues {
    const totalChapters = story.storyChapterCount || 0;
    const currentChapter = Math.max(0, story.progressCurrentChapter || 0);
    const hasValidChapterData = totalChapters > 0 && currentChapter > 0;
    const hasCurrentChapterOnly = totalChapters === 0 && currentChapter > 0;
    const progressPercentage = hasValidChapterData
        ? Math.round((currentChapter / totalChapters) * PROGRESS_PERCENTAGE_MAX)
        : 0;
    const isComplete = story.storyStatus?.toLowerCase() === "complete";
    const hasWordCount = (story.storyWordCount ?? 0) > 0;
    const formattedWordCount = estimateWordCount(story.storyWordCount);
    const hasValidUrl = Boolean(story.storyUrl?.trim());
    const hasNotes = Boolean(story.progressNotes?.trim());
    const hasDescription = Boolean(story.storyDescription?.trim());
    const formattedLastUpdated = formatDate(story.updatedAt);
    const isNsfw = story.storyIsNsfw ?? false;
    const hasFandomsOrTags = (story.fandoms?.length ?? 0) > 0 || (story.tags?.length ?? 0) > 0;
    const hasReadingProgress = hasValidChapterData || hasCurrentChapterOnly;

    return {
        totalChapters,
        currentChapter,
        hasValidChapterData,
        hasCurrentChapterOnly,
        progressPercentage,
        isComplete,
        hasWordCount,
        formattedWordCount,
        hasValidUrl,
        hasNotes,
        hasDescription,
        formattedLastUpdated,
        isNsfw,
        hasFandomsOrTags,
        hasReadingProgress,
    };
}

/**
 * Creates a memoization key for computed story values.
 * Used to determine when recomputation is necessary.
 */
export function getStoryComputationKey(story: LibraryStory): string {
    return [
        story.storyChapterCount,
        story.progressCurrentChapter,
        story.storyStatus,
        story.storyWordCount,
        story.storyUrl,
        story.progressNotes,
        story.storyDescription,
        story.updatedAt,
        story.storyIsNsfw,
        story.fandoms?.length,
        story.tags?.length,
    ].join("|");
}
