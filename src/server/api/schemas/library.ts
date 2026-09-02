import { z } from "zod/v4";
import { sortOrderEnum } from "#/lib/utils";
import { publicIdSchema } from "#/server/api/schemas/common";
import { DEFAULT_LIMIT, MAX_LIMIT, MAX_SEARCH_LENGTH, MIN_LIMIT } from "#/server/db/repositories/library-repository";
import { libraryEntryStatusEnum, librarySortByEnum } from "#/server/db/schema/library-entry";
import { sourceEnum } from "#/server/db/schema/work";

const MIN_RATING = 0;
const MAX_RATING = 5;

export const libraryQuerySchema = z
    .object({
        completedOnly: z.boolean().optional(),
        cursor: z.string().optional(),
        directTaxonomyTermIds: z.array(publicIdSchema).max(20).optional(),
        effectiveTaxonomyTermIds: z.array(publicIdSchema).max(20).optional(),
        favorite: z.boolean().optional(),
        hasNotes: z.boolean().optional(),
        inProgressOnly: z.boolean().optional(),
        isNsfw: z.boolean().optional(),
        limit: z.number().min(MIN_LIMIT).max(MAX_LIMIT).default(DEFAULT_LIMIT),
        maxChapterCount: z.number().min(0).optional(),
        maxRating: z.number().min(MIN_RATING).max(MAX_RATING).optional(),
        maxWordCount: z.number().min(0).optional(),
        minChapterCount: z.number().min(0).optional(),
        minRating: z.number().min(MIN_RATING).max(MAX_RATING).optional(),
        minWordCount: z.number().min(0).optional(),
        search: z.string().max(MAX_SEARCH_LENGTH).optional(),
        sortBy: librarySortByEnum.default("updatedAt"),
        sortOrder: sortOrderEnum.nullable().default("asc"),
        source: z.array(sourceEnum).max(10).optional(),
        status: z.array(libraryEntryStatusEnum).max(10).optional(),
    })
    .refine((data) => !(data.completedOnly && data.inProgressOnly), {
        message: "completedOnly and inProgressOnly cannot both be true",
        path: ["completedOnly", "inProgressOnly"],
    })
    .refine(
        (data) => {
            if (data.minRating !== undefined && data.maxRating !== undefined) {
                return data.minRating <= data.maxRating;
            }
            return true;
        },
        {
            message: "minRating must be less than or equal to maxRating",
            path: ["minRating", "maxRating"],
        }
    );
