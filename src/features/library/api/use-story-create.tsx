import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod/v4";
import { useLibraryRefetch } from "#/features/library/api/use-library-data";
import { storyCreateWithProgressSchema } from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";

export const createStorySchema = storyCreateWithProgressSchema.omit({
    storyPublicId: true,
    progressPublicId: true,
});

export type CreateStoryFormData = z.infer<typeof createStorySchema>;

export function useStoryCreate({ onClose }: { onClose: () => void }) {
    const trpc = useTRPC();
    const refetchLibrary = useLibraryRefetch();

    const form = useForm<CreateStoryFormData>({
        resolver: zodResolver(createStorySchema),
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

    const onSubmit = async (data: CreateStoryFormData) => {
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
                tagIds: data.tagIds,
                fandomIds: data.fandomIds,
                progressStatus: data.progressStatus,
                current_chapter: data.current_chapter,
                rating: Number(data.rating),
                notes: data.notes,
            });

            onClose();

            await refreshViews.mutateAsync();
            form.reset();

            refetchLibrary();

            toast.success("Story added to library!");
        } catch (error) {
            toast.error("Failed to add story.");
            console.error("Error creating story:", error);
        }
    };

    return {
        form,
        onSubmit,
        isLoading: createStoryWithProgress.isPending || refreshViews.isPending,
    };
}
