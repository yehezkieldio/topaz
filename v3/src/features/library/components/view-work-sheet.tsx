"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RatingBadge } from "@/features/library/components/rating-stars";
import type { WorkDetail } from "@/features/library/server/work-detail-action";
import { getWorkDetailAction } from "@/features/library/server/work-detail-action";

const formatLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/^./u, (char) => char.toUpperCase());

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
    {children}
  </h3>
);

const DetailBody = ({ detail }: { detail: WorkDetail }) => {
  const description = detail.summary || detail.description;

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="flex-none gap-2 border-b p-6 text-left">
        <SheetTitle className="text-xl">{detail.title}</SheetTitle>
        <SheetDescription className="text-base">
          by {detail.authorName ?? "Unknown author"}
        </SheetDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline">{formatLabel(detail.contentRating)}</Badge>
          <Badge variant="outline">
            {formatLabel(detail.publicationStatus)}
          </Badge>
          <Badge variant="outline">{formatLabel(detail.status)}</Badge>
          <RatingBadge rating={detail.rating} />
          {detail.currentChapter !== null && (
            <span className="text-muted-foreground self-center text-xs">
              Chapter {detail.currentChapter}
            </span>
          )}
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-6">
          {description && (
            <div className="space-y-2">
              <SectionHeading>Description</SectionHeading>
              <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-line">
                {description}
              </p>
            </div>
          )}

          {detail.taxonomyTerms.length > 0 && (
            <div className="space-y-2">
              <SectionHeading>Taxonomy</SectionHeading>
              <div className="flex flex-wrap gap-1.5">
                {detail.taxonomyTerms.map((term) => (
                  <Badge key={term.id} variant="secondary">
                    {term.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {detail.sources.length > 0 && (
            <div className="space-y-2">
              <SectionHeading>
                {detail.sources.length > 1 ? "Sources" : "Source"}
              </SectionHeading>
              <div className="space-y-2">
                {detail.sources.map((source) => (
                  <a
                    className="border-border/60 hover:bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
                    href={source.url}
                    key={source.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <span className="min-w-0 truncate">
                      {source.sourcePlatformName}
                      {source.chapterCount !== null &&
                        ` -- ${source.chapterCount} ch.`}
                      {source.wordCount !== null &&
                        ` -- ${source.wordCount.toLocaleString()} words`}
                    </span>
                    <ExternalLinkIcon className="text-muted-foreground size-4 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {detail.sources[0] && (
        <SheetFooter className="flex-none border-t p-6">
          <Button asChild type="button" variant="outline">
            <a
              href={detail.sources[0].url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open {detail.sources.length > 1 ? "primary source" : "source"}
              <ExternalLinkIcon className="ml-1 size-4" />
            </a>
          </Button>
        </SheetFooter>
      )}
    </div>
  );
};

export const ViewWorkSheet = ({
  libraryEntryPublicId,
  onOpenChange,
  open,
}: {
  libraryEntryPublicId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const result = await getWorkDetailAction(libraryEntryPublicId);
        if (!cancelled) {
          if (result) {
            setDetail(result);
          } else {
            setLoadError(true);
          }
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, libraryEntryPublicId]);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="w-full max-w-full overflow-y-auto p-0 sm:max-w-xl"
        side="right"
      >
        {loadError && (
          <p className="text-destructive p-6 text-sm">
            Couldn&apos;t load this work&apos;s details.
          </p>
        )}
        {!loadError &&
          (detail ? (
            <DetailBody detail={detail} />
          ) : (
            <p className="text-muted-foreground p-6 text-sm">Loading...</p>
          ))}
      </SheetContent>
    </Sheet>
  );
};
