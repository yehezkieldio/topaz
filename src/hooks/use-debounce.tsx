import * as React from "react";

export function useDebounce<T>(value: T, delay: number, options: { leading?: boolean } = {}): T {
    const [debounced, setDebounced] = React.useState<T>(value);
    const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastCall = React.useRef<number>(0);

    React.useEffect(() => {
        const now = Date.now();
        const isLeading = options.leading && (now - lastCall.current > delay || lastCall.current === 0);

        if (timeout.current) clearTimeout(timeout.current);

        if (isLeading) {
            setDebounced(value);
        } else {
            timeout.current = setTimeout(() => setDebounced(value), delay);
        }

        lastCall.current = now;

        return () => {
            if (timeout.current) {
                clearTimeout(timeout.current);
            }
        };
    }, [value, delay, options.leading]);

    return debounced;
}
