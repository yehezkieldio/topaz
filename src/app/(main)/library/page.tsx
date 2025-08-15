import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { AuthUserGate } from "#/components/auth-user-gate";
import { LibraryList } from "#/features/library/components/list/library-list";
import { LibraryControlsSkeleton } from "#/features/library/components/skeletons/library-controls-skeleton";
import { ErrorState } from "#/features/library/components/states/error-state";
import { LibraryControls } from "#/features/library/components/ui/library-controls";

export default async function Library() {
    return (
        <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
            <div className="relative z-10">
                <div className="flex min-h-screen flex-col">
                    <div className="hidden sm:block">
                        <Suspense fallback={<LibraryControlsSkeleton />}>
                            <AuthUserGate>
                                {(isAdministratorUser) => (
                                    <div className="sticky top-0 z-10 shrink-0 border-border/50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                                        <div className="p-4">
                                            <LibraryControls isAdministratorUser={isAdministratorUser} />
                                        </div>
                                    </div>
                                )}
                            </AuthUserGate>
                        </Suspense>
                    </div>

                    <div className="min-h-0 flex-1 flex-grow overflow-hidden p-1 pb-20 sm:p-2 sm:pb-2">
                        <ErrorBoundary
                            fallback={
                                <ErrorState
                                    message="An error occurred while loading the library. Please try again later."
                                    title="Error Loading Library"
                                />
                            }
                        >
                            <AuthUserGate>
                                {(isAdministratorUser) => (
                                    <div className="h-full">
                                        <LibraryList isAdministratorUser={isAdministratorUser} />
                                    </div>
                                )}
                            </AuthUserGate>
                        </ErrorBoundary>
                    </div>

                    <div className="fixed right-0 bottom-0 left-0 z-10 border-border/50 border-t bg-background supports-[backdrop-filter]:bg-background sm:hidden">
                        <div className="p-4">
                            <Suspense fallback={<LibraryControlsSkeleton />}>
                                <AuthUserGate>
                                    {(isAdministratorUser) => (
                                        <LibraryControls isAdministratorUser={isAdministratorUser} />
                                    )}
                                </AuthUserGate>
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
