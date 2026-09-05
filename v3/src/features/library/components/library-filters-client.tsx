"use client";

import { ChevronDownIcon, FilterIcon } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  librarySearchParsers,
  libraryStatusValues,
} from "@/features/library/search-params";
import {
  contentRatingEnum,
  publicationStatusEnum,
} from "@/server/db/schema/catalog";

const ALL_STATUSES = "all";
const ALL_RATINGS = "all";
const ALL_SOURCES = "all";
const ALL_CONTENT_RATINGS = "all";
const ALL_PUBLICATION_STATUSES = "all";

const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const formatLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/^./u, (char) => char.toUpperCase());

interface FilterOption {
  id: string;
  label: string;
}

const FilterDropdown = ({
  currentLabel,
  onValueChange,
  options,
  value,
}: {
  currentLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        className="text-foreground h-8 gap-1.5 rounded-md text-sm focus-visible:border-transparent focus-visible:ring-0"
        size="sm"
        variant="outline"
      >
        {currentLabel}
        <ChevronDownIcon className="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="rounded-md">
      <DropdownMenuRadioGroup onValueChange={onValueChange} value={value}>
        {options.map((option) => (
          <DropdownMenuRadioItem key={option.value} value={option.value}>
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const LibraryFiltersClient = ({
  sourcePlatforms,
}: {
  sourcePlatforms: FilterOption[];
}) => {
  const [isPending, startTransition] = useTransition();
  const [
    { contentRating, minRating, publicationStatus, source, status },
    setFilters,
  ] = useQueryStates(
    {
      contentRating: librarySearchParsers.contentRating,
      minRating: librarySearchParsers.minRating,
      publicationStatus: librarySearchParsers.publicationStatus,
      source: librarySearchParsers.source,
      status: librarySearchParsers.status,
    },
    { shallow: false, startTransition }
  );

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 data-[pending]:opacity-60"
      data-pending={isPending ? "" : undefined}
    >
      <FilterIcon className="text-muted-foreground mr-0.5 size-4 shrink-0" />

      <FilterDropdown
        currentLabel={status ? formatLabel(status) : "Status: All"}
        onValueChange={(value) => {
          // SAFETY: this dropdown's options are built from
          // libraryStatusValues plus the ALL_STATUSES sentinel (handled
          // below), so any other value is one of those enum values.
          void setFilters({
            status:
              value === ALL_STATUSES
                ? null
                : (value as (typeof libraryStatusValues)[number]),
          });
        }}
        options={[
          { label: "All", value: ALL_STATUSES },
          ...libraryStatusValues.map((value) => ({
            label: formatLabel(value),
            value,
          })),
        ]}
        value={status ?? ALL_STATUSES}
      />

      <FilterDropdown
        currentLabel={minRating ? `Rating: ${minRating}+` : "Rating: Any"}
        onValueChange={(value) => {
          void setFilters({
            minRating: value === ALL_RATINGS ? null : Number(value),
          });
        }}
        options={[
          { label: "Any", value: ALL_RATINGS },
          ...RATING_VALUES.map((value) => ({
            label: `${value}+`,
            value: String(value),
          })),
        ]}
        value={minRating ? String(minRating) : ALL_RATINGS}
      />

      <FilterDropdown
        currentLabel={
          contentRating ? formatLabel(contentRating) : "Content: All"
        }
        onValueChange={(value) => {
          void setFilters({
            // SAFETY: this dropdown's options are built from
            // contentRatingEnum.enumValues plus the ALL_CONTENT_RATINGS
            // sentinel (handled below), so any other value is one of those
            // enum values.
            contentRating:
              value === ALL_CONTENT_RATINGS
                ? null
                : (value as (typeof contentRatingEnum.enumValues)[number]),
          });
        }}
        options={[
          { label: "All", value: ALL_CONTENT_RATINGS },
          ...contentRatingEnum.enumValues.map((value) => ({
            label: formatLabel(value),
            value,
          })),
        ]}
        value={contentRating ?? ALL_CONTENT_RATINGS}
      />

      <FilterDropdown
        currentLabel={
          publicationStatus
            ? formatLabel(publicationStatus)
            : "Publication: All"
        }
        onValueChange={(value) => {
          void setFilters({
            // SAFETY: this dropdown's options are built from
            // publicationStatusEnum.enumValues plus the
            // ALL_PUBLICATION_STATUSES sentinel (handled below), so any
            // other value is one of those enum values.
            publicationStatus:
              value === ALL_PUBLICATION_STATUSES
                ? null
                : (value as (typeof publicationStatusEnum.enumValues)[number]),
          });
        }}
        options={[
          { label: "All", value: ALL_PUBLICATION_STATUSES },
          ...publicationStatusEnum.enumValues.map((value) => ({
            label: formatLabel(value),
            value,
          })),
        ]}
        value={publicationStatus ?? ALL_PUBLICATION_STATUSES}
      />

      {sourcePlatforms.length > 0 && (
        <FilterDropdown
          currentLabel={
            sourcePlatforms.find((platform) => platform.id === source)?.label ??
            "Source: All"
          }
          onValueChange={(value) => {
            void setFilters({ source: value === ALL_SOURCES ? null : value });
          }}
          options={[
            { label: "All", value: ALL_SOURCES },
            ...sourcePlatforms.map((platform) => ({
              label: platform.label,
              value: platform.id,
            })),
          ]}
          value={source ?? ALL_SOURCES}
        />
      )}
    </div>
  );
};
