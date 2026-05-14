import { isDevelopment } from "#/env";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "#/server/api/trpc";
import { invalidateLibraryReadModels } from "#/server/backend/cache/tags";
import {
    getLibraryStats,
    refreshLibraryReadModels,
    refreshLibraryStatsView,
    refreshLibraryView,
} from "#/server/db/repositories/library-repository";

export const viewRouter = createTRPCRouter({
    refreshAll: protectedProcedure.mutation(async ({ ctx }) => {
        await refreshLibraryReadModels(ctx.db);
        await invalidateLibraryReadModels();

        if (isDevelopment === false) {
            console.log("[trpc] Refreshed all materialized views");
        }

        return { success: true };
    }),
    refreshLibrary: protectedProcedure.mutation(async ({ ctx }) => {
        await refreshLibraryView(ctx.db);
        if (isDevelopment === false) {
            console.log("[trpc] Refreshed user library materialized view");
        }

        return { success: true };
    }),
    refreshLibraryStats: protectedProcedure.mutation(async ({ ctx }) => {
        await refreshLibraryStatsView(ctx.db);
        await invalidateLibraryReadModels();

        if (isDevelopment === false) {
            console.log("[trpc] Refreshed user library stats materialized view");
        }

        return { success: true };
    }),
    getStats: publicProcedure.query(async () => await getLibraryStats()),
});
