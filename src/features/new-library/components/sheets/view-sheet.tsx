/**
 * View sheet for displaying story details.
 */

"use client";

import { memo } from "react";
import { Badge } from "#/components/ui/badge";
import { Progress } from "#/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import type { LibraryStory } from "../../core/types";
import { useStoryValues } from "../../hooks/use-story-values";
import { useSheetStore } from "../../state/ui-store";

/**
 * View sheet content component.
 */
const ViewSheetContent = memo(function ViewSheetContent({ story }: { story: LibraryStory }) {
    const values = useStoryValues(story);

    return (
        <>
            <SheetHeader>
                <div className="flex items-start gap-2">
                    <SheetTitle className="flex-1">{story.storyTitle}</SheetTitle>
                    {values.isNsfw && <Badge variant="destructive">NSFW</Badge>}
                </div>
                {story.storyAuthor && <SheetDescription>{story.storyAuthor}</SheetDescription>}
            </SheetHeader>

            <div className="space-y-6 py-6">
                {values.hasDescription && (
                    <div>
                        <h3 className="mb-2 font-semibold">Description</h3>
                        <p className="text-muted-foreground text-sm">{story.storyDescription}</p>
                    </div>
                )}

                {values.hasReadingProgress && (
                    <div>
                        <h3 className="mb-2 font-semibold">Reading Progress</h3>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Current Chapter</span>
                                <span className="font-medium">
                                    {values.currentChapter}
                                    {values.hasValidChapterData && ` / ${values.totalChapters}`}
                                </span>
                            </div>
                            {values.hasValidChapterData && <Progress value={values.progressPercentage} />}
                        </div>
                    </div>
                )}

                {values.hasNotes && (
                    <div>
                        <h3 className="mb-2 font-semibold">Notes</h3>
                        <p className="text-muted-foreground text-sm">{story.progressNotes}</p>
                    </div>
                )}
            </div>
        </>
    );
});

/**
 * Sheet for viewing story details.
 */
export const LibraryViewSheet = memo(function LibraryViewSheet() {
    const isOpen = useSheetStore((state) => state.isViewSheetOpen);
    const closeSheet = useSheetStore((state) => state.closeViewSheet);
    const selectedStory = useSheetStore((state) => state.selectedStory);

    return (
        <Sheet onOpenChange={(open) => !open && closeSheet()} open={isOpen}>
            <SheetContent className="sm:max-w-2xl">
                {selectedStory ? (
                    <ViewSheetContent story={selectedStory} />
                ) : (
                    <div className="py-4">
                        <p className="text-muted-foreground text-sm">No story selected</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
});
