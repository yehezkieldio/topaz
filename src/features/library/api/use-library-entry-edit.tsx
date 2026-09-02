import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod/v4";
import { useLibraryRefetch } from "#/features/library/api/use-library-data";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";
import { useSearchQuery } from "#/features/library/hooks/use-library-query-state";
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
        defaultValues: {
            author: item.sourceAuthor || "",
            chapter_count: item.sourceChapterCount || 0,
            current_chapter: item.currentChapter || 0,
            description: item.workDescription || "",
            is_nsfw: item.workIsNsfw ?? false,
            libraryEntryPublicId: item.libraryEntryPublicId,
            libraryEntryStatus: item.libraryEntryStatus,
            libraryEntryVersion: item.libraryEntryVersion,
            notes: item.readingNotes || "",
            rating: item.rating?.toString() ?? "",
            source: item.source,
            status: item.workStatus,
            taxonomyTermIds: item.directTaxonomyTerms?.map((term) => term.publicId) || [],
            title: item.workTitle || "",
            url: item.sourceUrl || "",
            word_count: item.sourceWordCount || 0,
            workPublicId: item.workPublicId,
            workVersion: item.workVersion,
        },
        resolver: zodResolver(editLibraryEntrySchema),
    });

    const updateLibraryEntryWithRelations = useMutation(trpc.work.updateWithLibraryEntry.mutationOptions());

    const onSubmit = async (data: EditLibraryEntryFormData) => {
        try {
            await updateLibraryEntryWithRelations.mutateAsync({
                author: data.author,
                chapter_count: data.chapter_count,
                current_chapter: data.current_chapter,
                description: data.description || "",
                is_nsfw: data.is_nsfw,
                libraryEntryPublicId: data.libraryEntryPublicId,
                libraryEntryStatus: data.libraryEntryStatus,
                libraryEntryVersion: data.libraryEntryVersion,
                notes: data.notes,
                rating: data.rating,
                source: data.source,
                status: data.status,
                taxonomyTermIds: data.taxonomyTermIds,
                title: data.title,
                url: data.url,
                word_count: data.word_count,
                workPublicId: data.workPublicId,
                workVersion: data.workVersion,
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
        isLoading: updateLibraryEntryWithRelations.isPending,
        onSubmit,
    };
}
