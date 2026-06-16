"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import { memo, useCallback, useRef, useState } from "react";
import { useLibraryDataContext } from "#/features/library/api/use-library-data";
import { LibraryListItem } from "#/features/library/components/list/library-list-item";
import { ListItemSkeleton } from "#/features/library/components/skeletons/library-list-skeleton";
import { EmptyState } from "#/features/library/components/states/empty-state";
import { ErrorState } from "#/features/library/components/states/error-state";
import { LoadingSpinner } from "#/features/library/components/states/loading-spinner";
import type { LibraryItem as LibraryItemType } from "#/features/library/hooks/use-library-item";
import { useSearchQuery } from "#/features/library/hooks/use-search-query";
import { useIsMobile } from "#/hooks/use-mobile";

const LibraryEditSheet = dynamic(
    () =>
        import("#/features/library/components/sheets/library-edit-sheet").then((mod) => ({
            default: mod.LibraryEditSheet,
        })),
    {
        ssr: false,
    }
);

const LibraryItemDeleteDialog = dynamic(
    () =>
        import("#/features/library/components/dialogs/library-item-delete-dialog").then((mod) => ({
            default: mod.LibraryItemDeleteDialog,
        })),
    {
        ssr: false,
    }
);

const LibraryItemViewSheet = dynamic(
    () =>
        import("#/features/library/components/sheets/library-view-item-sheet").then((mod) => ({
            default: mod.LibraryItemViewSheet,
        })),
    {
        ssr: false,
    }
);

const DESKTOP_ITEM_HEIGHT = 128;
const MOBILE_ITEM_HEIGHT = 184;
const LOADER_ROW_HEIGHT = 96;
const OVERSCAN = 8;

export type LibraryListProps = {
    isAdministratorUser: boolean;
};

export const LibraryList = memo(function LibraryList({ isAdministratorUser }: LibraryListProps) {
    const [search] = useSearchQuery();
    const parentRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();
    const [selectedItem, setSelectedItem] = useState<LibraryItemType | null>(null);
    const [isViewSheetOpen, setIsViewSheetOpen] = useState(false);
    const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const isLoadingNextPageRef = useRef(false);

    const itemHeight = isMobile ? MOBILE_ITEM_HEIGHT : DESKTOP_ITEM_HEIGHT;

    const { actions, allItems, error, hasNextPage, isFetching, isFetchingNextPage, meta } = useLibraryDataContext();
    const { fetchNextPage } = actions;

    const estimateSize = useCallback(
        (index: number) => (index >= allItems.length ? LOADER_ROW_HEIGHT : itemHeight),
        [allItems.length, itemHeight]
    );
    const getItemKey = useCallback(
        (index: number) => allItems[index]?.libraryEntryPublicId ?? `loader-${index}`,
        [allItems]
    );

    const virtualizer = useVirtualizer({
        count: hasNextPage ? allItems.length + 1 : allItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize,
        getItemKey,
        overscan: OVERSCAN,
    });

    const items = virtualizer.getVirtualItems();

    const handleView = useCallback((item: LibraryItemType) => {
        setSelectedItem(item);
        setIsViewSheetOpen(true);
    }, []);

    const handleEdit = useCallback((item: LibraryItemType) => {
        setSelectedItem(item);
        setIsEditSheetOpen(true);
    }, []);

    const handleDelete = useCallback((item: LibraryItemType) => {
        setSelectedItem(item);
        setIsDeleteDialogOpen(true);
    }, []);

    const onLoaderInView = useCallback(async () => {
        if (!hasNextPage || isFetchingNextPage || isLoadingNextPageRef.current) return;

        isLoadingNextPageRef.current = true;
        try {
            await fetchNextPage();
        } finally {
            isLoadingNextPageRef.current = false;
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    if (meta.status === "pending") {
        return <ListItemSkeleton count={6} />;
    }

    if (meta.status === "error") {
        return (
            <ErrorState
                message={error instanceof Error ? error.message : "Something went wrong"}
                onRetry={() => window.location.reload()}
                title="Error Loading Library"
            />
        );
    }

    if (meta.status === "empty") {
        const message = search ? `No works match your search for "${search}"` : "No library works yet.";

        return <EmptyState message={message} title="No Works Found" />;
    }

    return (
        <div
            className="w-full overflow-auto"
            ref={parentRef}
            style={{
                contain: "strict",
                height: "calc(100vh - var(--header-height, 120px))",
                minHeight: "400px",
            }}
        >
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    width: "100%",
                    position: "relative",
                }}
            >
                {items.map((virtualItem) => {
                    const isLoaderRow = virtualItem.index > allItems.length - 1;
                    const item = allItems[virtualItem.index];

                    return (
                        <LibraryListItem
                            fetchNextPage={fetchNextPage}
                            handleDelete={handleDelete}
                            handleEdit={handleEdit}
                            handleView={handleView}
                            hasNextPage={hasNextPage}
                            isAdministratorUser={isAdministratorUser}
                            isFetchingNextPage={isFetchingNextPage}
                            isLoaderRow={isLoaderRow}
                            item={item}
                            key={virtualItem.key}
                            onInView={isLoaderRow ? onLoaderInView : undefined}
                            scrollContainerRef={parentRef}
                            virtualItem={virtualItem}
                        />
                    );
                })}
            </div>

            {isFetching && !isFetchingNextPage && meta.status === "ready" && (
                <LoadingSpinner message="Updating library..." />
            )}

            {selectedItem && (
                <>
                    <LibraryItemViewSheet
                        isOpen={isViewSheetOpen}
                        item={selectedItem}
                        onClose={() => {
                            setIsViewSheetOpen(false);
                            setSelectedItem(null);
                        }}
                    />
                    {isAdministratorUser && (
                        <>
                            <LibraryEditSheet
                                isOpen={isEditSheetOpen}
                                item={selectedItem}
                                onCloseAction={() => {
                                    setIsEditSheetOpen(false);
                                    setSelectedItem(null);
                                    // parentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                            />
                            <LibraryItemDeleteDialog
                                isOpen={isDeleteDialogOpen}
                                item={selectedItem}
                                onClose={() => {
                                    setIsDeleteDialogOpen(false);
                                    setSelectedItem(null);
                                    // parentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
});
