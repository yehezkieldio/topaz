# State and Providers

Three distinct kinds of state exist in the library feature, and each has exactly one owner. Mixing them into a single "library store" is the mistake this file exists to prevent.

```text
1. Server state (the works, taxonomy, stats themselves)  -> TanStack Query, seeded
   from Server Components. Never duplicated into Zustand.

2. URL state (search text, filters, sort, cursor)          -> nuqs. This is the
   shareable, bookmarkable, back-button-respecting state. Never duplicated into
   Zustand or React state as a second source of truth -- components read it via
   nuqs hooks directly or receive it as a prop from the page.

3. Client-only UI/interaction state that something OUTSIDE its owning subtree
   needs to read or trigger (global sheet state, row selection, view density)
   -> Zustand, scoped per-concern.

4. Client-only UI/interaction state that only the subtree that owns it ever
   reads or triggers (per-row view/edit/delete overlays inside the virtualized
   list) -> colocated local state in that subtree, never Zustand. See
   06_mutation_lifecycle_and_transitions.md's "Per-Row Overlay State" section
   for the exact test that decides which bucket a given piece of state falls into.
```

## Zustand Store Boundaries

Two stores, not one, because they change at different frequencies and are consumed by different parts of the tree. Both hold only state that's genuinely needed outside a single subtree -- see category 4 above for what deliberately stays out of Zustand:

```text
selection-store.ts
  - Selection (include/exclude model, see 03_row_selection.md)
  - lastInteractedId (anchor for shift-click range select)
  - actions: toggle, selectRange, selectAllMatching, clear, isSelected(id)

ui-store.ts
  - which globally-triggerable sheet is open: create-work (header button),
    bulk-action (toolbar), mobile filter sheet (nav chrome) -- as a
    discriminated union, per 02_sheets_and_dialogs.md's OpenSheet type.
    Per-row view/edit/delete overlays are NOT here -- see category 4 above.
  - view density (comfortable | compact)
```

Each store is created via Zustand's slice pattern, selected into components with primitive or `useShallow` selectors only -- never a bare object-returning selector (see `02_stack/05_advanced_react_patterns.md` on why that defeats memoization).

```text
// correct: primitive selector, stable reference by definition
const isOpen = useUiStore((s) => s.openSheet === "create");

// correct: shallow-compared derived array
const selectedIds = useSelectionStore(useShallow((s) => Array.from(s.selection.ids)));

// wrong: fresh array reference every call, re-renders every subscriber every render
const selectedWorks = useSelectionStore((s) => works.filter((w) => s.selection.ids.has(w.id)));
```

## Provider Composition

```text
LibraryQueryProvider
  - owns the QueryClient for this route (isServer-branched: fresh client per
    request on the server, stable singleton in the browser)
  - hydrates the prefetched infinite-query cache from the Server Component read

LibrarySelectionProvider
  - wraps the results region only, not the whole page
  - reads the active nuqs-derived query key (filters + sort + search)
  - on query key change: reconciles the selection store per the configured
    behavior (default: clear on filter/search change, preserve on sort-only
    change, since sort doesn't change the matching set)
  - this is the single place that decision is made -- no component downstream
    re-implements "should I clear selection on filter change"
```

## Context vs. Zustand

Zustand is used, not React Context, for both stores above -- selection and UI state both need to be read by components that are siblings or cousins in the tree (a row's checkbox and the bulk-action toolbar; a sheet trigger button and the sheet itself), and a Context provider holding this kind of frequently-changing state would force a provider re-render (and everything under it) on every toggle. Context is reserved in this feature for values that are genuinely static per-subtree (e.g. a `TaxonomyGraphContext` providing the seeded, read-mostly relation graph to the taxonomy picker) and are always constructed via `useMemo`/module scope per the referential-stability contract.

## Search Input State (Local, Deferred, Then URL)

The search input is a special case worth calling out: it has *three* layers of state, each with a purpose.

```text
1. Local useState (filterText) -- what's literally in the <input>, updates every keystroke.
2. useDeferredValue(filterText) -- lags behind (1), used to detect staleness
   (filterText !== deferredFilterText) and to drive the actual query.
3. nuqs / URL (q param) -- written from (2) via router.replace inside a
   useTransition, debounced/deferred so the URL and the network request don't
   thrash on every keystroke.
```

None of these three is redundant -- collapsing them into "just put it in the URL directly on every keystroke" produces the exact skeleton-flash-per-keystroke problem this architecture is designed to avoid.
