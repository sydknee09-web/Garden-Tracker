"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useOnboardingContextOptional } from "@/contexts/OnboardingContext";
import { useAnnouncer } from "@/contexts/AnnouncerContext";
import { useVaultOptional } from "@/contexts/VaultContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { OwnerBadge } from "@/components/OwnerBadge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getEffectiveCare } from "@/lib/plantCareHierarchy";
import { useSwipeOrderSnapshot } from "@/lib/swipeOrder";
import { decodeHtmlEntities, formatVarietyForDisplay } from "@/lib/htmlEntities";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { EmptyStateVault, EmptyStateSprout } from "@/components/EmptyStateIllustrations";

/**
 * Sow-month check for a profile: prefers the structured optimal_planting_months_array
 * (AI Fill overhaul Ship 2) and falls back to the planting_window text parse.
 */
function isProfilePlantableInMonth(
  s: { optimal_planting_months_array?: number[] | null; planting_window?: string | null },
  monthIndex: number
): boolean {
  const months = s.optimal_planting_months_array;
  if (Array.isArray(months) && months.length > 0) return months.includes(monthIndex + 1);
  return isPlantableInMonthSimple(s.planting_window, monthIndex);
}

/** Minimal sow-month check without loading zone10b_schedule (avoids init error in chunk). */
function isPlantableInMonthSimple(plantingWindow: string | null | undefined, monthIndex: number): boolean {
  const w = plantingWindow?.trim();
  if (!w) return true;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const abbrev = months[monthIndex];
  if (!abbrev) return false;
  if (new RegExp(abbrev, "i").test(w)) return true;
  const rangeMatch = w.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*[-–—]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (rangeMatch) {
    const start = months.indexOf(rangeMatch[1]!.toLowerCase());
    const end = months.indexOf(rangeMatch[2]!.toLowerCase());
    if (start >= 0 && end >= 0) return monthIndex >= Math.min(start, end) && monthIndex <= Math.max(start, end);
  }
  return false;
}
import { StarRating } from "@/components/StarRating";
import { PlantImage } from "@/components/PlantImage";
import { GridSkeleton } from "@/components/VaultSkeleton";
import { NoMatchCard } from "@/components/NoMatchCard";
import type { PlantProfileDisplay, Volume, VaultSortBy } from "@/types/vault";
import { isSeedTypeTag } from "@/constants/seedTypes";
import { buildPlantCategoryChips } from "@/constants/plantCategories";

/** Unified vault card item sourced from plant_profiles. */
export type VaultCardItem = {
  id: string;
  name: string;
  variety: string;
  packet_count: number;
  status?: string | null;
  harvest_days?: number | null;
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  tags?: string[] | null;
  primary_image_path?: string | null;
  /** Hero (plant) photo in journal-photos bucket; used for vault thumbnail when set. */
  hero_image_path?: string | null;
  /** External URL for hero (e.g. from link import); used when hero_image_path is not set. */
  hero_image_url?: string | null;
  /** True while background find-hero-photo is running for this profile. */
  hero_image_pending?: boolean | null;
  volume?: Volume;
  source_url?: string | null;
  created_at?: string | null;
  /** True if any packet under this profile has F1 (or similar) in packet tags. */
  hasF1Packet?: boolean;
  /** Comma-separated vendor names from packets (for list column). */
  vendor_display?: string | null;
  /** Average seed quantity % across packets (0–100), for inventory dot; null when no packets. */
  avg_qty_pct?: number | null;
  /** Max seed quantity % across all packets (0–100); used for inventory dot so one full packet = green. */
  max_qty_pct?: number | null;
  /** Planting window (e.g. "Spring: Feb-May"); used for Plant Now / Sowing Month filters. */
  planting_window?: string | null;
  /** Sowing method (e.g. "Direct Sow", "Start Indoors / Transplant"); for display badge. */
  sowing_method?: string | null;
  /** Structured planting seasons (Spring | Summer | Fall | Winter); Season refine filter. */
  planting_seasons_tags?: string[] | null;
  /** Structured months 1-12; preferred over planting_window text for Plant Now / Sowing Month. */
  optimal_planting_months_array?: number[] | null;
  /** Weeks before last frost to start indoors; non-null = "Indoors" method. */
  indoor_start_weeks_before_frost?: number | null;
  /** Weeks after last frost to plant outside; non-null = "Outdoors" method. */
  outdoor_plant_weeks_after_frost?: number | null;
  /** Latest purchase_date among packets for this profile (YYYY-MM-DD); for sort by purchase date. */
  latest_purchase_date?: string | null;
  /** user_id of the owner; populated in family-view to show ownership badge. */
  owner_user_id?: string | null;
  /** Best (max) packet_rating 1–5 across packets for this profile; null if none rated. */
  best_rating?: number | null;
  /** Canonical plant_profiles.plant_category (Vegetable | Fruit | Herb | Flower | Ornamental | Houseplant). Primary-chip filter dim (Sprint 11.5). */
  plant_category?: string | null;
  /** True if the profile has ≥1 archived (status≠growing) grow_instance — "Previously grown" inventory toggle (Phase 2b). */
  ever_grown?: boolean;
};

/** Placeholder hero URL (generic icon). Don't use for grid — prefer packet image or empty state. */
function isPlaceholderHeroUrl(url: string | null | undefined): boolean {
  if (!url || !String(url).trim()) return false;
  const u = String(url).trim().toLowerCase();
  return (
    u === "/seedling-icon.svg" ||
    u.endsWith("/seedling-icon.svg") ||
    u === "/plant-placeholder.png" ||
    u.endsWith("/plant-placeholder.png")
  );
}

