import { libraryQuerySchema } from "#/server/api/schemas/library";
import { adminProcedure, createTRPCRouter, publicProcedure } from "#/server/api/trpc";
import { getLibraryStats, listLibraryEntries, seedV2ReferenceData } from "#/server/db/repositories/library-repository";

export type { LibraryQueryResult } from "#/server/db/repositories/library-repository";

export const libraryRouter = createTRPCRouter({
    all: publicProcedure
        .input(libraryQuerySchema)
        .query(async ({ ctx, input }) => await listLibraryEntries(ctx.db, input)),
    getStats: publicProcedure.query(async () => await getLibraryStats()),
    seedReferenceData: adminProcedure.mutation(async ({ ctx }) => await seedV2ReferenceData(ctx.db)),
});
