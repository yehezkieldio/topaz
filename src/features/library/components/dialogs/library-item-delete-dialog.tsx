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

function LibraryItemDeleteDialogComponent({ item, isOpen, onClose, onDelete }: LibraryItemDeleteDialogProps) {
    const trpc = useTRPC();
    const refetchLibrary = useLibraryRefetch();

    const deleteWorkMutation = useMutation(trpc.work.delete.mutationOptions());
    const isPending = deleteWorkMutation.isPending;

    const handleDelete = useCallback(async () => {
        try {
            await deleteWorkMutation.mutateAsync({
                publicId: item.workPublicId,
            });

            toast.success("Work deleted from library.");

            await refetchLibrary();

            onDelete?.(item);
            onClose();
        } catch (error) {
            console.error("Error deleting library work:", error);
            toast.error(error instanceof Error ? error.message : "Failed to delete work.");
        }
    }, [deleteWorkMutation, item, refetchLibrary, onDelete, onClose]);

    const contextValue = useMemo(
        () => ({
            item,
            onDelete,
        }),
        [item, onDelete]
    );

    return (
        <LibraryItemProvider value={contextValue}>
            <AlertDialog onOpenChange={onClose} open={isOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the work "
                            {item.workTitle || "Untitled"}" and its library, source, reading, and taxonomy rows.
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
                            {isPending ? "Deleting..." : "Delete Work"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </LibraryItemProvider>
    );
}

export const LibraryItemDeleteDialog = memo(LibraryItemDeleteDialogComponent);
LibraryItemDeleteDialog.displayName = "LibraryItemDeleteDialog";
