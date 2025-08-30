"use client";

import { memo } from "react";
import { useLibraryItemContext } from "#/features/library/components/item/library-item-context";
import { useLibraryItemValues } from "#/features/library/hooks/use-library-item";
import { useIsMobile } from "#/hooks/use-mobile";
import { type Source, sourceLabels, sourceShortLabels } from "#/server/db/schema";

function _LibraryItemMetadata() {
    const { item } = useLibraryItemContext();
    const { hasWordCount, wordCount, totalChapters, hasCurrentChapterOnly, currentChapter, isComplete, lastUpdated } =
        useLibraryItemValues(item);
    const source = item.storySource as Source;
    const isMobile = useIsMobile();

    return (
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs lg:text-sm">
            <span>
                {isMobile
                    ? sourceShortLabels[source] || source || "Unknown"
                    : sourceLabels[source] || source || "Unknown"}
            </span>

            {hasWordCount && (
                <>
                    <span className="text-muted-foreground/40">•</span>
                    <span>{wordCount} words</span>
                </>
            )}

            {(totalChapters > 0 || (hasCurrentChapterOnly && isMobile)) && (
                <>
                    <span className="text-muted-foreground/40">•</span>
                    <span>
                        {isMobile ? (
                            totalChapters > 0 ? (
                                `${totalChapters} ch.${isComplete ? " (✓)" : ""}`
                            ) : (
                                `Ch. ${currentChapter}`
                            )
                        ) : (
                            <>
                                {totalChapters} chapter{totalChapters !== 1 ? "s" : ""}
                                {isComplete && <span className="ml-1 font-medium text-emerald-600">(Complete)</span>}
                            </>
                        )}
                    </span>
                </>
            )}

            {lastUpdated && (
                <>
                    <span className="text-muted-foreground/40">•</span>
                    <span>Updated {lastUpdated}</span>
                </>
            )}

            <span className="text-muted-foreground/40">•</span>
            <span>{item.storyStatus}</span>
        </div>
    );
}

export const LibraryItemMetadata = memo(_LibraryItemMetadata);
LibraryItemMetadata.displayName = "LibraryItemMetadata";