/** Thumbnail URL: real hero first, then packet image. Skip placeholder icon so we show packet or empty state. */
function getThumbnailUrl(seed: VaultCardItem): string | null {
  if (seed.hero_image_path?.trim()) {
    return supabase.storage.from("journal-photos").getPublicUrl(seed.hero_image_path.trim()).data.publicUrl;
  }
  const heroUrl = seed.hero_image_url?.trim();
  if (heroUrl && !isPlaceholderHeroUrl(heroUrl)) {
    return heroUrl;
  }
  if (seed.primary_image_path?.trim()) {
    return supabase.storage.from("seed-packets").getPublicUrl(seed.primary_image_path.trim()).data.publicUrl;
  }
  return null;
}

const HERO_PENDING_TIMEOUT_MS = 30000;
export type GridSortBy = "name" | "dateAdded";
/** Re-export for consumers that import from SeedVaultView. */
export type { VaultSortBy };

const VOLUME_LABELS: Record<string, string> = {
  full: "Full",
  partial: "Partial",
  low: "Low",
  empty: "Empty",
};

const VOLUME_COLORS: Record<string, string> = {
  full: "bg-emerald/20 text-emerald",
  partial: "bg-emerald/10 text-emerald",
  low: "bg-citrus/20 text-amber-700",
  empty: "bg-black/5 text-black/50",
};

/** Card border: green only when active_plantings_count > 0 (status is "active" only when profile has active grow_instances). */
function getCardBorderClass(seed: VaultCardItem): string {
  if (seed.status === "active") return "border-emerald-500/60 border-2";
  if (seed.packet_count === 0 || seed.status === "out_of_stock") return "border-neutral-200 border";
  return "border-slate-200/80 border";
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export type TagFilter = string[];

function SortArrowIcon({ dir }: { dir: "asc" | "desc" | "off" }) {
  return (
    <span className="inline-flex flex-col ml-0.5 text-neutral-400" aria-hidden>
      {dir === "asc" ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5z"/></svg>
      ) : dir === "desc" ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
      ) : (
        <span className="inline-flex flex-col -space-y-0.5 text-neutral-300">
          <svg width="8" height="6" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5z"/></svg>
          <svg width="8" height="6" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
        </span>
      )}
    </span>
  );
}


