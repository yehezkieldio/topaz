import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { adminProcedure, createTRPCRouter } from "#/server/api/trpc";
import { invalidateLibraryReadModels, invalidateTaxonomyReadModels } from "#/server/backend/cache/tags";
import { fetchWorkMetadata } from "#/server/backend/metadata/work-metadata";
import { createLibraryItem, deleteWork, updateLibraryItem } from "#/server/db/repositories/library-repository";
import { workWithLibraryEntrySchema } from "#/server/db/schema/work";

export const workRouter = createTRPCRouter({
    createWithLibraryEntry: adminProcedure
        .input(
            workWithLibraryEntrySchema.omit({
                libraryEntryPublicId: true,
                libraryEntryVersion: true,
                workPublicId: true,
                workVersion: true,
            })
        )
        .mutation(async ({ ctx, input }) => {
            const created = await createLibraryItem(ctx.db, {
                author: input.author,
                chapterCount: input.chapter_count,
                currentChapter: input.current_chapter,
                description: input.description ?? null,
                isNsfw: input.is_nsfw,
                notes: input.notes ?? null,
                rating: input.rating === "" ? null : Number(input.rating),
                source: input.source,
                status: input.libraryEntryStatus,
                taxonomyTermPublicIds: input.taxonomyTermIds,
                title: input.title,
                url: input.url,
                userId: ctx.session.user.id,
                wordCount: input.word_count,
                workStatus: input.status,
            });

            await invalidateLibraryReadModels();
            await invalidateTaxonomyReadModels();
            return created;
        }),
    delete: adminProcedure.input(z.object({ publicId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
        const deleted = await deleteWork(ctx.db, input.publicId);
        await invalidateLibraryReadModels();
        await invalidateTaxonomyReadModels();
        return deleted;
    }),
    fetchMetadata: adminProcedure.input(z.object({ url: z.url() })).mutation(async ({ input }) => {
        const metadata = await fetchWorkMetadata(input.url);

        if (!metadata) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Could not fetch story information for this URL.",
            });
        }

        return metadata;
    }),
    updateWithLibraryEntry: adminProcedure.input(workWithLibraryEntrySchema).mutation(async ({ ctx, input }) => {
        const updated = await updateLibraryItem(ctx.db, {
            author: input.author,
            chapterCount: input.chapter_count,
            currentChapter: input.current_chapter,
            description: input.description ?? null,
            isNsfw: input.is_nsfw,
            libraryEntryPublicId: input.libraryEntryPublicId,
            libraryEntryVersion: input.libraryEntryVersion,
            notes: input.notes ?? null,
            rating: input.rating === "" ? null : Number(input.rating),
            source: input.source,
            status: input.libraryEntryStatus,
            taxonomyTermPublicIds: input.taxonomyTermIds,
            title: input.title,
            url: input.url,
            wordCount: input.word_count,
            workPublicId: input.workPublicId,
            workStatus: input.status,
            workVersion: input.workVersion,
        });

        await invalidateLibraryReadModels();
        await invalidateTaxonomyReadModels();
        return updated;
    }),
});
