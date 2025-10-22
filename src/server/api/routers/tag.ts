import { TRPCError } from "@trpc/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "#/server/api/trpc";
import { storyTags } from "#/server/db/schema/story";
import { tagCreateSchema, tagUpdateSchema, tags } from "#/server/db/schema/tag";

// Tag router configuration constants
const TAG_LIMIT_MIN = 1;
const TAG_LIMIT_MAX = 50;
const TAG_LIMIT_DEFAULT = 10;
const TAG_HOT_LIMIT_MIN = 1;
const TAG_HOT_LIMIT_MAX = 20;
const TAG_HOT_LIMIT_DEFAULT = 8;
const TAG_NAME_MIN_LENGTH = 1;
const TAG_NAME_MAX_LENGTH = 255;

export const tagRouter = createTRPCRouter({
    delete: protectedProcedure
        .input(
            z.object({
                publicId: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [deletedTag] = await ctx.db.delete(tags).where(eq(tags.publicId, input.publicId)).returning({
                id: tags.id,
                publicId: tags.publicId,
            });

            if (!deletedTag) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Tag not found",
                });
            }

            return deletedTag;
        }),
    update: protectedProcedure.input(tagUpdateSchema).mutation(async ({ ctx, input }) => {
        const { publicId, ...updateData } = input;

        return await ctx.db.transaction(async (tx) => {
            if (updateData.name) {
                const [existingTag] = await tx
                    .select({
                        id: tags.id,
                        hasConflict: sql<boolean>`EXISTS(
                                SELECT 1 FROM ${tags} t2
                                WHERE t2.name = ${updateData.name}
                                AND t2.public_id != ${publicId}
                            )`.as("hasConflict"),
                    })
                    .from(tags)
                    .where(eq(tags.publicId, publicId))
                    .limit(1);

                if (!existingTag) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Tag not found",
                    });
                }

                if (existingTag.hasConflict) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "Tag with this name already exists",
                    });
                }
            }

            const [updatedTag] = await tx.update(tags).set(updateData).where(eq(tags.publicId, publicId)).returning({
                id: tags.id,
                publicId: tags.publicId,
            });

            if (!updatedTag) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Tag not found",
                });
            }

            return updatedTag;
        });
    }),
    create: protectedProcedure.input(tagCreateSchema).mutation(async ({ ctx, input }) => {
        return await ctx.db.transaction(async (tx) => {
            const existingTag = await tx.select({ id: tags.id }).from(tags).where(eq(tags.name, input.name)).limit(1);

            if (existingTag.length > 0) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Tag with this name already exists",
                });
            }

            const [newTag] = await tx.insert(tags).values(input).returning({
                id: tags.id,
                publicId: tags.publicId,
            });

            if (!newTag) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to create tag",
                });
            }

            return newTag;
        });
    }),
    forMultiselect: protectedProcedure
        .input(
            z.object({
                search: z.string().optional(),
                limit: z.number().min(TAG_LIMIT_MIN).max(TAG_LIMIT_MAX).default(TAG_LIMIT_DEFAULT),
                includeHot: z.boolean().default(true),
                hotLimit: z.number().min(TAG_HOT_LIMIT_MIN).max(TAG_HOT_LIMIT_MAX).default(TAG_HOT_LIMIT_DEFAULT),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { search, limit, includeHot, hotLimit } = input;

            let result: {
                tags: { publicId: string; name: string }[];
                canCreate: boolean;
                searchTerm: string | null;
            };

            if ((!search || search.trim().length === 0) && includeHot) {
                result = {
                    tags: await ctx.db
                        .select({
                            publicId: tags.publicId,
                            name: tags.name,
                        })
                        .from(tags)
                        .leftJoin(storyTags, eq(tags.id, storyTags.tagId))
                        .groupBy(tags.id, tags.publicId, tags.name)
                        .orderBy(desc(sql`COUNT(${storyTags.tagId})`), asc(tags.name))
                        .limit(hotLimit),
                    canCreate: false,
                    searchTerm: null,
                };
            } else if (!search || search.trim().length === 0) {
                result = {
                    tags: [],
                    canCreate: false,
                    searchTerm: null,
                };
            } else {
                const term = search.trim();
                const normalizedTerm = term.toLowerCase();
                const similarityExpr = sql<number>`similarity(LOWER(${tags.name}), ${normalizedTerm})`;
                const minSimilarity = term.length < 4 ? 0.1 : 0.2;

                const searchResults = await ctx.db
                    .select({
                        publicId: tags.publicId,
                        name: tags.name,
                    })
                    .from(tags)
                    .where(
                        sql`LOWER(${tags.name}) ILIKE ${`%${normalizedTerm}%`} OR ${similarityExpr} >= ${minSimilarity}`,
                    )
                    .orderBy(desc(similarityExpr), asc(tags.name))
                    .limit(limit);

                const exactMatch = await ctx.db
                    .select({ id: tags.id })
                    .from(tags)
                    .where(sql`LOWER(${tags.name}) = LOWER(${term})`)
                    .limit(1);

                const canCreate = exactMatch.length === 0;

                result = {
                    tags: searchResults,
                    canCreate,
                    searchTerm: term,
                };
            }

            return result;
        }),
    createForMultiselect: protectedProcedure
        .input(
            z.object({
                name: z.string().min(TAG_NAME_MIN_LENGTH).max(TAG_NAME_MAX_LENGTH),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { name } = input;

            const existingTag = await ctx.db
                .select({
                    publicId: tags.publicId,
                    name: tags.name,
                })
                .from(tags)
                .where(sql`LOWER(${tags.name}) = LOWER(${name})`)
                .limit(1);

            if (existingTag.length > 0) {
                return existingTag[0];
            }

            const [newTag] = await ctx.db.insert(tags).values({ name: name.trim() }).returning({
                publicId: tags.publicId,
                name: tags.name,
            });

            if (!newTag) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to create tag",
                });
            }

            return newTag;
        }),
});
