import { adminProcedure, createTRPCRouter, publicProcedure } from "#/server/api/trpc";
import { invalidateLibraryReadModels } from "#/server/backend/cache/tags";
import { getLibraryStats } from "#/server/db/repositories/library-repository";

export const viewRouter = createTRPCRouter({
    refreshAll: adminProcedure.mutation(async () => {
        await invalidateLibraryReadModels();
        return { success: true };
    }),
    refreshLibrary: adminProcedure.mutation(async () => {
        await invalidateLibraryReadModels();
        return { success: true };
    }),
    refreshLibraryStats: adminProcedure.mutation(async () => {
        await invalidateLibraryReadModels();
        return { success: true };
    }),
    getStats: publicProcedure.query(async () => await getLibraryStats()),
});
