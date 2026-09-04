"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useDeferredValue, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MIN_SEARCH_LENGTH = 2;

export const LibrarySearch = () => {
  const [isPending, startTransition] = useTransition();
  const [urlQuery, setUrlQuery] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: false, startTransition })
  );
  const [filterText, setFilterText] = useState(urlQuery);
  const deferredFilterText = useDeferredValue(filterText);
  const isStale = filterText !== deferredFilterText;

  useEffect(() => {
    const trimmed = deferredFilterText.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_SEARCH_LENGTH) {
      return;
    }
    if (deferredFilterText !== urlQuery) {
      void setUrlQuery(deferredFilterText || null);
    }
  }, [deferredFilterText, setUrlQuery, urlQuery]);

  const handleClear = () => {
    setFilterText("");
    void setUrlQuery(null);
  };

  return (
    <div className="relative w-full max-w-sm">
      <SearchIcon className="text-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        aria-label="Search library"
        className="focus-visible:border-accent rounded-md pr-9 pl-9 focus-visible:ring-0 data-[pending]:opacity-60"
        data-pending={isPending || isStale ? "" : undefined}
        onChange={(event) => setFilterText(event.target.value)}
        placeholder="Search the library..."
        type="search"
        value={filterText}
      />
      {filterText ? (
        <Button
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2 p-0"
          onClick={handleClear}
          size="sm"
          variant="ghost"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Clear search</span>
        </Button>
      ) : null}
    </div>
  );
};
