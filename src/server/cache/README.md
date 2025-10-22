# Server Cache Functions

This directory contains server-side cache functions using Next.js 16 Cache Components.

## Overview

Cache Components provide explicit, fine-grained control over server-side caching in Next.js. They replace the implicit caching behavior of previous versions with an opt-in model.

## Files

- **`stats.ts`** - Library statistics caching
- **`fandoms.ts`** - Fandom-related queries (hot fandoms, search)
- **`tags.ts`** - Tag-related queries (hot tags, search)
- **`actions.ts`** - Server actions for cache invalidation
- **`index.ts`** - Re-exports all cache functions
- **`examples.ts`** - Comprehensive examples and patterns

## Quick Start

### Using Cache Functions

```typescript
import { getCachedLibraryStats } from "#/server/cache";

export default async function StatsPage() {
    const stats = await getCachedLibraryStats();
    
    return <div>Total Stories: {stats.totalStories}</div>;
}
```

### Invalidating Caches

```typescript
import { invalidateLibraryStats } from "#/server/cache/actions";

export async function createStory() {
    // ... create story ...
    
    // Invalidate affected caches
    await invalidateLibraryStats();
}
```

## Cache Profiles

Topaz uses two built-in Next.js cache profiles:

- **`"hours"`** - For stable data (stats, hot items)
  - Stale time: ~1 hour
  - Revalidate: ~2 hours
  
- **`"minutes"`** - For dynamic data (search results)
  - Stale time: ~1 minute
  - Revalidate: ~5 minutes

## Cache Tags

All cached functions use tags for targeted invalidation:

- `library-stats` - Library statistics
- `hot-fandoms` - Popular fandoms list
- `fandom-search` - Fandom search results
- `hot-tags` - Popular tags list
- `tag-search` - Tag search results

## Best Practices

1. **Tag Everything**: Always use `cacheTag()` for easy invalidation
2. **Match Lifetime to Volatility**: Use shorter lifetimes for frequently changing data
3. **Invalidate on Mutations**: Always invalidate affected caches after data changes
4. **Use Separate Entries**: Different parameters = different cache entries
5. **Monitor Performance**: Track cache hit rates and database load reduction

## Architecture

```
┌─────────────────────────────────────────────┐
│ Server Component                            │
│ ┌─────────────────────────────────────────┐ │
│ │ async function Page() {                 │ │
│ │   const stats = await getCachedStats(); │ │
│ │   return <div>{stats.total}</div>;      │ │
│ │ }                                        │ │
│ └─────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Cache Function (src/server/cache/stats.ts) │
│ ┌─────────────────────────────────────────┐ │
│ │ async function getCachedStats() {       │ │
│ │   "use cache";                          │ │
│ │   cacheTag("library-stats");            │ │
│ │   cacheLife("hours");                   │ │
│ │   return await db.query(...);           │ │
│ │ }                                        │ │
│ └─────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Next.js Cache Layer                         │
│ - Checks cache for existing entry           │
│ - Returns cached result if valid            │
│ - Executes function if cache miss           │
│ - Stores result with tags and lifetime      │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Database (only on cache miss)               │
└─────────────────────────────────────────────┘
```

## Cache Invalidation Flow

```
┌─────────────────────────────────────────────┐
│ Mutation (create/update/delete)             │
│ ┌─────────────────────────────────────────┐ │
│ │ async function createStory() {          │ │
│ │   await db.insert(...);                 │ │
│ │   await invalidateLibraryStats();       │ │
│ │ }                                        │ │
│ └─────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Cache Invalidation Action                   │
│ ┌─────────────────────────────────────────┐ │
│ │ export async function                   │ │
│ │   invalidateLibraryStats() {            │ │
│ │   revalidateTag("library-stats", "max");│ │
│ │ }                                        │ │
│ └─────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Next.js Cache Layer                         │
│ - Marks tagged cache entries as stale       │
│ - Serves stale content while revalidating   │
│ - Fetches fresh data in background          │
│ - Updates cache with new data               │
└─────────────────────────────────────────────┘
```

## See Also

- [Cache Components Documentation](../../docs/CACHE_COMPONENTS.md)
- [Cache Examples](./examples.ts)
- [Next.js Cache Components Guide](https://nextjs.org/docs/app/api-reference/directives/use-cache)
