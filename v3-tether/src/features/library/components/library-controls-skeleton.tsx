import { Skeleton } from "@/components/ui/skeleton";

export const LibraryControlsSkeleton = () => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
    <Skeleton className="h-9 w-full sm:max-w-sm" />
    <Skeleton className="h-9 w-32" />
  </div>
);
