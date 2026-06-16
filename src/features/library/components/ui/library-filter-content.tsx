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
import {
    type LibraryEntryStatus,
    type LibrarySortBy,
    libraryEntryStatusLabels,
    type Source,
    sourceLabels,
} from "#/server/db/schema";

export type SortOption = {
    value: LibrarySortBy;
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
    value: LibraryEntryStatus | "all";
    label: string;
};

export const STATUS_OPTIONS: StatusOption[] = [
    { value: "all", label: "All" },
    { value: "Reading", label: libraryEntryStatusLabels.Reading },
    { value: "NotStarted", label: libraryEntryStatusLabels.NotStarted },
    { value: "Paused", label: libraryEntryStatusLabels.Paused },
    { value: "Completed", label: libraryEntryStatusLabels.Completed },
    { value: "Dropped", label: libraryEntryStatusLabels.Dropped },
] as const;

const SOURCE_OPTIONS: { value: Source | "all"; label: string }[] = [
    { value: "all", label: "All Sources" },
    { value: "ArchiveOfOurOwn", label: sourceLabels.ArchiveOfOurOwn },
    { value: "FanFictionNet", label: sourceLabels.FanFictionNet },
    { value: "Wattpad", label: sourceLabels.Wattpad },
    { value: "SpaceBattles", label: sourceLabels.SpaceBattles },
    { value: "SufficientVelocity", label: sourceLabels.SufficientVelocity },
    { value: "QuestionableQuesting", label: sourceLabels.QuestionableQuesting },
    { value: "RoyalRoad", label: sourceLabels.RoyalRoad },
    { value: "WebNovel", label: sourceLabels.WebNovel },
    { value: "ScribbleHub", label: sourceLabels.ScribbleHub },
    { value: "NovelBin", label: sourceLabels.NovelBin },
    { value: "Other", label: sourceLabels.Other },
] as const;

const TRI_STATE_OPTIONS = [
    { value: "all", label: "All" },
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
] as const;

type LibraryFilterContentProps = {
    currentStatusLabel: string;
};

function getOptionValue<TValue extends string>(options: ReadonlyArray<{ value: TValue }>, value: string) {
    return options.find((option) => option.value === value)?.value;
}

export const LibraryFilterContent = React.memo(function FilterContent({
    currentStatusLabel,
}: LibraryFilterContentProps) {
    const {
        favorite,
        hasNotes,
        isNsfw,
        setFavorite,
        setHasNotes,
        setIsNsfw,
        setSource,
        source,
        status,
        setStatus,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
    } = useLibraryFilter();

    const handleSortOrderToggle = useCallback(() => {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    }, [setSortOrder, sortOrder]);

    const handleStatusChange = useCallback(
        (value: string) => {
            const nextStatus = getOptionValue(STATUS_OPTIONS, value);

            if (nextStatus) {
                setStatus(nextStatus);
            }
        },
        [setStatus]
    );

    const handleSortChange = useCallback(
        (value: string) => {
            const nextSortBy = getOptionValue(SORT_OPTIONS, value);

            if (nextSortBy) {
                setSortBy(nextSortBy);
            }
        },
        [setSortBy]
    );

    const handleSourceChange = useCallback(
        (value: string) => {
            const nextSource = getOptionValue(SOURCE_OPTIONS, value);

            if (nextSource) {
                setSource(nextSource);
            }
        },
        [setSource]
    );

    const handleFavoriteChange = useCallback(
        (value: string) => {
            const nextFavorite = getOptionValue(TRI_STATE_OPTIONS, value);

            if (nextFavorite) {
                setFavorite(nextFavorite);
            }
        },
        [setFavorite]
    );

    const handleNsfwChange = useCallback(
        (value: string) => {
            const nextIsNsfw = getOptionValue(TRI_STATE_OPTIONS, value);

            if (nextIsNsfw) {
                setIsNsfw(nextIsNsfw);
            }
        },
        [setIsNsfw]
    );

    const handleNotesChange = useCallback(
        (value: string) => {
            const nextHasNotes = getOptionValue(TRI_STATE_OPTIONS, value);

            if (nextHasNotes) {
                setHasNotes(nextHasNotes);
            }
        },
        [setHasNotes]
    );

    return (
        <div className="flex flex-col gap-2 px-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-0">
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
                        {SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? "All Sources"}
                        <ChevronDownIcon className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-full max-w-xs rounded-md sm:w-auto sm:max-w-none">
                    <DropdownMenuRadioGroup onValueChange={handleSourceChange} value={source}>
                        {SOURCE_OPTIONS.map((option) => (
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
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className="w-full justify-center rounded-md sm:w-auto" size="default" variant="outline">
                        Favorite: {TRI_STATE_OPTIONS.find((option) => option.value === favorite)?.label ?? "All"}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-md">
                    <DropdownMenuRadioGroup onValueChange={handleFavoriteChange} value={favorite}>
                        {TRI_STATE_OPTIONS.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className="w-full justify-center rounded-md sm:w-auto" size="default" variant="outline">
                        NSFW: {TRI_STATE_OPTIONS.find((option) => option.value === isNsfw)?.label ?? "All"}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-md">
                    <DropdownMenuRadioGroup onValueChange={handleNsfwChange} value={isNsfw}>
                        {TRI_STATE_OPTIONS.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className="w-full justify-center rounded-md sm:w-auto" size="default" variant="outline">
                        Notes: {TRI_STATE_OPTIONS.find((option) => option.value === hasNotes)?.label ?? "All"}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-md">
                    <DropdownMenuRadioGroup onValueChange={handleNotesChange} value={hasNotes}>
                        {TRI_STATE_OPTIONS.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
});
