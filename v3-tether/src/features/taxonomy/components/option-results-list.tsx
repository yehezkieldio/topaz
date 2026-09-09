"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import type { OptionPickerOption } from "@/features/taxonomy/hooks/use-option-picker";
import { cn } from "@/lib/utils";

/**
 * The generic picker primitive doesn't know what "kind" or "similar term"
 * mean, but it defines this typed extension point so taxonomy-specific
 * creation logic plugs in without leaking taxonomy concepts into the
 * primitive itself (topaz-v3-specs/06_library/04_taxonomy_picker.md).
 */
export interface CreatableOptionPicker {
  canCreate: (query: string) => boolean;
  onCreate: (query: string) => Promise<OptionPickerOption>;
  renderCreateAffordance?: (query: string) => React.ReactNode;
}

const VIRTUALIZE_THRESHOLD = 30;
const ROW_HEIGHT = 32;
const VIRTUAL_LIST_HEIGHT = 240;

const OptionRow = ({
  isSelected,
  onSelect,
  option,
}: {
  option: OptionPickerOption;
  isSelected: boolean;
  onSelect: (option: OptionPickerOption) => void;
}) => (
  <button
    className={cn(
      "hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
      isSelected && "opacity-50"
    )}
    disabled={isSelected}
    onClick={() => onSelect(option)}
    type="button"
  >
    <span className="truncate">{option.label}</span>
    {option.kind && (
      <span className="text-muted-foreground shrink-0 text-[10px]">
        {option.kind}
      </span>
    )}
  </button>
);

/**
 * The one shared results-rendering surface for both TermCombobox and
 * TermMultiselect: hot-terms-when-empty and live search results go through
 * the same virtualized list, not two separate code paths
 * (topaz-v3-specs/06_library/04_taxonomy_picker.md "Virtualized Results").
 */
export const OptionResultsList = ({
  creatable,
  hotTerms,
  isQueryEmpty,
  isSearching,
  isSelected,
  onCreated,
  onSelect,
  query,
  results,
}: {
  results: OptionPickerOption[];
  hotTerms: OptionPickerOption[];
  isQueryEmpty: boolean;
  isSearching: boolean;
  isSelected: (id: string) => boolean;
  onSelect: (option: OptionPickerOption) => void;
  onCreated: (option: OptionPickerOption) => void;
  creatable?: CreatableOptionPicker;
  query: string;
}) => {
  // TanStack Virtual's useVirtualizer relies on interior mutability (its
  // returned instance is a mutable object the library updates in place),
  // which the React Compiler can't safely memoize -- there's no memo-safe
  // replacement upstream yet, so this component opts out of compilation
  // rather than risk the compiler caching a stale virtualizer snapshot.
  "use no memo";

  const parentRef = useRef<HTMLDivElement>(null);
  const displayed = isQueryEmpty ? hotTerms : results;
  const trimmedQuery = query.trim();
  const hasExactMatch =
    !isQueryEmpty &&
    results.some(
      (option) => option.label.toLowerCase() === trimmedQuery.toLowerCase()
    );
  const canCreate = Boolean(
    creatable && creatable.canCreate(query) && !hasExactMatch
  );
  const shouldVirtualize = displayed.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: displayed.length,
    estimateSize: () => ROW_HEIGHT,
    // Same flushSync-in-lifecycle guard as the library list: the virtualizer
    // calls flushSync on synchronous updates by default, which React 19
    // rejects during commit. Schedule those rerenders normally instead.
    useFlushSync: false,
    getScrollElement: () => parentRef.current,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const handleCreate = async () => {
    if (!creatable) {
      return;
    }
    try {
      const created = await creatable.onCreate(trimmedQuery);
      onCreated(created);
    } catch {
      // The picker just leaves the query text in place; the user can retry.
    }
  };

  if (isSearching) {
    return (
      <p className="text-muted-foreground px-3 py-2 text-xs">Searching...</p>
    );
  }

  return (
    <div>
      {displayed.length === 0 && !canCreate && (
        <p className="text-muted-foreground px-3 py-2 text-xs">
          {isQueryEmpty ? "No suggestions yet." : "No matches."}
        </p>
      )}
      {displayed.length > 0 &&
        (shouldVirtualize ? (
          <div
            className="overflow-y-auto"
            ref={parentRef}
            style={{ height: VIRTUAL_LIST_HEIGHT }}
          >
            <div
              style={{
                height: totalSize,
                position: "relative",
                width: "100%",
              }}
            >
              {virtualItems.map((virtualItem) => {
                const option = displayed[virtualItem.index];
                if (!option) {
                  return null;
                }
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      left: 0,
                      position: "absolute",
                      top: 0,
                      transform: `translateY(${virtualItem.start}px)`,
                      width: "100%",
                    }}
                  >
                    <OptionRow
                      isSelected={isSelected(option.id)}
                      onSelect={onSelect}
                      option={option}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto">
            {displayed.map((option) => (
              <OptionRow
                isSelected={isSelected(option.id)}
                key={option.id}
                onSelect={onSelect}
                option={option}
              />
            ))}
          </div>
        ))}
      {canCreate && (
        <div className="border-t">
          {creatable?.renderCreateAffordance?.(trimmedQuery)}
          <button
            className="hover:bg-muted w-full px-3 py-1.5 text-left text-sm"
            onClick={() => {
              void handleCreate();
            }}
            type="button"
          >
            Create &ldquo;{trimmedQuery}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
};
