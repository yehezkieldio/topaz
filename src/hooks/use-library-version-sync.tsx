import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getLatestCachedVersion, shouldRefreshCache, updateCachedVersion } from "#/lib/cache/version-manager";
import { useTRPC } from "#/trpc/react";

/**
 * Hook for synchronizing library data across devices using version checks.
 * Handles real-time updates via SSE and version comparisons on mount/focus.
 */
export function useLibraryVersionSync() {
    const queryClient = useQueryClient();
    const eventSourceRef = useRef<EventSource | null>(null);
    const trpc = useTRPC();

    // Get current version from server
    const { data: versionData } = useQuery({
        ...trpc.view.getVersion.queryOptions(),
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        staleTime: 0, // Always fetch fresh version data
    });

    const currentServerVersion = versionData?.version;

    // Check for version mismatch and invalidate if needed
    useEffect(() => {
        if (!currentServerVersion) return;

        const checkVersionAndRefresh = async () => {
            try {
                const cachedVersion = await getLatestCachedVersion();

                if (shouldRefreshCache(cachedVersion, currentServerVersion)) {
                    console.log("[sync] Version mismatch detected, invalidating cache", {
                        cached: cachedVersion,
                        server: currentServerVersion,
                    });

                    // Invalidate relevant queries
                    await queryClient.invalidateQueries({
                        queryKey: [["progress"]],
                    });

                    // Update cached version
                    await updateCachedVersion(currentServerVersion);
                }
            } catch (error) {
                console.warn("[sync] Failed to check version sync:", error);
            }
        };

        checkVersionAndRefresh();
    }, [currentServerVersion, queryClient]);

    // Set up SSE connection for real-time updates
    useEffect(() => {
        // Only set up SSE in browser environment
        if (typeof window === "undefined") return;

        const setupSSE = () => {
            try {
                const eventSource = new EventSource("/api/library-version-events");
                eventSourceRef.current = eventSource;

                eventSource.onmessage = async (event) => {
                    try {
                        const data = JSON.parse(event.data) as { version?: number; type?: string };
                        const newVersion = data.version;

                        if (typeof newVersion === "number") {
                            console.log("[sync] Received version update via SSE:", newVersion);

                            const cachedVersion = await getLatestCachedVersion();

                            if (shouldRefreshCache(cachedVersion, newVersion)) {
                                // Invalidate relevant queries
                                await queryClient.invalidateQueries({
                                    queryKey: [["progress"]],
                                });

                                // Update cached version
                                await updateCachedVersion(newVersion);
                            }
                        }
                    } catch (error) {
                        console.warn("[sync] Failed to process SSE message:", error);
                    }
                };

                eventSource.onerror = (error) => {
                    console.warn("[sync] SSE connection error:", error);
                    // EventSource will automatically retry
                };

                eventSource.onopen = () => {
                    console.log("[sync] SSE connection opened");
                };
            } catch (error) {
                console.warn("[sync] Failed to set up SSE:", error);
            }
        };

        setupSSE();

        // Cleanup on unmount
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [queryClient]);

    // Handle page visibility changes (tab focus)
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (!document.hidden && currentServerVersion) {
                // Page became visible, check for version updates
                try {
                    const cachedVersion = await getLatestCachedVersion();

                    if (shouldRefreshCache(cachedVersion, currentServerVersion)) {
                        console.log("[sync] Page focus detected version mismatch, refreshing");

                        await queryClient.invalidateQueries({
                            queryKey: [["progress"]],
                        });

                        await updateCachedVersion(currentServerVersion);
                    }
                } catch (error) {
                    console.warn("[sync] Failed to check version on focus:", error);
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [currentServerVersion, queryClient]);

    return {
        currentVersion: currentServerVersion,
        isSSEConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
    };
}
