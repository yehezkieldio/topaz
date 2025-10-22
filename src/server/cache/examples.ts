/**
 * Example demonstrating Next.js Cache Components usage in Topaz
 *
 * This file shows practical examples of how cache components are used
 * in the codebase and can be extended for new features.
 */

import { cacheLife, cacheTag } from "next/cache";
import { db } from "#/server/db";
import { fandoms } from "#/server/db/schema/fandom";
import { tags } from "#/server/db/schema/tag";

/**
 * Example 1: Simple cached function
 *
 * This function caches its result for 1 hour (using "hours" profile).
 * The cache is shared across all users (public cache).
 */
export async function getPopularityMetrics() {
    "use cache";
    cacheTag("popularity-metrics");
    cacheLife("hours");

    const fandomCount = await db.select({ count: db.$count(fandoms) }).from(fandoms);
    const tagCount = await db.select({ count: db.$count(tags) }).from(tags);

    return {
        totalFandoms: fandomCount[0]?.count ?? 0,
        totalTags: tagCount[0]?.count ?? 0,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Example 2: Cached function with parameters
 *
 * Each unique combination of parameters creates a separate cache entry.
 * This allows for efficient caching of search results.
 */
export async function getCachedFandomDetails(fandomId: string) {
    "use cache";
    cacheTag("fandom-details", fandomId);
    cacheLife("hours");

    const fandom = await db.query.fandoms.findFirst({
        where: (fandoms, { eq }) => eq(fandoms.publicId, fandomId),
    });

    return fandom;
}

/**
 * Example 3: Short-lived cache for frequently changing data
 *
 * Uses "minutes" profile for data that changes more frequently.
 * This is ideal for search results, trending items, etc.
 */
export async function getRecentActivity() {
    "use cache";
    cacheTag("recent-activity");
    cacheLife("minutes");

    // Simulated recent activity query
    return {
        lastUpdate: new Date().toISOString(),
        activityCount: Math.floor(Math.random() * 100),
    };
}

/**
 * Example 4: Multiple cache tags for granular invalidation
 *
 * This function has multiple tags, allowing it to be invalidated
 * by different operations:
 * - "global-stats" - invalidated when any global stat changes
 * - "fandom-stats" - invalidated when fandom-related data changes
 */
export async function getGlobalStats() {
    "use cache";
    cacheTag("global-stats", "fandom-stats", "tag-stats");
    cacheLife("hours");

    const fandomCount = await db.select({ count: db.$count(fandoms) }).from(fandoms);
    const tagCount = await db.select({ count: db.$count(tags) }).from(tags);

    return {
        fandoms: fandomCount[0]?.count ?? 0,
        tags: tagCount[0]?.count ?? 0,
        cachedAt: new Date().toISOString(),
    };
}

/**
 * USAGE IN COMPONENTS:
 *
 * // In a Server Component
 * export default async function StatsPage() {
 *     const metrics = await getPopularityMetrics();
 *
 *     return (
 *         <div>
 *             <h1>Popularity Metrics</h1>
 *             <p>Total Fandoms: {metrics.totalFandoms}</p>
 *             <p>Total Tags: {metrics.totalTags}</p>
 *             <p>Cached at: {metrics.timestamp}</p>
 *         </div>
 *     );
 * }
 *
 * CACHE INVALIDATION:
 *
 * // In a Server Action or mutation
 * import { revalidateTag } from "next/cache";
 *
 * export async function updateFandom() {
 *     // ... update logic ...
 *     revalidateTag("popularity-metrics", "max");
 *     revalidateTag("global-stats", "max");
 * }
 *
 * KEY BENEFITS:
 *
 * 1. Reduced Database Load
 *    - Expensive queries are cached and reused
 *    - Database is only hit when cache expires or is invalidated
 *
 * 2. Better Performance
 *    - Cached results are served instantly
 *    - No need to wait for database queries on every request
 *
 * 3. Explicit Cache Control
 *    - Clear visibility into what's cached and for how long
 *    - Easy to invalidate specific caches when data changes
 *
 * 4. Granular Invalidation
 *    - Multiple tags allow precise cache invalidation
 *    - Only affected caches are invalidated, not everything
 */
