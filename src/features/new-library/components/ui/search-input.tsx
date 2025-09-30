/**
 * Search input component for filtering library stories.
 */

"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { memo, useCallback } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { useSearchQuery } from "../../state/use-filter-state";

/**
 * Optimized search input with debouncing.
 */
export const LibrarySearchInput = memo(function LibrarySearchInput() {
    const [search, setSearch] = useSearchQuery();

    const handleClear = useCallback(() => {
        setSearch("");
    }, [setSearch]);

    return (
        <div className="relative w-full">
            <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
            <Input
                className="pr-9 pl-9"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stories..."
                type="search"
                value={search}
            />
            {search && (
                <Button
                    className="-translate-y-1/2 absolute top-1/2 right-1 h-7 w-7 p-0"
                    onClick={handleClear}
                    size="sm"
                    variant="ghost"
                >
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Clear search</span>
                </Button>
            )}
        </div>
    );
});
