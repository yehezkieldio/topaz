"use client";

import { FileTextIcon, LinkIcon, PencilIcon } from "lucide-react";
import { memo, useState } from "react";

import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EditWorkSheet } from "@/features/library/components/edit-work-sheet";
import { RatingBadge } from "@/features/library/components/rating-stars";
import { ViewWorkSheet } from "@/features/library/components/view-work-sheet";
import type { LibraryListRow } from "@/features/library/server/queries";

const MAX_VISIBLE_TERMS = 4;

const formatLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/^./u, (char) => char.toUpperCase());

const chapterLabel = (
  currentChapter: number | null,
  latestChapterCount: number | null
) => {
  if (currentChapter !== null && latestChapterCount !== null) {
    return `${currentChapter}/${latestChapterCount} chapters`;
  }
  if (currentChapter !== null) {
    return `Chapter ${currentChapter}`;
  }
  return "No progress";
};

const MetadataPill = ({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) => (
  <div className="border-border/60 text-muted-foreground flex min-w-0 items-center gap-1.5 rounded-sm border px-2 py-1 text-xs">
    {icon}
    <span className="truncate">{label}</span>
  </div>
);

/**
 * Memoized: the virtualizer re-renders LibraryListVirtualized on every
 * scroll frame (its own internal offset state), but that only ever changes
 * the position (translateY) of each row's wrapper div, not any row's own
 * props -- an already-rendered card has no reason to re-render just because
 * a sibling scrolled past it.
 */
const WorkCardComponent = ({
  isAdmin,
  row,
  sourcePlatforms,
}: {
  isAdmin: boolean;
  row: LibraryListRow;
  sourcePlatforms: { id: string; name: string; baseUrl: string | null }[];
}) => {
  const [viewOpen, setViewOpen] = useState(false);
  const visibleTerms = row.taxonomyTerms.slice(0, MAX_VISIBLE_TERMS);
  const remainingTermCount = row.taxonomyTerms.length - visibleTerms.length;
  const progressPercent =
    row.currentChapter !== null && row.latestChapterCount
      ? Math.min(100, (row.currentChapter / row.latestChapterCount) * 100)
      : null;

  return (
    <>
      {/*
        Everything the reader needs to parse lives in this one left column,
        top to bottom -- title, byline, blurb, tags, status/rating, then the
        chapter/source/word-count facts. The eye only ever travels down, not
        side to side; the right edge holds nothing but the admin action.
      */}
      <article className="group border-border/60 bg-background hover:bg-muted/30 relative flex items-start gap-3 border-b px-4 py-3.5 transition-colors">
        <button
          aria-label={`View ${row.title} details`}
          className="absolute inset-0 z-0 cursor-pointer"
          onClick={() => setViewOpen(true)}
          type="button"
        />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="text-foreground min-w-0 truncate text-sm leading-5 font-medium group-hover:underline group-hover:underline-offset-2">
              {row.title}
            </h3>
            {row.contentRating !== "not_rated" && (
              <Badge
                className="h-5 shrink-0 rounded-sm px-1.5 text-[10px]"
                variant="outline"
              >
                {formatLabel(row.contentRating)}
              </Badge>
            )}
          </div>

          {row.authorName && (
            <p className="text-muted-foreground truncate text-xs">
              {row.authorName}
            </p>
          )}

          {(row.summary || row.description) && (
            <p className="text-muted-foreground line-clamp-2 text-xs leading-5">
              {row.summary || row.description}
            </p>
          )}

          {(visibleTerms.length > 0 || remainingTermCount > 0) && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {visibleTerms.map((term) => (
                <Badge
                  className="max-w-32 shrink-0 truncate rounded-sm px-1.5 text-[10px] font-normal"
                  key={term.id}
                  title={term.label}
                  variant="secondary"
                >
                  {term.label}
                </Badge>
              ))}
              {remainingTermCount > 0 && (
                <Badge
                  className="shrink-0 rounded-sm px-1.5 text-[10px] font-normal"
                  variant="secondary"
                >
                  +{remainingTermCount}
                </Badge>
              )}
            </div>
          )}

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Badge
              className="h-5 rounded-sm px-1.5 text-[10px]"
              variant="outline"
            >
              {formatLabel(row.status)}
            </Badge>
            <RatingBadge rating={row.rating} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <MetadataPill
              icon={<FileTextIcon className="size-3" />}
              label={chapterLabel(row.currentChapter, row.latestChapterCount)}
            />
            {row.sourcePlatformName && (
              <MetadataPill
                icon={<LinkIcon className="size-3" />}
                label={row.sourcePlatformName}
              />
            )}
            {row.wordCount !== null && (
              <span className="text-muted-foreground text-xs">
                {row.wordCount.toLocaleString()} words
              </span>
            )}
          </div>

          {progressPercent !== null && (
            <Progress
              aria-label={`Reading progress for ${row.title}`}
              className="[&_[data-slot=progress-indicator]]:bg-foreground bg-muted h-1 max-w-xs"
              value={progressPercent}
            />
          )}
        </div>

        {isAdmin && (
          <div className="relative z-10 shrink-0 self-center">
            <SectionErrorBoundary>
              <EditWorkSheet
                libraryEntryPublicId={row.libraryEntryPublicId}
                sourcePlatforms={sourcePlatforms}
                trigger={
                  <Button
                    aria-label="Edit work"
                    className="size-8 p-0"
                    size="sm"
                    variant="ghost"
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                }
                workPublicId={row.workPublicId}
              />
            </SectionErrorBoundary>
          </div>
        )}
      </article>

      <ViewWorkSheet
        libraryEntryPublicId={row.libraryEntryPublicId}
        onOpenChange={setViewOpen}
        open={viewOpen}
      />
    </>
  );
};

export const WorkCard = memo(WorkCardComponent);

export const WorkCardSkeleton = () => (
  <div className="border-border/60 bg-background flex items-center gap-3 border-b px-4 py-3.5">
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
    </div>
    <Skeleton className="size-8 shrink-0 rounded-md" />
  </div>
);
