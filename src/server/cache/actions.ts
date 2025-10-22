"use server";

import { revalidateTag } from "next/cache";

/**
 * Server actions for cache invalidation.
 * 
 * These actions use revalidateTag() to invalidate specific cache entries
 * when data changes (e.g., after creating, updating, or deleting resources).
 * 
 * The "max" profile is used for stale-while-revalidate behavior.
 */

/**
 * Invalidate library stats cache.
 * Call this after any operation that affects library statistics.
 */
export async function invalidateLibraryStats() {
    revalidateTag("library-stats", "max");
}

/**
 * Invalidate hot fandoms cache.
 * Call this after creating, updating, or deleting fandoms or stories.
 */
export async function invalidateHotFandoms() {
    revalidateTag("hot-fandoms", "max");
}

/**
 * Invalidate fandom search cache.
 * Call this after creating, updating, or deleting fandoms.
 */
export async function invalidateFandomSearch() {
    revalidateTag("fandom-search", "max");
}

/**
 * Invalidate hot tags cache.
 * Call this after creating, updating, or deleting tags or stories.
 */
export async function invalidateHotTags() {
    revalidateTag("hot-tags", "max");
}

/**
 * Invalidate tag search cache.
 * Call this after creating, updating, or deleting tags.
 */
export async function invalidateTagSearch() {
    revalidateTag("tag-search", "max");
}

/**
 * Invalidate all caches.
 * Use sparingly - prefer targeted invalidation.
 */
export async function invalidateAllCaches() {
    revalidateTag("library-stats", "max");
    revalidateTag("hot-fandoms", "max");
    revalidateTag("fandom-search", "max");
    revalidateTag("hot-tags", "max");
    revalidateTag("tag-search", "max");
}
