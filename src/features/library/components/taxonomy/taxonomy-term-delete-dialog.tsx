"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
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
import { useTRPC } from "#/trpc/react";

export type TaxonomyTermDeleteTarget = {
    publicId: string;
    name: string;
    assignmentCount: number;
};

type TaxonomyTermDeleteDialogProps = {
    term: TaxonomyTermDeleteTarget | null;
    isOpen: boolean;
    onCloseAction: () => void;
};

export function TaxonomyTermDeleteDialog({ term, isOpen, onCloseAction }: TaxonomyTermDeleteDialogProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const deleteMutation = useMutation(trpc.taxonomy.delete.mutationOptions());

    const handleDelete = React.useCallback(async () => {
        if (!term) {
            return;
        }

        try {
            await deleteMutation.mutateAsync({ publicId: term.publicId });
            toast.success("Taxonomy term deleted.");
            await Promise.all([
                queryClient.invalidateQueries(trpc.taxonomy.list.queryFilter()),
                queryClient.invalidateQueries(trpc.library.all.queryFilter()),
            ]);
            onCloseAction();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete taxonomy term.");
        }
    }, [term, deleteMutation, queryClient, trpc, onCloseAction]);

    const handleOpenChange = React.useCallback(
        (open: boolean) => {
            if (!open) {
                onCloseAction();
            }
        },
        [onCloseAction]
    );

    if (!term) {
        return null;
    }

    return (
        <AlertDialog onOpenChange={handleOpenChange} open={isOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{term.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This permanently deletes the term, its labels, and its relations.
                        {term.assignmentCount > 0
                            ? ` It is currently assigned to ${term.assignmentCount} work${term.assignmentCount === 1 ? "" : "s"}, which will lose this tag.`
                            : ""}{" "}
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteMutation.isPending} onClick={onCloseAction}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteMutation.isPending}
                        onClick={handleDelete}
                    >
                        {deleteMutation.isPending ? "Deleting..." : "Delete term"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
