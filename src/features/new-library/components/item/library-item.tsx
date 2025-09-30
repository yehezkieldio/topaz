/**
 * Optimized library item card component.
 */

"use client";

import { memo } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Progress } from "#/components/ui/progress";
import type { LibraryStory, StoryActions } from "../../core/types";
import { useStoryValues } from "../../hooks/use-story-values";

interface LibraryItemProps {
    readonly story: LibraryStory;
    readonly actions: StoryActions;
    readonly showAdminControls?: boolean;
}

/**
 * Individual library item card with memoization for performance.
 * Only re-renders when story data actually changes.
 */
export const LibraryItem = memo(
    function LibraryItem({ story, actions, showAdminControls = false }: LibraryItemProps) {
        const values = useStoryValues(story);

        return (
            <div className="flex h-full flex-col rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 p-6">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 font-semibold text-xl leading-none tracking-tight">
                            {story.storyTitle}
                        </h3>
                        {values.isNsfw && (
                            <Badge className="shrink-0" variant="destructive">
                                NSFW
                            </Badge>
                        )}
                    </div>
                    {story.storyAuthor && (
                        <p className="line-clamp-1 text-muted-foreground text-sm">{story.storyAuthor}</p>
                    )}
                </div>

                <div className="flex-1 space-y-4 p-6 pt-0">
                    {values.hasDescription && (
                        <p className="line-clamp-3 text-muted-foreground text-sm">{story.storyDescription}</p>
                    )}

                    {values.hasReadingProgress && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium">
                                    {values.currentChapter}
                                    {values.hasValidChapterData && ` / ${values.totalChapters}`}
                                </span>
                            </div>
                            {values.hasValidChapterData && <Progress value={values.progressPercentage} />}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {story.progressStatus && (
                            <Badge className="capitalize" variant="outline">
                                {story.progressStatus.replace("-", " ")}
                            </Badge>
                        )}
                        {values.isComplete && <Badge variant="secondary">Complete</Badge>}
                        {values.hasWordCount && <Badge variant="outline">{values.formattedWordCount} words</Badge>}
                    </div>

                    {values.hasFandomsOrTags && (
                        <div className="space-y-1">
                            {story.fandoms && story.fandoms.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {story.fandoms.slice(0, 3).map((fandom) => (
                                        <Badge className="text-xs" key={fandom.publicId} variant="secondary">
                                            {fandom.name}
                                        </Badge>
                                    ))}
                                    {story.fandoms.length > 3 && (
                                        <Badge className="text-xs" variant="secondary">
                                            +{story.fandoms.length - 3}
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 p-6 pt-0">
                    <Button className="flex-1" onClick={() => actions.onView(story)} size="sm" variant="outline">
                        View
                    </Button>
                    {showAdminControls && (
                        <>
                            <Button onClick={() => actions.onEdit(story)} size="sm" variant="outline">
                                Edit
                            </Button>
                            <Button onClick={() => actions.onDelete(story)} size="sm" variant="destructive">
                                Delete
                            </Button>
                        </>
                    )}
                </div>
            </div>
        );
    },
    (prevProps, nextProps) => {
        // Custom comparison for optimal memoization
        return (
            prevProps.story.progressPublicId === nextProps.story.progressPublicId &&
            prevProps.story.updatedAt === nextProps.story.updatedAt &&
            prevProps.showAdminControls === nextProps.showAdminControls
        );
    },
);
