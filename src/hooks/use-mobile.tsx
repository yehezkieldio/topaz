import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    const getQuery = React.useCallback(() => `(max-width: ${MOBILE_BREAKPOINT - 1}px)`, []);

    // Always start with false to match SSR
    const [isMobile, setIsMobile] = React.useState<boolean>(false);
    const [mounted, setMounted] = React.useState<boolean>(false);

    React.useEffect(() => {
        setMounted(true);
        const mql = window.matchMedia(getQuery());
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);

        setIsMobile(mql.matches);

        mql.addEventListener?.("change", onChange);

        return () => {
            mql.removeEventListener?.("change", onChange);
        };
    }, [getQuery]);

    // Return false until mounted to match SSR
    return mounted ? isMobile : false;
}
