"use client";

import { memo } from "react";
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

    if (!(item.fandoms?.length || item.tags?.length)) {
        return null;
    }

    const fandomsToShow = showAllFandoms ? item.fandoms : item.fandoms?.slice(0, MAX_FANDOMS_TO_SHOW);
    const tagsToShow = showAllTags ? item.tags : item.tags?.slice(0, MAX_TAGS_TO_SHOW);

    return (
        <div className="space-y-2 lg:space-y-3">
            {item.fandoms?.length > 0 && (
                <div className="flex flex-wrap gap-1 lg:gap-2">
                    {fandomsToShow.map((fandom) => (
                        <Badge className="rounded-md text-xs lg:text-xs" key={fandom.publicId} variant="outline">
                            {fandom.name || "Unknown Fandom"}
                        </Badge>
                    ))}
                    {!showAllFandoms && item.fandoms.length > MAX_FANDOMS_TO_SHOW && (
                        <Badge className="rounded-md text-muted-foreground text-xs lg:text-xs" variant="outline">
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
                    {!showAllTags && item.tags.length > MAX_TAGS_TO_SHOW && (
                        <Badge className="rounded-md text-muted-foreground text-xs lg:text-xs" variant="secondary">
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
