"use client";

import { useWatch } from "react-hook-form";
import { Button } from "#/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "#/components/ui/form";
import { ProgressControls } from "#/components/ui/progress-controls";
import { SheetClose, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import { useLibraryEntryEdit } from "#/features/library/api/use-library-entry-edit";
import { LibraryForm } from "#/features/library/components/forms/library-form";
import { LibraryReadingStateForm } from "#/features/library/components/forms/library-reading-state-form";
import { LibraryWorkDetailsFieldsForm } from "#/features/library/components/forms/library-work-details-form";
import { LibraryWorkSourceFieldsForm } from "#/features/library/components/forms/library-work-source-form";
import { LibraryWorkTaxonomyForm } from "#/features/library/components/forms/library-work-taxonomy-form";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";
import { useIsMobile } from "#/hooks/use-mobile";

type LibraryEditFormProps = {
    item: LibraryItem;
    onCloseAction: () => void;
};

export function LibraryEditForm({ item, onCloseAction }: LibraryEditFormProps) {
    const { form, onSubmit, isLoading } = useLibraryEntryEdit({ item, onCloseAction });
    const isMobile = useIsMobile();

    const [currentChapter = 0, totalChapters = 0] = useWatch({
        control: form.control,
        name: ["current_chapter", "chapter_count"],
    });

    const handleChapterIncrement = () => {
        const current = currentChapter;
        const max = totalChapters || Number.POSITIVE_INFINITY;
        if (current < max) {
            form.setValue("current_chapter", current + 1, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
            });
        }
    };

    const handleChapterDecrement = () => {
        const current = currentChapter;
        if (current > 0) {
            form.setValue("current_chapter", current - 1, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
            });
        }
    };

    return (
        <Form {...form}>
            <form className="flex h-full w-full flex-col" onSubmit={form.handleSubmit(onSubmit)}>
                <SheetHeader className="flex-none border-b p-6 text-left">
                    <SheetTitle>Edit Library Entry</SheetTitle>
                    <SheetDescription>Update the details for this library entry.</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                    <LibraryForm className="space-y-8 p-6" control={form.control} isLoading={isLoading}>
                        {isMobile && (
                            <div className="rounded-lg border bg-card p-4">
                                <h3 className="mb-4 font-medium text-sm">Quick Progress Update</h3>
                                <FormField
                                    control={form.control}
                                    name="current_chapter"
                                    render={() => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Current Chapter</FormLabel>
                                            <FormControl>
                                                <ProgressControls
                                                    currentChapter={currentChapter}
                                                    onDecrementAction={handleChapterDecrement}
                                                    onIncrementAction={handleChapterIncrement}
                                                    totalChapters={totalChapters}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <LibraryForm.Info>
                            <LibraryWorkSourceFieldsForm />
                        </LibraryForm.Info>
                        <LibraryForm.Details>
                            <LibraryWorkDetailsFieldsForm />
                        </LibraryForm.Details>
                        <LibraryForm.Categories>
                            <LibraryWorkTaxonomyForm initialTaxonomyTerms={item.directTaxonomyTerms || []} />
                        </LibraryForm.Categories>
                        <LibraryForm.Progress>
                            <LibraryReadingStateForm />
                        </LibraryForm.Progress>
                    </LibraryForm>
                </div>

                <SheetFooter className="flex-none border-t p-6">
                    <Button disabled={isLoading} type="submit">
                        {isLoading ? "Updating..." : "Update Entry"}
                    </Button>
                    <SheetClose asChild>
                        <Button disabled={isLoading} onClick={onCloseAction} type="button" variant="outline">
                            Cancel
                        </Button>
                    </SheetClose>
                </SheetFooter>
            </form>
        </Form>
    );
}
