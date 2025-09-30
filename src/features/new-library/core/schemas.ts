/**
 * Zod validation schemas for runtime validation and type inference.
 */

import { z } from "zod";

// ============================================================================
// Enum Schemas
// ============================================================================

export const storyStatusSchema = z.enum(["complete", "in-progress", "hiatus", "abandoned"]);

export const progressStatusSchema = z.enum(["reading", "completed", "on-hold", "dropped", "plan-to-read"]);

export const progressSortBySchema = z.enum(["title", "updatedAt", "createdAt", "rating"]);

export const sortOrderSchema = z.enum(["asc", "desc"]);

export const sourceSchema = z.enum(["ao3", "ffn", "wattpad", "royalroad", "other"]);

// ============================================================================
// Filter Schemas
// ============================================================================

export const libraryFiltersSchema = z.object({
    search: z.string().optional(),
    status: z.union([progressStatusSchema, z.literal("all")]).optional(),
    sortBy: progressSortBySchema.default("updatedAt"),
    sortOrder: sortOrderSchema.default("desc"),
    source: z.union([sourceSchema, z.literal("all")]).optional(),
    fandoms: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
});

// ============================================================================
// Form Schemas
// ============================================================================

const fandomTagItemSchema = z.object({
    publicId: z.string(),
    name: z.string(),
});

export const storyFormSchema = z.object({
    title: z.string().min(1, "Title is required").max(500, "Title is too long"),
    author: z.string().max(200).optional(),
    url: z
        .string()
        .url("Invalid URL format")
        .max(2000, "URL is too long")
        .optional()
        .or(z.literal(""))
        .transform((val) => (val === "" ? undefined : val)),
    description: z.string().max(5000).optional(),
    wordCount: z.coerce
        .number()
        .int()
        .nonnegative("Word count must be positive")
        .max(100_000_000, "Word count is too large")
        .optional(),
    chapterCount: z.coerce
        .number()
        .int()
        .nonnegative("Chapter count must be positive")
        .max(100_000, "Chapter count is too large")
        .optional(),
    status: storyStatusSchema.optional(),
    isNsfw: z.boolean().optional(),
    source: sourceSchema.optional(),
    rating: z.coerce
        .number()
        .int()
        .min(0, "Rating must be between 0 and 5")
        .max(5, "Rating must be between 0 and 5")
        .optional(),
    currentChapter: z.coerce
        .number()
        .int()
        .nonnegative("Current chapter must be positive")
        .max(100_000, "Current chapter is too large")
        .optional(),
    progressStatus: progressStatusSchema.optional(),
    notes: z.string().max(10_000, "Notes are too long").optional(),
    fandoms: z.array(fandomTagItemSchema).optional(),
    tags: z.array(fandomTagItemSchema).optional(),
});

export type StoryFormInput = z.infer<typeof storyFormSchema>;

// ============================================================================
// Query Schemas
// ============================================================================

export const infiniteQueryInputSchema = z.object({
    search: z.string().optional(),
    status: z.array(progressStatusSchema).optional(),
    sortBy: progressSortBySchema,
    sortOrder: sortOrderSchema,
    limit: z.number().int().positive().max(100).default(20),
    cursor: z.string().optional(),
});

export type InfiniteQueryInput = z.infer<typeof infiniteQueryInputSchema>;
