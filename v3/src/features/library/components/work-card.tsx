import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FavoriteToggle } from "@/features/library/components/favorite-toggle";
import { RatingStars } from "@/features/library/components/rating-stars";
import { StatusSelect } from "@/features/library/components/status-select";
import {
  toggleFavoriteAction,
  updateRatingAction,
  updateStatusAction,
} from "@/features/library/server/actions";
import type { LibraryListRow } from "@/features/library/server/queries";

const formatContentRating = (value: string) =>
  value.replaceAll("_", " ").replace(/^./u, (char) => char.toUpperCase());

export const WorkCard = ({ row }: { row: LibraryListRow }) => (
  <article className="group border-border/60 bg-background hover:bg-muted/35 grid grid-cols-1 items-start gap-3 border-b px-3 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4">
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="text-foreground min-w-0 truncate text-sm leading-5 font-medium">
          {row.title}
        </h3>
        {row.contentRating !== "not_rated" && (
          <Badge
            className="h-5 shrink-0 rounded-sm px-1.5 text-[10px]"
            variant="outline"
          >
            {formatContentRating(row.contentRating)}
          </Badge>
        )}
      </div>
      <SectionErrorBoundary>
        <div className="flex flex-wrap items-center gap-3">
          <StatusSelect
            libraryEntryPublicId={row.libraryEntryPublicId}
            status={row.status}
            updateStatusAction={updateStatusAction}
            version={row.version}
          />
          <RatingStars
            libraryEntryPublicId={row.libraryEntryPublicId}
            rating={row.rating}
            updateRatingAction={updateRatingAction}
            version={row.readingStateVersion ?? 0}
          />
        </div>
      </SectionErrorBoundary>
    </div>

    <div className="flex items-center justify-end gap-1">
      <SectionErrorBoundary>
        <FavoriteToggle
          favorite={row.favorite}
          libraryEntryPublicId={row.libraryEntryPublicId}
          toggleFavoriteAction={toggleFavoriteAction}
          version={row.version}
        />
      </SectionErrorBoundary>
    </div>
  </article>
);

export const WorkCardSkeleton = () => (
  <div className="border-border/60 bg-background grid grid-cols-1 items-center gap-3 border-b px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-4">
    <div className="space-y-2">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
    </div>
    <Skeleton className="h-6 w-6 justify-self-end rounded-sm" />
  </div>
);
