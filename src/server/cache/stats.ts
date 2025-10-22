import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "#/server/db";
import { libraryStatsMaterializedView } from "#/server/db/schema/view";

export async function getCachedLibraryStats() {
    "use cache";
    cacheTag("library-stats");
    cacheLife("hours");

    const stats = await db.select().from(libraryStatsMaterializedView);
    return stats[0] || {};
}
