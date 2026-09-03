import { LibraryControlsSkeleton } from "#/features/library/components/skeletons/library-controls-skeleton";
import { ListItemSkeleton } from "#/features/library/components/skeletons/library-list-skeleton";

/**
 * Mirrors the structure of LibraryClientProvider (controls + list) so the
 * prerendered shell matches the streamed-in content at every breakpoint.
 */
export function LibraryPageSkeleton() {
    return (
        <div className="flex min-h-screen flex-col">
            <div className="hidden sm:block">
                <div className="sticky top-0 z-10 shrink-0 border-border/50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                    <div className="p-4">
                        <LibraryControlsSkeleton />
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1 grow overflow-hidden p-1 pb-20 sm:p-2 sm:pb-2">
                <ListItemSkeleton count={6} />
            </div>

            <div className="fixed right-0 bottom-0 left-0 z-10 border-border/50 border-t bg-background supports-backdrop-filter:bg-background sm:hidden">
                <div className="p-4">
                    <LibraryControlsSkeleton />
                </div>
            </div>
        </div>
    );
}
