"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useDeveloperUnlock } from "@/contexts/DeveloperUnlockContext";

type FeedbackRow = {
  id: string;
  user_id: string;
  created_at: string;
  message: string;
  category: string | null;
  page_url: string | null;
  user_email: string | null;
  screenshot_path: string | null;
  voice_path: string | null;
  debug_log_text: string | null;
  metadata: {
    user_agent?: string;
    viewport_w?: number;
    viewport_h?: number;
    app_version?: string;
  } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  question: "Question",
  other: "Other",
};

type CategoryFilter = "all" | "bug" | "feature" | "question" | "other";

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
];

function publicUrl(path: string): string {
  return supabase.storage.from("journal-photos").getPublicUrl(path).data.publicUrl;
}

export default function FeedbackInboxPage() {
  const { user } = useAuth();
  const { isUnlocked } = useDeveloperUnlock();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [voiceOnly, setVoiceOnly] = useState(false);
  const [debugLogOnly, setDebugLogOnly] = useState(false);
  const [expandedDebugLogId, setExpandedDebugLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !isUnlocked) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotAuthorized(false);
    (async () => {
      const { data, error: e } = await supabase.rpc("admin_list_feedback");
      if (cancelled) return;
      if (e) {
        // 42501 = insufficient_privilege; our function raises this for non-devs.
        if (e.code === "42501" || /not authorized/i.test(e.message)) {
          setNotAuthorized(true);
          setRows([]);
        } else {
          setError(e.message);
          setRows([]);
        }
      } else {
        setRows((data ?? []) as FeedbackRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isUnlocked, refreshTick]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (voiceOnly && !r.voice_path) return false;
      if (debugLogOnly && !r.debug_log_text) return false;
      return true;
    });
  }, [rows, categoryFilter, voiceOnly, debugLogOnly]);

  if (!user) {
    return (
      <div className="min-h-screen p-6 text-center">
        <p className="text-neutral-600">Sign in to view the feedback inbox.</p>
        <Link href="/login" className="mt-4 inline-block text-blue-600 underline">
          Go to login
        </Link>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen p-6 text-center">
        <p className="text-neutral-600">Developer tools require unlock.</p>
        <p className="mt-2 text-sm text-neutral-500">Tap the version number 7 times in Settings to unlock.</p>
        <Link href="/settings" className="mt-4 inline-block min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium">
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/settings" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4 min-h-[44px] items-center">
          ← Settings
        </Link>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-2xl font-semibold">Feedback Inbox</h1>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="mb-4 text-sm text-neutral-600">
          All user feedback, newest first. Screenshots and voice memos load on demand.
        </p>

        {notAuthorized ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
            <p className="text-sm text-amber-900 font-medium">Not authorized</p>
            <p className="text-sm text-amber-800 mt-1">
              Your user_id isn&apos;t in the <code className="px-1 py-0.5 bg-white/60 rounded text-xs">developer_users</code> allowlist. To enable this inbox, run this once in Supabase Dashboard → SQL Editor while signed in as yourself:
            </p>
            <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto"><code>INSERT INTO public.developer_users (user_id) VALUES (auth.uid());</code></pre>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-600">Category</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                  className="rounded-xl border border-black/10 px-3 py-2 bg-white text-sm min-h-[44px]"
                  aria-label="Filter by category"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceOnly}
                  onChange={(e) => setVoiceOnly(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-sm text-neutral-700">Voice only</span>
              </label>
              <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={debugLogOnly}
                  onChange={(e) => setDebugLogOnly(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-sm text-neutral-700">Debug log only</span>
              </label>
            </div>

            {error && (
              <p className="mb-4 text-red-600" role="alert">{error}</p>
            )}

            {loading ? (
              <p className="text-neutral-500">Loading…</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-black/60 rounded-xl border border-black/10 bg-white p-6">
                {rows.length === 0 ? "No feedback submitted yet." : "No feedback matches the current filters."}
              </p>
            ) : (
              <ul className="space-y-3">
                {filteredRows.map((row) => (
                  <li key={row.id} className="rounded-xl border border-black/10 bg-white p-4">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <time dateTime={row.created_at} className="text-xs text-black/50">
                        {new Date(row.created_at).toLocaleString()}
                      </time>
                      {row.category && (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald/10 px-2 py-0.5 rounded-full">
                          {CATEGORY_LABELS[row.category] ?? row.category}
                        </span>
                      )}
                    </div>
                    {row.user_email && (
                      <p className="text-xs text-black/60 mb-2">From: {row.user_email}</p>
                    )}
                    <p className="text-sm text-black/90 whitespace-pre-wrap">{row.message}</p>
                    {row.page_url && (
                      <p className="text-xs text-black/50 mt-2 truncate">Page: {row.page_url}</p>
                    )}
                    {row.metadata && (
                      <p className="text-xs text-black/50 mt-1 break-words">
                        Device: {[
                          row.metadata.app_version ? `v${row.metadata.app_version}` : null,
                          row.metadata.viewport_w && row.metadata.viewport_h
                            ? `${row.metadata.viewport_w}×${row.metadata.viewport_h}`
                            : null,
                          row.metadata.user_agent ?? null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {row.screenshot_path && (
                      <div className="mt-3 rounded-lg overflow-hidden border border-black/10 max-w-xs">
                        <img
                          src={publicUrl(row.screenshot_path)}
                          alt="Screenshot attachment"
                          className="w-full h-auto object-contain"
                          loading="lazy"
                        />
                      </div>
                    )}
                    {row.voice_path && (
                      <div className="mt-3">
                        <p className="text-xs text-black/60 mb-1">Voice memo</p>
                        <audio
                          controls
                          preload="none"
                          src={publicUrl(row.voice_path)}
                          className="w-full max-w-md"
                        >
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    )}
                    {row.debug_log_text && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setExpandedDebugLogId((cur) => (cur === row.id ? null : row.id))}
                          className="text-xs text-emerald-700 hover:underline min-h-[32px]"
                        >
                          {expandedDebugLogId === row.id ? "Hide debug log" : "Show debug log"}
                        </button>
                        {expandedDebugLogId === row.id && (
                          <textarea
                            readOnly
                            value={row.debug_log_text}
                            className="mt-2 w-full h-48 rounded-lg border border-black/10 bg-neutral-50 p-2 text-xs font-mono overflow-y-auto"
                            aria-label="Debug log contents"
                          />
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!loading && filteredRows.length > 0 && (
              <p className="mt-4 text-xs text-neutral-500">
                Showing {filteredRows.length} of {rows.length} row{rows.length === 1 ? "" : "s"} (latest 200 fetched, newest first).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
