"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Conditional activation, not conditional invocation: this hook is always
 * called, but only attaches its listener while `enabled` is true (e.g. a
 * dropdown is open) -- see 02_stack/06_effects_and_hooks_policy.md.
 */
export const useOutsideClick = (
  enabled: boolean,
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [enabled, ref, onOutside]);
};
