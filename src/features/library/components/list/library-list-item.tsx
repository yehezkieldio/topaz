"use client";

import type { VirtualItem as TanStackVirtualItem } from "@tanstack/react-virtual";
import { memo, type RefObject, useEffect, useRef } from "react";
import { Button } from "#/components/ui/button";
import { LibraryEntryRow } from "#/features/library/components/list/library-entry-row";
import { ListItemSkeleton } from "#/features/library/components/skeletons/library-list-skeleton";
import type { LibraryItem as LibraryItemType } from "#/features/library/hooks/use-library-item";

type LibraryListItemProps = {
    virtualItem: TanStackVirtualItem;
    item?: LibraryItemType;
    isLoaderRow: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
    isAdministratorUser: boolean;
    handleView: (item: LibraryItemType) => void;
    handleEdit: (item: LibraryItemType) => void;
    handleDelete: (item: LibraryItemType) => void;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    onInView?: () => void;
};

export const LibraryListItem = memo(function LibraryListItem({
    virtualItem,
    item,
    isLoaderRow,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isAdministratorUser,
    handleView,
    handleEdit,
    handleDelete,
    scrollContainerRef,
    onInView,
}: LibraryListItemProps) {
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!(onInView && sentinelRef.current && scrollContainerRef.current)) return;
        const el = sentinelRef.current;
        const scrollContainer = scrollContainerRef.current;

        const obs = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) onInView();
            },
            {
                root: scrollContainer,
                rootMargin: "600px 0px",
                threshold: 0,
            }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [onInView, scrollContainerRef]);

    return (
        <div
            data-index={virtualItem.index}
            key={virtualItem.key}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
            }}
        >
            {isLoaderRow ? (
                hasNextPage ? (
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="h-px w-full opacity-0" ref={sentinelRef} />
                        {isFetchingNextPage ? (
                            <ListItemSkeleton />
                        ) : (
                            <Button
                                className="transition-all duration-200 hover:scale-105"
                                disabled={!hasNextPage || isFetchingNextPage}
                                onClick={fetchNextPage}
                                variant="ghost"
                            >
                                Load More Works
                            </Button>
                        )}
                    </div>
                ) : null
            ) : item ? (
                <div className="h-full px-1">
                    <LibraryEntryRow
                        isAdministratorUser={isAdministratorUser}
                        item={item}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        onView={handleView}
                    />
                </div>
            ) : null}
        </div>
    );
});
