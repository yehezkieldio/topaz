import "server-only";

import { revalidateTag } from "next/cache";

export const backendCacheTags = {
    hotTaxonomyTerms: "hot-taxonomy-terms",
    libraryStats: "library-stats",
    taxonomySearch: "taxonomy-search",
} as const;

export async function invalidateLibraryReadModels() {
    revalidateTag(backendCacheTags.libraryStats, "max");
}

export async function invalidateTaxonomyReadModels() {
    revalidateTag(backendCacheTags.hotTaxonomyTerms, "max");
    revalidateTag(backendCacheTags.taxonomySearch, "max");
}

export async function invalidateAllBackendReadModels() {
    await invalidateLibraryReadModels();
    await invalidateTaxonomyReadModels();
}
