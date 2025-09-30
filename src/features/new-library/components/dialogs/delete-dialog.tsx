/**
 * Delete confirmation dialog.
 */

"use client";

import { memo } from "react";
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
import { useDeleteStory } from "../../data-access/use-library-mutations";
import { useDialogStore } from "../../state/ui-store";

/**
 * Dialog for confirming story deletion.
 */
export const LibraryDeleteDialog = memo(function LibraryDeleteDialog() {
    const isOpen = useDialogStore((state) => state.isDeleteDialogOpen);
    const closeDialog = useDialogStore((state) => state.closeDeleteDialog);
    const deleteStory = useDialogStore((state) => state.deleteStory);
    const deleteMutation = useDeleteStory();

    const handleDelete = async () => {
        if (!deleteStory) return;

        await deleteMutation.mutateAsync({
            storyId: deleteStory.storyPublicId,
            progressId: deleteStory.progressPublicId,
        });

        closeDialog();
    };

    return (
        <AlertDialog onOpenChange={(open) => !open && closeDialog()} open={isOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete "{deleteStory?.storyTitle || "this story"}" from your library. This
                        action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={deleteMutation.isPending} onClick={handleDelete}>
                        {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
});
