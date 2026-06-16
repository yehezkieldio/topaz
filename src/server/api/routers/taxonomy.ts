import { z } from "zod/v4";
import { publicIdSchema } from "#/server/api/schemas/common";
import { createTRPCRouter, protectedProcedure } from "#/server/api/trpc";
import { invalidateTaxonomyReadModels } from "#/server/backend/cache/tags";
import {
    createTaxonomyTerm,
    createTaxonomyTermForMultiselect,
    deleteTaxonomyTerm,
    getTaxonomyMultiselect,
    HOT_LIMIT_DEFAULT,
    HOT_LIMIT_MAX,
    HOT_LIMIT_MIN,
    MULTISELECT_LIMIT_DEFAULT,
    MULTISELECT_LIMIT_MAX,
    MULTISELECT_LIMIT_MIN,
    TAXONOMY_NAME_MAX,
    TAXONOMY_NAME_MIN,
    updateTaxonomyTerm,
} from "#/server/db/repositories/taxonomy-repository";
import { taxonomyKindEnum } from "#/server/db/schema/taxonomy";

export const taxonomyRouter = createTRPCRouter({
    delete: protectedProcedure.input(z.object({ publicId: publicIdSchema })).mutation(async ({ ctx, input }) => {
        const deletedTerm = await deleteTaxonomyTerm(ctx.db, input.publicId);
        await invalidateTaxonomyReadModels();
        return deletedTerm;
    }),
    update: protectedProcedure
        .input(
            z.object({
                publicId: publicIdSchema,
                kind: taxonomyKindEnum.optional(),
                name: z.string().min(1).max(255).optional(),
                slug: z.string().min(1).max(255).optional(),
                description: z.string().nullable().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const updatedTerm = await updateTaxonomyTerm(ctx.db, input);
            await invalidateTaxonomyReadModels();
            return updatedTerm;
        }),
    create: protectedProcedure
        .input(
            z.object({
                kind: taxonomyKindEnum,
                name: z.string().min(1).max(255),
                slug: z.string().min(1).max(255).optional(),
                description: z.string().nullable().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const newTerm = await createTaxonomyTerm(ctx.db, input);
            await invalidateTaxonomyReadModels();
            return newTerm;
        }),
    forMultiselect: protectedProcedure
        .input(
            z.object({
                kind: taxonomyKindEnum.optional(),
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
        .query(async ({ input }) => await getTaxonomyMultiselect(input)),
    createForMultiselect: protectedProcedure
        .input(
            z.object({
                kind: taxonomyKindEnum.default("trope"),
                name: z.string().min(TAXONOMY_NAME_MIN).max(TAXONOMY_NAME_MAX),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const term = await createTaxonomyTermForMultiselect(ctx.db, input);
            await invalidateTaxonomyReadModels();
            return term;
        }),
});
