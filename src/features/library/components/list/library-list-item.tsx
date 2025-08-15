"use client";

import type { VirtualItem as TanStackVirtualItem } from "@tanstack/react-virtual";
import { memo, useEffect, useRef } from "react";
import { Button } from "#/components/ui/button";
import { LibraryItem } from "#/features/library/components/item/library-item";
import { ListItemSkeleton } from "#/features/library/components/skeletons/library-list-skeleton";
import type { LibraryItem as LibraryItemType } from "#/features/library/hooks/use-library-item";

interface LibraryListItemProps {
    virtualItem: TanStackVirtualItem;
    item?: LibraryItemType;
    isLoaderRow: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
    isAdministratorUser: boolean;
    handleView: (item: LibraryItemType) => void;
    handleEdit: (item: LibraryItemType) => void;
    handleDelete: (item: LibraryItemType) => void;
    measureElement: (element: Element | null) => void;
    onInView?: () => void;
}

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
    measureElement,
    onInView,
}: LibraryListItemProps) {
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!(onInView && sentinelRef.current)) return;
        const el = sentinelRef.current;
        const root = el.parentElement;

        const obs = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) onInView();
            },
            {
                root,
                rootMargin: "600px 0px",
                threshold: 0,
            },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [onInView]);

    return (
        <div
            data-index={virtualItem.index}
            key={virtualItem.key}
            ref={measureElement}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
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
                                Load More Stories
                            </Button>
                        )}
                    </div>
                ) : null
            ) : item ? (
                <div className="px-1 pb-6">
                    <LibraryItem
                        item={item}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        onView={handleView}
                        showAdminControls={isAdministratorUser}
                    />
                </div>
            ) : null}
        </div>
    );
});
