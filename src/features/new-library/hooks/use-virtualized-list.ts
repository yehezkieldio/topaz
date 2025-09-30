/**
 * Hook for managing virtualized list with infinite scroll.
 */

"use client";

import { type Virtualizer, useVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useEffect } from "react";

interface UseVirtualizedListOptions {
    readonly parentRef: RefObject<HTMLDivElement>;
    readonly count: number;
    readonly estimateSize: number;
    readonly overscan?: number;
    readonly onEndReached?: () => void;
    readonly endReachedThreshold?: number;
}

interface UseVirtualizedListReturn {
    readonly virtualizer: Virtualizer<HTMLDivElement, Element>;
}

/**
 * Hook for managing virtualized lists with infinite scroll.
 * Automatically triggers loading more items when scrolled near the end.
 */
export function useVirtualizedList({
    parentRef,
    count,
    estimateSize,
    overscan = 5,
    onEndReached,
    endReachedThreshold = 0.8,
}: UseVirtualizedListOptions): UseVirtualizedListReturn {
    const virtualizer = useVirtualizer({
        count,
        getScrollElement: () => parentRef.current,
        estimateSize: () => estimateSize,
        overscan,
        measureElement:
            typeof window !== "undefined"
                ? (element) => element?.getBoundingClientRect()?.height ?? estimateSize
                : undefined,
    });

    // Infinite scroll detection
    useEffect(() => {
        if (!onEndReached) return;

        const items = virtualizer.getVirtualItems();
        if (items.length === 0) return;

        const lastItem = items.at(-1);
        if (!lastItem) return;

        // Trigger when the last rendered item exceeds the threshold
        if (lastItem.index >= count * endReachedThreshold) {
            onEndReached();
        }
    }, [virtualizer, count, onEndReached, endReachedThreshold]);

    return { virtualizer };
}
