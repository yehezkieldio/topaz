# Advanced React Engineering Patterns

This file sets the bar for how React code is written in Topaz: every render-path decision (memoization, context shape, selector shape, callback identity) is treated as load-bearing engineering, not an incidental style choice. This applies everywhere, but matters most in the library list, the multiselect, and any form with dynamic fields.

## Referential Stability Is a Contract, Not an Accident

A value's *type* says nothing about whether its *reference* is stable across renders. `items: Work[]` looks the same whether it's a `useMemo`'d stable array or a fresh `[]` literal produced every render -- but the two behave completely differently once they cross into `React.memo`, a `Context.Provider` value, a `useEffect` dependency array, or a TanStack Virtual row callback.

Treat referential stability as an explicit contract at every one of these boundaries:

```text
- Any array/object/function passed into a Context provider's value must come from
  useMemo (module scope for true constants). Never construct the value object inline
  in JSX (`value={{ a, b }}`) -- that is a fresh reference every render regardless of
  whether a and b themselves are stable.
- Any callback passed into a virtualized row, a memoized child, or a dependency array
  must have a stable identity across renders where its behavior hasn't changed.
  Prefer a single closure-over-id dispatcher (one stable `onAction(id, type, payload)`
  function) over a fresh per-row arrow function created inside `.map()`.
- Any derived collection (filtered list, selected-id Set, sorted view) that feeds a
  memoized consumer is computed via useMemo with a precise dependency array, not
  recomputed unconditionally on every render "because it's cheap" -- cheap compute,
  expensive downstream re-render.
- When a Zustand selector returns a derived array/object (not a primitive), use
  useShallow or an equality-checked selector. A bare `useStore(s => s.items.filter(...))`
  returns a new reference every call and silently defeats every memo downstream of it.
```

Where a value crosses a module boundary into a third-party API (TanStack Virtual's `estimateSize`, `getItemKey`, `measureElement`; TanStack Query's `queryKey`), the React Compiler's automatic memoization does not reach across that boundary -- these call sites need explicit `useMemo`/`useCallback` and should be commented as such when the reason isn't obvious from the surrounding code.

## Concurrent-Safe Mutation State: `useActionState` vs. bare `useTransition`

`useTransition` marks an update as non-blocking, but concurrent transitions run in **parallel** with no ordering guarantee -- a slow, earlier-triggered request can resolve after a newer one and silently overwrite it. This is a real hazard anywhere a user can trigger a second mutation on the same entity before the first resolves (rate this 3 stars, then quickly rate it 5).

`useActionState` wraps a Server Action in a queue: dispatches are sequentially consistent, each sees the previous action's committed result, and results commit atomically once the queue drains. Rule for Topaz:

```text
bare useTransition + useOptimistic  -> only for single-shot, no-ordering-hazard,
                                        purely client-side transitions (expand a
                                        card, switch a tab, open a sheet) with
                                        no server round trip that could race
                                        another one on the same entity.

useActionState                      -> required for any mutation where a second
                                        trigger on the same entity is plausible
                                        before the first resolves: favorite/status/
                                        rating toggles, reading-progress updates,
                                        bulk actions, form submits.
```

Do not layer a manual `useTransition` on top of TanStack Query's own request lifecycle for search/filtering -- `isFetching`/`isPending` already covers it, and TanStack Query already owns request cancellation/ordering via query keys. A second, uncoordinated source of "is this stale" truth is a bug waiting to happen, not redundancy for safety.

## Conditional Behavior, Never Conditional Hooks

Every hook is called unconditionally at every render. Where behavior needs to be conditional (a popover's outside-click handler only matters while it's open; a taxonomy field only exists for certain content types; keyboard nav only while a list is focused), the condition lives *inside* the hook as an `enabled` parameter, gating the effect body, not the call site:

```text
function useOutsideClick(enabled: boolean, ref: RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onOutside(); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [enabled, ref, onOutside]);
}
```

This keeps Rules of Hooks intact while still only running the side effect when it's actually needed. Apply this to every hook backing an optional sub-behavior in the multiselect, the taxonomy picker, and any dynamic form field.

## Scheduling and Render Budgets

React Compiler auto-memoizes the common case; manual `useMemo`/`useCallback`/`React.memo` are reserved for two situations only:

```text
1. Genuinely expensive computation (trigram/fuzzy taxonomy-suggestion matching
   over the full term set, client-side diffing of a large selection set).
2. A value crossing a module boundary into a third-party API that requires
   reference stability the compiler cannot see across (listed above).
```

For expensive client-side work triggered by a user action (e.g. diffing a multi-thousand-item selection when toggling "select all"), chunk the work rather than blocking a single synchronous pass:

```text
- Prefer incremental/structural-sharing updates over full-array clones: a Set-based
  selection model (06_library/03_row_selection.md) updates in O(1) per toggle instead
  of O(n) array reconstruction.
- Where a computation genuinely can't be avoided synchronously and is large enough
  to matter, wrap the state update in startTransition so it doesn't block input
  responsiveness, and communicate progress via isPending rather than freezing the UI.
- Profile before optimizing. Use the React DevTools Profiler and Chrome's
  Performance panel to confirm a render is actually expensive before reaching for
  any of the above -- do not manually memoize speculatively.
```

## Anti-Patterns Banned in This Codebase

```text
- Components defined inside another component's render body (remounts every render,
  destroying all local state and DOM identity for no reason).
- Index-as-key on any list that can reorder, filter, or have items inserted/removed
  in the middle -- always key by the entity's stable publicId.
- A Context provider that bundles a value and its setter into one object at a high
  level in the tree -- this gives every consumer of the value a reason to re-render
  on every setter-only change. Split "value" and "setters" into separate contexts
  wherever a value changes at a different frequency than who needs the setter
  (this matters directly for the search input: typing changes value every
  keystroke, but most of the tree only ever needs the setter).
- Inline object/array/function literals passed as props to a memoized component
  ({ a, b } or () => {} written directly in JSX) -- defeats the memoization it's
  being passed into.
- Effect chains where one effect's state update triggers another effect, used to
  sequence logic that should be a single derived computation or a single event
  handler instead.
```
