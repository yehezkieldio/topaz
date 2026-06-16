import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod/v4";
import { useLibraryRefetch } from "#/features/library/api/use-library-data";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";
import { useSearchQuery } from "#/features/library/hooks/use-search-query";
import { workWithLibraryEntrySchema } from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";

export const editLibraryEntrySchema = workWithLibraryEntrySchema;

export type EditLibraryEntryFormData = z.infer<typeof editLibraryEntrySchema>;

type UseLibraryEntryEditProps = {
    item: LibraryItem;
    onCloseAction: () => void;
};

export function useLibraryEntryEdit({ item, onCloseAction }: UseLibraryEntryEditProps) {
    const trpc = useTRPC();
    const refetchLibrary = useLibraryRefetch();
    const [, setSearch] = useSearchQuery();

    const form = useForm<EditLibraryEntryFormData>({
        resolver: zodResolver(editLibraryEntrySchema),
        defaultValues: {
            workPublicId: item.workPublicId,
            libraryEntryPublicId: item.libraryEntryPublicId,
            workVersion: item.workVersion,
            libraryEntryVersion: item.libraryEntryVersion,
            title: item.workTitle || "",
            author: item.sourceAuthor || "",
            url: item.sourceUrl || "",
            source: item.source,
            description: item.workDescription || "",
            chapter_count: item.sourceChapterCount || 0,
            word_count: item.sourceWordCount || 0,
            is_nsfw: item.workIsNsfw ?? false,
            status: item.workStatus,
            libraryEntryStatus: item.libraryEntryStatus,
            current_chapter: item.currentChapter || 0,
            rating: item.rating?.toString() ?? "",
            notes: item.readingNotes || "",
            taxonomyTermIds: item.directTaxonomyTerms?.map((term) => term.publicId) || [],
        },
    });

    const updateLibraryEntryWithRelations = useMutation(trpc.work.updateWithLibraryEntry.mutationOptions());

    const onSubmit = async (data: EditLibraryEntryFormData) => {
        try {
            await updateLibraryEntryWithRelations.mutateAsync({
                workPublicId: data.workPublicId,
                libraryEntryPublicId: data.libraryEntryPublicId,
                workVersion: data.workVersion,
                libraryEntryVersion: data.libraryEntryVersion,
                title: data.title,
                author: data.author,
                url: data.url,
                source: data.source,
                description: data.description || "",
                word_count: data.word_count,
                chapter_count: data.chapter_count,
                is_nsfw: data.is_nsfw,
                status: data.status,
                libraryEntryStatus: data.libraryEntryStatus,
                current_chapter: data.current_chapter,
                rating: data.rating,
                notes: data.notes,
                taxonomyTermIds: data.taxonomyTermIds,
            });

            onCloseAction();

            form.reset();

            await setSearch("");
            await refetchLibrary();

            toast.success("Library entry updated!");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update library entry.");
            console.error("Error updating library entry:", error);
        }
    };

    return {
        form,
        onSubmit,
        isLoading: updateLibraryEntryWithRelations.isPending,
    };
}
