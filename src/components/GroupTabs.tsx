"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserGroups } from "@/lib/groups";
import { ManageGroupsModal } from "@/components/ManageGroupsModal";
import { ICON_MAP } from "@/lib/styleDictionary";
import type { Group } from "@/types/garden";

const MANAGE_TOOLTIP_KEY = "gt-groups-manage-tooltip-seen";

/**
 * Sprint 3 Ship B B2 — Garden tab sub-tab row for user-defined Groups.
 *
 * Renders "All" + per-user-group tabs ordered by Group.position (NULLS LAST, then oldest first).
 * Filters happen client-side in GardenView via instance.groups[] membership; this component
 * just owns the selected-group state externally + emits change callbacks.
 *
 * Visual primitive: same JSX shape as Vault sub-tab at VaultPageContent.tsx:994 — emerald-500
 * active state (chrome STATE per VISION §8 emerald token split), neutral-100 pill container.
 */

export type SelectedGroup = "all" | string; // group UUID

export function GroupTabs({
  selectedGroup,
  onSelectGroup,
  refetchTrigger = 0,
}: {
  selectedGroup: SelectedGroup;
  onSelectGroup: (next: SelectedGroup) => void;
  /** Bump to re-fetch groups (e.g. after Manage Groups CRUD in B3). */
  refetchTrigger?: number;
}) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [localRefetchKey, setLocalRefetchKey] = useState(0);
  const [showManageTooltip, setShowManageTooltip] = useState(false);
  // Tabs scaling: pin Manage outside the scroll strip + show a right-edge fade
  // when the tab strip overflows so it's obvious more tabs exist (Walter/Sam
  // discoverability; brief item 1). Recompute on group-count change + resize.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // B4 first-visit hint: reveal a one-time tooltip pointing at the Manage button
  // so Sam-persona discovers group creation without an in-app walkthrough.
  // Read on mount only (useEffect avoids SSR / hydration mismatch).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(MANAGE_TOOLTIP_KEY)) {
      setShowManageTooltip(true);
    }
  }, []);

  const dismissManageTooltip = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(MANAGE_TOOLTIP_KEY, "1");
    }
    setShowManageTooltip(false);
  };

  useEffect(() => {
    if (!user?.id) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    fetchUserGroups(supabase, user.id).then((rows) => {
      if (!cancelled) setGroups(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, refetchTrigger, localRefetchKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [groups]);

  // If currently-selected group disappears (rare: deleted in B3 from another tab),
  // fall back to "all" to avoid a filter that matches nothing.
  useEffect(() => {
    if (selectedGroup === "all") return;
    if (groups.length === 0) return;
    if (!groups.some((g) => g.id === selectedGroup)) {
      onSelectGroup("all");
    }
  }, [groups, selectedGroup, onSelectGroup]);

  return (
    <>
      <div className="flex mb-3 items-center gap-2">
        {/* Scrollable tab strip — flex-1 + min-w-0 so it shrinks to leave room
            for the pinned Manage button instead of pushing it off-screen (the
            old 4+ groups break). */}
        <div className="relative flex-1 min-w-0">
          <div
            ref={scrollRef}
            className="overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="Filter plants by group"
          >
            <div
              className="inline-flex rounded-xl p-1 bg-neutral-100 gap-0.5"
              role="group"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedGroup === "all"}
                onClick={() => onSelectGroup("all")}
                className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedGroup === "all"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-black/60 hover:text-black"
                }`}
              >
                All
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedGroup === g.id}
                  onClick={() => onSelectGroup(g.id)}
                  className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedGroup === g.id
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-black/60 hover:text-black"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          {/* Right-edge fade indicating more tabs scroll off-screen. from-white
              matches the bg-white/95 sticky bar this row lives in. */}
          {overflowing && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
            />
          )}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              dismissManageTooltip();
              setManageOpen(true);
            }}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 whitespace-nowrap inline-flex items-center gap-1.5"
            aria-label="Manage groups"
          >
            <ICON_MAP.Edit stroke="currentColor" className="w-4 h-4" />
            Manage
          </button>
          {showManageTooltip && (
            <div
              role="status"
              className="absolute top-full right-0 mt-2 z-50 bg-neutral-900 text-white text-xs font-medium rounded-lg shadow-lg px-3 py-2 inline-flex items-center gap-2 whitespace-nowrap"
            >
              <span
                aria-hidden
                className="absolute -top-1 right-4 w-2 h-2 bg-neutral-900 rotate-45"
              />
              <span>Tap Manage to create your own groups</span>
              <button
                type="button"
                onClick={dismissManageTooltip}
                aria-label="Dismiss hint"
                className="min-w-[44px] min-h-[44px] -my-2 -mr-2 inline-flex items-center justify-center text-white/80 hover:text-white"
              >
                <ICON_MAP.Close stroke="currentColor" className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
      <ManageGroupsModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onMutated={() => setLocalRefetchKey((k) => k + 1)}
      />
    </>
  );
}
