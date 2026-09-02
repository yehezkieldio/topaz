"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import type { SelectedTaxonomyItem } from "#/features/library/api/use-taxonomy-search";
import { LibraryTaxonomyMultiselect } from "#/features/library/components/ui/library-taxonomy-multiselect";
import { useDialogCloseOnOpenChange } from "#/hooks/use-dialog-close-on-open-change";
import type { TaxonomyRelationSummary } from "#/server/db/repositories/taxonomy-repository";
import type { TaxonomyKind, TaxonomyRelationType } from "#/server/db/schema";
import { taxonomyKindLabels, taxonomyRelationTypeEnum } from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";

const RELATION_TYPE_LABELS: Record<TaxonomyRelationType, string> = {
    broader: "Broader than",
    conflicts_with: "Conflicts with",
    equivalent_to: "Equivalent to",
    implies: "Implies",
    related: "Related to",
};

export type TaxonomyRelationsTarget = {
    publicId: string;
    name: string;
    kind: TaxonomyKind;
};

type TaxonomyTermRelationsDialogProps = {
    term: TaxonomyRelationsTarget | null;
    isOpen: boolean;
    onCloseAction: () => void;
};

type RelationRowProps = {
    relation: TaxonomyRelationSummary;
    currentTermPublicId: string;
    onDelete: (relationPublicId: string) => void;
    isDeleting: boolean;
};

const RelationRow = React.memo(function RelationRowComponent({
    relation,
    currentTermPublicId,
    onDelete,
    isDeleting,
}: RelationRowProps) {
    const isOutgoing = relation.fromTerm.publicId === currentTermPublicId;
    const otherTerm = isOutgoing ? relation.toTerm : relation.fromTerm;
    const handleDelete = React.useCallback(() => onDelete(relation.publicId), [relation.publicId, onDelete]);

    return (
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
            <div className="flex min-w-0 flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                    {isOutgoing
                        ? RELATION_TYPE_LABELS[relation.relationType]
                        : `${RELATION_TYPE_LABELS[relation.relationType]} (incoming)`}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-sm">{otherTerm.name}</span>
                    <Badge className="rounded-md text-[10px]" variant="outline">
                        {taxonomyKindLabels[otherTerm.kind]}
                    </Badge>
                </div>
            </div>
            <Button
                aria-label={`Remove relation with ${otherTerm.name}`}
                disabled={isDeleting}
                onClick={handleDelete}
                size="icon"
                type="button"
                variant="ghost"
            >
                <Trash2Icon className="size-4" />
            </Button>
        </div>
    );
});

export function TaxonomyTermRelationsDialog({ term, isOpen, onCloseAction }: TaxonomyTermRelationsDialogProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const relationsQuery = useQuery({
        ...trpc.taxonomy.relations.queryOptions({ termPublicId: term?.publicId }),
        enabled: isOpen && !!term,
    });

    const invalidateRelated = React.useCallback(
        async () =>
            await Promise.all([
                queryClient.invalidateQueries(trpc.taxonomy.relations.queryFilter()),
                queryClient.invalidateQueries(trpc.taxonomy.list.queryFilter()),
                queryClient.invalidateQueries(trpc.library.all.queryFilter()),
            ]),
        [queryClient, trpc]
    );

    const createRelationMutation = useMutation(trpc.taxonomy.createRelation.mutationOptions());
    const deleteRelationMutation = useMutation(trpc.taxonomy.deleteRelation.mutationOptions());

    const [relationType, setRelationType] = React.useState<TaxonomyRelationType>("related");
    const [targetTerm, setTargetTerm] = React.useState<SelectedTaxonomyItem | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            setRelationType("related");
            setTargetTerm(null);
        }
    }, [isOpen]);

    const handleAddRelation = React.useCallback(async () => {
        if (!(term && targetTerm)) {
            return;
        }

        try {
            await createRelationMutation.mutateAsync({
                fromTermPublicId: term.publicId,
                relationType,
                toTermPublicId: targetTerm.value,
            });
            toast.success("Relation added.");
            setTargetTerm(null);
            await invalidateRelated();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to add relation.");
        }
    }, [term, targetTerm, relationType, createRelationMutation, invalidateRelated]);

    const handleDeleteRelation = React.useCallback(
        async (relationPublicId: string) => {
            try {
                await deleteRelationMutation.mutateAsync({ publicId: relationPublicId });
                toast.success("Relation removed.");
                await invalidateRelated();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to remove relation.");
            }
        },
        [deleteRelationMutation, invalidateRelated]
    );

    const handleOpenChange = useDialogCloseOnOpenChange(onCloseAction);
    const handleRelationTypeChange = React.useCallback(
        (value: string) => setRelationType(value as TaxonomyRelationType),
        []
    );
    const handleTargetTermChange = React.useCallback(
        (terms: SelectedTaxonomyItem[]) => setTargetTerm(terms.at(-1) ?? null),
        []
    );

    if (!term) {
        return null;
    }

    const relations = relationsQuery.data ?? [];

    return (
        <Dialog onOpenChange={handleOpenChange} open={isOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Relations for "{term.name}"</DialogTitle>
                    <DialogDescription>
                        Relations drive inferred (effective) taxonomy. For example, marking this term "broader" than
                        another means works tagged with the other term also inherit this one.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Select onValueChange={handleRelationTypeChange} value={relationType}>
                            <SelectTrigger className="w-full sm:w-40" size="sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {taxonomyRelationTypeEnum.options.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {RELATION_TYPE_LABELS[option]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <LibraryTaxonomyMultiselect
                            className="flex-1"
                            onTermsChangeAction={handleTargetTermChange}
                            placeholder="Select a term…"
                            selectedTerms={targetTerm ? [targetTerm] : []}
                        />
                    </div>
                    <Button
                        className="w-full"
                        disabled={!targetTerm || createRelationMutation.isPending}
                        onClick={handleAddRelation}
                        size="sm"
                        type="button"
                    >
                        {createRelationMutation.isPending ? "Adding..." : "Add relation"}
                    </Button>
                </div>

                <div className="h-px bg-border" />

                <div className="max-h-64 space-y-2 overflow-y-auto">
                    {relationsQuery.isLoading ? (
                        <p className="text-muted-foreground text-sm">Loading relations…</p>
                    ) : relations.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No relations yet.</p>
                    ) : (
                        relations.map((relation) => (
                            <RelationRow
                                currentTermPublicId={term.publicId}
                                isDeleting={deleteRelationMutation.isPending}
                                key={relation.publicId}
                                onDelete={handleDeleteRelation}
                                relation={relation}
                            />
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
