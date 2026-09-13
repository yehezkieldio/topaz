# Row Selection (Bulk Actions)

This file covers *entity selection*: checking multiple library entries in the list to run a bulk action (change status, add a taxonomy term, delete). It is a distinct concern from the taxonomy term picker covered in `04_taxonomy_picker.md` -- that one selects taxonomy terms as form input for a single work; this one selects rows across a virtualized, paginated list.

A naive multiselect is a plain array of ids, toggled with `includes()`/`splice()`/spread. That shape is brittle for reasons worth naming precisely, because the replacement is designed specifically against each one:

```text
- isSelected(id) is O(n) per row, per render, over a virtualized list -- exactly
  the case where it's called most often and matters most.
- Toggling produces a new array reference every time, which cascades re-renders
  through anything memoized downstream of "the selection."
- There is no way to express "select all 4,000 items matching the current filter"
  without either fetching and holding 4,000 ids client-side, or lying about what
  "select all" means (only selecting the currently-loaded page).
- Selection has no defined relationship to filter/sort changes -- items can end up
  "selected" that are no longer visible or no longer match, with no policy for it.
- Shift-click range selection is either missing or hand-rolled per usage site with
  its own bugs each time.
```

## The Model

Selection is an include/exclude set over a known universe (the current filtered/sorted query), not a bare list of ids:

```typescript
type Selection =
  | { mode: "include"; ids: ReadonlySet<string> }
  | { mode: "exclude"; ids: ReadonlySet<string>; totalCount: number };
```

`include` mode is the common case: a handful of explicitly checked items. `exclude` mode is what "select all" produces: the user meant "everything matching the current filter," represented as "all of them, minus whichever ones I've since unchecked" -- without ever materializing the full id list client-side. `totalCount` comes from the same aggregate the results count already uses.

```text
selectedCount(selection) =
  mode === "include" ? ids.size : totalCount - ids.size
```

## Store Shape

```typescript
interface SelectionState {
  selection: Selection;
  lastInteractedId: string | null;         // anchor for shift-click range select
  toggle: (id: string) => void;
  selectRange: (fromId: string, toId: string, orderedVisibleIds: string[]) => void;
  selectAllMatching: (totalCount: number) => void;   // -> exclude mode, ids: empty set
  clear: () => void;
  isSelected: (id: string) => boolean;
}
```

`toggle` flips membership in the current mode's set (adding to `include.ids`, or adding to `exclude.ids` when in exclude mode -- which reads correctly as "un-excluding is re-including, excluding is removing from the excluded-from-all set"). `selectRange` takes the two endpoint ids plus the currently-rendered ordered id list (from the virtualizer, not the full dataset) and adds every id between them in `include` mode -- range-select only ever operates over what's actually visible/loaded, by design; it does not attempt to range-select through unloaded pages.

`isSelected(id)` is O(1): a `Set.has()` check (inverted for exclude mode), not a scan. This is the entire point of the model -- it has to be cheap to call once per visible row, every render, in a virtualized list.

## Referential Stability

The `Selection` object and its inner `Set`s are replaced wholesale on every mutation (Zustand's standard immutable-update convention), never mutated in place -- so a `useShallow` or reference-equality selector correctly detects changes. Components read `isSelected(id)` as a store method (stable reference, closes over current state via Zustand's `get()`), not by subscribing to the whole `Selection` object and deriving membership inline -- that would re-render every row on every selection change instead of only the rows whose membership actually flipped. Where per-row re-render-on-any-change is unavoidable (e.g. a "N selected" toolbar), that's the one place subscribing to `selectedCount(selection)` directly is correct and expected.

## Bulk Actions Never Expand the Selection Client-Side

A `Selection` in `exclude` mode is sent to the server *as the descriptor it is* -- `{ mode: "exclude", excludedIds: [...], filters: <the active filter query> }` -- and the bulk-action Server Action re-applies the same filter query server-side, minus the excluded ids, to determine the actual target rows. This is why the selection store and the active filter query key are coupled through `LibrarySelectionProvider` (`01_state_and_providers.md`): the server needs to reconstruct the exact same "matching set" the client believed it was selecting against, using the same filter parameters, not a client-side enumeration of thousands of ids shipped over the wire.

## Selection Lifecycle Across Filter/Sort Changes

Policy, owned by `LibrarySelectionProvider`:

```text
filter or search query changes  -> clear selection (the matching set changed
                                   underneath the user; keeping stale selections
                                   silently pointing at now-invisible items is
                                   worse than asking them to reselect)
sort order changes only          -> preserve selection (the matching set is
                                   identical, only its order changed)
a selected item is deleted        -> remove it from selection.ids directly
                                   (include mode) or leave it in exclude.ids
                                   (harmless -- it no longer exists to exclude)
```

## Keyboard and Pointer Interaction

```text
click checkbox                    -> toggle(id), set lastInteractedId = id
shift+click checkbox               -> selectRange(lastInteractedId, id, visibleIds)
                                     if lastInteractedId is set, else toggle(id)
"select all N matching" control     -> selectAllMatching(totalCount), rendered only
                                     when totalCount exceeds the loaded/visible count
                                     (below that threshold, selecting each visible
                                     row via a real "select all visible" is
                                     equivalent and simpler -- offer that instead)
```
