# Mutation Lifecycle and State Transitions

This file specifies four things that are easy to get subtly wrong once optimistic concurrency, sheets, and URL-synced filters are all in play at once: what happens when a version conflict occurs, what order things happen in after a mutation succeeds, what happens to a sheet's form state when the entity underneath it changes, and how granular filter-state subscriptions stay granular.

## Version Conflicts Are a Distinct, Recoverable State

Every mutable entity (`work`, `library_entry`, `reading_state`, `taxonomy_term`) carries a `version` column (`03_data/00_schema_contract.md`), submitted back with every edit. A Server Action that detects a stale version must not fail the same way a validation error fails -- it's a different situation with a different recovery path, and the UI has to be able to tell them apart.

```typescript
type MutationResult<T> =
  | { status: "success"; data: T }
  | { status: "validation-error"; fieldErrors: Record<string, string[]> }
  | { status: "version-conflict"; currentVersion: number; latest: T };
```

A `version-conflict` result carries the current server-side state (`latest`), not just an error string. The UI's response is specific: surface a distinct message ("This was changed elsewhere since you opened it") with two actions -- **discard my changes and load the latest**, or **review the difference** (for a form, this can be as simple as re-populating the form with `latest` and letting the user re-apply their intended change against current data). It is never silently retried, and it is never presented as the same generic error toast a validation failure gets -- conflating the two teaches the user to ignore both.

This is the concrete reason `version` is threaded through every form and every mutation in the first place -- if nothing ever reads the conflict branch, the column is decorative.

## Mutation Success: A Fixed Order, No Incidental Side Effects

Every mutation handler (whether wired through `useActionState` or a sheet's submit handler) follows the same sequence, and does *only* what's in this sequence -- no side effect on unrelated UI state:

```text
1. Server Action resolves with { status: "success", data }.
2. The sheet/dialog closes (if the mutation was sheet-scoped).
3. Cache tags the mutation touched are already revalidated server-side
   (02_stack/03_caching_and_streaming.md) -- the client does not separately
   invalidate/refetch as a belt-and-suspenders step; the tag revalidation is
   the single source of truth for "this data is now stale, go refetch."
4. A success toast/confirmation renders.
```

What does not belong in this sequence: clearing the search box, resetting unrelated filters, or navigating away. A mutation on one entity must not reach into and mutate state that has nothing to do with it -- if editing a work happens to also clear the user's active search query, that's a bug, not a convenience, and it's exactly the kind of coupling that's easy to introduce by writing cleanup steps ad hoc inside a single mutation handler instead of following a fixed, minimal sequence.

## Sheets Remount on Entity Identity, Not Just Open State

A sheet/dialog whose content is a form bound to a specific entity (edit-work, manage-relations) is keyed by that entity's `publicId`:

```tsx
{openSheet.kind === "edit" && (
  <EditWorkSheet key={openSheet.workId} workId={openSheet.workId} />
)}
```

Without the `key`, switching from editing entity A directly to editing entity B (without the sheet fully closing in between -- e.g. clicking "edit" on a different row while a sheet-like overlay is already open) leaves React free to reuse the mounted form's internal state, because the component instance didn't change, only its props did. TanStack Form's internal field state, dirty-tracking, and any local `useState` inside the form do not know to reset just because a `workId` prop changed. Keying by identity forces a full unmount/remount, which is the only way to guarantee a form never shows entity A's edited-but-unsaved values while claiming to edit entity B.

## Per-Row Overlay State: Colocated, Not Global

Not every sheet needs to live in the global `ui-store` (`01_state_and_providers.md`). The deciding question is: **does anything outside this subtree need to open or read this overlay?**

```text
- View/edit/delete overlays triggered from a row inside the virtualized list,
  with no other part of the page needing to open them -- colocated local state
  in the list component itself, as a discriminated union:
  type ActiveOverlay = { kind: "none" } | { kind: "view" | "edit" | "delete"; workId: string }
  This is deliberately the same shape discipline as ui-store's openSheet union
  (02_sheets_and_dialogs.md), just scoped locally because nothing else needs it.

- Create-work (triggered from a page-level header button, outside the list),
  bulk-action (triggered from a toolbar that appears above the list but isn't
  part of any single row), and the mobile filter sheet (triggered from
  navigation chrome) -- these go through ui-store, because a component outside
  the list's own subtree needs to trigger them.
```

Putting row-scoped overlay state in Zustand when nothing outside the list ever reads it adds a global dependency and a wider re-render surface for no benefit -- state colocation (`01_principles/00_design_philosophy.md`) applies to sheet state exactly as it applies to any other state.

## Filter State: Subscribe Narrowly, Combine Late

A single hook that reads every filter field via one combined `useQueryStates` call and hands back one object re-renders every consumer of that hook whenever *any* filter changes, even a consumer that only displays one field. Prefer per-field `useQueryState` subscriptions in the components that only need one field (a single select control, a single toggle), and reserve the combined multi-field read for the one place that actually needs all fields together at once -- building the query key passed into `useInfiniteQuery`. That combining point is the only place a change to any field should legitimately cause a re-render; every individual filter control should re-render only when its own field changes.

## Infinite-Scroll Fetch Guard

The "fetch next page when the sentinel row scrolls into view" trigger needs a guard beyond `isFetchingNextPage` alone: an intersection observer can fire multiple times in quick succession before a state update from the first trigger has propagated, so a ref-based mutex (set synchronously on trigger, cleared in a `finally` after the fetch settles) sits alongside the query's own `isFetchingNextPage`/`hasNextPage` checks as a defensive second guard against duplicate fetches. This is not redundant with TanStack Query's own dedupe -- it prevents the *trigger* from firing twice, which is a different problem from the query layer deduping two identical in-flight requests.

## Code-Splitting Sheets and Dialogs

Every sheet and dialog is lazily loaded (`next/dynamic` with `ssr: false`, or React's `lazy` + `Suspense` if not using Next's wrapper) rather than bundled into the route's initial client JS. A sheet's content (a full form, a taxonomy picker, a relations panel) is meaningfully sized code that the vast majority of page loads never need to execute -- a public visitor browsing the library never opens an admin-only edit sheet, and shipping that code to them unconditionally is pure waste.
