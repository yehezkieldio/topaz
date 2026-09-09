"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";

export interface OptionPickerOption {
  id: string;
  label: string;
  /** Taxonomy kind slug (taxonomy_kind.slug), when the caller cares. */
  kind?: string;
  description?: string;
}

const MIN_QUERY_LENGTH = 2;

/**
 * The shared state machine both the combobox (single-select) and multiselect
 * taxonomy pickers render on top of -- selection, search, and hot-terms live
 * here once; the two components differ only in how they render `selected`
 * (topaz-v3-specs/06_library/04_taxonomy_picker.md).
 */
export const useOptionPicker = ({
  initialSelected = [],
  kind,
  loadHotTerms,
  mode = "multi",
  onSelectionChange,
  search,
}: {
  initialSelected?: OptionPickerOption[];
  search: (query: string, kind?: string) => Promise<OptionPickerOption[]>;
  loadHotTerms?: () => Promise<OptionPickerOption[]>;
  onSelectionChange?: (selected: OptionPickerOption[]) => void;
  mode?: "single" | "multi";
  /** Fixed kind slug to scope every search/hot-terms call to, if any. */
  kind?: string;
}) => {
  const [selected, setSelected] = useState<
    ReadonlyMap<string, OptionPickerOption>
  >(() => new Map(initialSelected.map((option) => [option.id, option])));
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<OptionPickerOption[]>([]);
  const [hotTerms, setHotTerms] = useState<OptionPickerOption[]>([]);
  const [isPending, startTransition] = useTransition();

  const isQueryEmpty = deferredQuery.trim().length === 0;
  const isQueryLongEnough = deferredQuery.trim().length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!loadHotTerms) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const next = await loadHotTerms();
        if (!cancelled) {
          setHotTerms(next);
        }
      } catch {
        if (!cancelled) {
          setHotTerms([]);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // Re-runs when the fixed kind changes -- loadHotTerms is expected to be
    // a stable reference closing over the current kind (or re-created by the
    // caller when kind changes), same contract as `search`.
  }, [loadHotTerms]);

  useEffect(() => {
    if (!isQueryLongEnough) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const next = await search(deferredQuery, kind);
        if (!cancelled) {
          setResults(next);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      }
    };

    startTransition(() => {
      void run();
    });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, search, isQueryLongEnough, kind]);

  const visibleResults = isQueryLongEnough ? results : [];

  // onSelectionChange (which forwards into a parent's state, e.g. TanStack
  // Form's field.handleChange) must not be called from inside the setSelected
  // updater -- updaters can run more than once (e.g. under StrictMode) and
  // must stay free of side effects. Compute the next map first, then commit
  // both state updates as separate top-level statements.
  const select = (option: OptionPickerOption) => {
    const next: Map<string, OptionPickerOption> =
      mode === "single"
        ? new Map([[option.id, option]])
        : new Map([...selected, [option.id, option]]);
    setSelected(next);
    onSelectionChange?.([...next.values()]);
  };

  const deselect = (id: string) => {
    const next = new Map(selected);
    next.delete(id);
    setSelected(next);
    onSelectionChange?.([...next.values()]);
  };

  const isSelected = (id: string) => selected.has(id);

  return {
    deselect,
    hotTerms,
    isQueryEmpty,
    isSearching: query !== deferredQuery || isPending,
    isSelected,
    query,
    results: visibleResults,
    select,
    selected,
    setQuery,
  };
};
