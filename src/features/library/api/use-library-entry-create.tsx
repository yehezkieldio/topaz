import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod/v4";
import { useLibraryRefetch } from "#/features/library/api/use-library-data";
import { useSearchQuery } from "#/features/library/hooks/use-search-query";
import { workWithLibraryEntrySchema } from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";

export const createLibraryEntrySchema = workWithLibraryEntrySchema.omit({
    workPublicId: true,
    libraryEntryPublicId: true,
    workVersion: true,
    libraryEntryVersion: true,
});

export type CreateLibraryEntryFormData = z.infer<typeof createLibraryEntrySchema>;

export function useLibraryEntryCreate({ onClose }: { onClose: () => void }) {
    const trpc = useTRPC();
    const refetchLibrary = useLibraryRefetch();
    const [, setSearch] = useSearchQuery();

    const form = useForm<CreateLibraryEntryFormData>({
        resolver: zodResolver(createLibraryEntrySchema),
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
            libraryEntryStatus: "Reading",
            current_chapter: 0,
            rating: "",
            notes: "",
            taxonomyTermIds: [],
        },
    });

    const createWorkWithLibraryEntry = useMutation(trpc.work.createWithLibraryEntry.mutationOptions());

    const onSubmit = async (data: CreateLibraryEntryFormData) => {
        try {
            await createWorkWithLibraryEntry.mutateAsync({
                title: data.title,
                author: data.author,
                url: data.url,
                source: data.source,
                description: data.description || "",
                word_count: data.word_count,
                chapter_count: data.chapter_count,
                is_nsfw: data.is_nsfw,
                status: data.status,
                taxonomyTermIds: data.taxonomyTermIds,
                libraryEntryStatus: data.libraryEntryStatus,
                current_chapter: data.current_chapter,
                rating: data.rating,
                notes: data.notes,
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
        onSubmit,
        isLoading: createWorkWithLibraryEntry.isPending,
    };
}
