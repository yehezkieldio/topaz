import { z } from "zod/v4";
import { publicIdSchema } from "#/server/api/schemas/common";
import { progressQuerySchema } from "#/server/api/schemas/library";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "#/server/api/trpc";
import { invalidateLibraryReadModels } from "#/server/backend/cache/tags";
import {
    deleteProgress,
    listLibraryProgress,
    refreshLibraryReadModels,
} from "#/server/db/repositories/library-repository";

export type { ProgressQueryResult } from "#/server/db/repositories/library-repository";

export const progressRouter = createTRPCRouter({
    delete: protectedProcedure.input(z.object({ publicId: publicIdSchema })).mutation(async ({ ctx, input }) => {
        const deletedProgress = await deleteProgress(ctx.db, input.publicId);

        await refreshLibraryReadModels(ctx.db);
        await invalidateLibraryReadModels();

        return deletedProgress;
    }),
    all: publicProcedure
        .input(progressQuerySchema)
        .query(async ({ ctx, input }) => await listLibraryProgress(ctx.db, input)),
});
