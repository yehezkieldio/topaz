"use server";

import { revalidateTag } from "next/cache";

export const backendCacheTags = {
    fandomSearch: "fandom-search",
    hotFandoms: "hot-fandoms",
    hotTags: "hot-tags",
    libraryStats: "library-stats",
    tagSearch: "tag-search",
} as const;

export async function invalidateLibraryReadModels() {
    revalidateTag(backendCacheTags.libraryStats, "max");
}

export async function invalidateTaxonomyReadModels() {
    revalidateTag(backendCacheTags.hotFandoms, "max");
    revalidateTag(backendCacheTags.fandomSearch, "max");
    revalidateTag(backendCacheTags.hotTags, "max");
    revalidateTag(backendCacheTags.tagSearch, "max");
}

export async function invalidateFandomReadModels() {
    revalidateTag(backendCacheTags.hotFandoms, "max");
    revalidateTag(backendCacheTags.fandomSearch, "max");
}

export async function invalidateTagReadModels() {
    revalidateTag(backendCacheTags.hotTags, "max");
    revalidateTag(backendCacheTags.tagSearch, "max");
}

export async function invalidateAllBackendReadModels() {
    await invalidateLibraryReadModels();
    await invalidateTaxonomyReadModels();
}
