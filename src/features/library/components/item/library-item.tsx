"use client";

import { EyeIcon } from "lucide-react";
import dynamic from "next/dynamic";
import * as React from "react";
import { memo } from "react";
import { Button } from "#/components/ui/button";
import { LibraryItemProvider, useLibraryItemContext } from "#/features/library/components/item/library-item-context";
import { LibraryItemHeader } from "#/features/library/components/item/library-item-header";
import { LibraryItemMetadata } from "#/features/library/components/item/library-item-metadata";
import { LibraryItemNotes } from "#/features/library/components/item/library-item-notes";
import { LibraryItemProgress } from "#/features/library/components/item/library-item-progress";
import { LibraryItemRating } from "#/features/library/components/item/library-item-rating";
import { LibraryItemTags } from "#/features/library/components/item/library-item-tags";
import type { LibraryItem as LibraryItemType } from "#/features/library/hooks/use-library-item";

const LibraryItemAdminControls = dynamic(
    () =>
        import("#/features/library/components/item/library-item-admin-controls").then((mod) => ({
            default: mod.LibraryItemAdminControls,
        })),
    {
        ssr: false,
    },
);

export type LibraryItemProps = {
    item: LibraryItemType;
    showAdminControls?: boolean;
    onView?: (item: LibraryItemType) => void;
    onEdit?: (item: LibraryItemType) => void;
    onDelete?: (item: LibraryItemType) => void;
    children?: React.ReactNode;
};

type LibraryItemHeaderProps = {
    children?: React.ReactNode;
};

function LibraryItemHeaderComponent({ children }: LibraryItemHeaderProps) {
    return (
        <>
            <LibraryItemHeader />
            {children}
        </>
    );
}

type LibraryItemMetadataProps = {
    children?: React.ReactNode;
};

function LibraryItemMetadataComponent({ children }: LibraryItemMetadataProps) {
    return (
        <>
            <LibraryItemMetadata />
            {children}
        </>
    );
}

type LibraryItemProgressProps = {
    children?: React.ReactNode;
};

function LibraryItemProgressComponent({ children }: LibraryItemProgressProps) {
    return (
        <>
            <LibraryItemProgress />
            {children}
        </>
    );
}

type LibraryItemRatingProps = {
    children?: React.ReactNode;
};

function LibraryItemRatingComponent({ children }: LibraryItemRatingProps) {
    const { item } = useLibraryItemContext();

    const rating = Number(item.progressRating ?? 0);

    if (rating <= 0) {
        return null;
    }

    return (
        <>
            <LibraryItemRating value={item.progressRating} />
            {children}
        </>
    );
}

type LibraryItemTagsProps = {
    children?: React.ReactNode;
};

function LibraryItemTagsComponent({ children }: LibraryItemTagsProps) {
    return (
        <>
            <LibraryItemTags />
            {children}
        </>
    );
}

type LibraryItemNotesProps = {
    children?: React.ReactNode;
};

function LibraryItemNotesComponent({ children }: LibraryItemNotesProps) {
    return (
        <>
            <LibraryItemNotes />
            {children}
        </>
    );
}

type LibraryItemAdminControlsProps = {
    children?: React.ReactNode;
};

function LibraryItemAdminControlsComponent({ children }: LibraryItemAdminControlsProps) {
    const { item, onEdit, onDelete } = useLibraryItemContext();

    const handleEditClick = () => {
        onEdit?.(item);
    };

    const handleDeleteClick = () => {
        onDelete?.(item);
    };

    return (
        <>
            <LibraryItemAdminControls onDelete={handleDeleteClick} onEdit={handleEditClick} />
            {children}
        </>
    );
}

type LibraryItemActionsProps = {
    showAdminControls?: boolean;
    children?: React.ReactNode;
};

function LibraryItemActionsComponent({ showAdminControls = false, children }: LibraryItemActionsProps) {
    const { item, onView } = useLibraryItemContext();

    const handleViewClick = () => {
        onView?.(item);
    };

    return (
        <div className="flex items-center justify-end border-border/50 border-t pt-4">
            <div className="flex items-center gap-1">
                <Button
                    aria-label="View details"
                    className="h-8 w-8 p-0"
                    onClick={handleViewClick}
                    size="sm"
                    variant="ghost"
                >
                    <span className="sr-only">View details</span>
                    <EyeIcon className="size-3" />
                </Button>
                {showAdminControls && <LibraryItemAdminControlsComponent />}
                {children}
            </div>
        </div>
    );
}

function _LibraryItem({ item, showAdminControls = false, onView, onEdit, onDelete, children }: LibraryItemProps) {
    const contextValue = React.useMemo(
        () => ({
            item,
            onView,
            onEdit,
            onDelete,
        }),
        [item, onView, onEdit, onDelete],
    );

    if (children) {
        return (
            <LibraryItemProvider value={contextValue}>
                <article className="group relative overflow-hidden rounded-md border border-border/50 bg-card p-6 transition-all duration-200 hover:border-border hover:shadow-md">
                    <div className="space-y-5">{children}</div>
                </article>
            </LibraryItemProvider>
        );
    }

    return (
        <LibraryItemProvider value={contextValue}>
            <article className="group relative overflow-hidden rounded-md border border-border/50 bg-card p-6 transition-all duration-200 hover:border-border hover:shadow-md">
                <div className="space-y-5">
                    <LibraryItemHeaderComponent />
                    <LibraryItemMetadataComponent />
                    <LibraryItemProgressComponent />
                    <LibraryItemRatingComponent />
                    <LibraryItemTagsComponent />
                    <LibraryItemNotesComponent />
                    <LibraryItemActionsComponent showAdminControls={showAdminControls} />
                </div>
            </article>
        </LibraryItemProvider>
    );
}

export const LibraryItem = Object.assign(memo(_LibraryItem), {
    Header: LibraryItemHeaderComponent,
    Metadata: LibraryItemMetadataComponent,
    Progress: LibraryItemProgressComponent,
    Rating: LibraryItemRatingComponent,
    Tags: LibraryItemTagsComponent,
    Notes: LibraryItemNotesComponent,
    AdminControls: LibraryItemAdminControlsComponent,
    Actions: LibraryItemActionsComponent,
});

LibraryItem.displayName = "LibraryItem";

export type {
    LibraryItemHeaderProps,
    LibraryItemMetadataProps,
    LibraryItemProgressProps,
    LibraryItemRatingProps,
    LibraryItemTagsProps,
    LibraryItemNotesProps,
    LibraryItemAdminControlsProps,
    LibraryItemActionsProps,
};
