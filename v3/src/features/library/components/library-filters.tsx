"use client";

import { ChevronDownIcon, FilterIcon } from "lucide-react";
import { useQueryState } from "nuqs";
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
  libraryStatusParser,
  libraryStatusValues,
} from "@/features/library/search-params";

const ALL_STATUSES = "all";

const formatStatusLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/^./u, (char) => char.toUpperCase());

export const LibraryFilters = () => {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useQueryState(
    "status",
    libraryStatusParser.withOptions({ shallow: false, startTransition })
  );

  const currentLabel = status ? formatStatusLabel(status) : "All";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="text-foreground gap-2 rounded-md focus-visible:border-transparent focus-visible:ring-0 data-[pending]:opacity-60"
          data-pending={isPending ? "" : undefined}
          variant="outline"
        >
          <FilterIcon className="size-4" />
          {currentLabel}
          <ChevronDownIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-md">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            void setStatus(
              value === ALL_STATUSES
                ? null
                : (value as (typeof libraryStatusValues)[number])
            );
          }}
          value={status ?? ALL_STATUSES}
        >
          <DropdownMenuRadioItem value={ALL_STATUSES}>
            All
          </DropdownMenuRadioItem>
          {libraryStatusValues.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {formatStatusLabel(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
