"use client";

import { XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { CreatableOptionPicker } from "@/features/taxonomy/components/option-results-list";
import { OptionResultsList } from "@/features/taxonomy/components/option-results-list";
import { TermChipMenu } from "@/features/taxonomy/components/term-chip-menu";
import { useOptionPicker } from "@/features/taxonomy/hooks/use-option-picker";
import type { OptionPickerOption } from "@/features/taxonomy/hooks/use-option-picker";
import { useOutsideClick } from "@/hooks/use-outside-click";

export const TermMultiselect = ({
  creatable,
  initialSelected,
  kind,
  loadHotTerms,
  onSelectionChange,
  search,
}: {
  initialSelected?: OptionPickerOption[];
  search: (query: string, kind?: string) => Promise<OptionPickerOption[]>;
  onSelectionChange: (selected: OptionPickerOption[]) => void;
  kind?: string;
  loadHotTerms?: () => Promise<OptionPickerOption[]>;
  creatable?: CreatableOptionPicker;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    deselect,
    hotTerms,
    isQueryEmpty,
    isSearching,
    isSelected,
    query,
    results,
    select,
    selected,
    setQuery,
  } = useOptionPicker({
    initialSelected,
    kind,
    loadHotTerms,
    onSelectionChange,
    search,
  });

  useOutsideClick(isOpen, containerRef, () => setIsOpen(false));

  return (
    <div className="relative" ref={containerRef}>
      <div className="border-input bg-background flex flex-wrap gap-1.5 rounded-md border p-2">
        {[...selected.values()].map((option) => (
          <Badge
            className="gap-1 rounded-sm pr-1"
            key={option.id}
            variant="secondary"
          >
            {option.label}
            <TermChipMenu termId={option.id} termLabel={option.label} />
            <button
              aria-label={`Remove ${option.label}`}
              onClick={() => deselect(option.id)}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent text-sm outline-none"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Add tags..."
          type="text"
          value={query}
        />
      </div>
      {isOpen && (
        <div className="bg-popover absolute z-10 mt-1 w-full rounded-md border shadow-md">
          <OptionResultsList
            creatable={creatable}
            hotTerms={hotTerms}
            isQueryEmpty={isQueryEmpty}
            isSearching={isSearching}
            isSelected={isSelected}
            onCreated={(option) => {
              select(option);
              setQuery("");
            }}
            onSelect={(option) => {
              select(option);
              setQuery("");
            }}
            query={query}
            results={results}
          />
        </div>
      )}
    </div>
  );
};
