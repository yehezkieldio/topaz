"use client";

import { Suspense, memo, useMemo } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { LibraryDataProvider } from "#/features/library/api/use-library-data";
import { LibraryList } from "#/features/library/components/list/library-list";
import { LibraryControlsSkeleton } from "#/features/library/components/skeletons/library-controls-skeleton";
import { ErrorState } from "#/features/library/components/states/error-state";
import { LibraryControls } from "#/features/library/components/ui/library-controls";
import { useLibraryFilter } from "#/features/library/hooks/use-library-filter";
import { useSearchQuery } from "#/features/library/hooks/use-search-query";

export function LibraryClientProvider({ isAdministratorUser }: { isAdministratorUser: boolean }) {
    const [search] = useSearchQuery();
    const { status, sortBy, sortOrder } = useLibraryFilter();

    const providerProps = useMemo(
        () => ({
            search,
            sortBy,
            sortOrder,
            status,
        }),
        [search, sortBy, sortOrder, status],
    );

    return (
        <div className="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_60%),radial-gradient(circle_at_70%_80%,hsl(var(--muted-foreground)/0.08),transparent_55%)]">
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    WebkitMaskImage: "radial-gradient(circle at center, black, transparent)",
                    maskImage: "radial-gradient(circle at center, black, transparent)",
                }}
            >
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-size-[40px_40px] opacity-[0.15]" />
            </div>
            <div className="relative z-10">
                <div className="flex min-h-screen flex-col">
                    <DesktopLibraryControls isAdministratorUser={isAdministratorUser} />

                    <div className="min-h-0 flex-1 grow overflow-hidden p-1 pb-20 sm:p-2 sm:pb-2">
                        <LibraryDataProvider {...providerProps}>
                            <LibraryListSection isAdministratorUser={isAdministratorUser} />
                        </LibraryDataProvider>
                    </div>

                    <MobileLibraryControls isAdministratorUser={isAdministratorUser} />
                </div>
            </div>
        </div>
    );
}

const MemoizedLibraryControls = memo(LibraryControls);
MemoizedLibraryControls.displayName = "MemoizedLibraryControls";

const LibraryListSection = memo(function LibraryListSection({ isAdministratorUser }: { isAdministratorUser: boolean }) {
    return (
        <ErrorBoundary FallbackComponent={LibraryErrorFallback}>
            <div className="h-full">
                <LibraryList isAdministratorUser={isAdministratorUser} />
            </div>
        </ErrorBoundary>
    );
});

LibraryListSection.displayName = "LibraryListSection";

const DesktopLibraryControls = memo(function DesktopLibraryControls({
    isAdministratorUser,
}: {
    isAdministratorUser: boolean;
}) {
    return (
        <div className="hidden sm:block">
            <div className="sticky top-0 z-10 shrink-0 border-border/50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                <div className="p-4">
                    <Suspense fallback={<LibraryControlsSkeleton />}>
                        <MemoizedLibraryControls isAdministratorUser={isAdministratorUser} />
                    </Suspense>
                </div>
            </div>
        </div>
    );
});

DesktopLibraryControls.displayName = "DesktopLibraryControls";

const MobileLibraryControls = memo(function MobileLibraryControls({
    isAdministratorUser,
}: {
    isAdministratorUser: boolean;
}) {
    return (
        <div className="fixed right-0 bottom-0 left-0 z-10 border-border/50 border-t bg-background supports-backdrop-filter:bg-background sm:hidden">
            <div className="p-4">
                <Suspense fallback={<LibraryControlsSkeleton />}>
                    <MemoizedLibraryControls isAdministratorUser={isAdministratorUser} />
                </Suspense>
            </div>
        </div>
    );
});

MobileLibraryControls.displayName = "MobileLibraryControls";

function LibraryErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <ErrorState
            message={
                error instanceof Error
                    ? error.message
                    : "An error occurred while loading the library. Please try again later."
            }
            onRetry={resetErrorBoundary}
            title="Error Loading Library"
        />
    );
}
