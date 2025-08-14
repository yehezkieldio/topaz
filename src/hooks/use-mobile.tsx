import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    const getQuery = React.useCallback(() => `(max-width: ${MOBILE_BREAKPOINT - 1}px)`, []);

    const [isMobile, setIsMobile] = React.useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia(getQuery()).matches;
    });

    React.useEffect(() => {
        const mql = window.matchMedia(getQuery());
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);

        setIsMobile(mql.matches);

        mql.addEventListener?.("change", onChange);

        return () => {
            mql.removeEventListener?.("change", onChange);
        };
    }, [getQuery]);

    return isMobile;
}