export function SeedVaultView({
  refetchTrigger = 0,
  searchQuery = "",
  tagFilters = [],
  onOpenScanner,
  onAddFirst,
  onTagsLoaded,
  batchSelectMode = false,
  selectedVarietyIds,
  onToggleVarietySelection,
  onLongPressVariety,
  onFilteredIdsChange,
  onPendingHeroCountChange,
  availablePlantTypes = [],
  onPlantTypeChange,
  plantMonthFilter = null,
  plantNameFilters = [],
  invGrowing = false,
  invHasPackets = false,
  invPrevGrown = false,
  invPrevOwned = false,
  gridDisplayStyle = "photo" as const,
  plantCategoryFilter = null,
  onPlantCategoryChipsLoaded,
  onPlantNameOptionsLoaded,
  varietyFilter = null,
  vendorFilter = null,
  methodFilter = null,
  sunFilter = null,
  spacingFilter = null,
  germinationFilter = null,
  maturityFilter = null,
  packetCountFilter = null,
  onRefineChipsLoaded,
  hideArchivedProfiles = false,
  onEmptyStateChange,
  sortBy: sortByProp = null,
  sortDirection: sortDirectionProp = "asc",
  scrollContainerRef,
  onClearFilters,
}: {
  refetchTrigger?: number;
  /** Optional ref to scroll container for pull-to-refresh (vault page). */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  searchQuery?: string;
  /** Tags that characterize the plant (F1, Heirloom, Heat Lover, etc.) — excludes seed types. */
  tagFilters?: TagFilter;
  onOpenScanner?: () => void;
  /** When vault is empty, optional callback for "Add your first packet" CTA. */
  onAddFirst?: () => void;
  onTagsLoaded?: (tags: string[]) => void;
  batchSelectMode?: boolean;
  selectedVarietyIds?: Set<string>;
  onToggleVarietySelection?: (plantVarietyId: string) => void;
  /** When user long-presses a card/row (e.g. ~500ms), enter select mode and select this variety. */
  onLongPressVariety?: (plantVarietyId: string) => void;
  onFilteredIdsChange?: (ids: string[]) => void;
  onPendingHeroCountChange?: (count: number) => void;
  /** Called when vault empty state changes (no seeds at all). Parent can hide toolbar. */
  onEmptyStateChange?: (isEmpty: boolean) => void;
  /** Options for the Plant Type dropdown in list view (e.g. from plant_profiles + "Imported seed", "Bean", "Cucumber"). */
  availablePlantTypes?: string[];
  /** Called when user changes plant type in list view; parent should update plant_profiles.name and refetch. */
  onPlantTypeChange?: (profileId: string, newName: string) => void;
  /** Plant-in-month filter (1–12). null = inactive (Phase 2b). */
  plantMonthFilter?: number | null;
  /** Plant-name multi-select (Phase 2b). Empty = inactive; OR semantics. */
  plantNameFilters?: string[];
  /** Inventory toggles (Phase 2b). OR within the inventory dimension. */
  invGrowing?: boolean;
  invHasPackets?: boolean;
  invPrevGrown?: boolean;
  invPrevOwned?: boolean;
  /** "photo" = 2-col gallery cards, "list" = condensed rows (matches peer surfaces). */
  gridDisplayStyle?: "photo" | "list";
  /** Primary-tier canonical plant_category filter (Sprint 11.5); single-select, null = all. */
  plantCategoryFilter?: string | null;
  /** Called when plant_category chips (count-gated, canonical order) are computed, for the primary chip row. */
  onPlantCategoryChipsLoaded?: (chips: { value: string; count: number }[]) => void;
  /** Called when distinct plant names are computed, for the Plant Name multi-select. */
  onPlantNameOptionsLoaded?: (names: string[]) => void;
  /** Refine-by filters (variety, vendor, sun, spacing, germination, maturity range, packet count range). */
  varietyFilter?: string | null;
  vendorFilter?: string | null;
  /** Planting method refine ("indoors" | "outdoors"), from the frost-offset structured fields. */
  methodFilter?: string | null;
  sunFilter?: string | null;
  spacingFilter?: string | null;
  germinationFilter?: string | null;
  maturityFilter?: string | null;
  packetCountFilter?: string | null;
  /** Called when refine chips (counts per dimension) are computed, for Refine By panel. */
  onRefineChipsLoaded?: (chips: {
    variety: { value: string; count: number }[];
    vendor: { value: string; count: number }[];
    sun: { value: string; count: number }[];
    spacing: { value: string; count: number }[];
    germination: { value: string; count: number }[];
    maturity: { value: string; count: number }[];
    packetCount: { value: string; count: number }[];
    method: { value: string; count: number }[];
  }) => void;
  /** When true, exclude plant profiles with no packets (archived) from list/table. */
  hideArchivedProfiles?: boolean;
  /** Sort from Refine By (vault page). When set, overrides internal grid/list sort. */
  sortBy?: VaultSortBy | null;
  sortDirection?: "asc" | "desc";
  /** Called when user taps "Clear filters" in no-match state. */
  onClearFilters?: () => void;
}) {
  const vault = useVaultOptional();
  const effectiveRefetchTrigger = vault?.refetchTrigger ?? refetchTrigger;
  const effectiveScrollContainerRef = vault?.scrollContainerRef ?? scrollContainerRef;
  const router = useRouter();
  const { user } = useAuth();
  const { viewMode: householdViewMode, householdMembers, getShorthandForUser, canEditPage } = useHousehold();
  const onboardingCtx = useOnboardingContextOptional();
  const isNewUser = onboardingCtx && !onboardingCtx.completed;
  const [seeds, setSeeds] = useState<VaultCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pullRefetch, setPullRefetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pendingSinceRef = useRef<Map<string, number>>(new Map());
  const [tick, setTick] = useState(0);
  const [plantTypeFilter, setPlantTypeFilter] = useState<string | null>(null);
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string | null>(null);
  const [plantFilterOpen, setPlantFilterOpen] = useState(false);
  const [plantFilterSearch, setPlantFilterSearch] = useState("");
  const plantFilterRef = useRef<HTMLDivElement>(null);
  const [gridSortBy, setGridSortBy] = useState<GridSortBy>("name");
  const [imageErrorIds, setImageErrorIds] = useState<Set<string>>(new Set());
  const [imageLoadedIds, setImageLoadedIds] = useState<Set<string>>(new Set());
  const isOnline = useOnlineStatus();
  const { announce } = useAnnouncer();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const LONG_PRESS_MS = 500;
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const getLongPressHandlers = useCallback(
    (seedId: string) => {
      return {
        onTouchStart: () => {
          longPressFiredRef.current = false;
          clearLongPressTimer();
          longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            longPressFiredRef.current = true;
            onLongPressVariety?.(seedId);
          }, LONG_PRESS_MS);
        },
        onTouchMove: clearLongPressTimer,
        onTouchEnd: clearLongPressTimer,
        onTouchCancel: clearLongPressTimer,
        handleClick: (e?: React.MouseEvent) => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            e?.preventDefault();
            return;
          }
          goToProfile(seedId);
        },
      };
    },
    [onLongPressVariety, clearLongPressTimer]
  );

  const markThumbError = useCallback((seedId: string) => {
    setImageErrorIds((prev) => (prev.has(seedId) ? prev : new Set(prev).add(seedId)));
  }, []);

  const markThumbLoaded = useCallback((seedId: string) => {
    setImageLoadedIds((prev) => (prev.has(seedId) ? prev : new Set(prev).add(seedId)));
  }, []);

  const q = searchQuery.trim().toLowerCase();

  function goToProfile(profileId: string) {
    router.push(`/library/${profileId}`);
  }

  const maturityRange = (days: number | null | undefined): string => {
    if (days == null || !Number.isFinite(days)) return "";
    if (days < 60) return "<60";
    if (days <= 90) return "60-90";
    return "90+";
  };
  const packetCountRange = (n: number): string => {
    if (n === 0) return "0";
    if (n === 1) return "1";
    return "2+";
  };

  const filteredSeeds = useMemo(() => {
    const anyInv = !!(invGrowing || invHasPackets || invPrevGrown || invPrevOwned);
    return seeds.filter((s) => {
      if (hideArchivedProfiles && !anyInv && (s.packet_count ?? 0) <= 0) return false;
      if (anyInv) {
        const st = (s.status ?? "").toLowerCase();
        const matches =
          (invGrowing && st === "active") ||
          (invHasPackets && (s.packet_count ?? 0) > 0) ||
          (invPrevGrown && s.ever_grown === true) ||
          (invPrevOwned && (s.packet_count ?? 0) === 0 && (st === "out_of_stock" || st === "archived"));
        if (!matches) return false;
      }
      if (plantNameFilters && plantNameFilters.length > 0 && !plantNameFilters.includes(s.name)) return false;
      if (varietyFilter != null && varietyFilter !== "") {
        const v = (s.variety ?? "").trim();
        if (v !== varietyFilter) return false;
      }
      if (vendorFilter != null && vendorFilter !== "") {
        const vendors = (s.vendor_display ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        if (!vendors.some((v) => v === vendorFilter)) return false;
      }
      if (sunFilter != null && sunFilter !== "") {
        const sun = (s.sun ?? "").trim();
        if (sun !== sunFilter) return false;
      }
      if (spacingFilter != null && spacingFilter !== "") {
        const sp = (s.plant_spacing ?? "").trim();
        if (sp !== spacingFilter) return false;
      }
      if (germinationFilter != null && germinationFilter !== "") {
        const g = (s.days_to_germination ?? "").trim();
        if (g !== germinationFilter) return false;
      }
      if (maturityFilter != null && maturityFilter !== "") {
        const days = s.harvest_days;
        if (maturityRange(days ?? null) !== maturityFilter) return false;
      }
      if (packetCountFilter != null && packetCountFilter !== "") {
        const n = s.packet_count ?? 0;
        if (packetCountRange(n) !== packetCountFilter) return false;
      }
      if (plantMonthFilter != null && !isProfilePlantableInMonth(s, plantMonthFilter - 1)) return false;
      if (methodFilter === "indoors" && s.indoor_start_weeks_before_frost == null) return false;
      if (methodFilter === "outdoors" && s.outdoor_plant_weeks_after_frost == null) return false;
      if (plantCategoryFilter != null && plantCategoryFilter !== "") {
        if ((s.plant_category ?? "").trim() !== plantCategoryFilter) return false;
      }
      if (plantTypeFilter && s.name !== plantTypeFilter) return false;
      if (selectedOwnerFilter && s.owner_user_id !== selectedOwnerFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !(s.variety && s.variety.toLowerCase().includes(q)))
        return false;
      if (tagFilters.length > 0) {
        const packetTagFilters = tagFilters.filter((t) => !isSeedTypeTag(t));
        if (packetTagFilters.length > 0) {
          const seedTags = s.tags ?? [];
          if (!packetTagFilters.some((t) => seedTags.includes(t))) return false;
        }
      }
      return true;
    });
  }, [seeds, hideArchivedProfiles, q, tagFilters, plantCategoryFilter, plantTypeFilter, selectedOwnerFilter, varietyFilter, vendorFilter, methodFilter, sunFilter, spacingFilter, germinationFilter, maturityFilter, packetCountFilter, plantMonthFilter, plantNameFilters, invGrowing, invHasPackets, invPrevGrown, invPrevOwned]);

  const plantCategoryChips = useMemo(() => buildPlantCategoryChips(seeds), [seeds]);

  const refineChips = useMemo(() => {
    const varietyMap = new Map<string, number>();
    const vendorMap = new Map<string, number>();
    const sunMap = new Map<string, number>();
    const spacingMap = new Map<string, number>();
    const germinationMap = new Map<string, number>();
    const maturityMap = new Map<string, number>();
    const packetCountMap = new Map<string, number>();
    let indoorsCount = 0;
    let outdoorsCount = 0;
    for (const s of seeds) {
      if (s.indoor_start_weeks_before_frost != null) indoorsCount++;
      if (s.outdoor_plant_weeks_after_frost != null) outdoorsCount++;
      const v = (s.variety ?? "").trim() || "—";
      varietyMap.set(v, (varietyMap.get(v) ?? 0) + 1);
      (s.vendor_display ?? "").split(",").map((x) => x.trim()).filter(Boolean).forEach((vendor) => {
        vendorMap.set(vendor, (vendorMap.get(vendor) ?? 0) + 1);
      });
      const sun = (s.sun ?? "").trim() || "—";
      if (sun) sunMap.set(sun, (sunMap.get(sun) ?? 0) + 1);
      const sp = (s.plant_spacing ?? "").trim() || "—";
      if (sp) spacingMap.set(sp, (spacingMap.get(sp) ?? 0) + 1);
      const g = (s.days_to_germination ?? "").trim() || "—";
      if (g) germinationMap.set(g, (germinationMap.get(g) ?? 0) + 1);
      const m = maturityRange(s.harvest_days ?? null);
      if (m) maturityMap.set(m, (maturityMap.get(m) ?? 0) + 1);
      const pk = packetCountRange(s.packet_count ?? 0);
      packetCountMap.set(pk, (packetCountMap.get(pk) ?? 0) + 1);
    }
    return {
      variety: Array.from(varietyMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      vendor: Array.from(vendorMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      sun: Array.from(sunMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      spacing: Array.from(spacingMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      germination: Array.from(germinationMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      maturity: (["<60", "60-90", "90+"] as const).filter((k) => maturityMap.has(k)).map((value) => ({ value, count: maturityMap.get(value) ?? 0 })),
      packetCount: ["0", "1", "2+"].filter((k) => packetCountMap.has(k)).map((value) => ({ value, count: packetCountMap.get(value) ?? 0 })),
      method: [
        { value: "indoors", count: indoorsCount },
        { value: "outdoors", count: outdoorsCount },
      ].filter((m) => m.count > 0),
    };
  }, [seeds]);

  const uniquePlantNames = useMemo(
    () => Array.from(new Set(seeds.map((s) => s.name))).sort((a, b) => a.localeCompare(b)),
    [seeds]
  );

  useEffect(() => {
    onPlantNameOptionsLoaded?.(uniquePlantNames);
  }, [uniquePlantNames, onPlantNameOptionsLoaded]);

  const filteredPlantNames = useMemo(() => {
    if (!plantFilterSearch.trim()) return uniquePlantNames;
    const q = plantFilterSearch.trim().toLowerCase();
    return uniquePlantNames.filter((name) => name.toLowerCase().includes(q));
  }, [uniquePlantNames, plantFilterSearch]);

  /** Single comparator for Refine By sort (purchase_date, name, date_added, variety, packet_count). */
  const vaultSortCmp = useCallback(
    (a: VaultCardItem, b: VaultCardItem): number => {
      if (!sortByProp) return 0;
      let v: number;
      switch (sortByProp) {
        case "purchase_date": {
          const da = a.latest_purchase_date ? new Date(a.latest_purchase_date).getTime() : 0;
          const db = b.latest_purchase_date ? new Date(b.latest_purchase_date).getTime() : 0;
          v = da - db;
          break;
        }
        case "name":
          v = (a.name?.trim() ?? "").localeCompare(b.name?.trim() ?? "", undefined, { sensitivity: "base" });
          break;
        case "date_added": {
          const da = a.created_at ? new Date(a.created_at).getTime() : 0;
          const db = b.created_at ? new Date(b.created_at).getTime() : 0;
          v = da - db;
          break;
        }
        case "variety":
          v = (a.variety?.trim() ?? "").localeCompare(b.variety?.trim() ?? "", undefined, { sensitivity: "base" });
          break;
        case "packet_count":
          v = (a.packet_count ?? 0) - (b.packet_count ?? 0);
          break;
        default:
          return 0;
      }
      return sortDirectionProp === "asc" ? v : -v;
    },
    [sortByProp, sortDirectionProp]
  );

  const sortedGridSeeds = useMemo(() => {
    const list = [...filteredSeeds];
    if (sortByProp) {
      list.sort(vaultSortCmp);
      return list;
    }
    if (gridSortBy === "name") {
      list.sort((a, b) => (a.name?.trim() ?? "").localeCompare(b.name?.trim() ?? "", undefined, { sensitivity: "base" }));
    } else {
      list.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
    }
    return list;
  }, [filteredSeeds, gridSortBy, sortByProp, vaultSortCmp]);

  // Snapshot the displayed (filtered + sorted) profile order so the profile detail page's swipe
  // traverses the filtered set the user is browsing — not all profiles A–Z (see lib/swipeOrder).
  const swipeOrderIds = useMemo(() => sortedGridSeeds.map((s) => s.id), [sortedGridSeeds]);
  useSwipeOrderSnapshot("profiles", swipeOrderIds);

  /** Returns the shorthand badge label for a card in family view (null = don't show badge). */
  function getOwnerBadge(seed: VaultCardItem): string | null {
    if (householdViewMode !== "family") return null;
    if (!seed.owner_user_id) return null;
    return getShorthandForUser(seed.owner_user_id);
  }

  function getThumbState(seed: VaultCardItem) {
    const showResearching = !(seed.hero_image_url ?? "").trim() && !!seed.hero_image_pending;
    if (showResearching && !pendingSinceRef.current.has(seed.id)) pendingSinceRef.current.set(seed.id, Date.now());
    const timedOut = showResearching && (Date.now() - (pendingSinceRef.current.get(seed.id) ?? 0)) >= HERO_PENDING_TIMEOUT_MS;
    const thumbUrl = getThumbnailUrl(seed);
    return { thumbUrl, showResearching: showResearching && !timedOut, timedOut };
  }

  useEffect(() => {
    if (!seeds.length || !onTagsLoaded) return;
    const allTags = new Set<string>();
    seeds.forEach((s) => (s.tags ?? []).forEach((t) => allTags.add(t)));
    onTagsLoaded(Array.from(allTags).sort());
  }, [seeds, onTagsLoaded]);

  useEffect(() => {
    if (!loading) onEmptyStateChange?.(seeds.length === 0);
  }, [loading, seeds.length, onEmptyStateChange]);

  useEffect(() => {
    if (!loading && seeds.length > 0) {
      announce(`${seeds.length} seed${seeds.length !== 1 ? "s" : ""} loaded`);
    }
  }, [loading, seeds.length, announce]);


  useEffect(() => {
    if (!user) {
      setSeeds([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchSeeds() {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("You're offline. Your vault will appear when you're back online.");
        setSeeds([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const isFamilyView = householdViewMode === "family";
      let profilesQuery = supabase
        .from("plant_profiles")
        .select("id, user_id, name, variety_name, status, harvest_days, sun, plant_spacing, days_to_germination, tags, primary_image_path, hero_image_path, hero_image_url, hero_image_pending, created_at, botanical_care_notes, planting_window, sowing_method, planting_seasons_tags, optimal_planting_months_array, indoor_start_weeks_before_frost, outdoor_plant_weeks_after_frost, plant_category")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (!isFamilyView) profilesQuery = profilesQuery.eq("user_id", user.id);
      const { data: profiles, error: profErr } = await profilesQuery;

      if (cancelled) return;
      if (profErr) {
        setError(typeof navigator !== "undefined" && !navigator.onLine
          ? "You're offline. Your vault will appear when you're back online."
          : profErr.message);
        setSeeds([]);
        setLoading(false);
        return;
      }
      if (!profiles?.length) {
        setSeeds([]);
        setLoading(false);
        return;
      }

      // Run packets, packet images, and active grows in parallel
      const profileIds = (profiles as { id: string }[]).map((pr) => pr.id);
      let packetsQuery = supabase
        .from("seed_packets")
        .select("plant_profile_id, tags, vendor_name, qty_status, purchase_date, packet_rating")
        .is("deleted_at", null)
        .or("is_archived.is.null,is_archived.eq.false");
      if (!isFamilyView) packetsQuery = packetsQuery.eq("user_id", user.id);
      let packetImagesQuery = supabase
        .from("seed_packets")
        .select("plant_profile_id, primary_image_path")
        .is("deleted_at", null)
        .not("primary_image_path", "is", null)
        .order("created_at", { ascending: true });
      if (!isFamilyView) packetImagesQuery = packetImagesQuery.eq("user_id", user.id);
      // Phase 2b: load status too (drop the growing-only filter) so we can build both the
      // active (growing) set and the ever-grown (archived/ended) set for the inventory toggles.
      let growsQuery = supabase
        .from("grow_instances")
        .select("plant_profile_id, status")
        .in("plant_profile_id", profileIds)
        .is("deleted_at", null);
      if (!isFamilyView && user?.id) growsQuery = growsQuery.eq("user_id", user.id);

      const [packetsRes, packetImagesRes, activeGrowsRes] = await Promise.all([
        packetsQuery,
        packetImagesQuery,
        growsQuery,
      ]);
      const packets = packetsRes.data;
      const packetImages = packetImagesRes.data;
      const activeGrows = activeGrowsRes.data;

      if (cancelled) return;

      const countByProfile = new Map<string, number>();
      const sumQtyByProfile = new Map<string, number>();
      const vendorsByProfile = new Map<string, Set<string>>();
      const f1ProfileIds = new Set<string>();
      const latestPurchaseByProfile = new Map<string, string>();
      const maxQtyByProfile = new Map<string, number>();
      const bestRatingByProfile = new Map<string, number>();
      for (const p of packets ?? []) {
        const row = p as { plant_profile_id: string; tags?: string[] | null; vendor_name?: string | null; qty_status?: number; purchase_date?: string | null; packet_rating?: number | null };
        const pid = row.plant_profile_id;
        countByProfile.set(pid, (countByProfile.get(pid) ?? 0) + 1);
        const qty = typeof row.qty_status === "number" ? row.qty_status : 100;
        sumQtyByProfile.set(pid, (sumQtyByProfile.get(pid) ?? 0) + qty);
        if (qty > (maxQtyByProfile.get(pid) ?? 0)) maxQtyByProfile.set(pid, qty);
        const v = (row.vendor_name ?? "").trim();
        if (v) {
          const set = vendorsByProfile.get(pid) ?? new Set<string>();
          set.add(v);
          vendorsByProfile.set(pid, set);
        }
        const tags = row.tags;
        if (Array.isArray(tags) && tags.some((t) => String(t).toLowerCase() === "f1")) f1ProfileIds.add(pid);
        const pd = (row.purchase_date ?? "").trim().slice(0, 10);
        if (pd) {
          const cur = latestPurchaseByProfile.get(pid);
          if (!cur || pd > cur) latestPurchaseByProfile.set(pid, pd);
        }
        const r = typeof row.packet_rating === "number" && row.packet_rating >= 1 && row.packet_rating <= 5 ? row.packet_rating : null;
        if (r != null) {
          const cur = bestRatingByProfile.get(pid) ?? 0;
          if (r > cur) bestRatingByProfile.set(pid, r);
        }
      }

      const firstPacketImageByProfile = new Map<string, string>();
      for (const row of packetImages ?? []) {
        const pid = (row as { plant_profile_id: string; primary_image_path: string }).plant_profile_id;
        const path = (row as { primary_image_path: string }).primary_image_path;
        if (pid && path?.trim() && !firstPacketImageByProfile.has(pid)) firstPacketImageByProfile.set(pid, path.trim());
      }

      const growRows = (activeGrows ?? []) as { plant_profile_id: string; status?: string | null }[];
      const activeProfileIds = new Set(growRows.filter((g) => g.status === "growing").map((g) => g.plant_profile_id));
      const everGrownProfileIds = new Set(growRows.filter((g) => g.status !== "growing").map((g) => g.plant_profile_id));

      const items: VaultCardItem[] = (profiles ?? []).map((p: Record<string, unknown>) => {
        const effective = getEffectiveCare(
          {
            sun: p.sun as string | null,
            plant_spacing: p.plant_spacing as string | null,
            days_to_germination: p.days_to_germination as string | null,
            harvest_days: p.harvest_days as number | null,
            botanical_care_notes: p.botanical_care_notes as Record<string, unknown> | null,
          },
          null
        );
        const profilePrimary = p.primary_image_path as string | null;
        const fallbackPacketImage = firstPacketImageByProfile.get(p.id as string) ?? null;
        const pid = p.id as string;
        const count = countByProfile.get(pid) ?? 0;
        const sumQty = sumQtyByProfile.get(pid) ?? 0;
        const avg_qty_pct = count > 0 ? Math.round(sumQty / count) : null;
        const max_qty_pct = count > 0 ? (maxQtyByProfile.get(pid) ?? null) : null;
        const effectiveStatus = activeProfileIds.has(pid) ? "active" : ((p.status as string) === "active" ? "vault" : (p.status as string | null));
        return {
          id: pid,
          name: (p.name as string) ?? "Unknown",
          variety: (p.variety_name as string) ?? "—",
          packet_count: count,
          avg_qty_pct,
          max_qty_pct,
          status: effectiveStatus,
          harvest_days: effective.harvest_days ?? (p.harvest_days as number | null) ?? null,
          sun: effective.sun ?? undefined,
          plant_spacing: effective.plant_spacing ?? undefined,
          days_to_germination: effective.days_to_germination ?? undefined,
          tags: p.tags as string[] | null,
          primary_image_path: profilePrimary ?? fallbackPacketImage,
          hero_image_path: (p.hero_image_path as string | null) ?? null,
          hero_image_url: (p.hero_image_url as string | null) ?? null,
          hero_image_pending: (p.hero_image_pending as boolean | null) ?? false,
          created_at: (p.created_at as string) ?? undefined,
          hasF1Packet: f1ProfileIds.has(pid),
          vendor_display: (() => {
            const vendors = vendorsByProfile.get(pid);
            return vendors && vendors.size > 0 ? Array.from(vendors).sort().join(", ") : null;
          })(),
          planting_window: (p.planting_window as string | null) ?? null,
          sowing_method: (p.sowing_method as string | null) ?? null,
          planting_seasons_tags: (p.planting_seasons_tags as string[] | null) ?? null,
          optimal_planting_months_array: (p.optimal_planting_months_array as number[] | null) ?? null,
          indoor_start_weeks_before_frost: (p.indoor_start_weeks_before_frost as number | null) ?? null,
          outdoor_plant_weeks_after_frost: (p.outdoor_plant_weeks_after_frost as number | null) ?? null,
          latest_purchase_date: latestPurchaseByProfile.get(pid) ?? null,
          owner_user_id: (p.user_id as string | null) ?? null,
          best_rating: bestRatingByProfile.get(pid) ?? null,
          plant_category: (p.plant_category as string | null) ?? null,
          ever_grown: everGrownProfileIds.has(pid),
        };
      });
      const byId = new Map<string, VaultCardItem>();
      for (const item of items) byId.set(item.id, item);
      setSeeds(Array.from(byId.values()));
      setLoading(false);
    }

    fetchSeeds();
    return () => {
      cancelled = true;
    };
  }, [user?.id, effectiveRefetchTrigger, householdViewMode, pullRefetch]);

  useEffect(() => {
    setImageErrorIds(new Set());
  }, [effectiveRefetchTrigger]);

  usePullToRefresh({
    onRefresh: () => setPullRefetch((r) => r + 1),
    disabled: loading,
    containerRef: effectiveScrollContainerRef,
  });

  const filteredIds = useMemo(
    () => filteredSeeds.map((s) => s.id),
    [filteredSeeds]
  );

  useEffect(() => {
    onFilteredIdsChange?.(filteredIds);
  }, [filteredIds, onFilteredIdsChange]);

  useEffect(() => {
    onPlantCategoryChipsLoaded?.(plantCategoryChips);
  }, [plantCategoryChips, onPlantCategoryChipsLoaded]);

  useEffect(() => {
    onRefineChipsLoaded?.(refineChips);
  }, [refineChips, onRefineChipsLoaded]);

  const pendingHeroCount = useMemo(
    () => seeds.filter((s) => !(s.hero_image_url ?? "").trim() && !!s.hero_image_pending).length,
    [seeds]
  );
  useEffect(() => {
    onPendingHeroCountChange?.(pendingHeroCount);
  }, [pendingHeroCount, onPendingHeroCountChange]);

  useEffect(() => {
    if (pendingHeroCount === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [pendingHeroCount]);

  useEffect(() => {
    if (!plantFilterOpen) return;
    const close = (e: MouseEvent) => {
      if (plantFilterRef.current && !plantFilterRef.current.contains(e.target as Node)) setPlantFilterOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [plantFilterOpen]);

  if (loading) {
    return (
      <div className="relative z-10">
        <GridSkeleton gridDisplayStyle={gridDisplayStyle} />
      </div>
    );
  }

  if (error) {
    const isOffline = !isOnline || error.includes("offline");
    return (
      <div className="rounded-card bg-white p-6 shadow-card border border-black/5">
        <p className={isOffline ? "text-slate-600 font-medium" : "text-amber-600 font-medium"}>
          {isOffline ? "You're offline" : "Could not load seed vault"}
        </p>
        <p className="text-sm text-slate-500 mt-1">{error}</p>
      </div>
    );
  }

  if (seeds.length === 0) {
    return (
      <EmptyStateCard
        title="Your seed library starts here."
        body="Add a packet by scanning, uploading a photo, or typing the details."
        actionLabel={onAddFirst ? "Add a Packet" : undefined}
        onAction={onAddFirst}
        illustration={<EmptyStateVault />}
      />
    );
  }

  if (filteredSeeds.length === 0) {
    const hasFilters = !!(q || tagFilters.length > 0 || plantNameFilters.length > 0 || plantMonthFilter != null || invGrowing || invHasPackets || invPrevGrown || invPrevOwned || plantCategoryFilter || varietyFilter || vendorFilter || methodFilter || sunFilter || spacingFilter || germinationFilter || maturityFilter || packetCountFilter);
    if (hasFilters) {
      return (
        <NoMatchCard
          message="No plant profiles match your search or filters."
          actionLabel={onClearFilters ? "Clear filters" : undefined}
          onAction={onClearFilters}
        />
      );
    }
    return (
      <EmptyStateCard
        title="No plant varieties here yet."
        body="Add a variety by scanning a packet or typing it in."
        actionLabel={onAddFirst ? "Add a Plant" : undefined}
        onAction={onAddFirst}
        illustration={<EmptyStateSprout />}
      />
    );
  }

  // Member filter pills (family view, >1 member)
  const showMemberPills = householdViewMode === "family" && householdMembers.length > 1;
  const memberPills = showMemberPills ? (
    <div className="flex items-center gap-1.5 flex-wrap pb-1">
      <button
        type="button"
        onClick={() => setSelectedOwnerFilter(null)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedOwnerFilter === null ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
      >
        All
      </button>
      {householdMembers.map((m) => {
        const shorthand = getShorthandForUser(m.user_id);
        const isSelected = selectedOwnerFilter === m.user_id;
        return (
          <button
            key={m.user_id}
            type="button"
            onClick={() => setSelectedOwnerFilter(isSelected ? null : m.user_id)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${isSelected ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}
          >
            {shorthand}
          </button>
        );
      })}
    </div>
  ) : null;

  const isPhotoCards = gridDisplayStyle === "photo";
    /* Gallery = 3-col grid matching peer surfaces (Packets/Shed/Active Garden/My Plants); list = vertical rows with divider. */
    const containerClass = isPhotoCards
      ? "grid grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2"
      : "rounded-xl border border-black/10 bg-white overflow-hidden divide-y divide-black/5";

    return (
      <div className="relative z-10 space-y-2">
        {memberPills}
        <ul className={containerClass} role="list">
          {sortedGridSeeds.map((seed, idx) => {
            const { thumbUrl, showResearching } = getThumbState(seed);
            const showSeedling = !thumbUrl || imageErrorIds.has(seed.id);
            const lp = onLongPressVariety ? getLongPressHandlers(seed.id) : null;
            const varietyDisplay = formatVarietyForDisplay(seed.variety, false);
            const ownerBadge = getOwnerBadge(seed);

            if (isPhotoCards) {
              const cardContent = (
                <>
                  <div className="px-1.5 pt-1.5 shrink-0">
                    <div className="relative w-full aspect-square overflow-hidden rounded-xl">
                      {showResearching ? (
                        <div className="absolute inset-0 animate-pulse bg-neutral-200 flex items-center justify-center rounded-xl">
                          <span className="text-[10px] font-medium text-neutral-500 px-1 text-center">AI…</span>
                        </div>
                      ) : (
                        <PlantImage
                          imageUrl={thumbUrl}
                          alt=""
                          fill
                          size="lg"
                          variant="neutral"
                          onLoad={() => markThumbLoaded(seed.id)}
                          onError={() => markThumbError(seed.id)}
                        />
                      )}
                      {batchSelectMode && (
                        <span className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full border-2 border-black/20 flex items-center justify-center bg-white" aria-hidden>
                          {selectedVarietyIds?.has(seed.id) ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                          ) : null}
                        </span>
                      )}
                      {ownerBadge && seed.owner_user_id !== user?.id && (
                        <span className="absolute top-0.5 left-0.5 z-10 pointer-events-none">
                          <OwnerBadge shorthand={ownerBadge} canEdit={seed.owner_user_id ? canEditPage(seed.owner_user_id ?? "", "seed_vault") : true} size="xs" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-1.5 pt-1 pb-0.5 flex flex-col flex-1 min-h-0 items-center text-center min-w-0">
                    <h3 className="font-semibold text-black text-xs leading-tight w-full min-h-[1.75rem] flex flex-col items-center justify-center min-w-0 mb-0" title={`${decodeHtmlEntities(seed.name)}${varietyDisplay ? ` (${varietyDisplay})` : ""}`}>
                      <span className="block line-clamp-2 break-words text-center">
                        {decodeHtmlEntities(seed.name)}
                      </span>
                      {varietyDisplay && (
                        <span className="block w-full font-normal italic text-black/60 truncate text-center">
                          {varietyDisplay}
                        </span>
                      )}
                    </h3>
                    <div className="pt-0.5 flex items-center gap-1 flex-wrap justify-center min-w-0 w-full">
                      {seed.hasF1Packet && <span className="text-[8px] font-semibold px-0.5 py-px rounded bg-amber-100 text-amber-800 shrink-0">F1</span>}
                    </div>
                  </div>
                </>
              );

              return (
                <li key={seed.id} className="min-w-0 animate-fade-in" style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}>
                  {batchSelectMode ? (
                    <article
                      role="button"
                      tabIndex={0}
                      onClick={() => onToggleVarietySelection?.(seed.id)}
                      className={`rounded-lg bg-white shadow-card overflow-hidden flex flex-col cursor-pointer border border-black/5 card-interactive ${selectedVarietyIds?.has(seed.id) ? "ring-2 ring-emerald-500" : ""} ${getCardBorderClass(seed)}`}
                    >
                      {cardContent}
                    </article>
                  ) : (
                    <div
                      role="link"
                      tabIndex={0}
                      className="block cursor-pointer"
                      onClick={lp ? () => lp.handleClick() : () => goToProfile(seed.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToProfile(seed.id); } }}
                      {...(lp
                        ? {
                            onTouchStart: lp.onTouchStart,
                            onTouchMove: lp.onTouchMove,
                            onTouchEnd: lp.onTouchEnd,
                            onTouchCancel: lp.onTouchCancel,
                          }
                        : {})}
                    >
                      <article className={`rounded-lg bg-white shadow-card overflow-hidden flex flex-col border border-black/5 hover:border-emerald-500/40 transition-colors w-full card-interactive ${getCardBorderClass(seed)}`}>
                        {cardContent}
                      </article>
                    </div>
                  )}
                </li>
              );
            }

            /* List row: thumbnail + stacked name / italic variety (VISION §8 variety presentation lock 2026-05-30). Packet count is scoped to the Packets tab. */
            const rowInner = (
              <>
                {batchSelectMode && (
                  <span className="shrink-0 flex items-center min-w-[44px] min-h-[44px] justify-center">
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white ${selectedVarietyIds?.has(seed.id) ? "border-emerald-500" : "border-black/20"}`} aria-hidden>
                      {selectedVarietyIds?.has(seed.id) ? <span className="w-3 h-3 rounded-full bg-emerald-600" /> : null}
                    </span>
                  </span>
                )}
                <span className="shrink-0 relative w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                  {showResearching ? (
                    <span className="text-[8px] font-medium text-neutral-500 text-center">AI…</span>
                  ) : (
                    <PlantImage imageUrl={thumbUrl} alt="" fill size="sm" variant="neutral" onLoad={() => markThumbLoaded(seed.id)} onError={() => markThumbError(seed.id)} />
                  )}
                  {ownerBadge && seed.owner_user_id !== user?.id && (
                    <span className="absolute top-0.5 right-0.5 z-10 pointer-events-none">
                      <OwnerBadge shorthand={ownerBadge} canEdit={seed.owner_user_id ? canEditPage(seed.owner_user_id ?? "", "seed_vault") : true} size="xs" />
                    </span>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-neutral-900 truncate">{decodeHtmlEntities(seed.name)}</span>
                  {varietyDisplay && (
                    <span className="block text-sm font-normal italic text-neutral-600 truncate">{varietyDisplay}</span>
                  )}
                </span>
                {seed.hasF1Packet && <span className="shrink-0 text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-800">F1</span>}
              </>
            );

            return (
              <li key={seed.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}>
                <button
                  type="button"
                  onClick={() => batchSelectMode ? onToggleVarietySelection?.(seed.id) : (lp ? lp.handleClick() : goToProfile(seed.id))}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left min-h-[44px] hover:bg-gray-50 transition-colors ${batchSelectMode && selectedVarietyIds?.has(seed.id) ? "bg-emerald/5 border-2 border-emerald-500" : ""}`}
                  {...(lp && !batchSelectMode ? { onTouchStart: lp.onTouchStart, onTouchMove: lp.onTouchMove, onTouchEnd: lp.onTouchEnd, onTouchCancel: lp.onTouchCancel } : {})}
                >
                  {rowInner}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
}
