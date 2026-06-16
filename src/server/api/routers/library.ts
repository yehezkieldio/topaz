import { z } from "zod/v4";
import { publicIdSchema } from "#/server/api/schemas/common";
import { libraryQuerySchema } from "#/server/api/schemas/library";
import { adminProcedure, createTRPCRouter, publicProcedure } from "#/server/api/trpc";
import { invalidateLibraryReadModels } from "#/server/backend/cache/tags";
import {
    deleteLibraryEntry,
    getLibraryStats,
    listLibraryEntries,
    seedV2ReferenceData,
} from "#/server/db/repositories/library-repository";

export type { LibraryQueryResult } from "#/server/db/repositories/library-repository";

export const libraryRouter = createTRPCRouter({
    delete: adminProcedure.input(z.object({ publicId: publicIdSchema })).mutation(async ({ ctx, input }) => {
        const deletedEntry = await deleteLibraryEntry(ctx.db, input.publicId);
        await invalidateLibraryReadModels();
        return deletedEntry;
    }),
    all: publicProcedure
        .input(libraryQuerySchema)
        .query(async ({ ctx, input }) => await listLibraryEntries(ctx.db, input)),
    getStats: publicProcedure.query(async () => await getLibraryStats()),
    seedReferenceData: adminProcedure.mutation(async ({ ctx }) => await seedV2ReferenceData(ctx.db)),
});
