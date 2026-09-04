# Library Feature Architecture

The library feature (browse, search, filter, create/edit, bulk actions) is the highest-traffic, highest-complexity part of the app. It gets a deliberate module boundary, not an organically grown folder of components.

## Module Layout

```text
features/library/
  server/
    queries.ts             - cache()-wrapped Server Component reads
    actions.ts              - "use server" mutations (single-entity)
    bulk-actions.ts          - "use server" mutations over a Selection (see 03_row_selection.md)
    cache-tags.ts            - cacheTag() naming functions, single source of truth for tag shape
  state/
    selection-store.ts        - Zustand slice: the include/exclude Selection model
    ui-store.ts               - Zustand slice: sheet/dialog open state, view density, etc.
    filters.ts               - nuqs parsers and the search-params cache
  providers/
    library-query-provider.tsx  - QueryClient boundary + hydration for this route
    library-selection-provider.tsx - scopes the selection store to the current
                                     filtered view (see 01_state_and_providers.md)
  components/
    search/
      library-search-input.tsx   - 'use client', URL-writer leaf
    filters/
      library-filter-sidebar.tsx  - 'use client', nuqs-driven
      (taxonomy filtering uses TermMultiselect from taxonomy/, not a bespoke picker)
    results/
      library-results.tsx        - async RSC, resolves searchParams, exports its
                                    own LibraryResultsSkeleton
      library-list-virtualized.tsx - 'use client', TanStack Virtual + useInfiniteQuery
      work-card.tsx               - server-rendered card shell + client leaves
    actions/
      favorite-toggle.tsx         - 'use client' leaf, action-prop pattern
      status-select.tsx           - 'use client' leaf, action-prop pattern
      rating-stars.tsx            - 'use client' leaf, action-prop pattern
      selection-checkbox.tsx      - 'use client' leaf, wired to the selection store
    sheets/
      create-work-sheet.tsx
      edit-work-sheet.tsx
      bulk-action-sheet.tsx
      library-filter-sheet.tsx    (mobile filter sheet)
    stats/
      library-stats.tsx           - separate "use cache" boundary + Suspense hole
  forms/
    work-form/
      work-form.tsx               - TanStack Form root, composes field groups
      fields/
        source-field.tsx
        contributor-field.tsx
        taxonomy-field.tsx         - wraps TermMultiselect, see 04_taxonomy_picker.md
        reading-state-field.tsx

features/taxonomy/
  server/
    queries.ts                    - cache()-wrapped search/hot-terms reads
    actions.ts                    - assign/unassign/create/merge/relation mutations
  components/
    term-combobox.tsx              - single-select variant, see 04_taxonomy_picker.md
    term-multiselect.tsx            - multi-select variant, see 04_taxonomy_picker.md
    term-chip.tsx                   - the chip rendered everywhere a term appears
    term-chip-menu.tsx               - Edit/Manage relations/Merge context menu,
                                      see 05_taxonomy_in_sheets.md
    term-relations-panel.tsx          - inline panel opened from term-chip-menu
  hooks/
    use-option-picker.ts             - the shared state machine both picker
                                      variants render on top of
```

`features/library/` never imports taxonomy internals directly -- it imports `TermMultiselect`/`TermCombobox`/`TermChip` from `features/taxonomy/components/` as a public surface, the same way it would treat any other feature module. This keeps the taxonomy graph's complexity (relations, merging, effective-taxonomy rebuilds) contained to its own feature, even though its UI renders inside library sheets.

## Composition Rule

`app/(main)/library/page.tsx` renders the providers, then the static shell (`LibraryFilterSidebar`, `LibrarySearchInput`), then wraps `LibraryResults` and `LibraryStats` in their own, independent Suspense boundaries. It does not import from `state/` or `server/` directly -- it only composes components that do.

```text
LibraryQueryProvider
  LibrarySelectionProvider
    LibrarySearchInput            (static shell)
    LibraryFilterSidebar          (static shell)
    Suspense(LibraryResultsSkeleton)
      LibraryResults -> LibraryListVirtualized -> WorkCard[]
    Suspense(LibraryStatsSkeleton)
      LibraryStats
```

## Why a Dedicated Selection Provider

The multiselect (03_row_selection.md) needs to be scoped to "the current filtered/sorted view," not global to the whole app session -- selecting items, then changing a filter, has to have a defined behavior (clear, or keep-if-still-matching), and that behavior needs one owner. `LibrarySelectionProvider` is that owner: it wraps the results region, resets or reconciles the selection store when the active filter/sort query key changes, and is the only place that decision is made.

## Server/Client Boundary Discipline

```text
- server/queries.ts and server/actions.ts never import from components/ or state/.
- components/ never import the database client or Drizzle schema directly --
  only through server/queries.ts or server/actions.ts.
- state/ (Zustand stores) never import server/ -- a store holds client state only;
  a Server Action call is triggered from a component event handler, not from
  inside a store's own logic.
```

This keeps the dependency graph a strict DAG: `components -> state`, `components -> server`, and nothing crosses back.
