# Sheets and Dialogs

Sheets (create/edit work, bulk actions, mobile filters) are the surface where form state, async submission, and navigation-away-with-unsaved-changes all collide. This file specifies the one correct shape.

## Single Source of Truth for "Which Sheet Is Open"

`ui-store.ts`'s `openSheet` field is a discriminated union, not a set of independent booleans:

```text
type OpenSheet =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; workId: string }
  | { kind: "bulk-action" }
  | { kind: "filter" }
```

A set of independent `isCreateOpen`/`isEditOpen`/`editingId` booleans allows invalid states (both open at once, an editingId with no sheet open) that this union makes structurally impossible. Every sheet component reads its own slice via a derived selector (`openSheet.kind === "edit" ? openSheet.workId : null`) and renders `null` when not its turn -- there is exactly one sheet mounted at a time.

## Async Submission Inside a Sheet

A sheet's form submission is the `useActionState` + TanStack Form pairing from `02_stack/02_data_and_mutation_flow.md`, with one addition specific to sheets: the sheet must not close until the action has actually resolved successfully, and must surface a distinct state for "submitting" vs. "failed" vs. "succeeded, closing."

```text
const [formState, formAction, isPending] = useActionState(submitWorkAction, initialState);

useEffect(() => {
  if (formState.status === "success") {
    closeSheet();          // ui-store action
    router.refresh();       // or rely on revalidateTag already having run server-side
  }
}, [formState.status]);
```

The sheet's own open/close state (`ui-store`) and the form's submission state (`useActionState`) are deliberately separate -- the sheet doesn't know how to submit a form, and the form doesn't know it's inside a sheet. This is what makes the same `WorkForm` reusable in a full-page context later without rewriting it.

## Close Guard (Unsaved Changes)

Closing a sheet with unsaved changes needs a confirmation step. This is a small, generic hook, not sheet-specific logic duplicated per sheet:

```text
function useCloseGuard(enabled: boolean, isDirty: boolean, onConfirmedClose: () => void) {
  const [pendingClose, setPendingClose] = useState(false);
  function requestClose() {
    if (!enabled || !isDirty) { onConfirmedClose(); return; }
    setPendingClose(true);
  }
  function confirmClose() { setPendingClose(false); onConfirmedClose(); }
  function cancelClose() { setPendingClose(false); }
  return { pendingClose, requestClose, confirmClose, cancelClose };
}
```

`enabled` follows the conditional-hooks pattern from `02_stack/05_advanced_react_patterns.md` -- the hook is always called; the guard only activates when the sheet is the kind of sheet that has a form to lose (a filter sheet doesn't need this at all, and passes `enabled: false`). `isDirty` comes from TanStack Form's own dirty-state, not a hand-rolled diff.

The confirmation itself is a nested `AlertDialog`, not a second sheet -- sheets should never stack.

## Bulk-Action Sheet

The bulk-action sheet is the one sheet that reads from `selection-store.ts` instead of owning its own single-entity form. It receives the current `Selection` (see `03_row_selection.md`), renders the available bulk operations (change status, add/remove a taxonomy term, delete), and on submit calls `bulk-actions.ts`'s Server Actions with the `Selection` descriptor directly -- it never expands the selection into a client-side array of every matching id before sending it, for the same reason described in `03_row_selection.md`.

## Mobile Filter Sheet

The filter sidebar's content and the mobile filter sheet's content are the same component (`LibraryFilterSidebar`), rendered in two different containers based on viewport -- not two parallel implementations of the filter form that can drift out of sync.
