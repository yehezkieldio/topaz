import { sql } from "drizzle-orm";
import { sourcePlatformSeeds, sourcePlatforms } from "#/server/db/schema/story";
import { taxonomyKindSeeds, taxonomyKinds } from "#/server/db/schema/taxonomy";
import { scriptDb } from "./script-db";

export async function seedV2ReferenceDataForScripts() {
    await scriptDb
        .insert(sourcePlatforms)
        .values(
            sourcePlatformSeeds.map((seed) => ({
                key: seed.key,
                name: seed.name,
                base_url: seed.baseUrl,
            }))
        )
        .onConflictDoUpdate({
            target: sourcePlatforms.key,
            set: {
                name: sql`excluded.name`,
                base_url: sql`excluded.base_url`,
                is_active: true,
            },
        });

    await scriptDb
        .insert(taxonomyKinds)
        .values(
            taxonomyKindSeeds.map((seed) => ({
                key: seed.key,
                name: seed.name,
                sort_order: seed.sortOrder,
            }))
        )
        .onConflictDoUpdate({
            target: taxonomyKinds.key,
            set: {
                name: sql`excluded.name`,
                sort_order: sql`excluded.sort_order`,
                is_assignable: true,
                allows_relations: true,
            },
        });

    return { sourcePlatforms: sourcePlatformSeeds.length, taxonomyKinds: taxonomyKindSeeds.length };
}
