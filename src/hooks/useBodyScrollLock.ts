"use client";

import { useEffect } from "react";

/**
 * Lock body scroll while a modal/sheet is open. Prevents background scrolling.
 *
 * Reference-counted so nested modals don't unlock prematurely. The first active
 * caller saves the original `overflow` value and applies `hidden`; the last to
 * deactivate restores the original.
 *
 * Usage:
 *   useBodyScrollLock(open);   // pass the modal's open boolean
 */
let lockCount = 0;
let originalOverflow: string | null = null;

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount++;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0 && originalOverflow !== null) {
        document.body.style.overflow = originalOverflow;
        originalOverflow = null;
      }
    };
  }, [active]);
}
