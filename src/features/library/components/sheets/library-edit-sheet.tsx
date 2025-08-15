"use client";

import { Sheet, SheetContent, SheetTrigger } from "#/components/ui/sheet";
import { LibraryEditForm } from "#/features/library/components/forms/library-edit-form";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";

interface LibraryEditSheetProps {
    item: LibraryItem;
    children?: React.ReactNode;
    isOpen: boolean;
    onClose: () => void;
}

export function LibraryEditSheet({ item, children, isOpen, onClose }: LibraryEditSheetProps) {
    return (
        <Sheet onOpenChange={onClose} open={isOpen}>
            {children && <SheetTrigger asChild>{children}</SheetTrigger>}
            <SheetContent className="w-full max-w-full p-0 sm:w-xl" side="right">
                <LibraryEditForm item={item} onClose={onClose} />
            </SheetContent>
        </Sheet>
    );
}
