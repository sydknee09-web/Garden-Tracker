"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])";

/**
 * Trap focus within the container while active and return focus to the trigger on close.
 * Used for modals (role="dialog" aria-modal="true").
 */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const el = containerRef.current;
    if (!el) return;

    const focusables = el.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    first?.focus();
    el.addEventListener("keydown", handleKeyDown);
    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      const prev = previousActiveElement.current;
      if (prev?.focus && typeof prev.focus === "function" && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [active]);

  return containerRef;
}
