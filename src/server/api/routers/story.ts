import { TRPCError } from "@trpc/server";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { formatRating } from "#/lib/utils";
import { createTRPCRouter, protectedProcedure } from "#/server/api/trpc";
import { CacheManager } from "#/server/cache/manager";
import { fandoms } from "#/server/db/schema/fandom";
import { progressStatusEnum, progresses } from "#/server/db/schema/progress";
import {
    stories,
    storyCreateSchema,
    storyCreateWithProgressSchema,
    storyFandoms,
    storyTags,
    storyUpdateSchema,
} from "#/server/db/schema/story";
import { tags } from "#/server/db/schema/tag";
import { incrementUserLibraryVersion } from "#/server/lib/version-sync";

// Constants for validation
const RATING_MIN = 0;
const RATING_MAX = 5;
const NOTES_MAX_LENGTH = 10_000;

export const storyRouter = createTRPCRouter({
    delete: protectedProcedure
        .input(
            z.object({
                publicId: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [deletedStory] = await ctx.db.delete(stories).where(eq(stories.publicId, input.publicId)).returning({
                id: stories.id,
                publicId: stories.publicId,
            });

            if (!deletedStory) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Story not found",
                });
            }

            await CacheManager.invalidateStory(input.publicId);

            return deletedStory;
        }),
    update: protectedProcedure.input(storyUpdateSchema).mutation(async ({ ctx, input }) => {
        const { publicId, ...updateData } = input;

        return await ctx.db.transaction(async (tx) => {
            if (updateData.url) {
                const [existingStory] = await tx
                    .select({
                        id: stories.id,
                        hasConflict: sql<boolean>`EXISTS(
                                SELECT 1 FROM ${stories} s2
                                WHERE s2.url = ${updateData.url}
                                AND s2.public_id != ${publicId}
                            )`.as("hasConflict"),
                    })
                    .from(stories)
                    .where(eq(stories.publicId, publicId))
                    .limit(1);

                if (!existingStory) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Story not found",
                    });
                }

                if (existingStory.hasConflict) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "Story with this URL already exists",
                    });
                }
            }

            const [updatedStory] = await tx
                .update(stories)
                .set(updateData)
                .where(eq(stories.publicId, publicId))
                .returning({
                    id: stories.id,
                    publicId: stories.publicId,
                });

            if (!updatedStory) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Story not found",
                });
            }

            await CacheManager.invalidateStory(publicId);

            return updatedStory;
        });
    }),
    updateWithRelations: protectedProcedure.input(storyCreateWithProgressSchema).mutation(async ({ ctx, input }) => {
        const { storyPublicId, progressPublicId, tagIds, fandomIds, ...rest } = input;
        const userId = ctx.session.user.id;

        return await ctx.db.transaction(async (tx) => {
            let resolvedTags: { publicId: string; name: string; id: string }[] = [];
            if (tagIds.length > 0) {
                const existingTags = await tx
                    .select({
                        id: tags.id,
                        publicId: tags.publicId,
                        name: tags.name,
                    })
                    .from(tags)
                    .where(inArray(tags.publicId, tagIds));

                if (existingTags.length !== tagIds.length) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "One or more tag IDs are invalid",
                    });
                }

                resolvedTags = existingTags;
            }

            let resolvedFandoms: { publicId: string; name: string; id: string }[] = [];
            if (fandomIds.length > 0) {
                const existingFandoms = await tx
                    .select({
                        id: fandoms.id,
                        publicId: fandoms.publicId,
                        name: fandoms.name,
                    })
                    .from(fandoms)
                    .where(inArray(fandoms.publicId, fandomIds));

                if (existingFandoms.length !== fandomIds.length) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "One or more fandom IDs are invalid",
                    });
                }

                resolvedFandoms = existingFandoms;
            }

            const [storyRecord] = await tx
                .select({ id: stories.id })
                .from(stories)
                .where(eq(stories.publicId, storyPublicId))
                .limit(1);

            if (!storyRecord) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Story not found",
                });
            }
            const storyId = storyRecord.id;

            const [updatedStory] = await tx
                .update(stories)
                .set({
                    title: rest.title,
                    author: rest.author,
                    url: rest.url,
                    source: rest.source,
                    description: rest.description,
                    word_count: rest.word_count,
                    chapter_count: rest.chapter_count,
                    is_nsfw: rest.is_nsfw,
                    status: rest.status,
                    updated_at: new Date(),
                })
                .where(eq(stories.publicId, storyPublicId))
                .returning({
                    id: stories.id,
                    publicId: stories.publicId,
                });

            if (!updatedStory) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Failed to update story or story not found.",
                });
            }

            const rating = rest.rating != null ? formatRating(Number(rest.rating)) : "0.0";

            const [updatedProgress] = await tx
                .update(progresses)
                .set({
                    status: rest.progressStatus,
                    current_chapter: rest.current_chapter,
                    rating,
                    notes: rest.notes,
                    updated_at: new Date(),
                })
                .where(eq(progresses.publicId, progressPublicId))
                .returning({
                    id: progresses.id,
                    publicId: progresses.publicId,
                });

            if (!updatedProgress) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Failed to update progress or progress not found.",
                });
            }

            await tx.delete(storyTags).where(eq(storyTags.storyId, storyId));
            if (resolvedTags.length > 0) {
                await tx.insert(storyTags).values(
                    resolvedTags.map((tag) => ({
                        storyId,
                        tagId: tag.id,
                    })),
                );
            }

            await tx.delete(storyFandoms).where(eq(storyFandoms.storyId, storyId));
            if (resolvedFandoms.length > 0) {
                await tx.insert(storyFandoms).values(
                    resolvedFandoms.map((fandom) => ({
                        storyId,
                        fandomId: fandom.id,
                    })),
                );
            }

            const result = {
                storyPublicId: updatedStory.publicId,
                progressPublicId: updatedProgress.publicId,
                updatedTags: resolvedTags.map((t) => t.publicId),
                updatedFandoms: resolvedFandoms.map((f) => f.publicId),
            };

            await CacheManager.invalidateStory(storyPublicId);
            await CacheManager.invalidateView();

            // Increment user library version for cache sync across devices
            await incrementUserLibraryVersion(userId);

            return result;
        });
    }),
    create: protectedProcedure.input(storyCreateSchema).mutation(async ({ ctx, input }) => {
        const { tagIds, fandomIds, ...storyData } = input;

        return await ctx.db.transaction(async (tx) => {
            const existingStory = await tx
                .select({ id: stories.id })
                .from(stories)
                .where(eq(stories.url, storyData.url))
                .limit(1);

            if (existingStory.length > 0) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Story with this URL already exists",
                });
            }

            const [newStory] = await tx.insert(stories).values(storyData).returning({
                id: stories.id,
                publicId: stories.publicId,
            });

            if (!newStory) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to create story",
                });
            }

            if (tagIds.length > 0) {
                const tagRecords = await tx
                    .select({ id: tags.id, publicId: tags.publicId })
                    .from(tags)
                    .where(inArray(tags.publicId, tagIds));

                if (tagRecords.length !== tagIds.length) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "One or more tag IDs are invalid",
                    });
                }

                await tx.insert(storyTags).values(
                    tagRecords.map((tag) => ({
                        storyId: newStory.id,
                        tagId: tag.id,
                    })),
                );
            }

            if (fandomIds.length > 0) {
                const fandomRecords = await tx
                    .select({ id: fandoms.id, publicId: fandoms.publicId })
                    .from(fandoms)
                    .where(inArray(fandoms.publicId, fandomIds));

                if (fandomRecords.length !== fandomIds.length) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "One or more fandom IDs are invalid",
                    });
                }

                await tx.insert(storyFandoms).values(
                    fandomRecords.map((fandom) => ({
                        storyId: newStory.id,
                        fandomId: fandom.id,
                    })),
                );
            }

            await CacheManager.invalidateStory(newStory.publicId);

            return newStory;
        });
    }),
    createWithProgress: protectedProcedure
        .input(
            storyCreateSchema.extend({
                progressStatus: z.enum(progressStatusEnum.enumValues),
                current_chapter: z.number().min(0),
                rating: z.number().min(RATING_MIN).max(RATING_MAX),
                notes: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { tagIds, fandomIds, progressStatus, current_chapter, rating, notes, ...storyData } = input;
            const userId = ctx.session.user.id;

            return await ctx.db.transaction(async (tx) => {
                const existingStory = await tx
                    .select({ id: stories.id })
                    .from(stories)
                    .where(eq(stories.url, storyData.url))
                    .limit(1);

                if (existingStory.length > 0) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "Story with this URL already exists",
                    });
                }

                const [newStory] = await tx.insert(stories).values(storyData).returning({
                    id: stories.id,
                    publicId: stories.publicId,
                });

                if (!newStory) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Failed to create story",
                    });
                }

                if (tagIds.length > 0) {
                    const tagRecords = await tx
                        .select({ id: tags.id, publicId: tags.publicId })
                        .from(tags)
                        .where(inArray(tags.publicId, tagIds));

                    if (tagRecords.length !== tagIds.length) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: "One or more tag IDs are invalid",
                        });
                    }

                    await tx.insert(storyTags).values(
                        tagRecords.map((tag) => ({
                            storyId: newStory.id,
                            tagId: tag.id,
                        })),
                    );
                }

                if (fandomIds.length > 0) {
                    const fandomRecords = await tx
                        .select({ id: fandoms.id, publicId: fandoms.publicId })
                        .from(fandoms)
                        .where(inArray(fandoms.publicId, fandomIds));

                    if (fandomRecords.length !== fandomIds.length) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: "One or more fandom IDs are invalid",
                        });
                    }

                    await tx.insert(storyFandoms).values(
                        fandomRecords.map((fandom) => ({
                            storyId: newStory.id,
                            fandomId: fandom.id,
                        })),
                    );
                }

                const sanitizedProgressData = {
                    status: progressStatus,
                    current_chapter: Math.max(0, Number(current_chapter)),
                    rating: rating != null ? formatRating(rating) : "0.0",
                    notes: notes?.slice(0, NOTES_MAX_LENGTH),
                    userId,
                    storyId: newStory.id,
                };

                const [newProgress] = await tx.insert(progresses).values(sanitizedProgressData).returning({
                    id: progresses.id,
                    publicId: progresses.publicId,
                });

                if (!newProgress) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Failed to create progress",
                    });
                }

                await Promise.all([CacheManager.invalidateStory(), CacheManager.invalidateView()]);

                // Increment user library version for cache sync across devices
                await incrementUserLibraryVersion(userId);

                return {
                    story: newStory,
                    progress: newProgress,
                };
            });
        }),
});
