"use client";

import { useState } from "react";

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

  const requestClose = () => {
    if (enabled && isDirty) {
      setPendingClose(true);
      return;
    }
    onConfirmedClose();
  };

  const confirmClose = () => {
    setPendingClose(false);
    onConfirmedClose();
  };

  const cancelClose = () => {
    setPendingClose(false);
  };

  return { cancelClose, confirmClose, pendingClose, requestClose };
};
