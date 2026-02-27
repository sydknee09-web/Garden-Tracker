"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { QuickAddSupply } from "@/components/QuickAddSupply";
import { OwnerBadge } from "@/components/OwnerBadge";
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
  scrollContainerRef,
  searchQuery: externalSearchQuery,
  categoryFilter: externalCategoryFilter,
  displayStyle: externalDisplayStyle,
  batchSelectMode = false,
  selectedIds = new Set<string>(),
  onToggleSelection,
  onLongPress,
  onFilteredIdsChange,
}: {
  /** When true, omit back link and title (used in vault inline). */
  embedded?: boolean;
  refetchTrigger?: number;
  categoryFromUrl?: string | null;
  /** Optional ref to scroll container for pull-to-refresh (vault page). */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** When embedded, vault provides search/filter. */
  searchQuery?: string;
  categoryFilter?: string | null;
  /** "grid" = icon badges, "list" = detailed rows. When embedded, vault provides this. */
  displayStyle?: "grid" | "list";
  batchSelectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onLongPress?: (id: string) => void;
  onFilteredIdsChange?: (ids: string[]) => void;
}) {
  const { user } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser, canEditPage } = useHousehold();
  const router = useRouter();
  const [supplies, setSupplies] = useState<(SupplyProfile & { last_used_at?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<string | null>(null);
  const [internalDisplayStyle, setInternalDisplayStyle] = useState<"grid" | "list">("list");
  const searchQuery = embedded && externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const categoryFilter = embedded && externalCategoryFilter !== undefined ? externalCategoryFilter : internalCategoryFilter;
  const displayStyle = embedded && externalDisplayStyle !== undefined ? externalDisplayStyle : internalDisplayStyle;

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
    if (!embedded && categoryFromUrl && SUPPLY_CATEGORIES.includes(categoryFromUrl as (typeof SUPPLY_CATEGORIES)[number])) {
      setInternalCategoryFilter(categoryFromUrl);
    }
  }, [embedded, categoryFromUrl]);

  const filteredSupplies = useMemo(() => supplies.filter((s) => {
    const matchCategory = !categoryFilter || s.category === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      (s.name?.toLowerCase().includes(q) ?? false) ||
      (s.brand?.toLowerCase().includes(q) ?? false);
    return matchCategory && matchSearch;
  }), [supplies, categoryFilter, searchQuery]);

  useEffect(() => {
    if (embedded && onFilteredIdsChange) {
      onFilteredIdsChange(filteredSupplies.map((s) => s.id));
    }
  }, [embedded, onFilteredIdsChange, filteredSupplies]);

  const handleAddSuccess = useCallback(() => {
    fetchSupplies();
    setQuickAddOpen(false);
  }, [fetchSupplies]);

  const setCategory = useCallback((cat: string | null) => {
    if (embedded) {
      router.replace(cat ? `/vault?tab=shed&category=${cat}` : "/vault?tab=shed", { scroll: false });
    } else {
      router.replace(cat ? `/shed?category=${cat}` : "/shed", { scroll: false });
    }
    if (!embedded) setInternalCategoryFilter(cat);
  }, [embedded, router]);

  usePullToRefresh({ onRefresh: fetchSupplies, disabled: loading, containerRef: scrollContainerRef });

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

      {!embedded && (
        <>
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
                onChange={(e) => setInternalSearchQuery(e.target.value)}
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
            <button
              type="button"
              onClick={() => setInternalDisplayStyle((s) => (s === "grid" ? "list" : "grid"))}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 bg-white ml-auto hover:bg-black/5"
              title={displayStyle === "grid" ? "List view" : "Grid view"}
              aria-label={displayStyle === "grid" ? "Switch to list view" : "Switch to grid view"}
            >
              {displayStyle === "grid" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              )}
            </button>
          </div>
        </>
      )}

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
      ) : displayStyle === "list" ? (
        <div className="rounded-xl border border-black/10 bg-white overflow-hidden [&_a]:pointer-events-auto">
          <ul className="divide-y divide-black/5" role="list">
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
              const detailHref = `/vault/shed/${s.id}${categoryFilter ? `?category=${categoryFilter}` : ""}`;
              const isSelected = batchSelectMode && selectedIds.has(s.id);
              const rowClassName = `flex items-center gap-3 px-3 py-2 text-left min-h-[44px] hover:bg-gray-50 transition-colors ${
                isSelected ? "bg-emerald-50/80 ring-inset ring-2 ring-emerald-500" : ""
              }`;
              const rowInner = (
                <>
                  <div className="relative shrink-0 w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg" aria-hidden>🌱</span>
                    )}
                    {isSelected && (
                      <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center" aria-hidden>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm text-neutral-900 leading-tight line-clamp-2 break-words">{s.name}</h3>
                    {s.brand && <p className="text-xs text-neutral-500 truncate mt-0.5">{s.brand}</p>}
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-neutral-500 leading-tight">
                      <span className="inline-block px-1 py-0.5 rounded bg-emerald-100/90 text-emerald-800 font-medium shrink-0">
                        {CATEGORY_LABELS[s.category] ?? s.category}
                      </span>
                      {npk && <span className="text-emerald-700 shrink-0">N {npk.n}% P {npk.p}% K {npk.k}%</span>}
                      {lastUsed && <span className="shrink-0">Last: {lastUsed}</span>}
                    </div>
                  </div>
                  {isFamilyView && s.user_id && (
                    <OwnerBadge shorthand={getShorthandForUser(s.user_id)} canEdit={canEditPage(s.user_id, "shed")} size="xs" />
                  )}
                </>
              );
              return (
                <li key={s.id}>
                  {batchSelectMode && onToggleSelection ? (
                    <button type="button" onClick={() => onToggleSelection(s.id)} className={`w-full ${rowClassName}`}>
                      {rowInner}
                    </button>
                  ) : (
                    <a
                      href={detailHref}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = detailHref; }}
                      className={`block cursor-pointer relative z-[1] ${rowClassName}`}
                    >
                      {rowInner}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 [&_a]:pointer-events-auto">
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
            const detailHref = `/vault/shed/${s.id}${categoryFilter ? `?category=${categoryFilter}` : ""}`;
            const isSelected = batchSelectMode && selectedIds.has(s.id);
            const cardClassName = `group rounded-xl bg-white border overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all min-h-[88px] flex flex-col text-left w-full ${isSelected ? "ring-2 ring-emerald-500 border-emerald-500" : "border-black/10"}`;
            const cardInner = (
              <>
                <div className="aspect-square bg-neutral-100 relative flex items-center justify-center min-h-0">
                  {batchSelectMode && (
                    <span className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white" aria-hidden>
                      {isSelected ? (
                        <span className="w-3 h-3 rounded-full bg-emerald-600" />
                      ) : null}
                    </span>
                  )}
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl text-neutral-400" aria-hidden>
                      🌱
                    </span>
                  )}
                  {isFamilyView && s.user_id && (
                    <span className="absolute top-1 right-1">
                      <OwnerBadge shorthand={getShorthandForUser(s.user_id)} canEdit={canEditPage(s.user_id, "shed")} size="xs" />
                    </span>
                  )}
                </div>
                <div className="p-1.5 flex-1 flex flex-col min-w-0">
                  <span className="font-medium text-neutral-900 text-xs leading-tight line-clamp-2 break-words block">{s.name}</span>
                  {s.brand && (
                    <span className="text-[11px] text-neutral-500 truncate block">{s.brand}</span>
                  )}
                  <span className="text-[11px] text-neutral-500 mt-0.5">
                    {CATEGORY_LABELS[s.category] ?? s.category}
                    {npk && ` · N ${npk.n}% P ${npk.p}% K ${npk.k}%`}
                  </span>
                  {lastUsed && (
                    <span className="text-[10px] text-neutral-400 mt-0.5">Last: {lastUsed}</span>
                  )}
                </div>
              </>
            );
            return batchSelectMode && onToggleSelection ? (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggleSelection(s.id)}
                className={cardClassName}
              >
                {cardInner}
              </button>
            ) : (
              <a
                key={s.id}
                href={detailHref}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = detailHref; }}
                className={`cursor-pointer relative z-[1] block ${cardClassName}`}
              >
                {cardInner}
              </a>
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
