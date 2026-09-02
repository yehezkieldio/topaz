import * as React from "react";

/**
 * Radix Dialog/AlertDialog `onOpenChange` handlers are almost always "call the close callback
 * when the dialog is dismissed" — this returns a stable handler for that shape.
 */
export function useDialogCloseOnOpenChange(onClose: () => void) {
    return React.useCallback(
        (open: boolean) => {
            if (!open) {
                onClose();
            }
        },
        [onClose]
    );
}
