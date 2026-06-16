import { z } from "zod/v4";
import { adminProcedure, createTRPCRouter } from "#/server/api/trpc";
import { invalidateLibraryReadModels, invalidateTaxonomyReadModels } from "#/server/backend/cache/tags";
import {
    assignTaxonomyTermsToWork,
    createLibraryItem,
    deleteWork,
    rebuildEffectiveTaxonomyForWork,
    updateLibraryItem,
} from "#/server/db/repositories/library-repository";
import { workWithLibraryEntrySchema } from "#/server/db/schema/work";

export const workRouter = createTRPCRouter({
    createWithLibraryEntry: adminProcedure
        .input(
            workWithLibraryEntrySchema.omit({
                workPublicId: true,
                libraryEntryPublicId: true,
                workVersion: true,
                libraryEntryVersion: true,
            })
        )
        .mutation(async ({ ctx, input }) => {
            const created = await createLibraryItem(ctx.db, {
                userId: ctx.session.user.id,
                title: input.title,
                author: input.author,
                url: input.url,
                source: input.source,
                description: input.description ?? null,
                chapterCount: input.chapter_count,
                wordCount: input.word_count,
                isNsfw: input.is_nsfw,
                workStatus: input.status,
                status: input.libraryEntryStatus,
                currentChapter: input.current_chapter,
                rating: input.rating === "" ? null : Number(input.rating),
                notes: input.notes ?? null,
                taxonomyTermPublicIds: input.taxonomyTermIds,
            });

            await invalidateLibraryReadModels();
            await invalidateTaxonomyReadModels();
            return created;
        }),
    updateWithLibraryEntry: adminProcedure.input(workWithLibraryEntrySchema).mutation(async ({ ctx, input }) => {
        const updated = await updateLibraryItem(ctx.db, {
            workPublicId: input.workPublicId,
            libraryEntryPublicId: input.libraryEntryPublicId,
            workVersion: input.workVersion,
            libraryEntryVersion: input.libraryEntryVersion,
            title: input.title,
            author: input.author,
            url: input.url,
            source: input.source,
            description: input.description ?? null,
            chapterCount: input.chapter_count,
            wordCount: input.word_count,
            isNsfw: input.is_nsfw,
            workStatus: input.status,
            status: input.libraryEntryStatus,
            currentChapter: input.current_chapter,
            rating: input.rating === "" ? null : Number(input.rating),
            notes: input.notes ?? null,
            taxonomyTermPublicIds: input.taxonomyTermIds,
        });

        await invalidateLibraryReadModels();
        await invalidateTaxonomyReadModels();
        return updated;
    }),
    delete: adminProcedure.input(z.object({ publicId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
        const deleted = await deleteWork(ctx.db, input.publicId);
        await invalidateLibraryReadModels();
        await invalidateTaxonomyReadModels();
        return deleted;
    }),
    assignTaxonomy: adminProcedure
        .input(z.object({ workId: z.uuid(), termPublicIds: z.array(z.string()).default([]) }))
        .mutation(async ({ ctx, input }) => {
            const assigned = await assignTaxonomyTermsToWork(ctx.db, input);
            await invalidateLibraryReadModels();
            await invalidateTaxonomyReadModels();
            return assigned;
        }),
    rebuildEffectiveTaxonomy: adminProcedure.input(z.object({ workId: z.uuid() })).mutation(async ({ ctx, input }) => {
        const effectiveRows = await rebuildEffectiveTaxonomyForWork(ctx.db, input.workId);
        await invalidateLibraryReadModels();
        return effectiveRows;
    }),
});
