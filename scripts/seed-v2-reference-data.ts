import { scriptSql } from "./script-db";
import { seedV2ReferenceDataForScripts } from "./seed-v2-reference-data.shared";

try {
    const result = await seedV2ReferenceDataForScripts();
    console.log(
        `Seeded V2 reference data: ${result.sourcePlatforms} source platforms, ${result.taxonomyKinds} taxonomy kinds.`
    );
} finally {
    await scriptSql.end();
}
