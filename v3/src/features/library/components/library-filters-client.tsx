"use client";

import { ChevronDownIcon, FilterIcon } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

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
        className="text-foreground gap-2 rounded-md focus-visible:border-transparent focus-visible:ring-0"
        variant="outline"
      >
        {currentLabel}
        <ChevronDownIcon className="size-4" />
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

const TagFilterDropdown = ({
  onModeChange,
  onToggle,
  options,
  selected,
  taxonomyMode,
}: {
  options: FilterOption[];
  selected: string[];
  taxonomyMode: "direct" | "effective";
  onToggle: (id: string) => void;
  onModeChange: (mode: "direct" | "effective") => void;
}) => {
  const currentLabel =
    selected.length === 0 ? "Tags: All" : `Tags: ${selected.length}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="text-foreground gap-2 rounded-md focus-visible:border-transparent focus-visible:ring-0"
          variant="outline"
        >
          {currentLabel}
          <ChevronDownIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-64 overflow-y-auto rounded-md"
      >
        {options.map((option) => (
          <label
            className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            key={option.id}
          >
            <Checkbox
              checked={selected.includes(option.id)}
              onCheckedChange={() => onToggle(option.id)}
            />
            {option.label}
          </label>
        ))}
        {selected.length > 0 && (
          <div className="mt-1 flex items-center gap-1 border-t px-2 pt-2">
            <Button
              className="h-6 flex-1 text-[11px]"
              onClick={() => onModeChange("effective")}
              size="sm"
              variant={taxonomyMode === "effective" ? "default" : "ghost"}
            >
              Effective
            </Button>
            <Button
              className="h-6 flex-1 text-[11px]"
              onClick={() => onModeChange("direct")}
              size="sm"
              variant={taxonomyMode === "direct" ? "default" : "ghost"}
            >
              Direct only
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const LibraryFiltersClient = ({
  sourcePlatforms,
  taxonomyTerms,
}: {
  sourcePlatforms: FilterOption[];
  taxonomyTerms: FilterOption[];
}) => {
  const [isPending, startTransition] = useTransition();
  const [
    {
      contentRating,
      favorite,
      featured,
      minRating,
      publicationStatus,
      source,
      status,
      tagMode,
      tags,
    },
    setFilters,
  ] = useQueryStates(
    {
      contentRating: librarySearchParsers.contentRating,
      favorite: librarySearchParsers.favorite,
      featured: librarySearchParsers.featured,
      minRating: librarySearchParsers.minRating,
      publicationStatus: librarySearchParsers.publicationStatus,
      source: librarySearchParsers.source,
      status: librarySearchParsers.status,
      tagMode: librarySearchParsers.tagMode,
      tags: librarySearchParsers.tags,
    },
    { shallow: false, startTransition }
  );

  const selectedTags = tags ?? [];

  return (
    <div
      className="flex flex-wrap items-center gap-2 data-[pending]:opacity-60"
      data-pending={isPending ? "" : undefined}
    >
      <FilterIcon className="text-muted-foreground size-4 shrink-0" />

      <FilterDropdown
        currentLabel={status ? formatLabel(status) : "Status: All"}
        onValueChange={(value) => {
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

      {taxonomyTerms.length > 0 && (
        <TagFilterDropdown
          onModeChange={(mode) => {
            void setFilters({ tagMode: mode === "effective" ? null : mode });
          }}
          onToggle={(id) => {
            const next = selectedTags.includes(id)
              ? selectedTags.filter((tagId) => tagId !== id)
              : [...selectedTags, id];
            void setFilters({ tags: next.length > 0 ? next : null });
          }}
          options={taxonomyTerms}
          selected={selectedTags}
          taxonomyMode={tagMode ?? "effective"}
        />
      )}

      <Button
        className="rounded-md"
        onClick={() => {
          void setFilters({ favorite: favorite ? null : true });
        }}
        size="sm"
        variant={favorite ? "default" : "outline"}
      >
        Favorites
      </Button>

      <Button
        className="rounded-md"
        onClick={() => {
          void setFilters({ featured: featured ? null : true });
        }}
        size="sm"
        variant={featured ? "default" : "outline"}
      >
        Featured
      </Button>
    </div>
  );
};
