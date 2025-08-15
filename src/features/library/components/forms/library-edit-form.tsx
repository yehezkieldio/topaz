import { Button } from "#/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "#/components/ui/form";
import { ProgressControls } from "#/components/ui/progress-controls";
import { SheetClose, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import { useStoryEdit } from "#/features/library/api/use-story-edit";
import { LibraryForm } from "#/features/library/components/forms/library-form";
import { LibraryStoryCategoriesForm } from "#/features/library/components/forms/library-story-categories-form";
import { LibraryStoryDetailsForm } from "#/features/library/components/forms/library-story-details-form";
import { LibraryStoryInfoForm } from "#/features/library/components/forms/library-story-info-form";
import { LibraryStoryProgressForm } from "#/features/library/components/forms/library-story-progress-form";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";
import { useIsMobile } from "#/hooks/use-mobile";

type LibraryEditFormProps = {
    item: LibraryItem;
    onCloseAction: () => void;
};

export function LibraryEditForm({ item, onCloseAction }: LibraryEditFormProps) {
    const { form, onSubmit, isLoading } = useStoryEdit({ item, onCloseAction });
    const isMobile = useIsMobile();

    const currentChapter = form.watch("current_chapter");
    const totalChapters = form.watch("chapter_count");

    const handleChapterIncrement = () => {
        const current = currentChapter;
        const max = totalChapters || Number.POSITIVE_INFINITY;
        if (current < max) {
            form.setValue("current_chapter", current + 1);
        }
    };

    const handleChapterDecrement = () => {
        const current = currentChapter;
        if (current > 0) {
            form.setValue("current_chapter", current - 1);
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
                            <LibraryStoryInfoForm />
                        </LibraryForm.Info>
                        <LibraryForm.Details>
                            <LibraryStoryDetailsForm />
                        </LibraryForm.Details>
                        <LibraryForm.Categories initialFandoms={item.fandoms || []} initialTags={item.tags || []}>
                            <LibraryStoryCategoriesForm
                                initialFandoms={item.fandoms || []}
                                initialTags={item.tags || []}
                            />
                        </LibraryForm.Categories>
                        <LibraryForm.Progress>
                            <LibraryStoryProgressForm />
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
