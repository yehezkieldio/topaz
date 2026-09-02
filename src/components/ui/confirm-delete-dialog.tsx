"use client";

import type * as React from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { useDialogCloseOnOpenChange } from "#/hooks/use-dialog-close-on-open-change";

type ConfirmDeleteDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isPending: boolean;
    title: React.ReactNode;
    description: React.ReactNode;
    confirmLabel: string;
    pendingLabel: string;
};

export function ConfirmDeleteDialog({
    isOpen,
    onClose,
    onConfirm,
    isPending,
    title,
    description,
    confirmLabel,
    pendingLabel,
}: ConfirmDeleteDialogProps) {
    const handleOpenChange = useDialogCloseOnOpenChange(onClose);

    return (
        <AlertDialog onOpenChange={handleOpenChange} open={isOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending} onClick={onClose}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isPending}
                        onClick={onConfirm}
                    >
                        {`${isPending ? pendingLabel : confirmLabel}`}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
