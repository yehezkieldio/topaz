"use server";

import { revalidateTag } from "next/cache";

export async function invalidateLibraryStats() {
    revalidateTag("library-stats", "max");
}

export async function invalidateHotFandoms() {
    revalidateTag("hot-fandoms", "max");
}

export async function invalidateFandomSearch() {
    revalidateTag("fandom-search", "max");
}

export async function invalidateHotTags() {
    revalidateTag("hot-tags", "max");
}

export async function invalidateTagSearch() {
    revalidateTag("tag-search", "max");
}

export async function invalidateAllCaches() {
    revalidateTag("library-stats", "max");
    revalidateTag("hot-fandoms", "max");
    revalidateTag("fandom-search", "max");
    revalidateTag("hot-tags", "max");
    revalidateTag("tag-search", "max");
}
