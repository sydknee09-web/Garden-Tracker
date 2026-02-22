"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { QuickAddSupply } from "@/components/QuickAddSupply";
import { parseNpkForDisplay } from "@/lib/supplyProfiles";
import type { SupplyProfile } from "@/types/garden";

const SUPPLY_CATEGORIES = ["fertilizer", "pesticide", "soil_amendment", "other"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  fertilizer: "Fertilizer",
  pesticide: "Pesticide",
  soil_amendment: "Soil Amendment",
  other: "Other",
};

export function ShedView({
  embedded = false,
  refetchTrigger = 0,
  categoryFromUrl = null,
}: {
  /** When true, omit back link and title (used in vault inline). */
  embedded?: boolean;
  refetchTrigger?: number;
  categoryFromUrl?: string | null;
}) {
  const { user } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser } = useHousehold();
  const router = useRouter();
  const [supplies, setSupplies] = useState<(SupplyProfile & { last_used_at?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const isFamilyView = householdViewMode === "family";

  const fetchSupplies = useCallback(async () => {
    if (!user?.id) {
      setSupplies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase
      .from("supply_profiles")
      .select("id, user_id, name, brand, category, usage_instructions, application_rate, primary_image_path, source_url, npk, notes, created_at, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (!isFamilyView) query = query.eq("user_id", user.id);
    const { data, error } = await query;
    if (error) {
      setSupplies([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as (SupplyProfile & { last_used_at?: string | null })[];
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      const { data: lastUsed } = await supabase
        .from("journal_entries")
        .select("supply_profile_id, created_at")
        .in("supply_profile_id", ids)
        .not("supply_profile_id", "is", null)
        .order("created_at", { ascending: false });
      const bySupply = new Map<string, string>();
      for (const r of lastUsed ?? []) {
        const sid = (r as { supply_profile_id: string }).supply_profile_id;
        if (sid && !bySupply.has(sid)) bySupply.set(sid, (r as { created_at: string }).created_at);
      }
      for (const s of rows) {
        s.last_used_at = bySupply.get(s.id) ?? null;
      }
    }
    setSupplies(rows);
    setLoading(false);
  }, [user?.id, isFamilyView]);

  useEffect(() => {
    fetchSupplies();
  }, [fetchSupplies, refetchTrigger]);

  useEffect(() => {
    if (categoryFromUrl && SUPPLY_CATEGORIES.includes(categoryFromUrl as (typeof SUPPLY_CATEGORIES)[number])) {
      setCategoryFilter(categoryFromUrl);
    }
  }, [categoryFromUrl]);

  const filteredSupplies = supplies.filter((s) => {
    const matchCategory = !categoryFilter || s.category === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      (s.name?.toLowerCase().includes(q) ?? false) ||
      (s.brand?.toLowerCase().includes(q) ?? false);
    return matchCategory && matchSearch;
  });

  const handleAddSuccess = useCallback(() => {
    fetchSupplies();
    setQuickAddOpen(false);
  }, [fetchSupplies]);

  const setCategory = useCallback((cat: string | null) => {
    setCategoryFilter(cat);
    if (embedded) {
      router.replace(cat ? `/vault?tab=shed&category=${cat}` : "/vault?tab=shed", { scroll: false });
    } else {
      router.replace(cat ? `/shed?category=${cat}` : "/shed", { scroll: false });
    }
  }, [embedded, router]);

  return (
    <div className="pt-2">
      {!embedded && (
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/vault"
            className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-2"
          >
            ← Vault
          </Link>
        </div>
      )}

      {!embedded && (
        <>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Shed</h1>
          <p className="text-neutral-600 text-sm mb-4">
            Fertilizers, pesticides, and garden supplies. Add products to track usage and instructions.
          </p>
        </>
      )}

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search supplies…"
            className="w-full rounded-xl bg-neutral-100 border-0 pl-10 pr-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-inset min-h-[44px]"
            aria-label="Search supplies"
          />
        </div>
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-emerald text-white font-medium hover:opacity-90 shrink-0"
        >
          Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {SUPPLY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(categoryFilter === cat ? null : cat)}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg border text-sm font-medium ${
              categoryFilter === cat
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : "border-black/10 text-black/70 hover:bg-black/5"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-neutral-500 py-8">Loading…</p>
      ) : filteredSupplies.length === 0 ? (
        <div className="rounded-xl bg-white border border-black/10 p-8 text-center">
          <p className="text-neutral-600 mb-4">
            {supplies.length === 0
              ? "No supplies yet. Add fertilizers, pesticides, or other products to track usage and instructions."
              : "No supplies match your filters."}
          </p>
          {supplies.length === 0 && (
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="min-h-[44px] px-6 rounded-xl bg-emerald text-white font-medium hover:opacity-90"
            >
              Add your first supply
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filteredSupplies.map((s) => {
            const npk = parseNpkForDisplay(s.npk);
            const thumbUrl = s.primary_image_path
              ? supabase.storage.from("journal-photos").getPublicUrl(s.primary_image_path).data.publicUrl
              : null;
            const lastUsed = s.last_used_at
              ? (() => {
                  const d = new Date(s.last_used_at);
                  const now = new Date();
                  const days = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
                  if (days === 0) return "Today";
                  if (days === 1) return "Yesterday";
                  if (days < 7) return `${days} days ago`;
                  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
                  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                })()
              : null;
            const detailHref = embedded
              ? `/shed/${s.id}${categoryFilter ? `?from=vault&category=${categoryFilter}` : "?from=vault"}`
              : `/shed/${s.id}${categoryFilter ? `?from=shed&category=${categoryFilter}` : "?from=shed"}`;
            return (
              <Link
                key={s.id}
                href={detailHref}
                className="group rounded-xl bg-white border border-black/10 overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all min-h-[120px] flex flex-col"
              >
                <div className="aspect-square bg-neutral-100 relative flex items-center justify-center">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl text-neutral-400" aria-hidden>
                      🌱
                    </span>
                  )}
                  {isFamilyView && s.user_id && s.user_id !== user?.id && (
                    <span className="absolute top-1 right-1 rounded px-1.5 py-0.5 text-xs font-medium bg-white/90 text-neutral-700">
                      {getShorthandForUser(s.user_id)}
                    </span>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col min-w-0">
                  <span className="font-medium text-neutral-900 truncate block">{s.name}</span>
                  {s.brand && (
                    <span className="text-xs text-neutral-500 truncate block">{s.brand}</span>
                  )}
                  <span className="text-xs text-neutral-500 mt-1">
                    {CATEGORY_LABELS[s.category] ?? s.category}
                  </span>
                  {npk && (
                    <span className="text-xs text-emerald-700 mt-0.5">
                      N {npk.n}% | P {npk.p}% | K {npk.k}%
                    </span>
                  )}
                  {lastUsed && (
                    <span className="text-xs text-neutral-400 mt-0.5">Last used: {lastUsed}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <QuickAddSupply
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}
