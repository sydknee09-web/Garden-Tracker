"use client";

import { useCallback } from "react";
import { useRowSwipe } from "@/hooks/useRowSwipe";

/**
 * Responsive swipe-to-complete row wrapper. Canonical reference: Calendar's task rows.
 *
 * Mobile (phone-portrait): swipe-LEFT reveals an emerald check and fires `onComplete`. When
 * `onSnooze` is provided, swipe-RIGHT reveals an amber clock and fires it (Calendar's bidirectional
 * config). The two Home surfaces (At-a-Glance, Shopping List) use the simplified complete-only
 * config (no `onSnooze`) — their secondary action (remove) stays a persistent visible button, NOT a
 * swipe, because it has no undo (locked 2026-06-01, Q1/Q2 = A). Desktop (`md:`+) completes via the
 * visible `RowCompleteButton` the consumer renders inside `children`.
 *
 * The consumer passes the row's own layout/background classes via `className` (the moving element
 * must be opaque so the reveal only shows as the row slides). Pass `enabled={!isMarking}` to block a
 * double-fire while a complete is already in flight.
 *
 * See VISION.md §8 "Complete-task affordance — responsive primitive lock" + Principle 9.
 */
export function SwipeCompleteRow({
  onComplete,
  onSnooze,
  enabled = true,
  className = "",
  children,
}: {
  onComplete: () => void;
  onSnooze?: () => void;
  enabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const noop = useCallback(() => {}, []);
  const { rowRef, swipeOffsetX, isSwiping } = useRowSwipe({
    enabled,
    onSwipeLeft: onComplete,
    onSwipeRight: onSnooze ?? noop,
  });
  // Complete-only surfaces (no onSnooze) have no right-swipe action — clamp the offset to ≤0 so a
  // right-swipe doesn't slide the row open onto an empty emerald reveal (Sprint 14 #69). Surfaces
  // with a snooze action (Calendar) keep the full bidirectional offset. VISION §8: At-a-Glance /
  // Shopping List are complete-only (swipe-LEFT); snooze is not part of their swipe contract.
  const effectiveOffsetX = onSnooze ? swipeOffsetX : Math.min(0, swipeOffsetX);
  const showSwipeReveal = effectiveOffsetX !== 0;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {showSwipeReveal && (
        <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
          {onSnooze && (
            <div className="flex-1 bg-amber-100 flex items-center justify-start px-5">
              <svg
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-amber-700"
                style={{ opacity: Math.max(0, Math.min(1, effectiveOffsetX / 80)) }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
                <path d="M4 22l2-2M20 22l-2-2M22 4l-2 2M2 4l2 2" />
              </svg>
            </div>
          )}
          <div className="flex-1 bg-emerald-100 flex items-center justify-end px-5">
            <svg
              width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-emerald-700"
              style={{ opacity: Math.max(0, Math.min(1, -effectiveOffsetX / 80)) }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      )}
      <div
        ref={rowRef}
        style={{
          transform: `translateX(${effectiveOffsetX}px)`,
          transition: isSwiping ? "none" : "transform 0.2s ease-out",
        }}
        className={`relative ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
