import { Skeleton } from "#/components/ui/skeleton";

type ListItemSkeletonProps = {
    count?: number;
};

export const ListItemSkeleton = ({ count = 1 }: ListItemSkeletonProps) => (
    <>
        {Array.from({ length: count }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Using index as key for simplicity in skeletons
            <div className="px-4 pb-4" key={i}>
                <Skeleton className="h-64 w-full rounded-md" />
            </div>
        ))}
    </>
);
