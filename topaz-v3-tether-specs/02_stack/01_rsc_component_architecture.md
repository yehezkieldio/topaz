# RSC Component Architecture

Source patterns: Aurora Scharff's RSC architecture series, applied to Topaz's library browsing page (search + filters + infinite-scroll virtualized list + per-item mutations).

## File Shape

```text
app/(main)/library/page.tsx           - synchronous compositor only
features/library/components/
  library-search.tsx                  - 'use client', URL-writer only, no data read
  library-filters.tsx                 - 'use client' sidebar, writes filter state to URL
  library-results.tsx                 - async RSC + co-located LibraryResultsSkeleton,
                                         reads searchParams inside its own Suspense
  library-list-virtualized.tsx        - 'use client', TanStack Virtual + useInfiniteQuery
  work-card.tsx                       - server-rendered card, client leaves for toggles
  favorite-toggle.tsx                 - 'use client' leaf, action-prop pattern
features/library/
  actions.ts                         - 'use server' Server Actions (mutations)
  queries.ts                         - cache()-wrapped fetchers + exported preload*
```

Each component that has an async server-rendered version exports its skeleton from the same file (`WorkCard` + `WorkCardSkeleton`), so the fallback and the real content never drift apart in shape.

## Page Composition Rule

`page.tsx` never awaits `searchParams`, `cookies()`, or a data call at its own top level. It renders the static parts (filters sidebar, search input) directly, and wraps only the dynamic part in Suspense, resolving `searchParams` *inside* that boundary:

```text
LibrarySearch (client, URL-writer, outside Suspense)
LibraryFilters (client, URL-writer, outside Suspense)
Suspense(fallback: LibraryResultsSkeleton)
  -> LibraryResults, an async Server Component that awaits searchParams itself
```

This keeps the input/sidebar in the static shell (instant paint under Cache Components) while only the results region is a dynamic hole. A page-level `await searchParams` would force the entire route out of the static shell.

## Search Input Behavior

The search box is a Client Component holding `filterText` as local state, plus `useDeferredValue(filterText)` to detect staleness (`filterText !== deferredFilterText`). It writes the deferred value to the URL via `router.replace` inside a `useTransition`. The transition's `isPending` drives a `data-pending` attribute on the results container so stale results fade rather than flash a skeleton on every keystroke.

`useDeferredValue` here defers *rendering*, not the network call -- TanStack Query's own key-based deduping/cancellation still owns request lifecycle. Enforce a minimum query length (2+ chars) before triggering a search.

## Avoiding Waterfalls

Where the same data is needed in more than one place (e.g. both `generateMetadata` and the page body, or a parent needing to kick off a child's fetch early), wrap the fetcher in React's `cache()` and export a `preload*` function that calls it without awaiting:

```text
const getWork = cache(async (id: string) => { ... });
export const preloadWork = (id: string) => { void getWork(id); };
```

Call `preloadWork(id)` as early as possible (layout or parent), `await getWork(id)` where the data is actually consumed. Never await the preload call itself. This is a per-render, per-request cache only -- it is not `"use cache"` and does not persist across requests.

## Initial Page vs. Infinite Scroll Boundary

The first page of results is a genuine Server Component read (`LibraryResults`), fetched via a `cache()`-wrapped query so it can share the fetch with `generateMetadata` if needed. It seeds TanStack Query's `useInfiniteQuery` as `initialData` on the client. Deeper pages are pure client-side infinite scroll via TanStack Query + TanStack Virtual (see `02_data_and_mutation_flow.md`).

This keeps the *first* page URL-driven, server-rendered, shareable, and cache-tagged, while accepting that scroll position 340 items deep is not bookmarkable -- which is fine; nobody needs to bookmark that.

## Error Boundaries

Use Next.js's `catchError` (next/error, Next 16.3+) instead of `react-error-boundary` for any Server Component boundary that can throw -- it correctly lets `notFound()`/`redirect()` digests propagate (a generic error boundary mis-catches these), and its `retry()` actually re-fetches/re-renders the segment server-side instead of just re-rendering stale client state.

```text
import { catchError, type ErrorInfo } from "next/error";
function ErrorFallback(_props, { retry }: ErrorInfo) {
  return <button onClick={() => retry()}>Try again</button>;
}
export default catchError(ErrorFallback);
```

Wrap `LibraryResults` (and ideally each virtualized page boundary) individually, so a failed search/filter fetch shows a scoped retry, not a full-page crash. Use a static fallback title, never `error.message` directly -- production strips server error messages by design.

## Reusable Mutation Components (Action-Prop Pattern)

Any small, reusable component that triggers a Server Action (favorite toggle, status toggle, rating stars) takes the action as an `Action`-suffixed prop and owns its own optimistic/pending state internally:

```text
function FavoriteToggle({ workId, isFavorite, toggleFavoriteAction }) {
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const [, startTransition] = useTransition();
  function handleClick() {
    startTransition(async () => {
      setOptimistic(!optimistic);
      await toggleFavoriteAction(workId);
    });
  }
}
```

Naming convention (`toggleFavoriteAction`, not `onToggleFavorite`) signals the prop runs inside a transition and accepts a Server Action. Errors thrown inside the action bubble to the nearest `catchError` boundary -- no manual try/catch needed, but boundary placement (per-card vs. per-page) determines blast radius. For rapid repeated mutations on the same item (e.g. re-rating quickly), prefer `useActionState` over bare `useTransition` -- see `02_data_and_mutation_flow.md` for why.

## Referential Stability in the List

TanStack Virtual's row measurement and any `React.memo`'d row component are exactly where unstable references silently cause re-measurement thrash:

```text
- Row-level callbacks (onToggleFavorite, onRate) are created once (module scope or a
  single useCallback keyed by row id via closure-over-id dispatch), never as a fresh
  arrow function inside .map().
- Filter/selection sets passed into query keys or row-highlighting logic go through
  useMemo or a Zustand selector that returns a stable reference (useShallow or a
  primitive selector), never a fresh array/Set literal per render.
- Any value threaded into a Context provider (TaxonomyContext, LibraryFiltersContext)
  must come from useMemo or a module-scope constant -- document this at the call site.
- Split "setters" and "values" into separate contexts where a value changes on every
  keystroke (search text) but most consumers only need the setter, so typing doesn't
  re-render every visible virtualized row.
```

React Compiler auto-memoizes most of this away, but does not cover values crossing a module boundary (e.g. into TanStack Virtual's `estimateSize`/`getItemKey`, or a third-party library's props) -- those still need explicit `useMemo`/`useCallback`.
