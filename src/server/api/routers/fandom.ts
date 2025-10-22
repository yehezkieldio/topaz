import { TRPCError } from "@trpc/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "#/server/api/trpc";
import { invalidateFandomSearch, invalidateHotFandoms } from "#/server/cache/actions";
import { getCachedFandomSearch, getCachedHotFandoms } from "#/server/cache/fandoms";
import { fandomCreateSchema, fandomUpdateSchema, fandoms } from "#/server/db/schema/fandom";
import { storyFandoms } from "#/server/db/schema/story";

// Magic numbers extracted to constants
const MULTISELECT_LIMIT_MIN = 1;
const MULTISELECT_LIMIT_MAX = 50;
const MULTISELECT_LIMIT_DEFAULT = 10;
const HOT_LIMIT_MIN = 1;
const HOT_LIMIT_MAX = 20;
const HOT_LIMIT_DEFAULT = 8;
const FANDOM_NAME_MIN = 1;
const FANDOM_NAME_MAX = 255;

export const fandomRouter = createTRPCRouter({
    delete: protectedProcedure
        .input(
            z.object({
                publicId: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [deletedFandom] = await ctx.db.delete(fandoms).where(eq(fandoms.publicId, input.publicId)).returning({
                id: fandoms.id,
                publicId: fandoms.publicId,
            });

            if (!deletedFandom) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Fandom not found",
                });
            }

            await invalidateHotFandoms();
            await invalidateFandomSearch();

            return deletedFandom;
        }),
    update: protectedProcedure.input(fandomUpdateSchema).mutation(async ({ ctx, input }) => {
        const { publicId, ...updateData } = input;

        return await ctx.db.transaction(async (tx) => {
            if (updateData.name) {
                const [existingFandom] = await tx
                    .select({
                        id: fandoms.id,
                        hasConflict: sql<boolean>`EXISTS(
                                SELECT 1 FROM ${fandoms} f2
                                WHERE f2.name = ${updateData.name}
                                AND f2.public_id != ${publicId}
                            )`.as("hasConflict"),
                    })
                    .from(fandoms)
                    .where(eq(fandoms.publicId, publicId))
                    .limit(1);

                if (!existingFandom) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Fandom not found",
                    });
                }

                if (existingFandom.hasConflict) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "Fandom with this name already exists",
                    });
                }
            }

            const [updatedFandom] = await tx
                .update(fandoms)
                .set(updateData)
                .where(eq(fandoms.publicId, publicId))
                .returning({
                    id: fandoms.id,
                    publicId: fandoms.publicId,
                });

            if (!updatedFandom) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Fandom not found",
                });
            }

            await invalidateHotFandoms();
            await invalidateFandomSearch();

            return updatedFandom;
        });
    }),
    create: protectedProcedure.input(fandomCreateSchema).mutation(async ({ ctx, input }) => {
        return await ctx.db.transaction(async (tx) => {
            const existingFandom = await tx
                .select({ id: fandoms.id })
                .from(fandoms)
                .where(eq(fandoms.name, input.name))
                .limit(1);

            if (existingFandom.length > 0) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Fandom with this name already exists",
                });
            }

            const [newFandom] = await tx.insert(fandoms).values(input).returning({
                id: fandoms.id,
                publicId: fandoms.publicId,
            });

            if (!newFandom) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to create fandom",
                });
            }

            await invalidateHotFandoms();
            await invalidateFandomSearch();

            return newFandom;
        });
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
            }),
        )
        .query(async ({ ctx, input }) => {
            const { search, limit, includeHot, hotLimit } = input;

            let result: {
                fandoms: { publicId: string; name: string }[];
                canCreate: boolean;
                searchTerm: string | null;
            };

            if ((!search || search.trim().length === 0) && includeHot) {
                const cachedFandoms = await getCachedHotFandoms(hotLimit);

                result = {
                    fandoms: cachedFandoms,
                    canCreate: false,
                    searchTerm: null,
                };
            } else if (!search || search.trim().length === 0) {
                result = {
                    fandoms: [],
                    canCreate: false,
                    searchTerm: null,
                };
            } else {
                const term = search.trim();

                const searchResults = await getCachedFandomSearch(term, limit);

                const exactMatch = await ctx.db
                    .select({ id: fandoms.id })
                    .from(fandoms)
                    .where(sql`LOWER(${fandoms.name}) = LOWER(${term})`)
                    .limit(1);

                const canCreate = exactMatch.length === 0;

                result = {
                    fandoms: searchResults,
                    canCreate,
                    searchTerm: term,
                };
            }

            return result;
        }),
    createForMultiselect: protectedProcedure
        .input(
            z.object({
                name: z.string().min(FANDOM_NAME_MIN).max(FANDOM_NAME_MAX),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { name } = input;

            const existingFandom = await ctx.db
                .select({
                    publicId: fandoms.publicId,
                    name: fandoms.name,
                })
                .from(fandoms)
                .where(sql`LOWER(${fandoms.name}) = LOWER(${name})`)
                .limit(1);

            if (existingFandom.length > 0) {
                return existingFandom[0];
            }

            const [newFandom] = await ctx.db.insert(fandoms).values({ name: name.trim() }).returning({
                publicId: fandoms.publicId,
                name: fandoms.name,
            });

            if (!newFandom) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to create fandom",
                });
            }

            await invalidateHotFandoms();
            await invalidateFandomSearch();

            return newFandom;
        }),
});
