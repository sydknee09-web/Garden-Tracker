"use client";

/**
 * Swipe-order snapshot — carries a list's *displayed* (filtered + sorted) ordering to a detail
 * page so swipe / prev-next traverses what the user was actually browsing, not a separate query.
 *
 * WHY sessionStorage (the pattern, locked 2026-06-09):
 *   A list component (SeedVaultView, PacketVaultView, …) unmounts when the user navigates to a
 *   detail page, so its in-memory filtered/sorted order is lost. The filter state is multi-criteria
 *   client state — too complex to encode in the URL, and re-deriving it on the detail page would
 *   couple the two surfaces. sessionStorage survives client-side navigation within the tab and is
 *   the lightest mechanism that carries the ordered id list. It is per-tab and cleared on tab close.
 *
 * HOW to adopt on a new surface:
 *   - List surface:   useSwipeOrderSnapshot(scope, displayedOrderedIds)   // keep the snapshot fresh
 *   - Detail surface: const ids = getSwipeOrder(scope, currentId)         // ids, or null → use the
 *                                                                         //   page's own default order
 *
 * TRADE-OFF (accepted 2026-06-09): it is a SNAPSHOT. If the list changes after the user opens a
 * detail page, swipe uses the order captured at entry time. Fine in practice.
 *
 * The `includes(currentId)` guard prevents cross-scope / stale contamination: a snapshot is only
 * used when it actually contains the item being viewed (so a stale or wrong-scope snapshot is
 * ignored and the detail page falls back to its own default ordering).
 */
import { useEffect } from "react";

export type SwipeScope = "profiles" | "packets" | "supplies" | "instances";

const storageKey = (scope: SwipeScope) => `swipeOrder:${scope}`;

export function setSwipeOrder(scope: SwipeScope, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(scope), JSON.stringify(ids));
  } catch {
    /* private mode / quota exceeded — non-fatal; swipe just falls back to default order */
  }
}

export function getSwipeOrder(scope: SwipeScope, currentId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) return null;
    return parsed.includes(currentId) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

/** List-surface helper: keep the snapshot in sync with the currently displayed ordered ids. */
export function useSwipeOrderSnapshot(scope: SwipeScope, displayedIds: string[]): void {
  useEffect(() => {
    setSwipeOrder(scope, displayedIds);
  }, [scope, displayedIds]);
}
