import { sql } from "drizzle-orm";
import { taxonomyKindSeeds, taxonomyKinds } from "#/server/db/schema/taxonomy";
import { sourcePlatformSeeds, sourcePlatforms } from "#/server/db/schema/work";
import { scriptDb } from "./script-db";

export async function seedV2ReferenceDataForScripts() {
    await scriptDb
        .insert(sourcePlatforms)
        .values(
            sourcePlatformSeeds.map((seed) => ({
                base_url: seed.baseUrl,
                key: seed.key,
                name: seed.name,
            }))
        )
        .onConflictDoUpdate({
            set: {
                base_url: sql`excluded.base_url`,
                is_active: true,
                name: sql`excluded.name`,
            },
            target: sourcePlatforms.key,
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
            set: {
                allows_relations: true,
                is_assignable: true,
                name: sql`excluded.name`,
                sort_order: sql`excluded.sort_order`,
            },
            target: taxonomyKinds.key,
        });

    return { sourcePlatforms: sourcePlatformSeeds.length, taxonomyKinds: taxonomyKindSeeds.length };
}
