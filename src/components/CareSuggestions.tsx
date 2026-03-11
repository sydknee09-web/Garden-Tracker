"use client";

import { useState, useCallback } from "react";
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
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const showGetButton = !hasSchedules && suggestions.length === 0 && !generating && !readOnly;

  const getAuthHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  };

  const handleGetSuggestions = useCallback(async () => {
    if (!userId || generating) return;
    setGenerating(true);
    setGenerateError(null);
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
      if (!res.ok) {
        setGenerateError(data.error ?? "Failed to generate suggestions");
        return;
      }
      if (data.error && (!data.suggestions || data.suggestions.length === 0)) {
        setGenerateError(data.error);
        return;
      }
      onChanged();
    } catch {
      setGenerateError("Something went wrong. Try again.");
    } finally {
      setGenerating(false);
    }
  }, [profileId, userId, profileName, profileVariety, profileType, generating, onChanged, session?.access_token]);

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
        if (!res.ok || !data.ok) {
          return;
        }
        onChanged();
      } finally {
        setActioningId(null);
      }
    },
    [userId, readOnly, onChanged, session?.access_token]
  );

  if (suggestions.length === 0 && !showGetButton && !generating) return null;

  return (
    <div className="space-y-3">
      {generateError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{generateError}</p>
      )}
      {generating && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <p className="text-sm text-amber-800">Generating AI care suggestions…</p>
        </div>
      )}
      {showGetButton && (
        <div className="bg-white rounded-xl border border-dashed border-neutral-200 p-6 text-center">
          <span className="text-3xl mb-2 block" aria-hidden>
            ✨
          </span>
          <p className="text-neutral-600 text-sm mb-2">Get AI care suggestions for this plant</p>
          <p className="text-neutral-500 text-xs mb-4">
            Pruning, fertilizing, mulching, and more — approve or reject each.
          </p>
          <button
            type="button"
            onClick={handleGetSuggestions}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 min-h-[44px] min-w-[44px]"
          >
            Get AI suggestions
          </button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-600">Suggested care — approve or reject</p>
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0" aria-hidden>
                  {getCategoryIcon(s.category ?? "other")}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-neutral-900 text-sm">{s.title}</h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              {s.notes?.trim() && (
                <div className="mt-3 pt-3 border-t border-amber-100 -mx-4 px-4">
                  <p className="text-xs text-neutral-600 break-words">{s.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
      if (!res.ok) {
        return;
      }
      if (data.error && (!data.suggestions || data.suggestions.length === 0)) {
        return;
      }
      onChanged();
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
      className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 bg-white font-medium hover:bg-neutral-50 disabled:opacity-50 min-h-[44px] min-w-[44px]"
    >
      {generating ? "…" : "Magic Fill"}
    </button>
  );
}
