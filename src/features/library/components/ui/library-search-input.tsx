"use client";

import { SearchIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { useSearchQuery } from "#/features/library/hooks/use-search-query";
import { useDebounce } from "#/hooks/use-debounce";
import { DEBOUNCE_DELAY_MS } from "#/lib/utils";

export function LibrarySearchInput() {
    const [search, setSearch] = useSearchQuery();
    const [draftSearch, setDraftSearch] = React.useState(search);
    const debouncedDraftSearch = useDebounce(draftSearch, DEBOUNCE_DELAY_MS);

    React.useEffect(() => {
        setDraftSearch(search);
    }, [search]);

    React.useEffect(() => {
        if (debouncedDraftSearch === search) return;
        void setSearch(debouncedDraftSearch);
    }, [debouncedDraftSearch, search, setSearch]);

    const handleClearSearch = React.useCallback(() => {
        setDraftSearch("");
        void setSearch("");
    }, [setSearch]);

    const handleInputKeyDown = React.useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Escape") {
                handleClearSearch();
            }
        },
        [handleClearSearch]
    );

    return (
        <div className="relative w-full max-w-sm">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground" />
            <Input
                className="rounded-md pr-9 pl-9 focus-visible:border-accent focus-visible:ring-0"
                onChange={(e) => setDraftSearch(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search the library..."
                value={draftSearch}
            />
            {draftSearch && (
                <Button
                    className="absolute top-1/2 right-1 size-7 -translate-y-1/2 p-0"
                    onClick={handleClearSearch}
                    size="sm"
                    variant="ghost"
                >
                    <XIcon className="size-4" />
                    <span className="sr-only">Clear search</span>
                </Button>
            )}
        </div>
    );
}
