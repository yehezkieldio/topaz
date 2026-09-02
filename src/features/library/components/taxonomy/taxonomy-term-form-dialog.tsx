"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import type { TaxonomyKind } from "#/server/db/schema";
import { taxonomyKindKeys, taxonomyKindLabels } from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";

export type TaxonomyTermFormTarget = {
    publicId: string;
    name: string;
    kind: TaxonomyKind;
    description: string | null;
};

type TaxonomyTermFormDialogProps = {
    term: TaxonomyTermFormTarget | null;
    isOpen: boolean;
    onCloseAction: () => void;
    defaultKind?: TaxonomyKind;
};

export function TaxonomyTermFormDialog({ term, isOpen, onCloseAction, defaultKind }: TaxonomyTermFormDialogProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const isEditing = term !== null;

    const [name, setName] = React.useState(term?.name ?? "");
    const [kind, setKind] = React.useState<TaxonomyKind>(term?.kind ?? defaultKind ?? "trope");
    const [description, setDescription] = React.useState(term?.description ?? "");

    React.useEffect(() => {
        if (isOpen) {
            setName(term?.name ?? "");
            setKind(term?.kind ?? defaultKind ?? "trope");
            setDescription(term?.description ?? "");
        }
    }, [isOpen, term, defaultKind]);

    const invalidate = React.useCallback(
        () => queryClient.invalidateQueries(trpc.taxonomy.list.queryFilter()),
        [queryClient, trpc]
    );

    const createMutation = useMutation(trpc.taxonomy.create.mutationOptions());
    const updateMutation = useMutation(trpc.taxonomy.update.mutationOptions());
    const isPending = createMutation.isPending || updateMutation.isPending;

    const handleSubmit = React.useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();
            const trimmedName = name.trim();
            if (!trimmedName) {
                toast.error("Name is required.");
                return;
            }

            try {
                if (isEditing) {
                    await updateMutation.mutateAsync({
                        description: description.trim() || null,
                        kind,
                        name: trimmedName,
                        publicId: term.publicId,
                    });
                    toast.success("Taxonomy term updated.");
                } else {
                    await createMutation.mutateAsync({
                        description: description.trim() || null,
                        kind,
                        name: trimmedName,
                    });
                    toast.success("Taxonomy term created.");
                }

                await invalidate();
                onCloseAction();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to save taxonomy term.");
            }
        },
        [name, kind, description, isEditing, term, createMutation, updateMutation, invalidate, onCloseAction]
    );

    const handleOpenChange = React.useCallback(
        (open: boolean) => {
            if (!open) {
                onCloseAction();
            }
        },
        [onCloseAction]
    );
    const handleNameChange = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
        []
    );
    const handleKindChange = React.useCallback((value: string) => setKind(value as TaxonomyKind), []);
    const handleDescriptionChange = React.useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value),
        []
    );

    return (
        <Dialog onOpenChange={handleOpenChange} open={isOpen}>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit taxonomy term" : "New taxonomy term"}</DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? "Rename this term, change its kind, or update its description."
                                : "Create a new taxonomy term directly."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="taxonomy-term-name">Name</Label>
                            <Input
                                autoFocus
                                id="taxonomy-term-name"
                                onChange={handleNameChange}
                                required
                                value={name}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="taxonomy-term-kind">Kind</Label>
                            <Select onValueChange={handleKindChange} value={kind}>
                                <SelectTrigger className="w-full" id="taxonomy-term-kind">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {taxonomyKindKeys.map((key) => (
                                        <SelectItem key={key} value={key}>
                                            {taxonomyKindLabels[key]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="taxonomy-term-description">Description</Label>
                            <Textarea
                                id="taxonomy-term-description"
                                onChange={handleDescriptionChange}
                                placeholder="Optional"
                                value={description}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button disabled={isPending} onClick={onCloseAction} type="button" variant="outline">
                            Cancel
                        </Button>
                        <Button disabled={isPending} type="submit">
                            {isPending ? "Saving..." : isEditing ? "Save changes" : "Create term"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
