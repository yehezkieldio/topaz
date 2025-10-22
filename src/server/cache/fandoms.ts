import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "#/server/db";
import { fandoms } from "#/server/db/schema/fandom";
import { storyFandoms } from "#/server/db/schema/story";

/**
 * Cached function to get hot (popular) fandoms.
 * Uses public cache since hot fandoms are the same for all users.
 * Returns fandoms ordered by story count (most popular first).
 */
export async function getCachedHotFandoms(limit = 8) {
    "use cache";
    cacheTag("hot-fandoms");
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

/**
 * Cached function to search fandoms.
 * Uses separate cache entries for each search term.
 */
export async function getCachedFandomSearch(searchTerm: string, limit = 10) {
    "use cache";
    cacheTag("fandom-search");
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
