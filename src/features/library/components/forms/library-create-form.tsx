"use client";

import { useMutation } from "@tanstack/react-query";
import * as React from "react";
import { Button } from "#/components/ui/button";
import { DiscardChangesDialog } from "#/components/ui/discard-changes-dialog";
import { Form } from "#/components/ui/form";
import { SheetClose, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import { useLibraryEntryCreate } from "#/features/library/api/use-library-entry-create";
import type { SelectedTaxonomyItem } from "#/features/library/api/use-taxonomy-search";
import { LibraryForm } from "#/features/library/components/forms/library-form";
import { LibraryReadingStateForm } from "#/features/library/components/forms/library-reading-state-form";
import { LibraryWorkDetailsFieldsForm } from "#/features/library/components/forms/library-work-details-form";
import { LibraryWorkSourceFieldsForm } from "#/features/library/components/forms/library-work-source-form";
import { LibraryWorkTaxonomyForm } from "#/features/library/components/forms/library-work-taxonomy-form";
import { type FormCloseGuardHandle, useFormCloseGuard } from "#/hooks/use-form-close-guard";
import { useTRPC } from "#/trpc/react";

type LibraryCreateFormProps = {
    onClose: () => void;
    ref?: React.Ref<FormCloseGuardHandle>;
};

export function LibraryCreateForm({ onClose, ref }: LibraryCreateFormProps) {
    const { form, onSubmit, isLoading } = useLibraryEntryCreate({ onClose });
    const trpc = useTRPC();
    const deleteTaxonomyTerm = useMutation(trpc.taxonomy.delete.mutationOptions());

    const createdTermIdsRef = React.useRef<Set<string>>(new Set());

    const handleTermCreated = React.useCallback((term: SelectedTaxonomyItem) => {
        createdTermIdsRef.current.add(term.value);
    }, []);

    const handleDiscard = React.useCallback(async () => {
        const publicIds = [...createdTermIdsRef.current];
        createdTermIdsRef.current.clear();
        await Promise.allSettled(publicIds.map((publicId) => deleteTaxonomyTerm.mutateAsync({ publicId })));
    }, [deleteTaxonomyTerm]);

    const { isDirty } = form.formState;
    const { cancelDiscard, confirmDiscard, isConfirmOpen } = useFormCloseGuard(
        { isDirty, onClose, onDiscard: handleDiscard },
        ref
    );

    return (
        <>
            <Form {...form}>
                <form className="flex h-full w-full flex-col" onSubmit={form.handleSubmit(onSubmit)}>
                    <SheetHeader className="flex-none border-b p-6 text-left">
                        <SheetTitle>Create New Library Entry</SheetTitle>
                        <SheetDescription>Fill in the details to create a new library entry.</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto">
                        <LibraryForm className="space-y-8 p-6" control={form.control} isLoading={isLoading}>
                            <LibraryForm.Info>
                                <LibraryWorkSourceFieldsForm />
                            </LibraryForm.Info>
                            <LibraryForm.Details>
                                <LibraryWorkDetailsFieldsForm />
                            </LibraryForm.Details>
                            <LibraryForm.Categories>
                                <LibraryWorkTaxonomyForm onTermCreatedAction={handleTermCreated} />
                            </LibraryForm.Categories>
                            <LibraryForm.Progress>
                                <LibraryReadingStateForm />
                            </LibraryForm.Progress>
                        </LibraryForm>
                    </div>

                    <SheetFooter className="flex-none border-t p-6">
                        <Button disabled={isLoading} type="submit">
                            {isLoading ? "Adding..." : "Add to Library"}
                        </Button>
                        <SheetClose asChild>
                            <Button disabled={isLoading} type="button" variant="outline">
                                Cancel
                            </Button>
                        </SheetClose>
                    </SheetFooter>
                </form>
            </Form>
            <DiscardChangesDialog isOpen={isConfirmOpen} onCancel={cancelDiscard} onConfirm={confirmDiscard} />
        </>
    );
}
