import "server-only";

import { TRPCError } from "@trpc/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { backendCacheTags } from "#/server/backend/cache/tags";
import { db } from "#/server/db";
import { fandoms } from "#/server/db/schema/fandom";
import { storyFandoms, storyTags } from "#/server/db/schema/story";
import { tags } from "#/server/db/schema/tag";

type Database = typeof db;

export const TAXONOMY_NAME_MIN = 1;
export const TAXONOMY_NAME_MAX = 255;
export const MULTISELECT_LIMIT_MIN = 1;
export const MULTISELECT_LIMIT_MAX = 50;
export const MULTISELECT_LIMIT_DEFAULT = 10;
export const HOT_LIMIT_MIN = 1;
export const HOT_LIMIT_MAX = 20;
export const HOT_LIMIT_DEFAULT = 8;

export type TaxonomyMultiselectResult = {
    canCreate: boolean;
    searchTerm: string | null;
};

export async function getHotFandoms(limit = HOT_LIMIT_DEFAULT) {
    "use cache";
    cacheTag(backendCacheTags.hotFandoms);
    cacheLife("hours");

    return await db
        .select({
            publicId: fandoms.publicId,
            name: fandoms.name,
        })
        .from(fandoms)
        .leftJoin(storyFandoms, eq(fandoms.id, storyFandoms.fandomId))
        .groupBy(fandoms.id, fandoms.publicId, fandoms.name)
        .orderBy(desc(sql`COUNT(${storyFandoms.fandomId})`), asc(fandoms.name))
        .limit(limit);
}

export async function searchFandoms(searchTerm: string, limit = MULTISELECT_LIMIT_DEFAULT) {
    "use cache";
    cacheTag(backendCacheTags.fandomSearch);
    cacheLife("minutes");

    const normalizedTerm = searchTerm.trim().toLowerCase();
    const similarityExpr = sql<number>`similarity(LOWER(${fandoms.name}), ${normalizedTerm})`;
    const minSimilarity = searchTerm.length < 4 ? 0.1 : 0.2;

    return await db
        .select({
            publicId: fandoms.publicId,
            name: fandoms.name,
        })
        .from(fandoms)
        .where(sql`LOWER(${fandoms.name}) ILIKE ${`%${normalizedTerm}%`} OR ${similarityExpr} >= ${minSimilarity}`)
        .orderBy(desc(similarityExpr), asc(fandoms.name))
        .limit(limit);
}

export async function getFandomMultiselect(input: {
    includeHot: boolean;
    hotLimit: number;
    limit: number;
    search?: string;
}): Promise<TaxonomyMultiselectResult & { fandoms: { publicId: string; name: string }[] }> {
    const term = input.search?.trim();
    if (!term && input.includeHot) {
        return {
            fandoms: await getHotFandoms(input.hotLimit),
            canCreate: false,
            searchTerm: null,
        };
    }

    if (!term) {
        return {
            fandoms: [],
            canCreate: false,
            searchTerm: null,
        };
    }

    const [searchResults, exactMatch] = await Promise.all([
        searchFandoms(term, input.limit),
        db.select({ id: fandoms.id }).from(fandoms).where(sql`LOWER(${fandoms.name}) = LOWER(${term})`).limit(1),
    ]);

    return {
        fandoms: searchResults,
        canCreate: exactMatch.length === 0,
        searchTerm: term,
    };
}

export async function createFandom(database: Database, name: string) {
    const existingFandom = await database
        .select({ id: fandoms.id })
        .from(fandoms)
        .where(eq(fandoms.name, name))
        .limit(1);
    if (existingFandom.length > 0) {
        throw new TRPCError({
            code: "CONFLICT",
            message: "Fandom with this name already exists",
        });
    }

    const [newFandom] = await database.insert(fandoms).values({ name: name.trim() }).returning({
        id: fandoms.id,
        publicId: fandoms.publicId,
    });

    if (!newFandom) {
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create fandom",
        });
    }

    return newFandom;
}

