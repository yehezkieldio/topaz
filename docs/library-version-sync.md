# Library Version Synchronization (Experimental)

This experimental feature provides multi-device cache synchronization for the user's library data, ensuring that changes made on one device are reflected across all other devices in real-time or upon next app launch.

## Overview

The system implements a robust, multi-layered cache synchronization strategy using:

- **Server-side version tracking**: Each user has a `libraryVersion` counter that increments atomically when library data changes
- **Client-side version comparison**: App compares local cache version with server version on startup and tab focus
- **Real-time updates**: Server-Sent Events (SSE) provide immediate notifications to active clients
- **Background sync**: Service Worker handles push notifications for inactive tabs/closed apps

## How It Works

### 1. Version Tracking
- Each user has a `libraryVersion` field in the database (starts at 1)
- Library-modifying mutations (`story.createWithProgress`, `story.updateWithRelations`, `progress.delete`) automatically increment this version
- The `view.getVersion()` endpoint provides a lightweight way to check the current version

### 2. Cache Storage Strategy
- **localStorage**: Stores version alongside React Query cache data
- **IndexedDB**: Used by Service Worker for background updates
- App compares both sources to determine if cache refresh is needed

### 3. Real-time Synchronization
- Active clients subscribe to SSE endpoint `/api/library-version-events`
- When version increments, connected clients receive immediate notification
- Relevant React Query caches are invalidated automatically

### 4. Background Updates
- Service Worker handles push notifications for inactive tabs
- Version updates are stored in IndexedDB for when app reopens
- On next app launch, version comparison triggers cache refresh if needed

## Implementation Details

### Backend Components

#### Database Schema
```sql
ALTER TABLE "topaz_user" ADD COLUMN "library_version" integer NOT NULL DEFAULT 1;
```

#### Version Management
```typescript
// Atomic version increment
await incrementUserLibraryVersion(userId);

// Get current version
const version = await getUserLibraryVersion(userId);
```

#### Updated Mutations
- `story.createWithProgress`
- `story.updateWithRelations` 
- `progress.delete`

All now increment user version after successful data changes.

### Frontend Components

#### Version Sync Hook
```typescript
const { currentVersion, isSSEConnected } = useLibraryVersionSync();
```

Handles:
- Server version fetching
- Cache comparison and invalidation
- SSE subscription management
- Page visibility change detection

#### Cache Management
```typescript
import { 
  getLatestCachedVersion, 
  shouldRefreshCache, 
  updateCachedVersion 
} from "#/lib/cache/version-manager";
```

Utilities for multi-storage version tracking.

#### App Integration
The `LibraryVersionSyncProvider` is automatically mounted at the app level and handles:
- Service Worker registration
- Version sync initialization
- Background sync coordination

## Usage

The synchronization happens automatically with no user intervention required. However, you can monitor sync status in development:

```typescript
// Check current sync status
const { currentVersion, isSSEConnected } = useLibraryVersionSync();

console.log('Current version:', currentVersion);
console.log('SSE connected:', isSSEConnected);
```

## Browser Support

- **SSE**: Supported in all modern browsers
- **Service Workers**: Supported in all modern browsers  
- **IndexedDB**: Supported in all modern browsers
- **Push API**: Supported in most browsers (degrades gracefully)

## Performance Considerations

- Version checks are lightweight (single integer comparison)
- Cache invalidation is targeted (only `progress` queries)
- SSE connections use minimal bandwidth (heartbeat every 30s)
- Service Worker operations are non-blocking

## Limitations

1. **Server-side broadcasting**: Current implementation has placeholder for multi-instance SSE broadcasting
2. **Push notifications**: Infrastructure present but not fully implemented
3. **Offline handling**: Works with cached data, syncs on reconnection
4. **Experimental status**: Monitor for edge cases in production

## Development Notes

- Enable debug logging with `NODE_ENV=development`
- SSE endpoint requires authentication
- Service Worker file excluded from linting due to ES module limitations
- Version storage is dual-layer for reliability

## Future Enhancements

- Redis-based SSE broadcasting for multi-server deployments
- Web Push notification registration and management
- Conflict resolution for simultaneous edits
- Selective cache warming based on usage patterns
- Analytics and monitoring for sync performance