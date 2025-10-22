import { isDevelopment } from "#/env";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "#/server/api/trpc";
import { libraryMaterializedView, libraryStatsMaterializedView } from "#/server/db/schema/view";

export const viewRouter = createTRPCRouter({
    refreshAll: protectedProcedure.mutation(async ({ ctx }) => {
        await ctx.db.refreshMaterializedView(libraryMaterializedView).concurrently();
        await ctx.db.refreshMaterializedView(libraryStatsMaterializedView);
        if (isDevelopment === false) {
            console.log("[trpc] Refreshed all materialized views");
        }

        return { success: true };
    }),
    refreshLibrary: protectedProcedure.mutation(async ({ ctx }) => {
        await ctx.db.refreshMaterializedView(libraryMaterializedView).concurrently();
        if (isDevelopment === false) {
            console.log("[trpc] Refreshed user library materialized view");
        }

        return { success: true };
    }),
    refreshLibraryStats: protectedProcedure.mutation(async ({ ctx }) => {
        await ctx.db.refreshMaterializedView(libraryStatsMaterializedView);
        if (isDevelopment === false) {
            console.log("[trpc] Refreshed user library stats materialized view");
        }

        return { success: true };
    }),
    getStats: publicProcedure.query(async ({ ctx }) => {
        const stats = await ctx.db.select().from(libraryStatsMaterializedView);
        return stats[0] || {};
    }),
});
