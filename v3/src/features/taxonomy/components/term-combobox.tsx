"use client";

import { useRef, useState } from "react";

import type { CreatableOptionPicker } from "@/features/taxonomy/components/option-results-list";
import { OptionResultsList } from "@/features/taxonomy/components/option-results-list";
import { useOptionPicker } from "@/features/taxonomy/hooks/use-option-picker";
import type { OptionPickerOption } from "@/features/taxonomy/hooks/use-option-picker";
import { useOutsideClick } from "@/hooks/use-outside-click";

/**
 * Single-select thin variant over useOptionPicker's shared state machine --
 * used wherever exactly one term is required (a relation's target, a merge's
 * "into" target), never a multiselect with .at(-1) taken from it
 * (06_library/04_taxonomy_picker.md).
 */
export const TermCombobox = ({
  creatable,
  exclude,
  kind,
  loadHotTerms,
  onSelect,
  placeholder = "Search terms...",
  search,
}: {
  search: (query: string, kind?: string) => Promise<OptionPickerOption[]>;
  onSelect: (option: OptionPickerOption) => void;
  exclude?: string;
  placeholder?: string;
  kind?: string;
  loadHotTerms?: () => Promise<OptionPickerOption[]>;
  creatable?: CreatableOptionPicker;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { hotTerms, isQueryEmpty, isSearching, query, results, setQuery } =
    useOptionPicker({ kind, loadHotTerms, mode: "single", search });

  useOutsideClick(isOpen, containerRef, () => setIsOpen(false));

  const excludeOption = (options: OptionPickerOption[]) =>
    exclude ? options.filter((option) => option.id !== exclude) : options;

  return (
    <div className="relative" ref={containerRef}>
      <input
        className="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-1.5 text-sm outline-none"
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        type="text"
        value={query}
      />
      {isOpen && (
        <div className="bg-popover absolute z-10 mt-1 w-full rounded-md border shadow-md">
          <OptionResultsList
            creatable={creatable}
            hotTerms={excludeOption(hotTerms)}
            isQueryEmpty={isQueryEmpty}
            isSearching={isSearching}
            isSelected={() => false}
            onCreated={(option) => {
              onSelect(option);
              setQuery("");
              setIsOpen(false);
            }}
            onSelect={(option) => {
              onSelect(option);
              setQuery("");
              setIsOpen(false);
            }}
            query={query}
            results={excludeOption(results)}
          />
        </div>
      )}
    </div>
  );
};
