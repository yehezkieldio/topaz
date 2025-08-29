"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { useLibraryItemContext } from "#/features/library/components/item/library-item-context";

type LibraryItemTagsProps = {
    showAllFandoms?: boolean;
    showAllTags?: boolean;
};

const MAX_FANDOMS_TO_SHOW = 3;
const MAX_TAGS_TO_SHOW = 6;

function _LibraryItemTags({ showAllFandoms = false, showAllTags = false }: LibraryItemTagsProps) {
    const { item } = useLibraryItemContext();
    const [expandedFandoms, setExpandedFandoms] = useState(false);
    const [expandedTags, setExpandedTags] = useState(false);

    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current || typeof IntersectionObserver === "undefined") return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) {
                        setExpandedFandoms(false);
                        setExpandedTags(false);
                    }
                }
            },
            { root: null, threshold: 0 },
        );

        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);

    if (!(item.fandoms?.length || item.tags?.length)) {
        return null;
    }

    const effectiveShowAllFandoms = showAllFandoms || expandedFandoms;
    const effectiveShowAllTags = showAllTags || expandedTags;

    const fandomsToShow = effectiveShowAllFandoms ? item.fandoms : item.fandoms?.slice(0, MAX_FANDOMS_TO_SHOW);
    const tagsToShow = effectiveShowAllTags ? item.tags : item.tags?.slice(0, MAX_TAGS_TO_SHOW);

    return (
        <div className="space-y-2 lg:space-y-3">
            {item.fandoms?.length > 0 && (
                <div className="flex flex-wrap gap-1 lg:gap-2">
                    {fandomsToShow.map((fandom) => (
                        <Badge className="rounded-md text-xs lg:text-xs" key={fandom.publicId} variant="outline">
                            {fandom.name || "Unknown Fandom"}
                        </Badge>
                    ))}
                    {!effectiveShowAllFandoms && item.fandoms.length > MAX_FANDOMS_TO_SHOW && (
                        <Badge
                            aria-expanded={effectiveShowAllFandoms}
                            className="cursor-pointer rounded-md text-muted-foreground text-xs lg:text-xs"
                            onClick={() => setExpandedFandoms((prev) => !prev)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setExpandedFandoms((prev) => !prev);
                                }
                            }}
                            tabIndex={0}
                            title={`Show ${item.fandoms.length - MAX_FANDOMS_TO_SHOW} more`}
                            variant="outline"
                        >
                            +{item.fandoms.length - MAX_FANDOMS_TO_SHOW} more
                        </Badge>
                    )}
                </div>
            )}

            {item.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 lg:gap-1.5">
                    {tagsToShow.map((tag) => (
                        <Badge className="rounded-md text-xs lg:text-xs" key={tag.publicId} variant="secondary">
                            {tag.name || "Unknown Tag"}
                        </Badge>
                    ))}
                    {!effectiveShowAllTags && item.tags.length > MAX_TAGS_TO_SHOW && (
                        <Badge
                            aria-expanded={effectiveShowAllTags}
                            className="cursor-pointer rounded-md text-muted-foreground text-xs lg:text-xs"
                            onClick={() => setExpandedTags((prev) => !prev)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setExpandedTags((prev) => !prev);
                                }
                            }}
                            tabIndex={0}
                            title={`Show ${item.tags.length - MAX_TAGS_TO_SHOW} more`}
                            variant="secondary"
                        >
                            +{item.tags.length - MAX_TAGS_TO_SHOW}
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}

export const LibraryItemTags = memo(_LibraryItemTags);
LibraryItemTags.displayName = "LibraryItemTags";

export type { LibraryItemTagsProps };
