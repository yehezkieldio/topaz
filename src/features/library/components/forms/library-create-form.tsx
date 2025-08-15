import { Button } from "#/components/ui/button";
import { Form } from "#/components/ui/form";
import { SheetClose, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import { useStoryCreate } from "#/features/library/api/use-story-create";
import { LibraryForm } from "#/features/library/components/forms/library-form";
import { LibraryStoryCategoriesForm } from "#/features/library/components/forms/library-story-categories-form";
import { LibraryStoryDetailsForm } from "#/features/library/components/forms/library-story-details-form";
import { LibraryStoryInfoForm } from "#/features/library/components/forms/library-story-info-form";
import { LibraryStoryProgressForm } from "#/features/library/components/forms/library-story-progress-form";

interface LibraryCreateFormProps {
    onClose: () => void;
}

export function LibraryCreateForm({ onClose }: LibraryCreateFormProps) {
    const { form, onSubmit, isLoading } = useStoryCreate({ onClose });

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
