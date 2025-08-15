"use client";

import { memo } from "react";
import { useLibraryItemContext } from "#/features/library/components/item/library-item-context";
import { useLibraryItemValues } from "#/features/library/hooks/use-library-item";

function _LibraryItemProgress() {
    const { item } = useLibraryItemContext();
    const { hasValidChapterData, hasCurrentChapterOnly, totalChapters, currentChapter, progressPercentage } =
        useLibraryItemValues(item);

    if (hasValidChapterData) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs lg:text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium tabular-nums">
                        {currentChapter}/{totalChapters} ({progressPercentage}%)
                    </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-md bg-muted">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    />
                </div>
            </div>
        );
    }

    if (hasCurrentChapterOnly) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs lg:text-sm">
                    <span className="text-muted-foreground">Current Chapter</span>
                    <span className="text-muted-foreground tabular-nums">Chapter {currentChapter}</span>
                </div>
            </div>
        );
    }

    return null;
}

export const LibraryItemProgress = memo(_LibraryItemProgress);
LibraryItemProgress.displayName = "LibraryItemProgress";
