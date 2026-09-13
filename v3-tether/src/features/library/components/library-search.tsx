"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { debounce, parseAsString, useQueryState } from "nuqs";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

export const LibrarySearch = () => {
  const [isPending, startTransition] = useTransition();
  const [urlQuery, setUrlQuery] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: false, startTransition })
  );
  const [filterText, setFilterText] = useState(urlQuery);

  const handleChange = (value: string) => {
    setFilterText(value);
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_SEARCH_LENGTH) {
      return;
    }
    void setUrlQuery(value || null, {
      limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS),
    });
  };

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
        data-pending={isPending ? "" : undefined}
        onChange={(event) => handleChange(event.target.value)}
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
