"use client";

import { useCallback, useState } from "react";

/**
 * Guards a sheet/dialog's close against discarding unsaved changes.
 * `enabled` follows the conditional-activation pattern (02_stack/06 -- every
 * hook is called unconditionally, the `enabled` flag no-ops internally)
 * rather than being called conditionally at the call site.
 */
export const useCloseGuard = (
  enabled: boolean,
  isDirty: boolean,
  onConfirmedClose: () => void
) => {
  const [pendingClose, setPendingClose] = useState(false);

  const requestClose = useCallback(() => {
    if (enabled && isDirty) {
      setPendingClose(true);
      return;
    }
    onConfirmedClose();
  }, [enabled, isDirty, onConfirmedClose]);

  const confirmClose = useCallback(() => {
    setPendingClose(false);
    onConfirmedClose();
  }, [onConfirmedClose]);

  const cancelClose = useCallback(() => {
    setPendingClose(false);
  }, []);

  return { cancelClose, confirmClose, pendingClose, requestClose };
};
