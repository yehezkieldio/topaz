/**
 * Custom hooks for form mutations (create and edit stories).
 * Handles form initialization, submission, and loading states.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { LibraryStory } from "#/features/new-library/core/types";
import { progressStatusEnum } from "#/server/db/schema/progress";
import { sourceEnum, storyStatusEnum } from "#/server/db/schema/story";
import { useTRPC } from "#/trpc/react";

/**
 * Form data schema matching the API requirements.
 */
const storyFormSchema = z.object({
    // Story fields
    title: z.string().min(1, "Title is required"),
    author: z.string().min(1, "Author is required"),
    url: z.string().url("Must be a valid URL"),
    source: z.enum(sourceEnum.enumValues),
    description: z.string().optional(),
    chapter_count: z.number().min(0),
    word_count: z.number().min(0),
    is_nsfw: z.boolean(),
    status: z.enum(storyStatusEnum.enumValues),

    // Progress fields
    progressStatus: z.enum(progressStatusEnum.enumValues),
    current_chapter: z.number().min(0),
    rating: z.string(),
    notes: z.string().optional(),

    // Relation fields
    tagIds: z.array(z.string()),
    fandomIds: z.array(z.string()),

    // Optional IDs for editing
    storyPublicId: z.string().optional(),
    progressPublicId: z.string().optional(),
});

export type StoryFormData = z.infer<typeof storyFormSchema>;

/**
 * Hook for creating new stories.
 */
export function useStoryCreateForm(onClose: () => void) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const form = useForm<StoryFormData>({
        resolver: zodResolver(storyFormSchema),
        defaultValues: {
            title: "",
            author: "",
            url: "",
            source: "ArchiveOfOurOwn",
            description: "",
            chapter_count: 0,
            word_count: 0,
            is_nsfw: false,
            status: "Ongoing",
            progressStatus: "Reading",
            current_chapter: 0,
            rating: "0",
            notes: "",
            tagIds: [],
            fandomIds: [],
        },
    });

    const createStoryWithProgress = useMutation(trpc.story.createWithProgress.mutationOptions());
    const refreshViews = useMutation(trpc.view.refreshAll.mutationOptions());

    const onSubmit = useCallback(
        async (data: StoryFormData) => {
            try {
                await createStoryWithProgress.mutateAsync({
                    title: data.title,
                    author: data.author,
                    url: data.url,
                    source: data.source,
                    description: data.description || "",
                    word_count: data.word_count,
                    chapter_count: data.chapter_count,
                    is_nsfw: data.is_nsfw,
                    status: data.status,
                    tagIds: data.tagIds ?? [],
                    fandomIds: data.fandomIds ?? [],
                    progressStatus: data.progressStatus,
                    current_chapter: data.current_chapter,
                    rating: Number(data.rating),
                    notes: data.notes,
                });

                // Invalidate all progress queries to refresh data
                await queryClient.invalidateQueries({ queryKey: [["progress"]] });
                await refreshViews.mutateAsync();

                form.reset();
                onClose();

                toast.success("Story added to library!");
            } catch (error) {
                toast.error("Failed to add story.");
                console.error("Error creating story:", error);
            }
        },
        [createStoryWithProgress, refreshViews, queryClient, form, onClose],
    );

    return {
        form,
        onSubmit: form.handleSubmit(onSubmit),
        isLoading: createStoryWithProgress.isPending || refreshViews.isPending,
    };
}

/**
 * Hook for editing existing stories.
 */
export function useStoryEditForm(story: LibraryStory | null, onClose: () => void) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const form = useForm<StoryFormData>({
        resolver: zodResolver(storyFormSchema),
        defaultValues: story
            ? {
                  storyPublicId: story.storyPublicId,
                  progressPublicId: story.progressPublicId,
                  title: story.storyTitle || "",
                  author: story.storyAuthor || "",
                  url: story.storyUrl || "",
                  source: story.storySource as StoryFormData["source"],
                  description: story.storyDescription || "",
                  chapter_count: story.storyChapterCount || 0,
                  word_count: story.storyWordCount || 0,
                  is_nsfw: story.storyIsNsfw ?? false,
                  status: story.storyStatus as StoryFormData["status"],
                  progressStatus: story.progressStatus as StoryFormData["progressStatus"],
                  current_chapter: story.progressCurrentChapter || 0,
                  rating: story.progressRating?.toString() ?? "0",
                  notes: story.progressNotes || "",
                  tagIds: story.tags?.map((tag) => tag.publicId) ?? [],
                  fandomIds: story.fandoms?.map((fandom) => fandom.publicId) ?? [],
              }
            : {
                  title: "",
                  author: "",
                  url: "",
                  source: "ArchiveOfOurOwn",
                  description: "",
                  chapter_count: 0,
                  word_count: 0,
                  is_nsfw: false,
                  status: "Ongoing",
                  progressStatus: "Reading",
                  current_chapter: 0,
                  rating: "0",
                  notes: "",
                  tagIds: [],
                  fandomIds: [],
              },
    });

    const updateStoryWithRelations = useMutation(trpc.story.updateWithRelations.mutationOptions());
    const refreshViews = useMutation(trpc.view.refreshAll.mutationOptions());

    const onSubmit = useCallback(
        async (data: StoryFormData) => {
            const hasRequiredIds = Boolean(data.storyPublicId && data.progressPublicId);
            if (!hasRequiredIds) {
                toast.error("Missing required IDs.");
                return;
            }

            try {
                await updateStoryWithRelations.mutateAsync({
                    storyPublicId: data.storyPublicId as string,
                    progressPublicId: data.progressPublicId as string,
                    title: data.title,
                    author: data.author,
                    url: data.url,
                    source: data.source,
                    description: data.description || "",
                    word_count: data.word_count,
                    chapter_count: data.chapter_count,
                    is_nsfw: data.is_nsfw,
                    status: data.status,
                    progressStatus: data.progressStatus,
                    current_chapter: data.current_chapter,
                    rating: data.rating,
                    notes: data.notes,
                    tagIds: data.tagIds ?? [],
                    fandomIds: data.fandomIds ?? [],
                });

                // Invalidate all progress queries to refresh data
                await queryClient.invalidateQueries({ queryKey: [["progress"]] });
                await refreshViews.mutateAsync();

                form.reset();
                onClose();

                toast.success("Story updated successfully!");
            } catch (error) {
                toast.error("Failed to update story.");
                console.error("Error updating story:", error);
            }
        },
        [updateStoryWithRelations, refreshViews, queryClient, form, onClose],
    );

    return {
        form,
        onSubmit: form.handleSubmit(onSubmit),
        isLoading: updateStoryWithRelations.isPending || refreshViews.isPending,
    };
}
