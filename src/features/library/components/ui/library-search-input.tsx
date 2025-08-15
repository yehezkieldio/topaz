"use client";

import { SearchIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { useSearchQuery } from "#/features/library/hooks/use-search-query";

export function LibrarySearchInput() {
    const [search, setSearch] = useSearchQuery();

    const handleClearSearch = React.useCallback(() => {
        setSearch("");
    }, [setSearch]);

    const handleInputKeyDown = React.useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Escape") {
                handleClearSearch();
            }
        },
        [handleClearSearch],
    );

    return (
        <div className="relative w-full max-w-sm">
            <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-foreground" />
            <Input
                className="rounded-md pr-9 pl-9 font-serif focus-visible:border-accent focus-visible:ring-0"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search the library..."
                value={search}
            />
            {search && (
                <Button
                    className="-translate-y-1/2 absolute top-1/2 right-1 size-7 p-0"
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
