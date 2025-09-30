/**
 * Optimized mutations for library operations.
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "#/trpc/react";
import type { StoryFormInput } from "../core/schemas";

// Map local enum values to server enum values
const mapStoryStatus = (
    status: string | undefined,
): "Completed" | "Ongoing" | "Hiatus" | "Abandoned" | "Unknown" | undefined => {
    if (!status) return;
    const statusMap: Record<string, "Completed" | "Ongoing" | "Hiatus" | "Abandoned"> = {
        complete: "Completed",
        "in-progress": "Ongoing",
        hiatus: "Hiatus",
        abandoned: "Abandoned",
    };
    return statusMap[status];
};

const mapSource = (
    source: string | undefined,
):
    | "ArchiveOfOurOwn"
    | "FanFictionNet"
    | "Wattpad"
    | "SpaceBattles"
    | "SufficientVelocity"
    | "QuestionableQuesting"
    | "RoyalRoad"
    | "WebNovel"
    | "ScribbleHub"
    | "NovelBin"
    | "Other"
    | undefined => {
    if (!source) return;
    const sourceMap: Record<
        string,
        | "ArchiveOfOurOwn"
        | "FanFictionNet"
        | "Wattpad"
        | "RoyalRoad"
        | "SpaceBattles"
        | "SufficientVelocity"
        | "QuestionableQuesting"
        | "WebNovel"
        | "ScribbleHub"
        | "NovelBin"
        | "Other"
    > = {
        ao3: "ArchiveOfOurOwn",
        ffn: "FanFictionNet",
        wattpad: "Wattpad",
        royalroad: "RoyalRoad",
        other: "Other",
    };
    return sourceMap[source];
};

/**
 * Hook for creating a new story.
 */
export function useCreateStory() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const createMutation = useMutation(trpc.story.create.mutationOptions());

    return useMutation({
        mutationFn: async (data: StoryFormInput) => {
            return await createMutation.mutateAsync({
                title: data.title,
                author: data.author,
                url: data.url || "",
                description: data.description,
                word_count: data.wordCount,
                chapter_count: data.chapterCount,
                status: mapStoryStatus(data.status),
                is_nsfw: data.isNsfw,
                source: mapSource(data.source),
                fandomIds: data.fandoms?.map((f) => f.publicId),
                tagIds: data.tags?.map((t) => t.publicId),
            });
        },
        onSuccess: async () => {
            toast.success("Story created successfully");
            await queryClient.invalidateQueries({ queryKey: [["progress", "all"]] });
        },
        onError: (error) => {
            toast.error("Failed to create story");
            console.error("Create story error:", error);
        },
    });
}

/**
 * Hook for updating an existing story.
 */
export function useUpdateStory() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const updateMutation = useMutation(trpc.story.update.mutationOptions());

    return useMutation({
        mutationFn: async ({ storyId, data }: { storyId: string; data: Partial<StoryFormInput> }) => {
            return await updateMutation.mutateAsync({
                publicId: storyId,
                author: data.author,
                chapter_count: data.chapterCount,
                description: data.description,
                is_nsfw: data.isNsfw,
                source: mapSource(data.source),
                status: mapStoryStatus(data.status),
                word_count: data.wordCount,
            });
        },
        onSuccess: async () => {
            toast.success("Story updated successfully");
            await queryClient.invalidateQueries({ queryKey: [["progress", "all"]] });
        },
        onError: (error) => {
            toast.error("Failed to update story");
            console.error("Update story error:", error);
        },
    });
}

/**
 * Hook for deleting a story.
 */
export function useDeleteStory() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const deleteMutation = useMutation(trpc.story.delete.mutationOptions());

    return useMutation({
        mutationFn: async ({ storyId }: { storyId: string; progressId: string }) => {
            return await deleteMutation.mutateAsync({
                publicId: storyId,
            });
        },
        onSuccess: async () => {
            toast.success("Story deleted successfully");
            await queryClient.invalidateQueries({ queryKey: [["progress", "all"]] });
        },
        onError: (error) => {
            toast.error("Failed to delete story");
            console.error("Delete story error:", error);
        },
    });
}
