# Taxonomy Management Lives in Library Sheets

There is no standalone taxonomy management page or route. Every taxonomy operation -- assigning terms, creating a new term, merging duplicates, and managing typed relations -- happens contextually, from wherever a taxonomy term is already visible: the work create/edit sheet, or a term chip anywhere it's rendered.

## Why

A separate `/library/taxonomy` admin page forces a context switch: leave the work you're editing, find the term in an unrelated list, make the change, navigate back. Since Topaz is single-user and low-volume, every taxonomy operation has a natural trigger point already on screen -- the term picker while editing a work, or a term chip on a work's card. Surfacing management there removes an entire route, an entire page component tree, and the state-synchronization problem of keeping a standalone admin view in sync with whatever sheet is also open.

## Term Chip Context Menu

Any place a taxonomy term renders as a chip/badge (inside `TermMultiselect`'s selected list, on a `WorkCard`'s tag row, in the filter sidebar) gets the same context menu, wired to the same three Server Actions:

```text
Edit term        -> opens a small inline popover (not a sheet): rename, change kind,
                    edit label/aliases. Single-entity, low-friction, no navigation.
Manage relations  -> opens a compact panel anchored to the chip: lists existing
                    relations (broader/related/implies/conflicts_with/equivalent_to),
                    a TermCombobox + relation-type select to add one, delete buttons
                    on existing ones. This is the direct replacement for the old
                    standalone relations dialog -- same functionality, invoked from
                    the term itself instead of a separate admin page.
Merge into...     -> opens a TermCombobox scoped to the same kind, confirms, then
                    calls the merge Server Action (reassigns work_taxonomy_assignment
                    rows, sets mergedIntoId, triggers effective-taxonomy rebuild for
                    every affected work). This is a deliberately heavier action --
                    confirm via an AlertDialog before committing, per the close-guard
                    pattern's use of AlertDialog for destructive confirmations.
```

This context menu is one shared component (`TermChipMenu`), rendered identically everywhere a chip appears -- not reimplemented per surface.

## Creating a New Term

Never a separate "add term" form. Creation only happens inline, at the moment a term is needed: typing a name into a `TermMultiselect`/`TermCombobox` that doesn't match an existing term surfaces the create affordance (kind selector + similarity warning, per `04_taxonomy_picker.md`'s `CreatableOptionPicker` contract) directly in the dropdown. There is no code path that creates a taxonomy term outside of a picker.

## Effective-Taxonomy Rebuild Trigger

Every action in this file that changes assignments or relations (assign/unassign a term, add/delete a relation, merge two terms) triggers the effective-taxonomy rebuild for the affected work(s) as part of the same Server Action -- not a separate step the UI has to remember to call. The rebuild is bounded (maxDepth 4, per `03_data/00_schema_contract.md`) so this stays cheap even from a chip-level interaction.

## What's Explicitly Not Rebuilt

A global "browse all taxonomy terms" view is not part of this design. If term discovery beyond what the picker's search/hot-terms view already surfaces becomes a real need, that is a new, deliberately scoped feature request -- not a reason to bring back a standalone admin page by default.
