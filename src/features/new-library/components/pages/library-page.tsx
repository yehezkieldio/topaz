/**
 * Main library page component - entry point for the library feature.
 */

"use client";

import { PlusIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, memo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "#/components/ui/button";
import { useSheetStore } from "../../state/ui-store";
import { LibraryContainer } from "../container/library-container";
import { LibrarySearchInput } from "../ui/search-input";
import { ErrorState, LoadingSpinner } from "../ui/states";

// Dynamic imports for code splitting
const LibraryCreateSheet = dynamic(
    () => import("../sheets/create-sheet").then((mod) => ({ default: mod.LibraryCreateSheet })),
    { ssr: false },
);

const LibraryEditSheet = dynamic(
    () => import("../sheets/edit-sheet").then((mod) => ({ default: mod.LibraryEditSheet })),
    { ssr: false },
);

const LibraryViewSheet = dynamic(
    () => import("../sheets/view-sheet").then((mod) => ({ default: mod.LibraryViewSheet })),
    { ssr: false },
);

const LibraryDeleteDialog = dynamic(
    () => import("../dialogs/delete-dialog").then((mod) => ({ default: mod.LibraryDeleteDialog })),
    { ssr: false },
);

interface LibraryPageProps {
    readonly isAdministratorUser: boolean;
}

/**
 * Main library page with controls, list, and dialogs.
 */
export const LibraryPage = memo(function LibraryPage({ isAdministratorUser }: LibraryPageProps) {
    const openCreateSheet = useSheetStore((state) => state.openCreateSheet);

    return (
        <div className="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_60%),radial-gradient(circle_at_70%_80%,hsl(var(--muted-foreground)/0.08),transparent_55%)]">
            <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent)]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.15]" />
            </div>

            <div className="relative z-10">
                <div className="flex min-h-screen flex-col">
                    {/* Controls Header */}
                    <div className="sticky top-0 z-10 shrink-0 border-border/50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        <div className="p-4">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <LibrarySearchInput />
                                </div>
                                {isAdministratorUser && (
                                    <Button onClick={openCreateSheet} size="default">
                                        <PlusIcon className="mr-2 h-4 w-4" />
                                        Add Story
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="min-h-0 flex-1 flex-grow overflow-hidden p-1 sm:p-2">
                        <ErrorBoundary
                            fallback={
                                <ErrorState message="An error occurred while loading the library. Please try again later." />
                            }
                        >
                            <Suspense fallback={<LoadingSpinner />}>
                                <div className="h-full">
                                    <LibraryContainer isAdministratorUser={isAdministratorUser} />
                                </div>
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </div>
            </div>

            {/* Sheets and Dialogs */}
            <Suspense fallback={null}>
                <LibraryCreateSheet />
                <LibraryEditSheet />
                <LibraryViewSheet />
                <LibraryDeleteDialog />
            </Suspense>
        </div>
    );
});
