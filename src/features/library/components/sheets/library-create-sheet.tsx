"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "#/components/ui/button";
import { Sheet, SheetContent } from "#/components/ui/sheet";
import { LibraryCreateForm } from "#/features/library/components/forms/library-create-form";
import { useLibraryCreateSheet } from "#/features/library/stores/library-create-sheet-store";

export function LibraryCreateSheet() {
    const { isOpen, setIsOpen } = useLibraryCreateSheet();
    const isHandlingKeyboardRef = useRef(false);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (isHandlingKeyboardRef.current) {
                return;
            }

            const isTargetKey = event.key.toLowerCase() === "t";
            const hasModifiers = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;

            if (!isTargetKey || hasModifiers || isOpen) {
                return;
            }

            const target = event.target as HTMLElement;
            const isInInputField =
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable ||
                target.closest('[contenteditable="true"]') ||
                target.closest("input, textarea");

            if (isInInputField) {
                return;
            }

            isHandlingKeyboardRef.current = true;

            event.preventDefault();
            event.stopImmediatePropagation();

            setIsOpen(true);

            setTimeout(() => {
                isHandlingKeyboardRef.current = false;
            }, 100);
        },
        [isOpen, setIsOpen],
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
        return () => {
            document.removeEventListener("keydown", handleKeyDown, { capture: true });
        };
    }, [handleKeyDown]);

    const handleOpenChange = useCallback(
        (open: boolean) => {
            setIsOpen(open);
        },
        [setIsOpen],
    );

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, [setIsOpen]);

    return (
        <>
            <Button
                className="w-full rounded-md text-foreground hover:text-foreground sm:w-auto"
                onClick={() => setIsOpen(true)}
                variant="outline"
            >
                Create New Library Entry
            </Button>

            <Sheet onOpenChange={handleOpenChange} open={isOpen}>
                <SheetContent className="w-full max-w-full p-0 sm:w-xl" side="right">
                    <LibraryCreateForm onClose={handleClose} />
                </SheetContent>
            </Sheet>
        </>
    );
}
