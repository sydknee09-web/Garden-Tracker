import { useEffect, useRef, useState } from "react";

/**
 * Row swipe-to-act engine (touch devices). Canonical reference: Calendar task rows.
 * swipe-left → onSwipeLeft (e.g. mark complete), swipe-right → onSwipeRight (e.g. snooze).
 *
 * Extracted from calendar/page.tsx (2026-06-01) so all task/item-complete surfaces share one
 * swipe engine. Per VISION.md §8 "Complete-task affordance — responsive primitive lock" +
 * Principle 9: phone-portrait is swipe-only; iPad-portrait+/desktop show inline buttons alongside.
 *
 * Direction-locks at 8px (so vertical scroll isn't hijacked), commits at 100px. Returns a ref to
 * attach to the moving row, the live horizontal offset, and whether a swipe is in progress.
 * Listeners are attached via useEffect and cleaned up on unmount / when `enabled` flips.
 */
export function useRowSwipe({
  enabled,
  onSwipeLeft,
  onSwipeRight,
}: {
  enabled: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeDirectionRef = useRef<"horizontal" | "vertical" | null>(null);
  const latestOffsetRef = useRef(0);

  useEffect(() => {
    const node = rowRef.current;
    if (!node || !enabled) return;

    const SWIPE_THRESHOLD = 100;
    const DIRECTION_LOCK_AT = 8;

    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      swipeStartRef.current = { x: t.clientX, y: t.clientY };
      swipeDirectionRef.current = null;
      latestOffsetRef.current = 0;
      setIsSwiping(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const start = swipeStartRef.current;
      const t = e.touches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;

      if (!swipeDirectionRef.current) {
        if (Math.abs(dx) > DIRECTION_LOCK_AT || Math.abs(dy) > DIRECTION_LOCK_AT) {
          swipeDirectionRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        }
      }

      if (swipeDirectionRef.current === "horizontal") {
        e.preventDefault();
        latestOffsetRef.current = dx;
        setSwipeOffsetX(dx);
      }
    };

    const handleTouchEnd = () => {
      const dx = latestOffsetRef.current;
      const direction = swipeDirectionRef.current;

      swipeStartRef.current = null;
      swipeDirectionRef.current = null;
      latestOffsetRef.current = 0;
      setIsSwiping(false);
      setSwipeOffsetX(0);

      if (direction === "horizontal") {
        if (dx <= -SWIPE_THRESHOLD) {
          onSwipeLeft();
        } else if (dx >= SWIPE_THRESHOLD) {
          onSwipeRight();
        }
      }
    };

    node.addEventListener("touchstart", handleTouchStart, { passive: false });
    node.addEventListener("touchmove", handleTouchMove, { passive: false });
    node.addEventListener("touchend", handleTouchEnd);
    node.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchend", handleTouchEnd);
      node.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [enabled, onSwipeLeft, onSwipeRight]);

  return { rowRef, swipeOffsetX, isSwiping };
}
