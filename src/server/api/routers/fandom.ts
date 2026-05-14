import { z } from "zod/v4";
import { publicIdSchema } from "#/server/api/schemas/common";
import { createTRPCRouter, protectedProcedure } from "#/server/api/trpc";
import { invalidateFandomReadModels } from "#/server/backend/cache/tags";
import {
    createFandom,
    createFandomForMultiselect,
    deleteFandom,
    getFandomMultiselect,
    HOT_LIMIT_DEFAULT,
    HOT_LIMIT_MAX,
    HOT_LIMIT_MIN,
    MULTISELECT_LIMIT_DEFAULT,
    MULTISELECT_LIMIT_MAX,
    MULTISELECT_LIMIT_MIN,
    TAXONOMY_NAME_MAX,
    TAXONOMY_NAME_MIN,
    updateFandom,
} from "#/server/db/repositories/taxonomy-repository";
import { fandomCreateSchema, fandomUpdateSchema } from "#/server/db/schema/fandom";

export const fandomRouter = createTRPCRouter({
    delete: protectedProcedure.input(z.object({ publicId: publicIdSchema })).mutation(async ({ ctx, input }) => {
        const deletedFandom = await deleteFandom(ctx.db, input.publicId);
        await invalidateFandomReadModels();
        return deletedFandom;
    }),
    update: protectedProcedure.input(fandomUpdateSchema).mutation(async ({ ctx, input }) => {
        const updatedFandom = await updateFandom(ctx.db, input);
        await invalidateFandomReadModels();
        return updatedFandom;
    }),
    create: protectedProcedure.input(fandomCreateSchema).mutation(async ({ ctx, input }) => {
        const newFandom = await createFandom(ctx.db, input.name);
        await invalidateFandomReadModels();
        return newFandom;
    }),
    forMultiselect: protectedProcedure
        .input(
            z.object({
                search: z.string().optional(),
                limit: z
                    .number()
                    .min(MULTISELECT_LIMIT_MIN)
                    .max(MULTISELECT_LIMIT_MAX)
                    .default(MULTISELECT_LIMIT_DEFAULT),
                includeHot: z.boolean().default(true),
                hotLimit: z.number().min(HOT_LIMIT_MIN).max(HOT_LIMIT_MAX).default(HOT_LIMIT_DEFAULT),
            })
        )
        .query(async ({ input }) => await getFandomMultiselect(input)),
    createForMultiselect: protectedProcedure
        .input(
            z.object({
                name: z.string().min(TAXONOMY_NAME_MIN).max(TAXONOMY_NAME_MAX),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const fandom = await createFandomForMultiselect(ctx.db, input.name);
            await invalidateFandomReadModels();
            return fandom;
        }),
});
