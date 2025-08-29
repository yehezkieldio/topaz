import { createTRPCRouter, protectedProcedure, publicProcedure } from "#/server/api/trpc";
import { CacheManager } from "#/server/cache/manager";
import { libraryMaterializedView, libraryStatsMaterializedView } from "#/server/db/schema/view";

export const viewRouter = createTRPCRouter({
    refreshAll: protectedProcedure.mutation(async ({ ctx }) => {
        await ctx.db.refreshMaterializedView(libraryMaterializedView).concurrently();
        await ctx.db.refreshMaterializedView(libraryStatsMaterializedView);
        console.log("[trpc] Refreshed user library materialized view");

        await CacheManager.invalidateView();

        return { success: true };
    }),
    refreshLibrary: protectedProcedure.mutation(async ({ ctx }) => {
        await ctx.db.refreshMaterializedView(libraryMaterializedView).concurrently();
        console.log("[trpc] Refreshed user library materialized view");

        await CacheManager.invalidateByTags(["view", "progress"]);

        return { success: true };
    }),
    refreshLibraryStats: protectedProcedure.mutation(async ({ ctx }) => {
        await ctx.db.refreshMaterializedView(libraryStatsMaterializedView);
        console.log("[trpc] Refreshed user library stats materialized view");

        await CacheManager.invalidateByTags(["view", "stats"]);

        return { success: true };
    }),
    getStats: publicProcedure.query(async ({ ctx }) => {
        return CacheManager.getWithSingleflight(
            "stats",
            "library",
            async () => {
                const stats = await ctx.db.select().from(libraryStatsMaterializedView);
                return stats[0] || {};
            },
            { ttl: 300 },
            ["view", "stats"],
        );
    }),
});
