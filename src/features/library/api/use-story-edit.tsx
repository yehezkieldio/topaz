import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod/v4";
import { useLibraryRefetch } from "#/features/library/api/use-library-data";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";
import {
    type ProgressStatus,
    type Source,
    type StoryStatus,
    progressStatusEnum,
    sourceEnum,
    storyCreateWithProgressSchema,
    storyStatusEnum,
} from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";

export const editStorySchema = storyCreateWithProgressSchema;

export type EditStoryFormData = z.infer<typeof editStorySchema>;

interface UseStoryEditProps {
    item: LibraryItem;
    onClose: () => void;
}

export function useStoryEdit({ item, onClose }: UseStoryEditProps) {
    const trpc = useTRPC();
    const refetchLibrary = useLibraryRefetch();

    const storySourceDefault = sourceEnum.enumValues.includes(item.storySource as Source)
        ? (item.storySource as Source)
        : "ArchiveOfOurOwn";
    const progressStatusDefault = progressStatusEnum.enumValues.includes(item.progressStatus)
        ? (item.progressStatus as ProgressStatus)
        : "Reading";
    const storyStatusDefault = storyStatusEnum.enumValues.includes(item.storyStatus as StoryStatus)
        ? (item.storyStatus as StoryStatus)
        : "Ongoing";

    const form = useForm<EditStoryFormData>({
        resolver: zodResolver(editStorySchema),
        defaultValues: {
            storyPublicId: item.storyPublicId,
            progressPublicId: item.progressPublicId,
            title: item.storyTitle || "",
            author: item.storyAuthor || "",
            url: item.storyUrl || "",
            source: storySourceDefault,
            description: item.storyDescription || "",
            chapter_count: item.storyChapterCount || 0,
            word_count: item.storyWordCount || 0,
            is_nsfw: item.storyIsNsfw ?? false,
            status: storyStatusDefault,
            progressStatus: progressStatusDefault,
            current_chapter: item.progressCurrentChapter || 0,
            rating: item.progressRating?.toString(),
            notes: item.progressNotes || "",
            tagIds: item.tags?.map((tag) => tag.publicId) || [],
            fandomIds: item.fandoms?.map((fandom) => fandom.publicId) || [],
        },
    });

    const updateStoryWithRelations = useMutation(trpc.story.updateWithRelations.mutationOptions());
    const refreshViews = useMutation(trpc.view.refreshAll.mutationOptions());

    const onSubmit = async (data: EditStoryFormData) => {
        try {
            await updateStoryWithRelations.mutateAsync({
                storyPublicId: data.storyPublicId,
                progressPublicId: data.progressPublicId,
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
                rating: data.rating.toString(),
                notes: data.notes,
                tagIds: data.tagIds,
                fandomIds: data.fandomIds,
            });

            onClose();

            await refreshViews.mutateAsync();
            form.reset();

            refetchLibrary();

            toast.success("Library entry updated!");
        } catch (error) {
            toast.error("Failed to update library entry.");
            console.error("Error updating story:", error);
        }
    };

    return {
        form,
        onSubmit,
        isLoading: updateStoryWithRelations.isPending || refreshViews.isPending,
    };
}
