"use client";

import * as React from "react";

export type FormCloseGuardHandle = {
    requestClose: () => void;
};

type UseFormCloseGuardOptions = {
    isDirty: boolean;
    onClose: () => void;
    onDiscard?: () => void | Promise<void>;
};

export function useFormCloseGuard(
    { isDirty, onClose, onDiscard }: UseFormCloseGuardOptions,
    ref: React.Ref<FormCloseGuardHandle> | undefined
) {
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const isDirtyRef = React.useRef(isDirty);
    isDirtyRef.current = isDirty;

    const requestClose = React.useCallback(() => {
        if (isDirtyRef.current) {
            setIsConfirmOpen(true);
            return;
        }
        onClose();
    }, [onClose]);

    React.useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

    const confirmDiscard = React.useCallback(async () => {
        setIsConfirmOpen(false);
        await onDiscard?.();
        onClose();
    }, [onDiscard, onClose]);

    const cancelDiscard = React.useCallback(() => {
        setIsConfirmOpen(false);
    }, []);

    return { cancelDiscard, confirmDiscard, isConfirmOpen };
}
