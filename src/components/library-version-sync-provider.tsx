"use client";

import { useEffect } from "react";
import { useLibraryVersionSync } from "#/hooks/use-library-version-sync";

/**
 * Component that initializes library version synchronization.
 * Should be mounted at the app level to ensure version sync works across all pages.
 */
export function LibraryVersionSyncProvider({ children }: { children: React.ReactNode }) {
    // Initialize version sync
    const { currentVersion, isSSEConnected } = useLibraryVersionSync();

    // Register service worker for push notifications
    useEffect(() => {
        if ("serviceWorker" in navigator && "PushManager" in window) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("[sync] Service Worker registered:", registration);
                })
                .catch((error) => {
                    console.warn("[sync] Service Worker registration failed:", error);
                });
        }
    }, []);

    // Log sync status for debugging
    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            console.log("[sync] Version sync status:", {
                currentVersion,
                isSSEConnected,
            });
        }
    }, [currentVersion, isSSEConnected]);

    return <>{children}</>;
}
