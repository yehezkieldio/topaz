"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { memo, useMemo } from "react";
import { Button } from "#/components/ui/button";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "#/components/ui/sheet";
import { Textarea } from "#/components/ui/textarea";
import { LibraryItemProvider } from "#/features/library/components/item/library-item-context";
import { LibraryItemMetadata } from "#/features/library/components/item/library-item-metadata";
import { LibraryItemNotes } from "#/features/library/components/item/library-item-notes";
import { LibraryItemProgress } from "#/features/library/components/item/library-item-progress";
import { LibraryItemTags } from "#/features/library/components/item/library-item-tags";
import { type LibraryItem, useLibraryItemValues } from "#/features/library/hooks/use-library-item";

export type ViewSheetProps = {
    item: LibraryItem;
    isOpen: boolean;
    onClose: () => void;
};

function _LibraryItemViewSheet({ item, isOpen, onClose }: ViewSheetProps) {
    const { hasDescription, hasNotes, hasValidUrl, hasFandomsOrTags, hasReadingProgress } = useLibraryItemValues(item);

    const contextValue = useMemo(
        () => ({
            item,
            onView: undefined,
            onEdit: undefined,
            onDelete: undefined,
        }),
        [item],
    );

    const ItemContent = useMemo(
        () => (
            <LibraryItemProvider value={contextValue}>
                <div className="flex h-full w-full flex-col">
                    <SheetHeader className="flex-none border-b p-6 text-left">
                        <SheetTitle className="text-xl">{item.storyTitle || "Untitled"}</SheetTitle>
                        <SheetDescription className="text-base">
                            by {item.storyAuthor || "Unknown Author"}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto">
                        <div className="space-y-4 p-6">
                            <div className="space-y-3">
                                <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                                    Story Details
                                </h3>
                                <LibraryItemMetadata />
                            </div>

                            {hasReadingProgress && (
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                                        Reading Progress
                                    </h3>
                                    <LibraryItemProgress />
                                </div>
                            )}

                            {hasFandomsOrTags && (
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                                        Categories
                                    </h3>
                                    <LibraryItemTags showAllFandoms showAllTags />
                                </div>
                            )}

                            {hasDescription && (
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                                        Description
                                    </h3>
                                    <Textarea
                                        className="scrollbar-hide resize-none rounded-md border border-none bg-background! p-0 text-xs focus-visible:ring-1 lg:text-sm"
                                        disabled
                                        readOnly
                                        ref={(el) => {
                                            const textarea = el;
                                            if (textarea) {
                                                textarea.style.height = "0px";
                                                const scrollHeight = textarea.scrollHeight;

                                                if (scrollHeight <= 256) {
                                                    textarea.style.height = `${scrollHeight}px`;
                                                    textarea.style.overflow = "hidden";
                                                } else {
                                                    textarea.style.height = "16rem";
                                                    textarea.style.overflow = "auto";
                                                }
                                            }
                                        }}
                                        style={{ maxHeight: "16rem" }}
                                        value={item.storyDescription}
                                    />
                                </div>
                            )}

                            {hasNotes && (
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                                        My Notes
                                    </h3>
                                    <LibraryItemNotes />
                                </div>
                            )}
                        </div>
                    </div>

                    <SheetFooter className="flex-none border-t p-6">
                        {hasValidUrl ? (
                            <Button asChild type="button" variant="outline">
                                <Link href={item.storyUrl ?? ""} rel="noopener noreferrer" target="_blank">
                                    Open Story
                                    <ExternalLinkIcon className="ml-1 h-4 w-4" />
                                </Link>
                            </Button>
                        ) : (
                            <Button className="cursor-not-allowed opacity-60" disabled type="button" variant="outline">
                                No valid URL
                            </Button>
                        )}
                        <SheetClose asChild>
                            <Button onClick={onClose} type="button" variant="outline">
                                Close
                            </Button>
                        </SheetClose>
                    </SheetFooter>
                </div>
            </LibraryItemProvider>
        ),
        [contextValue, item, onClose, hasDescription, hasNotes, hasValidUrl, hasFandomsOrTags, hasReadingProgress],
    );

    return (
        <Sheet onOpenChange={onClose} open={isOpen}>
            <SheetContent className="w-full max-w-full p-0 sm:w-xl" side="right">
                {ItemContent}
            </SheetContent>
        </Sheet>
    );
}

export const LibraryItemViewSheet = memo(_LibraryItemViewSheet);
LibraryItemViewSheet.displayName = "LibraryItemViewSheet";