export async function updateFandom(database: Database, input: { name?: string; publicId: string }) {
    const { publicId, ...updateData } = input;

    return await database.transaction(async (tx) => {
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

        return updatedFandom;
    });
}

export async function createFandomForMultiselect(database: Database, name: string) {
    const existingFandom = await database
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

    const [newFandom] = await database.insert(fandoms).values({ name: name.trim() }).returning({
        publicId: fandoms.publicId,
        name: fandoms.name,
    });

    if (!newFandom) {
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create fandom",
        });
    }

    return newFandom;
}

export async function deleteFandom(database: Database, publicId: string) {
    const [deletedFandom] = await database.delete(fandoms).where(eq(fandoms.publicId, publicId)).returning({
        id: fandoms.id,
        publicId: fandoms.publicId,
    });

    if (!deletedFandom) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Fandom not found",
        });
    }

    return deletedFandom;
}

export async function getHotTags(limit = HOT_LIMIT_DEFAULT) {
    "use cache";
    cacheTag(backendCacheTags.hotTags);
    cacheLife("hours");

    return await db
        .select({
            publicId: tags.publicId,
            name: tags.name,
        })
        .from(tags)
        .leftJoin(storyTags, eq(tags.id, storyTags.tagId))
        .groupBy(tags.id, tags.publicId, tags.name)
        .orderBy(desc(sql`COUNT(${storyTags.tagId})`), asc(tags.name))
        .limit(limit);
}

export async function searchTags(searchTerm: string, limit = MULTISELECT_LIMIT_DEFAULT) {
    "use cache";
    cacheTag(backendCacheTags.tagSearch);
    cacheLife("minutes");

    const normalizedTerm = searchTerm.trim().toLowerCase();
    const similarityExpr = sql<number>`similarity(LOWER(${tags.name}), ${normalizedTerm})`;
    const minSimilarity = searchTerm.length < 4 ? 0.1 : 0.2;

    return await db
        .select({
            publicId: tags.publicId,
            name: tags.name,
        })
        .from(tags)
        .where(sql`LOWER(${tags.name}) ILIKE ${`%${normalizedTerm}%`} OR ${similarityExpr} >= ${minSimilarity}`)
        .orderBy(desc(similarityExpr), asc(tags.name))
        .limit(limit);
}

export async function getTagMultiselect(input: {
    includeHot: boolean;
    hotLimit: number;
    limit: number;
    search?: string;
}): Promise<TaxonomyMultiselectResult & { tags: { publicId: string; name: string }[] }> {
    const term = input.search?.trim();
    if (!term && input.includeHot) {
        return {
            tags: await getHotTags(input.hotLimit),
            canCreate: false,
            searchTerm: null,
        };
    }

    if (!term) {
        return {
            tags: [],
            canCreate: false,
            searchTerm: null,
        };
    }

    const [searchResults, exactMatch] = await Promise.all([
        searchTags(term, input.limit),
        db.select({ id: tags.id }).from(tags).where(sql`LOWER(${tags.name}) = LOWER(${term})`).limit(1),
    ]);

    return {
        tags: searchResults,
        canCreate: exactMatch.length === 0,
        searchTerm: term,
    };
}

export async function createTag(database: Database, name: string) {
    const existingTag = await database.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).limit(1);
    if (existingTag.length > 0) {
        throw new TRPCError({
            code: "CONFLICT",
            message: "Tag with this name already exists",
        });
    }

    const [newTag] = await database.insert(tags).values({ name: name.trim() }).returning({
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
}

export async function updateTag(database: Database, input: { name?: string; publicId: string }) {
    const { publicId, ...updateData } = input;

    return await database.transaction(async (tx) => {
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
}

export async function createTagForMultiselect(database: Database, name: string) {
    const existingTag = await database
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

    const [newTag] = await database.insert(tags).values({ name: name.trim() }).returning({
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
}

export async function deleteTag(database: Database, publicId: string) {
    const [deletedTag] = await database.delete(tags).where(eq(tags.publicId, publicId)).returning({
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
}
