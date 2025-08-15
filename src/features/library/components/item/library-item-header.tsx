"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Badge } from "#/components/ui/badge";
import { useLibraryItemContext } from "#/features/library/components/item/library-item-context";
import { useLibraryItemValues } from "#/features/library/hooks/use-library-item";
import { type ProgressStatus, progressStatusLabels } from "#/server/db/schema";

function _LibraryItemHeader() {
    const { item } = useLibraryItemContext();
    const { hasValidUrl, isNsfw } = useLibraryItemValues(item);
    const progressStatus = item.progressStatus as ProgressStatus;

    return (
        <div className="space-y-2">
            <div className="flex items-start justify-between gap-2 sm:gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1 sm:gap-2">
                        <h2 className="line-clamp-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                            {hasValidUrl ? (
                                <Link
                                    className="font-display transition-colors hover:text-primary"
                                    href={item.storyUrl as string}
                                    prefetch={false}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                >
                                    {item.storyTitle || "Untitled"}
                                </Link>
                            ) : (
                                <span>{item.storyTitle || "Untitled"}</span>
                            )}
                        </h2>
                        {hasValidUrl && (
                            <span className="group/icon relative mt-[2px] hidden items-center sm:flex">
                                <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground/60 transition-colors duration-150 group-hover/icon:text-white sm:size-4" />
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground text-xs lg:text-sm">
                        by <span>{item.storyAuthor || "Unknown Author"}</span>
                    </p>
                </div>

                {isNsfw && (
                    <Badge className="shrink-0 rounded-md text-xs lg:text-sm" variant="destructive">
                        NSFW
                    </Badge>
                )}
                <Badge className="shrink-0 rounded-md text-xs lg:text-sm" variant="secondary">
                    {progressStatusLabels[progressStatus]}
                </Badge>
            </div>
        </div>
    );
}

export const LibraryItemHeader = memo(_LibraryItemHeader);
LibraryItemHeader.displayName = "LibraryItemHeader";
