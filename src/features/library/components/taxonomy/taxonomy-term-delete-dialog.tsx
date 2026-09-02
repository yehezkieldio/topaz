"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "#/components/ui/confirm-delete-dialog";
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

    if (!term) {
        return null;
    }

    return (
        <ConfirmDeleteDialog
            confirmLabel="Delete term"
            description={
                <>
                    This permanently deletes the term, its labels, and its relations.
                    {term.assignmentCount > 0
                        ? ` It is currently assigned to ${term.assignmentCount} work${term.assignmentCount === 1 ? "" : "s"}, which will lose this tag.`
                        : ""}{" "}
                    This action cannot be undone.
                </>
            }
            isOpen={isOpen}
            isPending={deleteMutation.isPending}
            onClose={onCloseAction}
            onConfirm={handleDelete}
            pendingLabel="Deleting..."
            title={`Delete "${term.name}"?`}
        />
    );
}
