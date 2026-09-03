"use client";

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

type DiscardChangesDialogProps = {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export function DiscardChangesDialog({ isOpen, onCancel, onConfirm }: DiscardChangesDialogProps) {
    const handleOpenChange = useDialogCloseOnOpenChange(onCancel);

    return (
        <AlertDialog onOpenChange={handleOpenChange} open={isOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes that will be lost if you continue.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>Keep editing</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>Discard</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
