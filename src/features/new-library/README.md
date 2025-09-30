# New Library Feature - Architecture Documentation

## Overview

The new-library feature is a complete rewrite of the library management system with a focus on performance, maintainability, and cognitive simplicity. It follows modern React patterns and best practices.

## Architecture Principles

### 1. **Separation of Concerns**
- **Core**: Domain logic, types, and business rules (framework-agnostic)
- **Data Access**: API calls, caching, and data fetching
- **State**: UI state management and URL synchronization
- **Hooks**: Reusable logic and utilities
- **Components**: Presentation layer organized by responsibility

### 2. **Performance First**
- Aggressive memoization with `React.memo` and custom comparison functions
- Virtualized lists for handling large datasets
- Code splitting with dynamic imports
- Optimized React Query caching strategies
- Minimal re-renders through proper selector usage

### 3. **Type Safety**
- Explicit TypeScript types throughout
- Zod schemas for runtime validation
- Type guards for safe type narrowing
- No use of `any` type

### 4. **Immutability**
- All types use `readonly` modifiers
- State updates create new objects
- Predictable data flow

## Directory Structure

```
new-library/
├── core/                      # Framework-agnostic domain logic
│   ├── types.ts              # Core type definitions
│   ├── schemas.ts            # Zod validation schemas
│   └── domain.ts             # Domain utilities and computations
│
├── data-access/              # Data fetching and mutations
│   ├── query-keys.ts         # Query key factory
│   ├── use-library-query.ts  # Infinite scroll query
│   ├── use-library-stats.ts  # Statistics query
│   └── use-library-mutations.ts # Create/Update/Delete mutations
│
├── state/                    # State management
│   ├── ui-store.ts           # Zustand store for UI state
│   └── use-filter-state.ts   # URL-synced filter state
│
├── hooks/                    # Reusable hooks
│   ├── use-story-values.ts   # Computed story values
│   ├── use-debounce.ts       # Debouncing utility
│   └── use-virtualized-list.ts # Virtualization logic
│
├── components/               # React components
│   ├── pages/               # Entry point components
│   │   └── library-page.tsx
│   ├── container/           # Container components
│   │   └── library-container.tsx
│   ├── list/                # List components
│   │   └── library-list.tsx
│   ├── item/                # Item components
│   │   └── library-item.tsx
│   ├── ui/                  # UI components
│   │   ├── search-input.tsx
│   │   └── states.tsx
│   ├── sheets/              # Sheet dialogs
│   │   ├── create-sheet.tsx
│   │   ├── edit-sheet.tsx
│   │   └── view-sheet.tsx
│   └── dialogs/             # Alert dialogs
│       └── delete-dialog.tsx
│
└── index.ts                 # Public API exports
```

## Key Design Patterns

### 1. **Container/Presenter Pattern**
- Containers handle data fetching and business logic
- Presenters focus purely on rendering
- Clear separation between smart and dumb components

### 2. **Composition Over Inheritance**
- Small, focused components
- Composition through props and render props
- Compound components for complex UI patterns

### 3. **Optimistic Memoization**
- Every component is memoized by default
- Custom comparison functions for optimal re-render prevention
- Careful dependency tracking in hooks

### 4. **URL as Source of Truth**
- All filter state lives in the URL
- Shareable links with preserved filters
- Browser back/forward navigation support

### 5. **Aggressive Caching**
- 5-minute stale time for data queries
- 30-minute garbage collection time
- Structural sharing for optimal memory usage
- Background refetch disabled to prevent unnecessary requests

## Performance Optimizations

### 1. **Virtual Scrolling**
- Only renders visible items
- Automatic infinite scroll detection
- Dynamic height measurement
- Mobile-optimized item sizing

### 2. **Code Splitting**
- Sheets and dialogs loaded on demand
- Suspense boundaries for loading states
- Error boundaries for fault tolerance

### 3. **Selective Re-renders**
- Zustand selectors prevent unnecessary re-renders
- Memoized callbacks with useCallback
- Computed values cached with useMemo
- Custom comparison functions in memo()

### 4. **Query Optimization**
- Deduplicated requests
- Exponential backoff for retries
- Optimized notifyOnChangeProps
- Query key factories for consistent caching

## State Management Strategy

### UI State (Zustand)
- Sheet open/close state
- Dialog open/close state
- Selected story reference
- Uses selectors to prevent re-renders

### Filter State (URL)
- Search query
- Status filter
- Sort by/order
- Synced with URL for shareability

### Server State (React Query)
- Library stories (paginated)
- Library statistics
- Mutation results
- Automatic cache invalidation

## Usage Example

```tsx
import { LibraryPage } from "#/features/new-library";

export default function Page() {
    return <LibraryPage isAdministratorUser={true} />;
}
```

## Migration Path

The new-library feature is designed as a drop-in replacement for the old library feature:

1. Update imports to use `new-library` instead of `library`
2. Update page components to use `LibraryPage`
3. Test thoroughly
4. Delete old library feature once validated

## Testing Considerations

- Core domain logic is pure and easily testable
- Components are isolated and mockable
- State management is centralized
- API layer is separated from UI

## Future Enhancements

- Batch operations (multi-select)
- Advanced filtering UI
- Export/import functionality
- Offline support with service workers
- Real-time updates with WebSockets
