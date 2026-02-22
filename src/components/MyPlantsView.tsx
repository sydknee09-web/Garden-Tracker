"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";

type PermanentPlant = {
  id: string;
  name: string;
  variety_name: string | null;
  primary_image_path: string | null;
  hero_image_url: string | null;
  hero_image_path: string | null;
  status: string | null;
  profile_type: string;
  created_at: string;
  purchase_date: string | null;
  care_count: number;
  journal_count: number;
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  tags?: string[] | null;
  user_id?: string | null;
};

/** Law 7: hero_image_url → hero_image_path → primary_image_path. Memoized outside component. */
function getPlantImageUrl(plant: { hero_image_url?: string | null; hero_image_path?: string | null; primary_image_path?: string | null }): string | null {
  if ((plant.hero_image_url ?? "").trim().startsWith("http")) return plant.hero_image_url!.trim();
  if ((plant.hero_image_path ?? "").trim()) return supabase.storage.from("journal-photos").getPublicUrl(plant.hero_image_path!.trim()).data.publicUrl;
  if ((plant.primary_image_path ?? "").trim()) return supabase.storage.from("seed-packets").getPublicUrl(plant.primary_image_path!.trim()).data.publicUrl;
  return null;
}

function formatPlantedAgo(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const years = Math.floor((now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) {
    const months = Math.floor((now.getTime() - d.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
    if (months < 1) return "Planted this month";
    return `Planted ${months} month${months !== 1 ? "s" : ""} ago`;
  }
  return `Planted ${years} year${years !== 1 ? "s" : ""} ago`;
}

export function MyPlantsView({
  refetchTrigger,
  searchQuery = "",
  categoryFilter = null,
  onCategoryChipsLoaded,
  varietyFilter = null,
  sunFilter = null,
  spacingFilter = null,
  germinationFilter = null,
  maturityFilter = null,
  tagFilters = [],
  onRefineChipsLoaded,
  onFilteredCountChange,
  onEmptyStateChange,
  onAddClick,
  onPermanentPlantAdded,
  gridDisplayStyle = "condensed",
}: {
  refetchTrigger: number;
  searchQuery?: string;
  onPermanentPlantAdded?: () => void;
  categoryFilter?: string | null;
  onCategoryChipsLoaded?: (chips: { type: string; count: number }[]) => void;
  varietyFilter?: string | null;
  sunFilter?: string | null;
  spacingFilter?: string | null;
  germinationFilter?: string | null;
  maturityFilter?: string | null;
  tagFilters?: string[];
  onRefineChipsLoaded?: (chips: {
    variety: { value: string; count: number }[];
    sun: { value: string; count: number }[];
    spacing: { value: string; count: number }[];
    germination: { value: string; count: number }[];
    maturity: { value: string; count: number }[];
    tags: string[];
  }) => void;
  onFilteredCountChange?: (count: number) => void;
  onEmptyStateChange?: (isEmpty: boolean) => void;
  onAddClick?: () => void;
  /** When "condensed", smaller 3-col grid; when "photo", larger 2-col cards. Matches vault dial. */
  gridDisplayStyle?: "photo" | "condensed";
}) {
  const { user } = useAuth();
  const { viewMode: householdViewMode } = useHousehold();
  const [plants, setPlants] = useState<PermanentPlant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlants = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const isFamilyView = householdViewMode === "family";

    let profileQuery = supabase
      .from("plant_profiles")
      .select("id, name, variety_name, primary_image_path, hero_image_url, hero_image_path, status, profile_type, created_at, purchase_date, sun, plant_spacing, days_to_germination, harvest_days, tags, user_id")
      .eq("profile_type", "permanent")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (!isFamilyView) profileQuery = profileQuery.eq("user_id", user.id);
    const { data: profiles } = await profileQuery;

    if (!profiles || profiles.length === 0) {
      setPlants([]);
      setLoading(false);
      return;
    }

    const profileIds = profiles.map((p) => p.id);

    // Count care schedules and journal entries (scoped to owner when not family view)
    let careQuery = supabase.from("care_schedules").select("plant_profile_id").in("plant_profile_id", profileIds).eq("is_active", true);
    let journalQuery = supabase.from("journal_entries").select("plant_profile_id").in("plant_profile_id", profileIds).is("deleted_at", null);
    if (!isFamilyView) {
      careQuery = careQuery.eq("user_id", user.id);
      journalQuery = journalQuery.eq("user_id", user.id);
    }
    const [careRes, journalRes] = await Promise.all([careQuery, journalQuery]);

    const careCounts = new Map<string, number>();
    (careRes.data ?? []).forEach((c: { plant_profile_id: string | null }) => {
      if (c.plant_profile_id) careCounts.set(c.plant_profile_id, (careCounts.get(c.plant_profile_id) ?? 0) + 1);
    });
    const journalCounts = new Map<string, number>();
    (journalRes.data ?? []).forEach((j: { plant_profile_id: string | null }) => {
      if (j.plant_profile_id) journalCounts.set(j.plant_profile_id, (journalCounts.get(j.plant_profile_id) ?? 0) + 1);
    });

    setPlants(profiles.map((p) => ({
      ...p,
      profile_type: p.profile_type ?? "permanent",
      care_count: careCounts.get(p.id) ?? 0,
      journal_count: journalCounts.get(p.id) ?? 0,
    })));
    setLoading(false);
  }, [user?.id, householdViewMode]);

  useEffect(() => { fetchPlants(); }, [fetchPlants, refetchTrigger]);

  const maturityRange = (days: number | null | undefined): string => {
    if (days == null || !Number.isFinite(days)) return "";
    if (days < 60) return "<60";
    if (days <= 90) return "60-90";
    return "90+";
  };

  const categoryChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of plants) {
      const first = (p.name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
      map.set(first, (map.get(first) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type, undefined, { sensitivity: "base" }));
  }, [plants]);

  const refineChips = useMemo(() => {
    const varietyMap = new Map<string, number>();
    const sunMap = new Map<string, number>();
    const spacingMap = new Map<string, number>();
    const germinationMap = new Map<string, number>();
    const maturityMap = new Map<string, number>();
    const tagSet = new Set<string>();
    for (const p of plants) {
      const v = (p.variety_name ?? "").trim() || "—";
      varietyMap.set(v, (varietyMap.get(v) ?? 0) + 1);
      const sun = (p.sun ?? "").trim();
      if (sun) sunMap.set(sun, (sunMap.get(sun) ?? 0) + 1);
      const sp = (p.plant_spacing ?? "").trim();
      if (sp) spacingMap.set(sp, (spacingMap.get(sp) ?? 0) + 1);
      const g = (p.days_to_germination ?? "").trim();
      if (g) germinationMap.set(g, (germinationMap.get(g) ?? 0) + 1);
      const m = maturityRange(p.harvest_days ?? null);
      if (m) maturityMap.set(m, (maturityMap.get(m) ?? 0) + 1);
      (p.tags ?? []).forEach((t) => tagSet.add(t));
    }
    return {
      variety: Array.from(varietyMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      sun: Array.from(sunMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      spacing: Array.from(spacingMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      germination: Array.from(germinationMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      maturity: (["<60", "60-90", "90+"] as const).filter((k) => maturityMap.has(k)).map((value) => ({ value, count: maturityMap.get(value) ?? 0 })),
      tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    };
  }, [plants]);

  const filteredPlants = useMemo(() => {
    return plants.filter((p) => {
      if (categoryFilter) {
        const first = (p.name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
        if (first !== categoryFilter) return false;
      }
      if (varietyFilter != null && varietyFilter !== "") {
        const v = (p.variety_name ?? "").trim();
        if (v !== varietyFilter) return false;
      }
      if (sunFilter != null && sunFilter !== "") {
        const sun = (p.sun ?? "").trim();
        if (sun !== sunFilter) return false;
      }
      if (spacingFilter != null && spacingFilter !== "") {
        const sp = (p.plant_spacing ?? "").trim();
        if (sp !== spacingFilter) return false;
      }
      if (germinationFilter != null && germinationFilter !== "") {
        const g = (p.days_to_germination ?? "").trim();
        if (g !== germinationFilter) return false;
      }
      if (maturityFilter != null && maturityFilter !== "") {
        if (maturityRange(p.harvest_days ?? null) !== maturityFilter) return false;
      }
      if (tagFilters.length > 0) {
        const plantTags = p.tags ?? [];
        if (!tagFilters.some((t) => plantTags.includes(t))) return false;
      }
      return true;
    });
  }, [plants, categoryFilter, varietyFilter, sunFilter, spacingFilter, germinationFilter, maturityFilter, tagFilters]);

  const q = (searchQuery ?? "").trim().toLowerCase();
  const filteredBySearch = useMemo(() => {
    if (!q) return filteredPlants;
    return filteredPlants.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const variety = (p.variety_name ?? "").toLowerCase();
      return name.includes(q) || variety.includes(q);
    });
  }, [filteredPlants, q]);

  useEffect(() => {
    onCategoryChipsLoaded?.(categoryChips);
  }, [categoryChips, onCategoryChipsLoaded]);

  useEffect(() => {
    onRefineChipsLoaded?.(refineChips);
  }, [refineChips, onRefineChipsLoaded]);

  useEffect(() => {
    onFilteredCountChange?.(filteredBySearch.length);
  }, [filteredBySearch.length, onFilteredCountChange]);

  useEffect(() => {
    if (!loading) onEmptyStateChange?.(plants.length === 0);
  }, [loading, plants.length, onEmptyStateChange]);

  if (loading) {
    return (
      <div className={`grid gap-2 ${gridDisplayStyle === "condensed" ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2"}`}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-emerald-100 overflow-hidden animate-pulse">
            <div className={`bg-emerald-50/50 ${gridDisplayStyle === "condensed" ? "aspect-square" : "aspect-[16/10]"}`} />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-neutral-200 rounded w-3/4" />
              <div className="h-3 bg-neutral-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {plants.length === 0 ? (
        <div className="rounded-2xl bg-white border border-black/10 p-8 text-center max-w-md mx-auto" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
          <div className="flex justify-center mb-4" aria-hidden>
            <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="text-emerald-400" aria-hidden>
              <path d="M32 60v-12" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M32 48c-10 0-18-8-18-18s8-18 18-18 18 8 18 18-8 18-18 18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M32 36c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
            </svg>
          </div>
          <p className="text-black/70 font-medium mb-2">No permanent plants yet</p>
          <p className="text-sm text-black/50 mb-6">Add your fruit trees, bushes, and other perennial plants here.</p>
          <button
            type="button"
            onClick={() => onAddClick?.()}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm"
          >
            Add a Perennial
          </button>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <p className="text-sm text-black/50">{filteredBySearch.length} plant{filteredBySearch.length !== 1 ? "s" : ""}</p>
          </div>
          <div className={`grid gap-2 ${gridDisplayStyle === "condensed" ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2"}`}>
            {filteredBySearch.map((plant) => {
              const imgUrl = getPlantImageUrl(plant);
              const isCondensed = gridDisplayStyle === "condensed";
              return (
                <Link key={plant.id} href={`/vault/${plant.id}?from=garden`} className={`group bg-white border border-emerald-100 overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all flex flex-col ${isCondensed ? "rounded-lg" : "rounded-xl"}`} style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <div className={`bg-emerald-50/50 relative overflow-hidden shrink-0 ${isCondensed ? "px-1.5 pt-1.5" : ""}`}>
                    <div className={`relative overflow-hidden ${isCondensed ? "aspect-square rounded-md" : "aspect-[16/10]"}`}>
                      {imgUrl ? (
                        <Image src={imgUrl} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes={gridDisplayStyle === "condensed" ? "120px" : "(max-width: 640px) 50vw, 33vw"} unoptimized />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/50">
                          {isCondensed ? (
                            <span className="text-2xl" aria-hidden>🌱</span>
                          ) : (
                            <svg width="40" height="40" viewBox="0 0 64 64" fill="none" className="text-emerald-300" aria-hidden>
                              <path d="M32 60v-12" stroke="#78716c" strokeWidth="2" strokeLinecap="round" />
                              <path d="M32 48c-10 0-18-8-18-18s8-18 18-18 18 8 18 18-8 18-18 18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </svg>
                          )}
                        </div>
                      )}
                      <span className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 font-medium ${isCondensed ? "text-[9px]" : "text-[10px]"}`} aria-hidden>
                        Perennial
                      </span>
                      {householdViewMode === "family" && plant.user_id && plant.user_id !== user?.id && (
                        <span className="absolute top-1 left-1 text-[8px] font-semibold px-1 py-0.5 rounded-full bg-violet-500 text-white leading-none">
                          FAM
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={isCondensed ? "px-1.5 pt-1 pb-1.5 flex flex-col flex-1 min-h-0" : "p-3"}>
                    <h3 className={`font-semibold text-neutral-900 truncate ${isCondensed ? "text-xs leading-tight" : "text-sm"}`}>{plant.name}</h3>
                    {plant.variety_name && <p className={`text-neutral-500 truncate ${isCondensed ? "text-[10px] italic" : "text-xs"}`}>{plant.variety_name}</p>}
                    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-neutral-500 ${isCondensed ? "text-[10px] line-clamp-2" : "text-xs"}`}>
                      {formatPlantedAgo(plant.purchase_date) && <span>{formatPlantedAgo(plant.purchase_date)}</span>}
                      {plant.care_count > 0 && <span>{plant.care_count} care</span>}
                      {plant.journal_count > 0 && <span>{plant.journal_count} journal</span>}
                      {plant.care_count === 0 && plant.journal_count === 0 && !formatPlantedAgo(plant.purchase_date) && <span>No activity</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
