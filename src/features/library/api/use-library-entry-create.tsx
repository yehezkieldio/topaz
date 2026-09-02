import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod/v4";
import { useLibraryRefetch } from "#/features/library/api/use-library-data";
import { useSearchQuery } from "#/features/library/hooks/use-library-query-state";
import { workWithLibraryEntrySchema } from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";

export const createLibraryEntrySchema = workWithLibraryEntrySchema.omit({
    libraryEntryPublicId: true,
    libraryEntryVersion: true,
    workPublicId: true,
    workVersion: true,
});

export type CreateLibraryEntryFormData = z.infer<typeof createLibraryEntrySchema>;

export function useLibraryEntryCreate({ onClose }: { onClose: () => void }) {
    const trpc = useTRPC();
    const refetchLibrary = useLibraryRefetch();
    const [, setSearch] = useSearchQuery();

    const form = useForm<CreateLibraryEntryFormData>({
        defaultValues: {
            author: "",
            chapter_count: 0,
            current_chapter: 0,
            description: "",
            is_nsfw: false,
            libraryEntryStatus: "Reading",
            notes: "",
            rating: "",
            source: "ArchiveOfOurOwn",
            status: "Ongoing",
            taxonomyTermIds: [],
            title: "",
            url: "",
            word_count: 0,
        },
        resolver: zodResolver(createLibraryEntrySchema),
    });

    const createWorkWithLibraryEntry = useMutation(trpc.work.createWithLibraryEntry.mutationOptions());

    const onSubmit = async (data: CreateLibraryEntryFormData) => {
        try {
            await createWorkWithLibraryEntry.mutateAsync({
                author: data.author,
                chapter_count: data.chapter_count,
                current_chapter: data.current_chapter,
                description: data.description || "",
                is_nsfw: data.is_nsfw,
                libraryEntryStatus: data.libraryEntryStatus,
                notes: data.notes,
                rating: data.rating,
                source: data.source,
                status: data.status,
                taxonomyTermIds: data.taxonomyTermIds,
                title: data.title,
                url: data.url,
                word_count: data.word_count,
            });

            onClose();

            form.reset();

            await setSearch("");
            await refetchLibrary();

            toast.success("Work added to library.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to add work.");
            console.error("Error creating library work:", error);
        }
    };

    return {
        form,
        isLoading: createWorkWithLibraryEntry.isPending,
        onSubmit,
    };
}
