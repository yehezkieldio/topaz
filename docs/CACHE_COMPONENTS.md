# Next.js Cache Components Integration

This document explains how Cache Components are integrated into Topaz.

## Overview

Topaz uses **Next.js 16 Cache Components** to optimize server-side data fetching and reduce database load. Cache Components provide fine-grained control over what data is cached, for how long, and how it's invalidated.

## What Are Cache Components?

Cache Components represent a paradigm shift in Next.js:

- **Before**: Routes were static by default, you opted into dynamic rendering
- **After**: Routes are dynamic by default, you opt into caching with `"use cache"`

This approach makes caching explicit and predictable.

## Cache Types

### 1. Public Cache (`"use cache"`)

Used for data that's the same for all users:

```typescript
async function getCachedLibraryStats() {
    "use cache";
    cacheTag("library-stats");
    cacheLife("hours");
    
    // Expensive database query here
}
```

**Characteristics**:
- ✅ Shared across all users
- ✅ Included in static prerendering
- ✅ Reduces database load
- ❌ Cannot access cookies/headers
- ❌ Not user-specific

### 2. Private Cache (`"use cache: private"`)

Used for user-specific data (not implemented in this codebase yet):

```typescript
async function getUserPreferences() {
    "use cache: private";
    cacheLife({ stale: 300 });
    
    const userId = (await cookies()).get("userId");
    // User-specific query here
}
```

**Characteristics**:
- ✅ Per-user caching
- ✅ Can access cookies/headers
- ✅ Included in runtime prefetching
- ❌ Not shared across users
- ⚠️ Must be wrapped in `<Suspense>`

## Implementation in Topaz

### Cache Functions

Located in `src/server/cache/`:

1. **Stats** (`stats.ts`):
   - `getCachedLibraryStats()` - Library statistics
   - Cache lifetime: `"hours"`
   - Tag: `"library-stats"`

2. **Fandoms** (`fandoms.ts`):
   - `getCachedHotFandoms()` - Popular fandoms
   - `getCachedFandomSearch()` - Fandom search results
   - Cache lifetimes: `"hours"` (hot), `"minutes"` (search)
   - Tags: `"hot-fandoms"`, `"fandom-search"`

3. **Tags** (`tags.ts`):
   - `getCachedHotTags()` - Popular tags
   - `getCachedTagSearch()` - Tag search results
   - Cache lifetimes: `"hours"` (hot), `"minutes"` (search)
   - Tags: `"hot-tags"`, `"tag-search"`

### Cache Invalidation

Use server actions in `src/server/cache/actions.ts`:

```typescript
import { invalidateLibraryStats, invalidateHotFandoms } from "#/server/cache/actions";

// After creating a story
async function createStory(data) {
    await db.insert(stories).values(data);
    
    // Invalidate affected caches
    await invalidateLibraryStats();
    await invalidateHotFandoms();
}
```

## Cache Lifetimes

Topaz uses Next.js built-in cache profiles:

- `"hours"` - Data that changes infrequently (hot fandoms, hot tags, stats)
- `"minutes"` - Data that changes moderately (search results)

Custom profiles can be defined in `next.config.ts`:

```typescript
experimental: {
    cacheLife: {
        frequent: {
            stale: 60,      // 1 minute
            revalidate: 300, // 5 minutes
        },
    },
}
```

## When to Use Caching

### ✅ Good Candidates for Caching

- Statistics and aggregate data
- Popular/hot items lists
- Search results (short cache lifetime)
- Reference data (genres, categories)
- Materialized view results

### ❌ Not Suitable for Caching

- User-specific data (use `"use cache: private"` instead)
- Real-time data
- Data that changes per request
- Authenticated user information

## Migration from tRPC

Before Cache Components, data was fetched via tRPC:

```typescript
// Before
const stats = await caller.view.getStats();

// After
const stats = await getCachedLibraryStats();
```

Benefits:
- ✅ Explicit caching behavior
- ✅ Fine-grained cache control
- ✅ Better performance
- ✅ Reduced database load

## Best Practices

1. **Tag Your Caches**: Use `cacheTag()` for targeted invalidation
   ```typescript
   cacheTag("library-stats", "stats");
   ```

2. **Choose Appropriate Lifetimes**: Match cache lifetime to data volatility
   ```typescript
   cacheLife("hours"); // For stable data
   cacheLife("minutes"); // For dynamic data
   ```

3. **Invalidate on Mutations**: Always invalidate affected caches
   ```typescript
   await invalidateLibraryStats();
   ```

4. **Use Separate Cache Entries**: Different parameters = different cache entries
   ```typescript
   getCachedFandomSearch("naruto", 10); // Cache entry 1
   getCachedFandomSearch("potter", 10); // Cache entry 2
   ```

5. **Avoid Over-Caching**: Don't cache user-specific or frequently changing data

## Monitoring and Debugging

### Development Mode

In development, caches work but may be invalidated more frequently. Use Next.js DevTools MCP to inspect cache behavior.

### Production Mode

Caches are more aggressive in production. Monitor:
- Cache hit rates
- Database load reduction
- Response times

## Future Enhancements

Potential improvements:

1. **Private Caches**: Implement user-specific caching for preferences
2. **Remote Caching**: Use `"use cache: remote"` for distributed caching
3. **Dynamic Prefetching**: Leverage runtime prefetching for instant navigation
4. **Advanced Invalidation**: Use `updateTag()` for read-your-own-writes patterns

## References

- [Next.js Cache Components Documentation](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [Next.js DevTools MCP Knowledge Base](node_modules/next-devtools-mcp/dist/mcp-resources/nextjs-16-knowledge/)
- [Cache Invalidation Guide](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
