/**
 * Main library container that orchestrates the feature.
 */

"use client";

import { memo, useCallback } from "react";
import type { LibraryStory } from "../../core/types";
import { useLibraryQuery } from "../../data-access/use-library-query";
import { useDialogStore, useSheetStore } from "../../state/ui-store";
import { useLibraryFilters } from "../../state/use-filter-state";
import { LibraryItem } from "../item/library-item";
import { LibraryList } from "../list/library-list";
import { EmptyState, ErrorState, LoadingSpinner } from "../ui/states";

interface LibraryContainerProps {
    readonly isAdministratorUser: boolean;
}

/**
 * Main container component for the library feature.
 * Handles data fetching, state management, and UI orchestration.
 */
export const LibraryContainer = memo(function LibraryContainer({ isAdministratorUser }: LibraryContainerProps) {
    const { filters } = useLibraryFilters();
    const { stories, isLoading, error, hasNextPage, fetchNextPage } = useLibraryQuery({ filters });

    const openViewSheet = useSheetStore((state) => state.openViewSheet);
    const openEditSheet = useSheetStore((state) => state.openEditSheet);
    const openDeleteDialog = useDialogStore((state) => state.openDeleteDialog);

    const handleView = useCallback(
        (story: LibraryStory) => {
            openViewSheet(story);
        },
        [openViewSheet],
    );

    const handleEdit = useCallback(
        (story: LibraryStory) => {
            openEditSheet(story);
        },
        [openEditSheet],
    );

    const handleDelete = useCallback(
        (story: LibraryStory) => {
            openDeleteDialog(story);
        },
        [openDeleteDialog],
    );

    const renderItem = useCallback(
        (story: LibraryStory, _index: number) => (
            <div className="p-2">
                <LibraryItem
                    actions={{ onView: handleView, onEdit: handleEdit, onDelete: handleDelete }}
                    showAdminControls={isAdministratorUser}
                    story={story}
                />
            </div>
        ),
        [isAdministratorUser, handleView, handleEdit, handleDelete],
    );

    const renderLoader = useCallback(() => <LoadingSpinner />, []);

    if (isLoading && stories.length === 0) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <ErrorState message="Failed to load library stories. Please try again." />;
    }

    if (stories.length === 0) {
        return <EmptyState />;
    }

    return (
        <LibraryList
            hasNextPage={hasNextPage}
            onLoadMore={fetchNextPage}
            renderItem={renderItem}
            renderLoader={renderLoader}
            stories={stories}
        />
    );
});
