import { z } from "zod/v4";
import { publicIdSchema } from "#/server/api/schemas/common";
import { createTRPCRouter, protectedProcedure } from "#/server/api/trpc";
import { invalidateTagReadModels } from "#/server/backend/cache/tags";
import {
    createTag,
    createTagForMultiselect,
    deleteTag,
    getTagMultiselect,
    HOT_LIMIT_DEFAULT,
    HOT_LIMIT_MAX,
    HOT_LIMIT_MIN,
    MULTISELECT_LIMIT_DEFAULT,
    MULTISELECT_LIMIT_MAX,
    MULTISELECT_LIMIT_MIN,
    TAXONOMY_NAME_MAX,
    TAXONOMY_NAME_MIN,
    updateTag,
} from "#/server/db/repositories/taxonomy-repository";
import { tagCreateSchema, tagUpdateSchema } from "#/server/db/schema/tag";

export const tagRouter = createTRPCRouter({
    delete: protectedProcedure.input(z.object({ publicId: publicIdSchema })).mutation(async ({ ctx, input }) => {
        const deletedTag = await deleteTag(ctx.db, input.publicId);
        await invalidateTagReadModels();
        return deletedTag;
    }),
    update: protectedProcedure.input(tagUpdateSchema).mutation(async ({ ctx, input }) => {
        const updatedTag = await updateTag(ctx.db, input);
        await invalidateTagReadModels();
        return updatedTag;
    }),
    create: protectedProcedure.input(tagCreateSchema).mutation(async ({ ctx, input }) => {
        const newTag = await createTag(ctx.db, input.name);
        await invalidateTagReadModels();
        return newTag;
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
        .query(async ({ input }) => await getTagMultiselect(input)),
    createForMultiselect: protectedProcedure
        .input(
            z.object({
                name: z.string().min(TAXONOMY_NAME_MIN).max(TAXONOMY_NAME_MAX),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const tag = await createTagForMultiselect(ctx.db, input.name);
            await invalidateTagReadModels();
            return tag;
        }),
});
