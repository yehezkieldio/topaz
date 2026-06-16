"use client";

import { Button } from "#/components/ui/button";
import { Form } from "#/components/ui/form";
import { SheetClose, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import { useLibraryEntryCreate } from "#/features/library/api/use-library-entry-create";
import { LibraryForm } from "#/features/library/components/forms/library-form";
import { LibraryReadingStateForm } from "#/features/library/components/forms/library-reading-state-form";
import { LibraryWorkDetailsFieldsForm } from "#/features/library/components/forms/library-work-details-form";
import { LibraryWorkSourceFieldsForm } from "#/features/library/components/forms/library-work-source-form";
import { LibraryWorkTaxonomyForm } from "#/features/library/components/forms/library-work-taxonomy-form";

type LibraryCreateFormProps = {
    onClose: () => void;
};

export function LibraryCreateForm({ onClose }: LibraryCreateFormProps) {
    const { form, onSubmit, isLoading } = useLibraryEntryCreate({ onClose });

    return (
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
                            <LibraryWorkTaxonomyForm />
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
                        <Button disabled={isLoading} onClick={onClose} type="button" variant="outline">
                            Cancel
                        </Button>
                    </SheetClose>
                </SheetFooter>
            </form>
        </Form>
    );
}
