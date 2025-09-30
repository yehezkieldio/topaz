/**
 * Hook for debouncing values to optimize performance.
 */

"use client";

import { useEffect, useState } from "react";

/**
 * Debounces a value to prevent excessive updates.
 * Useful for search inputs and other high-frequency updates.
 */
export function useDebounce<T>(value: T, delay = 500): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
