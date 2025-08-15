"use client";

import { FilterIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "#/components/ui/sheet";
import { Skeleton } from "#/components/ui/skeleton";
import { LibraryFilterContent, STATUS_OPTIONS } from "#/features/library/components/ui/library-filter-content";
import { useLibraryFilter } from "#/features/library/hooks/use-library-filter";
import { useIsMobile } from "#/hooks/use-mobile";

export function LibraryFilterSheet() {
    const isMobile = useIsMobile();
    const { status } = useLibraryFilter();
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    const currentStatusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label || "All";

    if (!isHydrated) {
        return <Skeleton className="w-full px-3 lg:w-2xl" />;
    }

    if (isMobile) {
        return (
            <Sheet>
                <SheetTrigger asChild className="w-full max-w-none">
                    <Button
                        className="relative gap-2 rounded-md text-muted-foreground"
                        size="default"
                        variant="outline"
                    >
                        <FilterIcon className="size-4" />
                        Filters
                    </Button>
                </SheetTrigger>
                <SheetContent className="min-h-[40dvh] sm:min-h-0" side="bottom">
                    <SheetHeader>
                        <SheetTitle>Filters</SheetTitle>
                        <SheetDescription>Adjust the library filters to find what you're looking for.</SheetDescription>
                    </SheetHeader>
                    <div>
                        <LibraryFilterContent currentStatusLabel={currentStatusLabel} />
                    </div>
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <div className="flex flex-col items-center">
            <LibraryFilterContent currentStatusLabel={currentStatusLabel} />
        </div>
    );
}
