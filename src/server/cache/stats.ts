import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "#/server/db";
import { libraryStatsMaterializedView } from "#/server/db/schema/view";

/**
 * Cached function to get library statistics.
 * Uses public cache since stats are the same for all users.
 * Cache is refreshed periodically based on cacheLife configuration.
 */
export async function getCachedLibraryStats() {
    "use cache";
    cacheTag("library-stats");
    cacheLife("hours");

    const stats = await db.select().from(libraryStatsMaterializedView);
    return stats[0] || {};
}
