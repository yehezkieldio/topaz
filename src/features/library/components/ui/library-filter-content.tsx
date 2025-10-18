"use client";

import { ArrowUpDownIcon, ChevronDownIcon, FilterIcon } from "lucide-react";
import * as React from "react";
import { useCallback } from "react";
import { Button } from "#/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useLibraryFilter } from "#/features/library/hooks/use-library-filter";
import { type ProgressSortBy, type ProgressStatus, progressStatusLabels } from "#/server/db/schema";

export type SortOption = {
    value: ProgressSortBy;
    label: string;
};

export const SORT_OPTIONS: SortOption[] = [
    { value: "updatedAt", label: "Date Updated" },
    { value: "title", label: "Title" },
    { value: "author", label: "Author" },
    { value: "status", label: "Reading Status" },
    { value: "rating", label: "Rating" },
    { value: "progress", label: "Progress" },
    { value: "createdAt", label: "Date Added" },
    { value: "wordCount", label: "Word Count" },
    { value: "chapterCount", label: "Chapter Count" },
    { value: "isNsfw", label: "NSFW" },
] as const;

export type StatusOption = {
    value: ProgressStatus | "all";
    label: string;
};

export const STATUS_OPTIONS: StatusOption[] = [
    { value: "all", label: "All" },
    { value: "Reading", label: progressStatusLabels.Reading },
    { value: "NotStarted", label: progressStatusLabels.NotStarted },
    { value: "Paused", label: progressStatusLabels.Paused },
    { value: "Completed", label: progressStatusLabels.Completed },
    { value: "Dropped", label: progressStatusLabels.Dropped },
] as const;

type LibraryFilterContentProps = {
    currentStatusLabel: string;
};

export const LibraryFilterContent = React.memo(function FilterContent({
    currentStatusLabel,
}: LibraryFilterContentProps) {
    const { status, setStatus, sortBy, setSortBy, sortOrder, setSortOrder } = useLibraryFilter();

    const handleSortOrderToggle = useCallback(() => {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    }, [setSortOrder, sortOrder]);

    const handleStatusChange = useCallback(
        (value: string) => {
            setStatus(value as typeof status);
        },
        [setStatus],
    );

    const handleSortChange = useCallback(
        (value: string) => {
            setSortBy(value as ProgressSortBy);
        },
        [setSortBy],
    );

    return (
        <div className="flex flex-col gap-2 px-3 sm:flex-row sm:items-center sm:px-0">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        className="w-full justify-center gap-2 rounded-md text-foreground focus-visible:border-transparent focus-visible:ring-0 sm:w-auto"
                        size="default"
                        variant="outline"
                    >
                        <FilterIcon className="size-4" />
                        {currentStatusLabel}
                        <ChevronDownIcon className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-full max-w-xs rounded-md sm:w-auto sm:max-w-none">
                    <DropdownMenuRadioGroup onValueChange={handleStatusChange} value={status}>
                        {STATUS_OPTIONS.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        className="w-full justify-center gap-2 rounded-md border-border text-foreground focus-visible:border-transparent focus-visible:ring-0 sm:w-auto"
                        size="default"
                        variant="outline"
                    >
                        <ArrowUpDownIcon className="size-4" />
                        {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Sort By"}
                        <ChevronDownIcon className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-full max-w-xs rounded-md sm:w-auto sm:max-w-none">
                    <DropdownMenuRadioGroup onValueChange={handleSortChange} value={sortBy}>
                        {SORT_OPTIONS.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button
                className="group gap-2 rounded-md focus-visible:border-transparent focus-visible:ring-0"
                onClick={handleSortOrderToggle}
                size="default"
                variant="outline"
            >
                <ArrowUpDownIcon className="size-4 text-foreground" />
                <span className="hidden text-foreground sm:inline">{sortOrder === "asc" ? "A-Z" : "Z-A"}</span>
                <span className="text-foreground sm:hidden">
                    {sortOrder === "asc" ? "Ascending (A-Z)" : "Descending (Z-A)"}
                </span>
            </Button>
        </div>
    );
});
