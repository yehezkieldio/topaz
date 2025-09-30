/**
 * Edit sheet for updating existing stories.
 */

"use client";

import { memo } from "react";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import { useStoryEditForm } from "../../hooks/use-form-mutations";
import { useSheetStore } from "../../state/ui-store";
import { LibraryForm } from "../forms/library-form";
import { LibraryStoryCategoriesForm } from "../forms/library-story-categories-form";
import { LibraryStoryDetailsForm } from "../forms/library-story-details-form";
import { LibraryStoryInfoForm } from "../forms/library-story-info-form";
import { LibraryStoryProgressForm } from "../forms/library-story-progress-form";

/**
 * Sheet for editing library stories.
 */
export const LibraryEditSheet = memo(function LibraryEditSheet() {
    const isOpen = useSheetStore((state) => state.isEditSheetOpen);
    const closeSheet = useSheetStore((state) => state.closeEditSheet);
    const selectedStory = useSheetStore((state) => state.selectedStory);

    // Call hook unconditionally, but provide a default fallback story
    const { form, onSubmit, isLoading } = useStoryEditForm(selectedStory ?? null, closeSheet);

    if (!selectedStory) {
        return null;
    }

    return (
        <Sheet onOpenChange={(open) => !open && closeSheet()} open={isOpen}>
            <SheetContent className="flex flex-col p-0 sm:max-w-2xl">
                <SheetHeader className="px-6 pt-6">
                    <SheetTitle>Edit Story</SheetTitle>
                    <SheetDescription>Update details for {selectedStory.storyTitle}</SheetDescription>
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
                                {isLoading ? "Saving..." : "Save Changes"}
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
