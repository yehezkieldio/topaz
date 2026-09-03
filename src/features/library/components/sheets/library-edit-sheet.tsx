"use client";

import { useCallback, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "#/components/ui/sheet";
import { LibraryEditForm } from "#/features/library/components/forms/library-edit-form";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";
import type { FormCloseGuardHandle } from "#/hooks/use-form-close-guard";

type LibraryEditSheetProps = {
    item: LibraryItem;
    children?: React.ReactNode;
    isOpen: boolean;
    onCloseAction: () => void;
};

export function LibraryEditSheet({ item, children, isOpen, onCloseAction }: LibraryEditSheetProps) {
    const formRef = useRef<FormCloseGuardHandle>(null);

    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                formRef.current?.requestClose();
                return;
            }
            onCloseAction();
        },
        [onCloseAction]
    );

    return (
        <Sheet onOpenChange={handleOpenChange} open={isOpen}>
            {children ? <SheetTrigger asChild>{children}</SheetTrigger> : null}
            <SheetContent className="w-full max-w-full p-0 sm:w-xl" side="right">
                <LibraryEditForm item={item} onCloseAction={onCloseAction} ref={formRef} />
            </SheetContent>
        </Sheet>
    );
}
