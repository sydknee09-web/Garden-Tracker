"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type FeedbackRow = {
  id: string;
  created_at: string;
  message: string;
  category: string | null;
  page_url: string | null;
  screenshot_path: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  question: "Question",
  other: "Other",
};

export default function SettingsFeedbackPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("user_feedback")
      .select("id, created_at, message, category, page_url, screenshot_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as FeedbackRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto pb-24">
      <Link href="/settings" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4 min-h-[44px] items-center">
        ← Back to Settings
      </Link>
      <h1 className="text-xl font-bold text-neutral-900 mb-1">Your feedback</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Feedback you’ve submitted. To review all user feedback, use the Supabase dashboard → Table Editor → user_feedback.
      </p>

      {loading ? (
        <p className="text-sm text-black/60">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-black/60 rounded-xl border border-black/10 bg-white p-6">
          No feedback submitted yet. Use the wrench icon in the header to send feedback from any page.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.id} className="rounded-xl border border-black/10 bg-white p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <time dateTime={row.created_at} className="text-xs text-black/50">
                  {new Date(row.created_at).toLocaleString()}
                </time>
                {row.category && (
                  <span className="text-xs font-medium text-emerald-700 bg-emerald/10 px-2 py-0.5 rounded-full">
                    {CATEGORY_LABELS[row.category] ?? row.category}
                  </span>
                )}
              </div>
              <p className="text-sm text-black/90 whitespace-pre-wrap">{row.message}</p>
              {row.screenshot_path && (
                <div className="mt-2 rounded-lg overflow-hidden border border-black/10 max-w-xs">
                  <img
                    src={supabase.storage.from("journal-photos").getPublicUrl(row.screenshot_path).data.publicUrl}
                    alt="Screenshot"
                    className="w-full h-auto object-contain"
                  />
                </div>
              )}
              {row.page_url && (
                <p className="text-xs text-black/50 mt-2 truncate">From: {row.page_url}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
