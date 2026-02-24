"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function ApiUsagePage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<{
    byProvider: Record<string, { thisMonth: number; lastMonth: number; thisYear: number; tokensThisMonth: number; tokensThisYear: number }>;
    note?: string;
  } | null>(null);

  const loadUsage = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/developer/usage", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { byProvider: Record<string, { thisMonth: number; lastMonth: number; thisYear: number; tokensThisMonth: number; tokensThisYear: number }>; note?: string };
        setUsageData(data);
      } else {
        setUsageData(null);
      }
    } catch {
      setUsageData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto pb-24">
      <Link
        href="/settings/developer"
        className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6 min-h-[44px] items-center"
      >
        &larr; Developer
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">API Usage</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Self-tracked calls to Gemini, OpenAI, and Perenual. For exact billing, check each provider&apos;s dashboard.
      </p>

      {loading ? (
        <p className="text-neutral-400 text-sm">Loading...</p>
      ) : usageData ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {(["gemini", "openai", "perenual"] as const).map((provider) => {
              const p = usageData.byProvider[provider];
              if (!p) return null;
              const label = provider === "gemini" ? "Gemini" : provider === "openai" ? "OpenAI" : "Perenual";
              return (
                <div key={provider} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <p className="text-base font-semibold text-neutral-800 mb-3">{label}</p>
                  <p className="text-sm text-neutral-600">This month: {p.thisMonth} calls</p>
                  <p className="text-sm text-neutral-600">Last month: {p.lastMonth} calls</p>
                  <p className="text-sm text-neutral-600">This year: {p.thisYear} calls</p>
                  {(p.tokensThisMonth > 0 || p.tokensThisYear > 0) && (
                    <p className="text-xs text-neutral-500 mt-2 pt-2 border-t border-neutral-100">
                      Tokens: {p.tokensThisMonth.toLocaleString()} this month, {p.tokensThisYear.toLocaleString()} YTD
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-medium text-neutral-700 mb-2">Provider dashboards</p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-600 hover:underline min-h-[44px] min-w-[44px] inline-flex items-center"
              >
                Gemini / Google AI Studio
              </a>
              <span className="text-neutral-300">|</span>
              <a
                href="https://platform.openai.com/usage"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-600 hover:underline min-h-[44px] min-w-[44px] inline-flex items-center"
              >
                OpenAI usage
              </a>
              <span className="text-neutral-300">|</span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-600 hover:underline min-h-[44px] min-w-[44px] inline-flex items-center"
              >
                Supabase dashboard
              </a>
            </div>
          </div>

          <p className="text-xs text-neutral-400">
            Gemini free tier: ~15 req/min, 1M tokens/day. Supabase: check your project billing.
          </p>
        </div>
      ) : (
        <p className="text-neutral-400 text-sm">Could not load usage.</p>
      )}
    </div>
  );
}
