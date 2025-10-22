import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "#/server/db";
import { storyTags } from "#/server/db/schema/story";
import { tags } from "#/server/db/schema/tag";

/**
 * Cached function to get hot (popular) tags.
 * Uses public cache since hot tags are the same for all users.
 * Returns tags ordered by story count (most popular first).
 */
export async function getCachedHotTags(limit = 8) {
    "use cache";
    cacheTag("hot-tags");
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

/**
 * Cached function to search tags.
 * Uses separate cache entries for each search term.
 */
export async function getCachedTagSearch(searchTerm: string, limit = 10) {
    "use cache";
    cacheTag("tag-search");
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
