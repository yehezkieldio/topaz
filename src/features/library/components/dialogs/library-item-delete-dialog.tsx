"use client";

import { useMutation } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { useLibraryRefetch } from "#/features/library/api/use-library-data";
import { LibraryItemProvider } from "#/features/library/components/item/library-item-context";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";
import { useTRPC } from "#/trpc/react";

export type LibraryItemDeleteDialogProps = {
    item: LibraryItem;
    isOpen: boolean;
    onClose: () => void;
    onDelete?: (item: LibraryItem) => void;
};

function _LibraryItemDeleteDialog({ item, isOpen, onClose, onDelete }: LibraryItemDeleteDialogProps) {
    const trpc = useTRPC();
    const refetchLibrary = useLibraryRefetch();

    const refreshViews = useMutation(trpc.view.refreshAll.mutationOptions());
    const deleteStory = useMutation(trpc.story.delete.mutationOptions());
    const deleteProgress = useMutation(trpc.progress.delete.mutationOptions());

    const isPending = deleteStory.isPending || deleteProgress.isPending;

    const handleDelete = useCallback(async () => {
        try {
            await deleteProgress.mutateAsync({
                publicId: item.progressPublicId,
            });

            await deleteStory.mutateAsync({
                publicId: item.storyPublicId,
            });

            await refreshViews.mutateAsync();
            toast.success("Story deleted from library!");

            refetchLibrary();

            onDelete?.(item);
            onClose();
        } catch (error) {
            console.error("Error deleting story/progress:", error);
            toast.error("Failed to delete story.");
        }
    }, [deleteProgress, deleteStory, refreshViews, item, refetchLibrary, onDelete, onClose]);

    const contextValue = useMemo(
        () => ({
            item,
            onDelete,
        }),
        [item, onDelete],
    );

    return (
        <LibraryItemProvider value={contextValue}>
            <AlertDialog onOpenChange={onClose} open={isOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the story "
                            {item.storyTitle || "Untitled"}" and all associated progress data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending} onClick={onClose}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isPending}
                            onClick={handleDelete}
                        >
                            {isPending ? "Deleting..." : "Delete Story"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </LibraryItemProvider>
    );
}

export const LibraryItemDeleteDialog = memo(_LibraryItemDeleteDialog);
LibraryItemDeleteDialog.displayName = "LibraryItemDeleteDialog";
