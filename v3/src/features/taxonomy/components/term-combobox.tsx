"use client";

import { useRef, useState } from "react";

import { useOptionPicker } from "@/features/taxonomy/hooks/use-option-picker";
import type { OptionPickerOption } from "@/features/taxonomy/hooks/use-option-picker";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { cn } from "@/lib/utils";

/**
 * Single-select thin variant over useOptionPicker's shared state machine --
 * used wherever exactly one term is required (a relation's target, a merge's
 * "into" target), never a multiselect with .at(-1) taken from it
 * (06_library/04_taxonomy_picker.md).
 */
export const TermCombobox = ({
  exclude,
  onSelect,
  placeholder = "Search terms...",
  search,
}: {
  search: (query: string) => Promise<OptionPickerOption[]>;
  onSelect: (option: OptionPickerOption) => void;
  exclude?: string;
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isSearching, query, results, setQuery } = useOptionPicker({
    mode: "single",
    search,
  });

  useOutsideClick(isOpen, containerRef, () => setIsOpen(false));

  const visibleResults = results.filter((option) => option.id !== exclude);

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
      {isOpen && query.trim().length >= 2 && (
        <div className="bg-popover absolute z-10 mt-1 w-full rounded-md border shadow-md">
          {isSearching && (
            <p className="text-muted-foreground px-3 py-2 text-xs">
              Searching...
            </p>
          )}
          {!isSearching && visibleResults.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-xs">
              No matches.
            </p>
          )}
          <ul>
            {visibleResults.map((option) => (
              <li key={option.id}>
                <button
                  className={cn(
                    "hover:bg-muted w-full px-3 py-1.5 text-left text-sm"
                  )}
                  onClick={() => {
                    onSelect(option);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
