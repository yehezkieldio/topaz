"use client";

import { XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useOptionPicker } from "@/features/taxonomy/hooks/use-option-picker";
import type { OptionPickerOption } from "@/features/taxonomy/hooks/use-option-picker";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { cn } from "@/lib/utils";

export const TermMultiselect = ({
  createTerm,
  initialSelected,
  onSelectionChange,
  search,
}: {
  initialSelected?: OptionPickerOption[];
  search: (query: string) => Promise<OptionPickerOption[]>;
  onSelectionChange: (selected: OptionPickerOption[]) => void;
  createTerm?: (name: string) => Promise<OptionPickerOption | null>;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    deselect,
    isSearching,
    isSelected,
    query,
    results,
    select,
    selected,
    setQuery,
  } = useOptionPicker({ initialSelected, onSelectionChange, search });

  useOutsideClick(isOpen, containerRef, () => setIsOpen(false));

  const trimmedQuery = query.trim();
  const hasExactMatch = results.some(
    (option) => option.label.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const canCreate =
    Boolean(createTerm) && trimmedQuery.length >= 2 && !hasExactMatch;

  const handleCreate = async () => {
    if (!createTerm) {
      return;
    }
    try {
      const created = await createTerm(trimmedQuery);
      if (created) {
        select(created);
        setQuery("");
      }
    } catch {
      // The picker just leaves the query text in place; the user can retry.
    }
  };

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
      {isOpen && (query.trim().length >= 2 || results.length > 0) && (
        <div className="bg-popover absolute z-10 mt-1 w-full rounded-md border shadow-md">
          {isSearching && (
            <p className="text-muted-foreground px-3 py-2 text-xs">
              Searching...
            </p>
          )}
          {!isSearching && results.length === 0 && !canCreate && (
            <p className="text-muted-foreground px-3 py-2 text-xs">
              No matches.
            </p>
          )}
          <ul>
            {results.map((option) => (
              <li key={option.id}>
                <button
                  className={cn(
                    "hover:bg-muted w-full px-3 py-1.5 text-left text-sm",
                    isSelected(option.id) && "opacity-50"
                  )}
                  disabled={isSelected(option.id)}
                  onClick={() => {
                    select(option);
                    setQuery("");
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
          {canCreate && (
            <button
              className="hover:bg-muted w-full border-t px-3 py-1.5 text-left text-sm"
              onClick={() => {
                handleCreate();
              }}
              type="button"
            >
              Create &ldquo;{trimmedQuery}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
};
