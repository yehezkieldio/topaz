"use client";

import { parseAsString, useQueryState } from "nuqs";

const parseAsDebouncedString = parseAsString.withDefault("").withOptions({
    limitUrlUpdates: { method: "debounce", timeMs: 400 },
});

export function useSearchQuery() {
    return useQueryState("q", parseAsDebouncedString);
}
