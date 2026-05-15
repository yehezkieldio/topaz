import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { formatRating } from "#/lib/utils";
import { protectedProcedure } from "#/server/api/trpc";
import { invalidateLibraryReadModels, invalidateTaxonomyReadModels } from "#/server/backend/cache/tags";
import { refreshLibraryReadModels } from "#/server/db/repositories/library-repository";
import { progresses, progressStatusEnum } from "#/server/db/schema/progress";
import {
    stories,
    storyCreateSchema,
    storyCreateWithProgressSchema,
    storyTaxonomyTerms,
    storyUpdateSchema,
} from "#/server/db/schema/story";
import { taxonomyTerms } from "#/server/db/schema/taxonomy";

// Constants for validation
const RATING_MIN = 0;
const RATING_MAX = 5;
const NOTES_MAX_LENGTH = 10_000;

export const storyProcedures = {
    delete: protectedProcedure
        .input(
            z.object({
                publicId: z.string(),
            })
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

            await refreshLibraryReadModels(ctx.db);
            await Promise.all([invalidateLibraryReadModels(), invalidateTaxonomyReadModels()]);

            return deletedStory;
        }),
    update: protectedProcedure
        .input(storyUpdateSchema.extend({ version: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const { publicId, version, ...updateData } = input;

            const result = await ctx.db.transaction(async (tx) => {
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
                    .set({ ...updateData, version: sql`${stories.version} + 1` })
                    .where(and(eq(stories.publicId, publicId), eq(stories.version, version)))
                    .returning({
                        id: stories.id,
                        publicId: stories.publicId,
                    });

                if (!updatedStory) {
                    const [freshStory] = await tx
                        .select({ version: stories.version })
                        .from(stories)
                        .where(eq(stories.publicId, publicId))
                        .limit(1);

                    if (freshStory) {
                        throw new TRPCError({
                            code: "CONFLICT",
                            message: "The story has been modified by another user. Please refresh and try again.",
                        });
                    }

                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Story not found",
                    });
                }

                return updatedStory;
            });

            await refreshLibraryReadModels(ctx.db);
            await invalidateLibraryReadModels();

            return result;
        }),
    updateWithRelations: protectedProcedure.input(storyCreateWithProgressSchema).mutation(async ({ ctx, input }) => {
        const { storyPublicId, progressPublicId, taxonomyTermIds, storyVersion, progressVersion, ...rest } = input;

        const result = await ctx.db.transaction(async (tx) => {
            let resolvedTerms: { publicId: string; name: string; id: string }[] = [];
            if (taxonomyTermIds.length > 0) {
                const existingTerms = await tx
                    .select({
                        id: taxonomyTerms.id,
                        publicId: taxonomyTerms.publicId,
                        name: taxonomyTerms.name,
                    })
                    .from(taxonomyTerms)
                    .where(inArray(taxonomyTerms.publicId, taxonomyTermIds));

                if (existingTerms.length !== taxonomyTermIds.length) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "One or more taxonomy term IDs are invalid",
                    });
                }

                resolvedTerms = existingTerms;
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
                    version: sql`${stories.version} + 1`,
                })
                .where(and(eq(stories.publicId, storyPublicId), eq(stories.version, storyVersion)))
                .returning({
                    id: stories.id,
                    publicId: stories.publicId,
                });

            if (!updatedStory) {
                const [freshStory] = await tx
                    .select({ version: stories.version })
                    .from(stories)
                    .where(eq(stories.publicId, storyPublicId))
                    .limit(1);

                if (freshStory) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "The story has been modified by another user. Please refresh and try again.",
                    });
                }

                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Failed to update story or story not found.",
                });
            }

            const rating = rest.rating == null ? "0.0" : formatRating(Number(rest.rating));

            const [updatedProgress] = await tx
                .update(progresses)
                .set({
                    status: rest.progressStatus,
                    current_chapter: rest.current_chapter,
                    rating,
                    notes: rest.notes,
                    updated_at: new Date(),
                    version: sql`${progresses.version} + 1`,
                })
                .where(and(eq(progresses.publicId, progressPublicId), eq(progresses.version, progressVersion)))
                .returning({
                    id: progresses.id,
                    publicId: progresses.publicId,
                });

            if (!updatedProgress) {
                const [freshProgress] = await tx
                    .select({ version: progresses.version })
                    .from(progresses)
                    .where(eq(progresses.publicId, progressPublicId))
                    .limit(1);

                if (freshProgress) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "The progress has been modified by another user. Please refresh and try again.",
                    });
                }

                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Failed to update progress or progress not found.",
                });
            }

            await tx.delete(storyTaxonomyTerms).where(eq(storyTaxonomyTerms.storyId, storyId));
            if (resolvedTerms.length > 0) {
                await tx.insert(storyTaxonomyTerms).values(
                    resolvedTerms.map((term) => ({
                        storyId,
                        termId: term.id,
                    }))
                );
            }

            return {
                storyPublicId: updatedStory.publicId,
                progressPublicId: updatedProgress.publicId,
                updatedTaxonomyTerms: resolvedTerms.map((term) => term.publicId),
            };
        });

        await refreshLibraryReadModels(ctx.db);
        await Promise.all([invalidateLibraryReadModels(), invalidateTaxonomyReadModels()]);

        return result;
    }),
    create: protectedProcedure.input(storyCreateSchema).mutation(async ({ ctx, input }) => {
        const { taxonomyTermIds, ...storyData } = input;

        const result = await ctx.db.transaction(async (tx) => {
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

            if (taxonomyTermIds.length > 0) {
                const termRecords = await tx
                    .select({ id: taxonomyTerms.id, publicId: taxonomyTerms.publicId })
                    .from(taxonomyTerms)
                    .where(inArray(taxonomyTerms.publicId, taxonomyTermIds));

                if (termRecords.length !== taxonomyTermIds.length) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "One or more taxonomy term IDs are invalid",
                    });
                }

                await tx.insert(storyTaxonomyTerms).values(
                    termRecords.map((term) => ({
                        storyId: newStory.id,
                        termId: term.id,
                    }))
                );
            }

            return newStory;
        });

        await refreshLibraryReadModels(ctx.db);
        await Promise.all([invalidateLibraryReadModels(), invalidateTaxonomyReadModels()]);

        return result;
    }),
    createWithProgress: protectedProcedure
        .input(
            storyCreateSchema.extend({
                progressStatus: z.enum(progressStatusEnum.enumValues),
                current_chapter: z.number().min(0),
                rating: z.number().min(RATING_MIN).max(RATING_MAX),
                notes: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { taxonomyTermIds, progressStatus, current_chapter, rating, notes, ...storyData } = input;
            const userId = ctx.session.user.id;

            const result = await ctx.db.transaction(async (tx) => {
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

                if (taxonomyTermIds.length > 0) {
                    const termRecords = await tx
                        .select({ id: taxonomyTerms.id, publicId: taxonomyTerms.publicId })
                        .from(taxonomyTerms)
                        .where(inArray(taxonomyTerms.publicId, taxonomyTermIds));

                    if (termRecords.length !== taxonomyTermIds.length) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: "One or more taxonomy term IDs are invalid",
                        });
                    }

                    await tx.insert(storyTaxonomyTerms).values(
                        termRecords.map((term) => ({
                            storyId: newStory.id,
                            termId: term.id,
                        }))
                    );
                }

                const sanitizedProgressData = {
                    status: progressStatus,
                    current_chapter: Math.max(0, Number(current_chapter)),
                    rating: rating == null ? "0.0" : formatRating(rating),
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

                return {
                    story: newStory,
                    progress: newProgress,
                };
            });

            await refreshLibraryReadModels(ctx.db);
            await Promise.all([invalidateLibraryReadModels(), invalidateTaxonomyReadModels()]);

            return result;
        }),
};
