"use client";

import { useEffect } from "react";

/**
 * Lock body scroll while a modal/sheet is open. Prevents background scrolling
 * on desktop AND mobile (iOS Safari requires position: fixed, not just
 * overflow: hidden, to reliably lock scroll).
 *
 * Reference-counted so nested modals don't unlock prematurely. The first active
 * caller saves the original body styles + scroll position and applies the lock;
 * the last to deactivate restores both.
 *
 * Usage:
 *   useBodyScrollLock(open);   // pass the modal's open boolean
 */
let lockCount = 0;
let savedState: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
  scrollY: number;
} | null = null;

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    if (lockCount === 0) {
      const scrollY = window.scrollY;
      savedState = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        overflow: document.body.style.overflow,
        scrollY,
      };
      // iOS-safe lock: pin body in place at the current scroll offset.
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    }
    lockCount++;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0 && savedState !== null) {
        const { position, top, left, right, width, overflow, scrollY } = savedState;
        document.body.style.position = position;
        document.body.style.top = top;
        document.body.style.left = left;
        document.body.style.right = right;
        document.body.style.width = width;
        document.body.style.overflow = overflow;
        window.scrollTo(0, scrollY);
        savedState = null;
      }
    };
  }, [active]);
}
