"use client";

import { useState, useCallback } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { useAuth } from "@/contexts/AuthContext";
import type { CareScheduleSuggestion } from "@/types/garden";

const CATEGORY_ICONS: Record<string, string> = {
  fertilize: "🌿",
  prune: "✂️",
  spray: "🧴",
  repot: "🪴",
  harvest: "🧺",
  mulch: "🍂",
  other: "📋",
};

function getCategoryIcon(cat: string): string {
  return CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.other;
}

function getRecurrenceLabel(s: CareScheduleSuggestion): string {
  if (s.recurrence_type === "interval" && s.interval_days != null && s.interval_days > 0) {
    return `Every ${s.interval_days} days`;
  }
  if (s.recurrence_type === "monthly") return "Monthly";
  if (s.recurrence_type === "yearly") return "Yearly";
  return "One-time";
}

interface Props {
  profileId: string;
  userId: string;
  profileName: string;
  profileVariety: string | null;
  profileType: "seed" | "permanent";
  suggestions: CareScheduleSuggestion[];
  hasSchedules: boolean;
  onChanged: () => void;
  readOnly?: boolean;
}

export function CareSuggestions({
  profileId,
  userId,
  profileName,
  profileVariety,
  profileType,
  suggestions,
  hasSchedules,
  onChanged,
  readOnly = false,
}: Props) {
  const { session } = useAuth();
  const [actioningId, setActioningId] = useState<string | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  };

  const handleAction = useCallback(
    async (suggestionId: string, action: "approve" | "reject") => {
      if (!userId || readOnly) return;
      setActioningId(suggestionId);
      try {
        const res = await fetch("/api/seed/care-suggestion-action", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ suggestion_id: suggestionId, action }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) return;
        onChanged();
      } finally {
        setActioningId(null);
      }
    },
    [userId, readOnly, onChanged, session?.access_token]
  );

  // Suppress unused warnings for props still needed by parent contract
  void profileId; void profileName; void profileVariety; void profileType; void hasSchedules;

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-sm font-medium text-neutral-500">Suggested care — approve or reject</p>
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="bg-neutral-50/80 rounded-xl border border-amber-100 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0 opacity-80" aria-hidden>
                {getCategoryIcon(s.category ?? "other")}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-neutral-600 text-sm">{s.title}</h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {getRecurrenceLabel(s)}
                </p>
              </div>
              {!readOnly && (
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAction(s.id, "approve")}
                    disabled={actioningId === s.id}
                    className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Approve"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(s.id, "reject")}
                    disabled={actioningId === s.id}
                    className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Reject"
                  >
                    <ICON_MAP.Close stroke="currentColor" className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            {s.notes?.trim() && (
              <div className="mt-3 pt-3 border-t border-amber-100 -mx-4 px-4">
                <p className="text-xs text-neutral-500 break-words">{s.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compact button to trigger AI care suggestions — use next to Add Care Schedule button. */
export function GetAiSuggestionsButton({
  profileId,
  userId,
  profileName,
  profileVariety,
  profileType,
  onChanged,
  readOnly = false,
}: Pick<Props, "profileId" | "userId" | "profileName" | "profileVariety" | "profileType" | "onChanged" | "readOnly">) {
  const { session } = useAuth();
  const [generating, setGenerating] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  };

  const handleClick = useCallback(async () => {
    if (!userId || generating || readOnly) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/seed/recommend-care-tasks", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          plant_profile_id: profileId,
          name: profileName,
          variety: profileVariety ?? "",
          profile_type: profileType,
        }),
      });
      const data = (await res.json()) as { suggestions?: unknown[]; error?: string };
      if (!res.ok) return;
      if (data.error && (!data.suggestions || data.suggestions.length === 0)) return;
      // Await the refresh so suggestions are loaded before clearing loading state
      await Promise.resolve(onChanged());
    } catch {
      // Silent fail for compact button
    } finally {
      setGenerating(false);
    }
  }, [profileId, userId, profileName, profileVariety, profileType, generating, onChanged, readOnly, session?.access_token]);

  if (readOnly) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={generating}
      className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 bg-white font-medium hover:bg-neutral-50 disabled:opacity-50 min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2"
    >
      {generating ? (
        <span className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" aria-hidden />
      ) : (
        "Magic Fill"
      )}
    </button>
  );
}
