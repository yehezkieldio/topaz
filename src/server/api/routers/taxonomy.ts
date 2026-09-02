import { z } from "zod/v4";
import { publicIdSchema } from "#/server/api/schemas/common";
import { adminProcedure, createTRPCRouter } from "#/server/api/trpc";
import { invalidateAllBackendReadModels, invalidateTaxonomyReadModels } from "#/server/backend/cache/tags";
import {
    createTaxonomyRelation,
    createTaxonomyTerm,
    createTaxonomyTermForMultiselect,
    deleteTaxonomyRelation,
    deleteTaxonomyTerm,
    getTaxonomyMultiselect,
    HOT_LIMIT_DEFAULT,
    HOT_LIMIT_MAX,
    HOT_LIMIT_MIN,
    LIST_LIMIT_DEFAULT,
    LIST_LIMIT_MAX,
    LIST_LIMIT_MIN,
    listTaxonomyRelations,
    listTaxonomyTerms,
    MULTISELECT_LIMIT_DEFAULT,
    MULTISELECT_LIMIT_MAX,
    MULTISELECT_LIMIT_MIN,
    TAXONOMY_NAME_MAX,
    TAXONOMY_NAME_MIN,
    updateTaxonomyTerm,
} from "#/server/db/repositories/taxonomy-repository";
import { taxonomyKindEnum, taxonomyRelationTypeEnum } from "#/server/db/schema/taxonomy";

export const taxonomyRouter = createTRPCRouter({
    create: adminProcedure
        .input(
            z.object({
                description: z.string().nullable().optional(),
                kind: taxonomyKindEnum,
                name: z.string().min(1).max(255),
                slug: z.string().min(1).max(255).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const newTerm = await createTaxonomyTerm(ctx.db, input);
            await invalidateTaxonomyReadModels();
            return newTerm;
        }),
    createForMultiselect: adminProcedure
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
    createRelation: adminProcedure
        .input(
            z.object({
                fromTermPublicId: publicIdSchema,
                relationType: taxonomyRelationTypeEnum,
                toTermPublicId: publicIdSchema,
            })
        )
        .mutation(async ({ ctx, input }) => {
            const relation = await createTaxonomyRelation(ctx.db, input);
            await invalidateAllBackendReadModels();
            return relation;
        }),
    delete: adminProcedure.input(z.object({ publicId: publicIdSchema })).mutation(async ({ ctx, input }) => {
        const deletedTerm = await deleteTaxonomyTerm(ctx.db, input.publicId);
        await invalidateAllBackendReadModels();
        return deletedTerm;
    }),
    deleteRelation: adminProcedure.input(z.object({ publicId: publicIdSchema })).mutation(async ({ ctx, input }) => {
        const relation = await deleteTaxonomyRelation(ctx.db, input.publicId);
        await invalidateAllBackendReadModels();
        return relation;
    }),
    forMultiselect: adminProcedure
        .input(
            z.object({
                hotLimit: z.number().min(HOT_LIMIT_MIN).max(HOT_LIMIT_MAX).default(HOT_LIMIT_DEFAULT),
                includeHot: z.boolean().default(true),
                kind: taxonomyKindEnum.optional(),
                limit: z
                    .number()
                    .min(MULTISELECT_LIMIT_MIN)
                    .max(MULTISELECT_LIMIT_MAX)
                    .default(MULTISELECT_LIMIT_DEFAULT),
                search: z.string().optional(),
            })
        )
        .query(async ({ input }) => await getTaxonomyMultiselect(input)),
    list: adminProcedure
        .input(
            z.object({
                kind: taxonomyKindEnum.optional(),
                limit: z.number().min(LIST_LIMIT_MIN).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT),
                offset: z.number().min(0).default(0),
                search: z.string().optional(),
            })
        )
        .query(async ({ input }) => await listTaxonomyTerms(input)),
    relations: adminProcedure
        .input(z.object({ termPublicId: publicIdSchema.optional() }).optional())
        .query(async ({ ctx, input }) => await listTaxonomyRelations(ctx.db, input ?? {})),
    update: adminProcedure
        .input(
            z.object({
                description: z.string().nullable().optional(),
                kind: taxonomyKindEnum.optional(),
                name: z.string().min(1).max(255).optional(),
                publicId: publicIdSchema,
                slug: z.string().min(1).max(255).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const updatedTerm = await updateTaxonomyTerm(ctx.db, input);
            await invalidateTaxonomyReadModels();
            return updatedTerm;
        }),
});
