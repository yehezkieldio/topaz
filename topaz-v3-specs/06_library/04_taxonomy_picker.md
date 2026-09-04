# Taxonomy Picker (Combobox + Multiselect Primitive)

The taxonomy term picker is the single highest-touch control in the app: every work create/edit, every relation edit, and every filter interaction goes through it. It is worth naming its exact prior failure modes, because the redesign is a direct answer to each:

```text
- Two independent search states for one logical control: the multiselect ran its
  own debounced remote search, and the form field wrapping it ran a *second*,
  separate search instance solely to resolve already-known ids back to labels.
- A generic multiselect primitive was reused for single-select (a relation's
  target term) by taking .at(-1) of the selection array -- the type signature
  allowed multiple, the actual usage needed exactly one, and nothing enforced it.
- Selected terms were a plain array, diffed by .value on every toggle -- new
  array reference every interaction, O(n) membership checks, and the options
  list itself was never virtualized.
- Kind-scoping and "create a new term" were wired ad hoc at each call site
  rather than being part of the primitive's own contract.
```

## One State Machine, Two Thin Variants

There is one hook, `useOptionPicker`, and two components built on it: `TermCombobox` (single-select) and `TermMultiselect` (multi-select). Neither component reimplements selection logic; both are a thin rendering shell over the same state machine, so there is no single-select-via-multiselect-hack path available.

```typescript
type Option = { id: string; label: string; kind: TaxonomyKind; description?: string };

interface UseOptionPickerArgs {
  mode: "single" | "multi";
  initialSelected: Option[];           // full objects, not ids -- see below
  search: (query: string, kind?: TaxonomyKind) => Promise<Option[]>;  // calls a Server Action
  kind?: TaxonomyKind;                  // fixed kind, or undefined to allow any
}

interface UseOptionPickerResult {
  selected: ReadonlyMap<string, Option>;   // id -> Option, not an array
  query: string;
  setQuery: (q: string) => void;
  results: Option[];
  isSearching: boolean;
  select: (option: Option) => void;        // single mode: replaces; multi mode: adds
  deselect: (id: string) => void;
  isSelected: (id: string) => boolean;      // O(1)
}
```

`selected` is a `Map`, not an array -- membership is O(1), and the map already carries the full `Option` (label, kind, description), so nothing downstream needs a second lookup structure. Replaced wholesale on every mutation (never mutated in place), same referential-stability discipline as the row-selection model.

## Initial Selection Comes From the Server, Never Re-Fetched by ID

The prior implementation's root duplication bug -- a second `useTaxonomySearch()` call existing solely to turn already-known ids back into labels -- is structurally impossible in this design, because `initialSelected` is always the full `Option[]` the Server Component already has (the work's assigned taxonomy terms are fetched with their labels in the same read that renders the edit sheet). A picker is never handed bare ids and left to resolve them itself.

## Search: `useDeferredValue`, Not a Custom Debounce Hook

```text
- query is local state, updated synchronously on every keystroke (input stays responsive).
- deferredQuery = useDeferredValue(query) drives the actual search() call.
- isSearching = query !== deferredQuery || the search promise is still pending.
- search() is the Server Action directly (features/taxonomy/actions.ts), wrapped
  in cache() where the same query+kind pair is likely to repeat within a render.
```

This replaces the bespoke `useDebounce` + manual whitespace-normalization that existed per call site with the same primitive already used for the main library search box (`02_stack/01_rsc_component_architecture.md`) -- one deferred-value pattern for every search-as-you-type control in the app, not two.

## Virtualized Results

The results list renders through TanStack Virtual once `results.length` exceeds a small threshold (roughly 30 -- below that, virtualization overhead isn't worth it). The "hot terms" default view (shown when `query` is empty) and live search results share the same virtualized list component; there is no separate unvirtualized code path for one of them.

## Creation Is a Typed Contract, Not a Raw Slot

The generic picker primitive doesn't know what "kind" or "similar term" mean -- but it does define a typed extension point so taxonomy-specific creation logic plugs in without leaking taxonomy concepts into the primitive itself:

```typescript
interface CreatableOptionPicker {
  canCreate: (query: string) => boolean;
  onCreate: (query: string) => Promise<Option>;
  renderCreateAffordance?: (query: string) => React.ReactNode; // kind selector, similar-term warning
}
```

`TermMultiselect` and `TermCombobox` both accept an optional `creatable: CreatableOptionPicker`. The taxonomy feature supplies one implementation (kind selector + trigram-similarity warning surfaced inline, calling the `createTaxonomyTerm` Server Action) that both components share -- the create flow is written once, not once per call site.

## Where Each Variant Is Used

```text
TermMultiselect  -> work create/edit sheet's taxonomy field (assigning terms to a work)
                   -> library filter sidebar's taxonomy filter (filtering the list)

TermCombobox     -> relation target picker (a relation is always exactly one
                   term related to another -- this was the case the old
                   multiselect-via-.at(-1) hack was covering incorrectly)
                   -> "merge into" target picker when merging a duplicate term
```

## Referential Stability at the Call Site

Every consumer passes `select`/`deselect` (or a thin wrapper) directly as the mutation callback into the form field it's bound to -- never a fresh inline arrow function reconstructing a new array each render. For a TanStack Form field:

```text
<form.Field name="taxonomyTermIds">
  {(field) => (
    <TermMultiselect
      initialSelected={work.taxonomyTerms}
      onChange={useCallback((selected) => field.handleChange([...selected.keys()]), [field])}
    />
  )}
</form.Field>
```

`onChange` is memoized once per field identity, not reconstructed per keystroke -- consistent with `02_stack/05_advanced_react_patterns.md`'s referential-stability contract.
