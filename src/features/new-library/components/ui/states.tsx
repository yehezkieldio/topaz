/**
 * Empty and loading state components.
 */

"use client";

import { BookOpenIcon, LoaderIcon } from "lucide-react";
import { memo } from "react";

/**
 * Empty state when no stories match filters.
 */
export const EmptyState = memo(function EmptyState() {
    return (
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
            <BookOpenIcon className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
                <h3 className="font-semibold text-lg">No stories found</h3>
                <p className="text-muted-foreground text-sm">
                    Try adjusting your search or filters to find more stories.
                </p>
            </div>
        </div>
    );
});

/**
 * Loading spinner for async operations.
 */
export const LoadingSpinner = memo(function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center p-8">
            <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading...</span>
        </div>
    );
});

/**
 * Error state for when something goes wrong.
 */
export const ErrorState = memo(function ErrorState({ message = "Something went wrong" }: { message?: string }) {
    return (
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="space-y-2">
                <h3 className="font-semibold text-destructive text-lg">Error</h3>
                <p className="text-muted-foreground text-sm">{message}</p>
            </div>
        </div>
    );
});
