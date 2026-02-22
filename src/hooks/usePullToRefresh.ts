"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hapticSuccess } from "@/lib/haptics";

const PULL_THRESHOLD_PX = 80;

/**
 * Pull-to-refresh for list views. Attach to a scroll container.
 * When user is at top and pulls down past threshold, triggers onRefresh.
 */
export function usePullToRefresh(options: {
  onRefresh: () => Promise<void> | void;
  /** Scroll container ref. If not provided, uses document.documentElement. */
  containerRef?: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
}) {
  const { onRefresh, containerRef, disabled } = options;
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const currentPullY = useRef(0);

  const getScrollContainer = useCallback((): HTMLElement | null => {
    if (containerRef?.current) return containerRef.current;
    return typeof document !== "undefined" ? document.documentElement : null;
  }, [containerRef]);

  const isAtTop = useCallback(() => {
    if (containerRef?.current) {
      return containerRef.current.scrollTop <= 2;
    }
    return typeof window !== "undefined" && window.scrollY <= 2;
  }, [containerRef]);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      const el = getScrollContainer();
      if (!el) return;
      const scrollTop = el.scrollTop;
      startY.current = e.touches[0].clientY;
      startScrollTop.current = scrollTop;
      currentPullY.current = 0;
      setPullY(0);
    },
    [disabled, isRefreshing, getScrollContainer]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      if (!isAtTop()) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        setPullY(Math.min(delta, PULL_THRESHOLD_PX * 1.5));
      }
    },
    [disabled, isRefreshing, isAtTop]
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;
    if (pullY >= PULL_THRESHOLD_PX && isAtTop()) {
      hapticSuccess();
      setIsRefreshing(true);
      setPullY(0);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullY(0);
    }
  }, [disabled, isRefreshing, isAtTop, onRefresh]);

  useEffect(() => {
    const target = getScrollContainer();
    if (!target) return;
    target.addEventListener("touchstart", handleTouchStart, { passive: true });
    target.addEventListener("touchmove", handleTouchMove, { passive: true });
    target.addEventListener("touchend", handleTouchEnd, { passive: false });
    return () => {
      target.removeEventListener("touchstart", handleTouchStart);
      target.removeEventListener("touchmove", handleTouchMove);
      target.removeEventListener("touchend", handleTouchEnd);
    };
  }, [getScrollContainer, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pullY, isRefreshing };
}
