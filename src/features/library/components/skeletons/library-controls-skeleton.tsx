import { Skeleton } from "#/components/ui/skeleton";

export function LibraryControlsSkeleton() {
    return (
        <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:justify-between lg:p-4">
            <Skeleton className="h-10 w-full sm:w-64" />
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2">
                <Skeleton className="h-10 w-full lg:w-64" />
            </div>
        </div>
    );
}
