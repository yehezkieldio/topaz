/**
 * Optimized virtualized list component for displaying library stories.
 */

"use client";

import { memo, useCallback, useRef } from "react";
import { useIsMobile } from "#/hooks/use-mobile";
import type { LibraryStory } from "../../core/types";
import { useVirtualizedList } from "../../hooks/use-virtualized-list";

const DESKTOP_ITEM_HEIGHT = 380;
const MOBILE_ITEM_HEIGHT = 420;

interface LibraryListProps {
    readonly stories: readonly LibraryStory[];
    readonly hasNextPage: boolean;
    readonly onLoadMore: () => void;
    readonly renderItem: (story: LibraryStory, index: number) => React.ReactNode;
    readonly renderLoader?: () => React.ReactNode;
}

/**
 * Virtualized list component with infinite scroll support.
 * Optimized for large datasets with minimal re-renders.
 */
export const LibraryList = memo(function LibraryList({
    stories,
    hasNextPage,
    onLoadMore,
    renderItem,
    renderLoader,
}: LibraryListProps) {
    const parentRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

    const itemHeight = isMobile ? MOBILE_ITEM_HEIGHT : DESKTOP_ITEM_HEIGHT;
    const totalCount = hasNextPage ? stories.length + 1 : stories.length;

    const handleEndReached = useCallback(() => {
        if (hasNextPage) {
            onLoadMore();
        }
    }, [hasNextPage, onLoadMore]);

    const { virtualizer } = useVirtualizedList({
        parentRef: parentRef as React.RefObject<HTMLDivElement>,
        count: totalCount,
        estimateSize: itemHeight,
        overscan: 5,
        onEndReached: handleEndReached,
        endReachedThreshold: 0.8,
    });

    const items = virtualizer.getVirtualItems();

    return (
        <div className="h-full overflow-auto" ref={parentRef}>
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                }}
            >
                {items.map((virtualItem) => {
                    const isLoader = virtualItem.index >= stories.length;
                    const story = stories[virtualItem.index];

                    return (
                        <div
                            data-index={virtualItem.index}
                            key={virtualItem.key}
                            ref={virtualizer.measureElement}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                        >
                            {isLoader ? renderLoader?.() : story ? renderItem(story, virtualItem.index) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
