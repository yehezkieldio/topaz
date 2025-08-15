"use client";

import { memo } from "react";
import { useLibraryItemContext } from "#/features/library/components/item/library-item-context";
import { useLibraryItemValues } from "#/features/library/hooks/use-library-item";

function _LibraryItemNotes() {
    const { item } = useLibraryItemContext();
    const { hasNotes } = useLibraryItemValues(item);

    if (!hasNotes) {
        return null;
    }

    return (
        <div className="rounded-none border-primary/30 border-l-2 bg-muted/30 p-3">
            <p className="line-clamp-2 text-muted-foreground text-xs lg:text-sm">{(item.progressNotes ?? "").trim()}</p>
        </div>
    );
}

export const LibraryItemNotes = memo(_LibraryItemNotes);
LibraryItemNotes.displayName = "LibraryItemNotes";
