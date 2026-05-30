"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserGroups } from "@/lib/groups";
import type { Group } from "@/types/garden";

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
  }, [user?.id, refetchTrigger]);

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
    <div
      className="flex mb-3 -mx-6 px-6 overflow-x-auto scrollbar-hide"
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
  );
}
