"use client";

import { useQueryState, useQueryStates } from "nuqs";
import { useTransition } from "react";
import { librarySearchParamsParsers } from "#/features/library/search-params";

export function useLibraryQueryState() {
    const [isPending, startTransition] = useTransition();
    const [filters, setFilters] = useQueryStates(librarySearchParamsParsers, {
        startTransition,
    });

    return {
        filters,
        isPending,
        setFilters,
    };
}

export function useSearchQuery() {
    return useQueryState("q", librarySearchParamsParsers.q);
}
