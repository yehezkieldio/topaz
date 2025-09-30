/**
 * Create sheet for adding new stories.
 */

"use client";

import { memo } from "react";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import { useStoryCreateForm } from "../../hooks/use-form-mutations";
import { useSheetStore } from "../../state/ui-store";
import { LibraryForm } from "../forms/library-form";
import { LibraryStoryCategoriesForm } from "../forms/library-story-categories-form";
import { LibraryStoryDetailsForm } from "../forms/library-story-details-form";
import { LibraryStoryInfoForm } from "../forms/library-story-info-form";
import { LibraryStoryProgressForm } from "../forms/library-story-progress-form";

/**
 * Sheet for creating new library stories.
 */
export const LibraryCreateSheet = memo(function LibraryCreateSheet() {
    const isOpen = useSheetStore((state) => state.isCreateSheetOpen);
    const closeSheet = useSheetStore((state) => state.closeCreateSheet);
    const { form, onSubmit, isLoading } = useStoryCreateForm(closeSheet);

    return (
        <Sheet onOpenChange={(open) => !open && closeSheet()} open={isOpen}>
            <SheetContent className="flex flex-col p-0 sm:max-w-2xl">
                <SheetHeader className="px-6 pt-6">
                    <SheetTitle>Add New Story</SheetTitle>
                    <SheetDescription>Add a new story to your library</SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6">
                    <form className="space-y-6 pb-6" onSubmit={onSubmit}>
                        <LibraryForm control={form.control} isLoading={isLoading}>
                            <LibraryForm.Info>
                                <LibraryStoryInfoForm />
                            </LibraryForm.Info>
                            <LibraryForm.Details>
                                <LibraryStoryDetailsForm />
                            </LibraryForm.Details>
                            <LibraryForm.Categories>
                                <LibraryStoryCategoriesForm />
                            </LibraryForm.Categories>
                            <LibraryForm.Progress>
                                <LibraryStoryProgressForm />
                            </LibraryForm.Progress>
                        </LibraryForm>
                        <div className="flex gap-2 pt-4">
                            <Button className="flex-1" disabled={isLoading} type="submit">
                                {isLoading ? "Creating..." : "Create Story"}
                            </Button>
                            <Button disabled={isLoading} onClick={closeSheet} type="button" variant="outline">
                                Cancel
                            </Button>
                        </div>
                    </form>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
});
