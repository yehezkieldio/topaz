/**
 * Server cache functions for Topaz.
 *
 * These functions use Next.js 16 Cache Components ("use cache" directive)
 * to cache expensive database queries and reduce server load.
 *
 * Cache Invalidation:
 * - Use cacheTag() to tag cached data
 * - Use revalidateTag() in mutations to invalidate specific caches
 * - Use updateTag() in server actions for immediate read-your-own-writes
 */

export { getCachedFandomSearch, getCachedHotFandoms } from "./fandoms";
export { getCachedLibraryStats } from "./stats";
export { getCachedHotTags, getCachedTagSearch } from "./tags";
