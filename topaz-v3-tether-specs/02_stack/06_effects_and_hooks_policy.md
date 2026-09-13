# Effects and Hooks Policy

A short, opinionated policy for when an effect is the right tool and when it isn't, and for a handful of React 19 APIs that are easy to miss on a stack this new.

## Derive at Render, Never Mirror via Effect

Any value computable from state/props/store data that already exists is computed inline or via `useMemo` during render -- never copied into a second piece of state via `useEffect` "to keep it in sync." A `useEffect` that calls `setState` in response to another state change is almost always a sign the derived value should have been computed directly instead.

```text
wrong:  useEffect(() => setShowBulkBar(selection.size > 0), [selection]);
right:  const showBulkBar = selection.size > 0;   // computed at render, no effect
```

This applies directly to any UI flag derived from `selection-store` or TanStack Query state (`06_library/01_state_and_providers.md`) -- "is the bulk-action bar visible," "is this row's mutation pending," "does the picker have a create affordance" are all render-time derivations, not effect-synced state.

## `useEffectEvent` for Effects That Need Fresh Values Without Re-Subscribing

`useEffect`'s dependency array answers "when should this re-run"; `useEffectEvent` (stable as of React 19.2) answers "what fresh values should this read without causing a re-run." Use it wherever an effect subscribes to something long-lived (a scroll listener, an intersection observer) but needs to read a value that changes often without tearing down and resubscribing on every change:

```typescript
const onScroll = useEffectEvent((offset: number) => {
  // reads the latest filters/query without being in the dependency array
  if (offset > threshold && !isFetchingNextPage) fetchNextPage();
});

useEffect(() => {
  const el = scrollContainerRef.current;
  const handler = () => onScroll(el.scrollTop);
  el.addEventListener("scroll", handler);
  return () => el.removeEventListener("scroll", handler);
}, []);  // stable -- onScroll is not a dependency, by design
```

Concrete uses in Topaz: the virtualized list's scroll/intersection listener reading the current filter state without resubscribing on every filter change, and the taxonomy picker's debounced search effect reading the current selection set (to exclude already-selected terms from results) without restarting the debounce timer every time a term is selected.

## `useOptimistic` Needs an Explicit Ordering Strategy

`useOptimistic` gives instant visual feedback and auto-rollback on failure, but it does not by itself guarantee ordering across rapid repeated actions on the same entity -- this is exactly why `02_data_and_mutation_flow.md` already specifies `useActionState` (which queues dispatches sequentially) over bare `useTransition` for any mutation where a second trigger is plausible before the first resolves. This file adds the concrete UI-level half of that policy: every `useActionState`-backed toggle (favorite, status, rating) disables its own input while its action is pending (`isPending` from `useActionState`'s third return value), rather than allowing a burst of clicks to queue up multiple dispatches whose resolution order a user can't predict from the UI alone. A pending toggle shows its optimistic value with a visibly disabled/muted affordance until the action settles -- this is a deliberate trade of a few hundred milliseconds of input-blocking for a correctness guarantee that's cheap to give up.

## `useId()` for Multi-Instance Safety

Any component that can legitimately be mounted more than once at a time (the taxonomy picker open in two different sheets, a form field repeated in a list) uses `useId()` for its internal `label`/`input`/ARIA id associations, never a hardcoded or module-scoped counter-based id. This is a real hazard specifically for the taxonomy picker (`06_library/04_taxonomy_picker.md`), which can appear inside both a work-edit sheet and a relation-management panel simultaneously.

## `React.cache()` and Taint APIs

`React.cache()` request-deduping (`02_stack/01_rsc_component_architecture.md`'s `preload*` pattern) already covers repeated server-side reads within one render. Add to that: any Server Action or query function that reads a row containing fields that must never reach the client (nothing currently in the schema qualifies, but this becomes relevant the moment any internal/administrative field is added to a table also used for public reads) calls `experimental_taintObjectReference`/`taintUniqueValue` on that value before it can be passed down -- a compile-time-adjacent guarantee against a field accidentally serializing into a Client Component prop, rather than relying on every call site to remember to strip it manually.

## Compound Components: A Narrow Fit, Not a Default

Compound components (`<Group><Group.Item/></Group>`) are the right shape for a **fixed, small vocabulary with flexible layout** -- a status segmented control, a rating-bucket filter. They are the wrong shape for **API-driven, dynamic option data**, because the parent/child contract has nothing stable to share across a compound API when the options themselves come from a search result. This is exactly why the taxonomy picker (`06_library/04_taxonomy_picker.md`) is a props/slots-based `useOptionPicker` hook with two thin rendering variants, not a `<Picker><Picker.Item/></Picker>` compound API -- confirmed correct by this policy, not a change. Where a genuinely fixed-vocabulary control is needed (e.g. a `library_entry.status` segmented control), a typed compound-component factory is appropriate:

```typescript
function createRadioGroup<T extends string>() {
  const Context = createContext<{ value: T; onChange: (v: T) => void } | null>(null);
  // ... Group and Group.Item, sharing the generic T through the factory closure
  return { Group, Item };
}
const StatusGroup = createRadioGroup<LibraryEntryStatus>();
```

The factory threads the generic type parameter through parent and child once, at the point of instantiation, so call sites don't re-annotate children manually.
