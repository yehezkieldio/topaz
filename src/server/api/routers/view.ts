import { createTRPCRouter, publicProcedure } from "#/server/api/trpc";
import { getLibraryStats } from "#/server/db/repositories/library-repository";

export const viewRouter = createTRPCRouter({
    getStats: publicProcedure.query(async () => await getLibraryStats()),
});
