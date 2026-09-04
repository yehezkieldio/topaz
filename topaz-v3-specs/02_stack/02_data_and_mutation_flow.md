# Data and Mutation Flow

## Three Shapes, Three Homes

```text
1. Initial server-rendered read
   -> Server Component calls a cache()-wrapped function in features/*/queries.ts
   -> no client JS shipped for this read

2. Client-owned, re-fetchable read (infinite scroll, live search, filter changes)
   -> TanStack Query on the client
   -> queryFn calls a Server Action or Route Handler directly (no tRPC in between)
   -> first page seeded from the server-rendered read as initialData/prefetched cache

3. Mutation (create/edit/delete work, toggle favorite, change status/rating,
   reading-event append)
   -> Server Action in features/*/actions.ts, "use server"
   -> called via an Action-suffixed prop (small reusable components) or
      useActionState (forms, or any mutation needing sequential ordering)
   -> revalidates specific cacheTags on success (see 03_caching_and_streaming.md)
```

There is no fourth shape. If something doesn't fit one of these three, the design is wrong, not the taxonomy.

## Infinite Scroll: TanStack Query + TanStack Virtual

`useInfiniteQuery` in v5 requires `initialPageParam` explicitly -- there is no implicit default via `({ pageParam = 0 })` in `queryFn` like in v4. Required shape:

```text
useInfiniteQuery({
  queryKey: ["library", filters],
  queryFn: ({ pageParam }) => fetchLibraryPage(filters, pageParam), // Server Action
  initialPageParam: null,           // cursor, not an index -- library uses cursor pagination
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
```

Server-side prefetch/hydration (no tRPC needed -- `queryFn` calls the Server Action or Route Handler directly):

```text
const queryClient = new QueryClient();
await queryClient.prefetchInfiniteQuery({
  queryKey, queryFn, initialPageParam, getNextPageParam, pages: 1,
});
return <HydrationBoundary state={dehydrate(queryClient)}><LibraryListVirtualized /></HydrationBoundary>;
```

Set `dehydrate.shouldDehydrateQuery` to include pending queries under streaming SSR, and `shouldRedactErrors: () => false` on the QueryClient config -- otherwise TanStack Query can swallow the internal error Next.js uses to detect dynamic rendering, which breaks Cache Components' static/dynamic split silently.

TanStack Virtual integration -- the "+1 sentinel row" pattern for fetch-on-scroll:

```text
count: hasNextPage ? allRows.length + 1 : allRows.length
// in an effect watching rowVirtualizer.getVirtualItems():
// if last virtual item's index >= allRows.length - 1 and hasNextPage && !isFetchingNextPage:
//   fetchNextPage()
```

Dynamic/variable row height (work cards vary with description length, tag count): use `ref={virtualizer.measureElement}` plus a required `data-index={virtualItem.index}` attribute on each row -- the virtualizer measures the actual rendered height and feeds it back, no manual height math.

## Mutations: useOptimistic + useTransition vs. useActionState

Two valid patterns, chosen by whether ordering matters:

```text
useTransition + useOptimistic alone
  -> fine for a single-shot, no-ordering-hazard client transition (expand a card,
     switch a detail tab, any purely local UI change with no server round trip
     that could race with another one on the same item)

useActionState (wraps a Server Action, queues dispatches sequentially)
  -> required for anything where a second mutation on the same item can be
     triggered before the first resolves: favorite toggle, status change, rating
     change, reading-progress update. Concurrent bare useTransition calls run in
     PARALLEL with no ordering guarantee -- a slow earlier request can resolve
     after a newer one and silently overwrite it. useActionState serializes the
     queue so each action sees the previous one's committed result and results
     commit atomically once the queue drains.
```

Concretely: `FavoriteToggle`/`RatingStars`/`StatusSelect` all use `useActionState` internally, not bare `useTransition`, specifically because a user can click twice quickly. `useActionState`'s queuing solves dispatch ordering; it does not by itself make rapid re-clicking pleasant to use, which is why each of these components also disables its own input while `isPending` is true -- see `02_stack/06_effects_and_hooks_policy.md`'s `useOptimistic` section for the full reasoning.

Do not layer a manual `useTransition` on top of TanStack Query's own pending state for search/filtering -- `isFetching`/`isPending` from the query already covers it, and TanStack Query already handles request cancellation/ordering via query keys. A redundant transition here adds a second, uncoordinated source of "is this stale" truth.

## Forms: TanStack Form + Server Actions

`@tanstack/react-form` accepts a Zod (Standard Schema) validator directly on `useForm({ validators: { onChange: schema } })` or per-field via `<form.Field validators={{ onChange, onChangeAsync, onChangeAsyncDebounceMs }}>` -- no adapter package needed for validation itself.

The Server Action interop is a **separate package**, `@tanstack/react-form-nextjs`:

```text
server: createServerValidate({ ...formOpts, onServerValidate }) wraps a "use server"
  action; catch ServerValidateError and return e.formState.

client: useActionState(theAction, initialFormState) combined with
  useTransform(useForm) + mergeForm(baseForm, state) to reconcile server-validated
  state back into the client form; <form action={action} onSubmit={() => form.handleSubmit()}>.
```

Use this pairing for the create/edit work form (the multi-entity form that creates a `work`, `work_source`, `contributor`, `library_entry`, and taxonomy assignments together). Keep TanStack Form's own field/dirty state colocated to the form component -- it is not global state and does not belong in Zustand.

## Conditional Fields (Entry-Type-Dependent Form Fields, Taxonomy Picker)

If the create/edit form ever branches fields by content type, or the taxonomy picker has optional sub-behaviors (outside-click-to-close, escape handling, autocomplete-on-open, keyboard nav only while expanded), do not conditionally call hooks based on that branch. Every hook is called unconditionally; the hook itself takes an `enabled` boolean and no-ops internally:

```text
function useOutsideClick(enabled: boolean, ref, onOutside) {
  useEffect(() => {
    if (!enabled) return;
    // attach listener
  }, [enabled, ref, onOutside]);
}
```

This is conditional *activation*, not conditional *invocation* -- rules of hooks stay intact, and resources are only active when actually needed.
