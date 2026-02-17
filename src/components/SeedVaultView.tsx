"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getEffectiveCare } from "@/lib/plantCareHierarchy";
import { isPlantableInMonth } from "@/lib/plantingWindow";
import { decodeHtmlEntities, formatVarietyForDisplay, looksLikeScientificName } from "@/lib/htmlEntities";
import { normalizeSeedStockRows } from "@/lib/vault";
import type { SeedStockDisplay, PlantProfileDisplay, Volume } from "@/types/vault";

/** List table state: column order + widths persisted to localStorage. See docs/SEED_VAULT_TABLE.md. */
const SEED_VAULT_TABLE_STORAGE_KEY = "seed-vault-table-state";
const DEFAULT_LIST_COLUMN_ORDER: ListDataColumnId[] = ["name", "variety", "vendor", "sun", "spacing", "germination", "maturity", "pkts"];
const DEFAULT_LIST_COLUMN_WIDTHS: Record<ListDataColumnId, number> = {
  name: 140,
  variety: 160,
  vendor: 100,
  sun: 88,
  spacing: 100,
  germination: 100,
  maturity: 88,
  pkts: 64,
};
type ListDataColumnId = "name" | "variety" | "vendor" | "sun" | "spacing" | "germination" | "maturity" | "pkts";

function loadListTableState(): { columnOrder: ListDataColumnId[]; columnWidths: Record<string, number> } {
  if (typeof window === "undefined") return { columnOrder: [...DEFAULT_LIST_COLUMN_ORDER], columnWidths: { ...DEFAULT_LIST_COLUMN_WIDTHS } };
  try {
    const raw = localStorage.getItem(SEED_VAULT_TABLE_STORAGE_KEY);
    if (!raw) return { columnOrder: [...DEFAULT_LIST_COLUMN_ORDER], columnWidths: { ...DEFAULT_LIST_COLUMN_WIDTHS } };
    const parsed = JSON.parse(raw) as { columnOrder?: string[]; columnWidths?: Record<string, number> };
    const rawOrder = Array.isArray(parsed.columnOrder)
      ? parsed.columnOrder.filter((id): id is ListDataColumnId => DEFAULT_LIST_COLUMN_ORDER.includes(id as ListDataColumnId))
      : [];
    const seen = new Set<ListDataColumnId>();
    const mergedOrder: ListDataColumnId[] = [];
    for (const id of rawOrder) if (!seen.has(id)) { mergedOrder.push(id); seen.add(id); }
    for (const id of DEFAULT_LIST_COLUMN_ORDER) if (!seen.has(id)) { mergedOrder.push(id); seen.add(id); }
    const widths = { ...DEFAULT_LIST_COLUMN_WIDTHS, ...(parsed.columnWidths && typeof parsed.columnWidths === "object" ? parsed.columnWidths : {}) };
    return { columnOrder: mergedOrder, columnWidths: widths };
  } catch {
    return { columnOrder: [...DEFAULT_LIST_COLUMN_ORDER], columnWidths: { ...DEFAULT_LIST_COLUMN_WIDTHS } };
  }
}

function saveListTableState(columnOrder: ListDataColumnId[], columnWidths: Record<string, number>) {
  try {
    localStorage.setItem(SEED_VAULT_TABLE_STORAGE_KEY, JSON.stringify({ columnOrder, columnWidths }));
  } catch {
    /* ignore */
  }
}

/** Unified vault card item: from plant_profiles (new) or seed_stocks (legacy). */
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
  /** Planting window (e.g. "Spring: Feb-May"); used for Plant Now / Sowing Month filters. */
  planting_window?: string | null;
  /** Sowing method (e.g. "Direct Sow", "Start Indoors / Transplant"); for display badge. */
  sowing_method?: string | null;
  /** Latest purchase_date among packets for this profile (YYYY-MM-DD); for sort by purchase date. */
  latest_purchase_date?: string | null;
};

export type ListSortColumn = "name" | "variety" | "vendor" | "sun" | "spacing" | "germination" | "maturity" | "pkts";

/** Placeholder hero URL (generic icon). Don't use for grid — prefer packet image or empty state. */
function isPlaceholderHeroUrl(url: string | null | undefined): boolean {
  if (!url || !String(url).trim()) return false;
  const u = String(url).trim().toLowerCase();
  return u === "/seedling-icon.svg" || u.endsWith("/seedling-icon.svg");
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
/** Sort options from Refine By modal (vault page). When set, overrides internal grid/list sort. */
export type VaultSortBy = "purchase_date" | "name" | "date_added" | "variety" | "packet_count";

const VOLUME_LABELS: Record<string, string> = {
  full: "Full",
  partial: "Partial",
  low: "Low",
  empty: "Empty",
};

const VOLUME_COLORS: Record<string, string> = {
  full: "bg-emerald/20 text-emerald",
  partial: "bg-emerald/10 text-emerald",
  low: "bg-citrus/20 text-[#b8860b]",
  empty: "bg-black/5 text-black/50",
};

/** Returns a color class for the health indicator dot based on inventory % (avg qty). Grey = no packets, yellow ≤25%, orange ≤50%, green >50%. */
function getHealthColor(seed: VaultCardItem): string {
  if (seed.packet_count === 0 || seed.status === "out_of_stock") return "bg-neutral-400";
  const avg = seed.avg_qty_pct ?? 0;
  if (avg <= 25) return "bg-amber-400";
  if (avg <= 50) return "bg-orange-500";
  return "bg-emerald-500";
}

/** Card border by planting status: active = in garden, out_of_stock = muted, default = vault/dormant. */
function getCardBorderClass(seed: VaultCardItem): string {
  const active = (seed.status ?? "").toLowerCase().includes("active");
  if (active) return "border-emerald-500/60 border-2";
  if (seed.packet_count === 0 || seed.status === "out_of_stock") return "border-neutral-300 border border-dashed";
  return "border-slate-200/80 border";
}

function HealthDot({ seed, size = "default" }: { seed: VaultCardItem; size?: "default" | "sm" }) {
  const color = getHealthColor(seed);
  const label =
    seed.packet_count === 0 || seed.status === "out_of_stock"
      ? "Out of stock"
      : (seed.avg_qty_pct ?? 0) <= 25
        ? "Low inventory (≤25%)"
        : (seed.avg_qty_pct ?? 0) <= 50
          ? "Medium (≤50%)"
          : "In stock (>50%)";
  const sizeClass = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  return <span className={`inline-block rounded-full ${sizeClass} ${color} shrink-0`} title={label} aria-label={label} />;
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

export type StatusFilter = "" | "vault" | "active" | "low_inventory" | "archived";
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

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function SeedVaultView({
  mode,
  refetchTrigger = 0,
  searchQuery = "",
  statusFilter = "",
  tagFilters = [],
  onOpenScanner,
  onTagsLoaded,
  batchSelectMode = false,
  selectedVarietyIds,
  onToggleVarietySelection,
  onLongPressVariety,
  onFilteredIdsChange,
  onPendingHeroCountChange,
  availablePlantTypes = [],
  onPlantTypeChange,
  plantNowFilter = false,
  /** When plantNowFilter is true, use this month (YYYY-MM) instead of current month. */
  sowMonth = null,
  gridDisplayStyle = "condensed" as const,
  categoryFilter: categoryFilterProp,
  onCategoryFilterChange,
  onCategoryChipsLoaded,
  varietyFilter = null,
  vendorFilter = null,
  sunFilter = null,
  spacingFilter = null,
  germinationFilter = null,
  maturityFilter = null,
  packetCountFilter = null,
  onSowingMonthChipsLoaded,
  onRefineChipsLoaded,
  onVaultStatusChipsLoaded,
  hideArchivedProfiles = false,
  onEmptyStateChange,
  sortBy: sortByProp = null,
  sortDirection: sortDirectionProp = "asc",
}: {
  mode: "grid" | "list";
  refetchTrigger?: number;
  searchQuery?: string;
  statusFilter?: StatusFilter;
  tagFilters?: TagFilter;
  onOpenScanner?: () => void;
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
  plantNowFilter?: boolean;
  /** When plantNowFilter is true, use this month (YYYY-MM) instead of current month. */
  sowMonth?: string | null;
  /** When mode is "grid", "photo" = image-dominant 2-col cards, "condensed" = compact 3-col. */
  gridDisplayStyle?: "photo" | "condensed";
  /** Controlled plant-type filter (first word of name); when set, Refine By panel can drive this. */
  categoryFilter?: string | null;
  onCategoryFilterChange?: (value: string | null) => void;
  /** Called when category chips (plant types with counts) are computed, for Refine By panel. */
  onCategoryChipsLoaded?: (chips: { type: string; count: number }[]) => void;
  /** Refine-by filters (variety, vendor, sun, spacing, germination, maturity range, packet count range). */
  varietyFilter?: string | null;
  vendorFilter?: string | null;
  sunFilter?: string | null;
  spacingFilter?: string | null;
  germinationFilter?: string | null;
  maturityFilter?: string | null;
  packetCountFilter?: string | null;
  /** Called when sowing month chips (counts per month) are computed, for Refine By panel. */
  onSowingMonthChipsLoaded?: (chips: { month: number; monthName: string; count: number }[]) => void;
  /** Called when refine chips (counts per dimension) are computed, for Refine By panel. */
  onRefineChipsLoaded?: (chips: {
    variety: { value: string; count: number }[];
    vendor: { value: string; count: number }[];
    sun: { value: string; count: number }[];
    spacing: { value: string; count: number }[];
    germination: { value: string; count: number }[];
    maturity: { value: string; count: number }[];
    packetCount: { value: string; count: number }[];
  }) => void;
  /** Called when vault status counts (All, In storage, Active, Low inventory, Archived) are computed, for Refine By panel. */
  onVaultStatusChipsLoaded?: (chips: { value: StatusFilter; label: string; count: number }[]) => void;
  /** When true, exclude plant profiles with no packets (archived) from list/table. */
  hideArchivedProfiles?: boolean;
  /** Sort from Refine By (vault page). When set, overrides internal grid/list sort. */
  sortBy?: VaultSortBy | null;
  sortDirection?: "asc" | "desc";
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [seeds, setSeeds] = useState<VaultCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingSinceRef = useRef<Map<string, number>>(new Map());
  const [tick, setTick] = useState(0);
  const [listSortColumn, setListSortColumn] = useState<ListSortColumn | null>("name");
  const [listSortDir, setListSortDir] = useState<"asc" | "desc">("asc");
  const [plantTypeFilter, setPlantTypeFilter] = useState<string | null>(null);
  const [plantFilterOpen, setPlantFilterOpen] = useState(false);
  const [plantFilterSearch, setPlantFilterSearch] = useState("");
  const plantFilterRef = useRef<HTMLDivElement>(null);
  const [categoryFilterInternal, setCategoryFilterInternal] = useState<string | null>(null);
  const categoryFilter = categoryFilterProp !== undefined ? categoryFilterProp : categoryFilterInternal;
  const setCategoryFilter = onCategoryFilterChange ?? setCategoryFilterInternal;
  const [gridSortBy, setGridSortBy] = useState<GridSortBy>("name");
  const [imageErrorIds, setImageErrorIds] = useState<Set<string>>(new Set());
  const [listColumnOrder, setListColumnOrder] = useState<ListDataColumnId[]>(() => loadListTableState().columnOrder);
  const [listColumnWidths, setListColumnWidths] = useState<Record<string, number>>(() => loadListTableState().columnWidths);
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);
  const isOnline = useOnlineStatus();
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const dragOverColIdRef = useRef<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    saveListTableState(listColumnOrder, listColumnWidths);
  }, [listColumnOrder, listColumnWidths]);

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

  const handleListSort = (col: ListSortColumn) => {
    if (listSortColumn !== col) {
      setListSortColumn(col);
      setListSortDir("asc");
    } else if (listSortDir === "asc") {
      setListSortDir("desc");
    } else {
      setListSortColumn(null);
    }
  };

  const handleResizeStart = useCallback((colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const w = listColumnWidths[colId] ?? DEFAULT_LIST_COLUMN_WIDTHS[colId as ListDataColumnId];
    resizeRef.current = { colId, startX: e.clientX, startW: w };
    const onMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = moveEvent.clientX - resizeRef.current.startX;
      const newW = Math.max(60, resizeRef.current.startW + delta);
      setListColumnWidths((prev) => ({ ...prev, [resizeRef.current!.colId]: newW }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [listColumnWidths]);

  const handleColumnReorder = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setListColumnOrder((prev) => {
      const i = prev.indexOf(fromId as ListDataColumnId);
      const j = prev.indexOf(toId as ListDataColumnId);
      if (i < 0 || j < 0) return prev;
      const next = [...prev];
      next.splice(i, 1);
      next.splice(j, 0, fromId as ListDataColumnId);
      return next;
    });
  }, []);

  const q = searchQuery.trim().toLowerCase();

  const displayedSeeds = useMemo(() => seeds, [seeds]);

  function goToProfile(profileId: string) {
    router.push(`/vault/${profileId}`);
  }

  const sowMonthIndex = useMemo(() => {
    if (sowMonth && /^\d{4}-\d{2}$/.test(sowMonth)) {
      const [, m] = sowMonth.split("-").map(Number);
      return (m ?? 1) - 1;
    }
    return new Date().getMonth();
  }, [sowMonth]);

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
    return displayedSeeds.filter((s) => {
      if (hideArchivedProfiles && statusFilter !== "archived" && (s.packet_count ?? 0) <= 0) return false;
      if (categoryFilter !== null) {
        const first = (s.name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
        if (first !== categoryFilter) return false;
      }
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
      if (plantNowFilter && !isPlantableInMonth(s, sowMonthIndex)) return false;
      if (plantTypeFilter && s.name !== plantTypeFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !(s.variety && s.variety.toLowerCase().includes(q)))
        return false;
      if (statusFilter === "vault") {
        if ((s.packet_count ?? 0) <= 0) return false;
        if ((s.status ?? "").toLowerCase() === "out_of_stock") return false;
      }
      if (statusFilter === "active") {
        if ((s.status ?? "").toLowerCase() !== "active on hillside") return false;
      }
      if (statusFilter === "low_inventory") {
        if ((s.packet_count ?? 0) > 1) return false;
      }
      if (statusFilter === "archived") {
        if ((s.status ?? "").toLowerCase() !== "out_of_stock") return false;
      }
      if (tagFilters.length > 0) {
        const seedTags = s.tags ?? [];
        if (!tagFilters.some((t) => seedTags.includes(t))) return false;
      }
      return true;
    });
  }, [displayedSeeds, hideArchivedProfiles, q, statusFilter, tagFilters, plantTypeFilter, categoryFilter, varietyFilter, vendorFilter, sunFilter, spacingFilter, germinationFilter, maturityFilter, packetCountFilter, plantNowFilter, sowMonthIndex]);

  const categoryChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of seeds) {
      const first = (s.name ?? "").trim().split(/\s+/)[0]?.trim();
      const type = first || "Other";
      map.set(type, (map.get(type) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type, undefined, { sensitivity: "base" }));
  }, [seeds]);

  const refineChips = useMemo(() => {
    const varietyMap = new Map<string, number>();
    const vendorMap = new Map<string, number>();
    const sunMap = new Map<string, number>();
    const spacingMap = new Map<string, number>();
    const germinationMap = new Map<string, number>();
    const maturityMap = new Map<string, number>();
    const packetCountMap = new Map<string, number>();
    for (const s of seeds) {
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
    };
  }, [seeds]);

  /** Vault status counts for Refine By panel: same buckets as status filter (All, In storage, Active, Low inventory, Archived). */
  const vaultStatusChips = useMemo(() => {
    const statuses: { value: StatusFilter; label: string }[] = [
      { value: "", label: "All" },
      { value: "vault", label: "In storage" },
      { value: "active", label: "Active" },
      { value: "low_inventory", label: "Low inventory" },
      { value: "archived", label: "Archived" },
    ];
    return statuses.map(({ value, label }) => {
      let count: number;
      if (value === "") {
        count = seeds.length;
      } else if (value === "vault") {
        count = seeds.filter((s) => (s.packet_count ?? 0) > 0 && (s.status ?? "").toLowerCase() !== "out_of_stock").length;
      } else if (value === "active") {
        count = seeds.filter((s) => (s.status ?? "").toLowerCase() === "active on hillside").length;
      } else if (value === "low_inventory") {
        count = seeds.filter((s) => (s.packet_count ?? 0) <= 1).length;
      } else {
        count = seeds.filter((s) => (s.status ?? "").toLowerCase() === "out_of_stock").length;
      }
      return { value, label, count };
    });
  }, [seeds]);

  const sowingMonthChips = useMemo(() => {
    const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return MONTH_NAMES.map((monthName, monthIndex) => {
      const count = seeds.filter((s) => isPlantableInMonth(s, monthIndex)).length;
      return { month: monthIndex + 1, monthName, count };
    });
  }, [seeds]);

  useEffect(() => {
    onSowingMonthChipsLoaded?.(sowingMonthChips);
  }, [sowingMonthChips, onSowingMonthChipsLoaded]);

  const uniquePlantNames = useMemo(
    () => Array.from(new Set(displayedSeeds.map((s) => s.name))).sort((a, b) => a.localeCompare(b)),
    [displayedSeeds]
  );

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

  const sortedListSeeds = useMemo(() => {
    const list = [...filteredSeeds];
    if (sortByProp) {
      list.sort(vaultSortCmp);
      return list;
    }
    if (listSortColumn == null) return list;
    const cmp = (a: VaultCardItem, b: VaultCardItem): number => {
      let va: string | number | null | undefined;
      let vb: string | number | null | undefined;
      switch (listSortColumn) {
        case "name":
          va = a.name?.trim() ?? "";
          vb = b.name?.trim() ?? "";
          return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
        case "variety":
          va = a.variety?.trim() ?? "";
          vb = b.variety?.trim() ?? "";
          return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
        case "vendor":
          va = a.vendor_display?.trim() ?? "";
          vb = b.vendor_display?.trim() ?? "";
          return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
        case "sun":
          va = a.sun?.trim() ?? "";
          vb = b.sun?.trim() ?? "";
          return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
        case "spacing":
          va = a.plant_spacing?.trim() ?? "";
          vb = b.plant_spacing?.trim() ?? "";
          return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
        case "germination":
          va = a.days_to_germination?.trim() ?? "";
          vb = b.days_to_germination?.trim() ?? "";
          return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
        case "maturity":
          va = a.harvest_days ?? -1;
          vb = b.harvest_days ?? -1;
          return (Number(va) - Number(vb));
        case "pkts":
          va = a.packet_count ?? 0;
          vb = b.packet_count ?? 0;
          return Number(va) - Number(vb);
        default:
          return 0;
      }
    };
    list.sort((a, b) => {
      const v = cmp(a, b);
      return listSortDir === "asc" ? v : -v;
    });
    return list;
  }, [filteredSeeds, listSortColumn, listSortDir, sortByProp, vaultSortCmp]);

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

      const { data: profiles, error: profErr } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name, status, harvest_days, sun, plant_spacing, days_to_germination, tags, primary_image_path, hero_image_path, hero_image_url, hero_image_pending, created_at, botanical_care_notes, planting_window, sowing_method")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (profErr || !profiles?.length) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setError("You're offline. Your vault will appear when you're back online.");
          setSeeds([]);
          setLoading(false);
          return;
        }
        const { data: legacyData, error: e } = await supabase
          .from("seed_stocks")
          .select("id, plant_variety_id, volume, created_at, plant_varieties!inner(name, variety_name, inventory_count, status, harvest_days, sun, plant_spacing, days_to_germination, tags, source_url)")
          .eq("plant_varieties.user_id", user.id)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (e) {
          setError(typeof navigator !== "undefined" && !navigator.onLine
            ? "You're offline. Your vault will appear when you're back online."
            : e.message);
          setSeeds([]);
          setLoading(false);
          return;
        }
        const rows = normalizeSeedStockRows(legacyData ?? []);
        const byPv = new Map<string, number>();
        rows.forEach((s: SeedStockDisplay) => {
          byPv.set(s.plant_variety_id, (byPv.get(s.plant_variety_id) ?? 0) + 1);
        });
        const deduped: VaultCardItem[] = [];
        const seen = new Set<string>();
        for (const s of rows) {
          if (seen.has(s.plant_variety_id)) continue;
          seen.add(s.plant_variety_id);
          const rawRow = (legacyData ?? []).find((r: { plant_variety_id: string }) => r.plant_variety_id === s.plant_variety_id) as { plant_varieties?: { sun?: string; plant_spacing?: string; days_to_germination?: string }; created_at?: string } | undefined;
          const pv = rawRow?.plant_varieties;
          deduped.push({
            id: s.plant_variety_id,
            name: s.name,
            variety: s.variety,
            packet_count: byPv.get(s.plant_variety_id) ?? 1,
            status: s.status,
            harvest_days: s.harvest_days,
            sun: pv?.sun ?? undefined,
            plant_spacing: pv?.plant_spacing ?? undefined,
            days_to_germination: pv?.days_to_germination ?? undefined,
            tags: s.tags,
            volume: s.volume,
            source_url: s.source_url,
            created_at: rawRow?.created_at ?? undefined,
          });
        }
        setSeeds(deduped);
        setLoading(false);
        return;
      }

      // Count all non-deleted packets (including archived) so vault count matches profile page; include purchase_date for sort
      const { data: packets } = await supabase
        .from("seed_packets")
        .select("plant_profile_id, tags, vendor_name, qty_status, purchase_date")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      const countByProfile = new Map<string, number>();
      const sumQtyByProfile = new Map<string, number>();
      const vendorsByProfile = new Map<string, Set<string>>();
      const f1ProfileIds = new Set<string>();
      /** Latest (max) purchase_date per profile for sort by purchase date. */
      const latestPurchaseByProfile = new Map<string, string>();
      for (const p of packets ?? []) {
        const row = p as { plant_profile_id: string; tags?: string[] | null; vendor_name?: string | null; qty_status?: number; purchase_date?: string | null };
        const pid = row.plant_profile_id;
        countByProfile.set(pid, (countByProfile.get(pid) ?? 0) + 1);
        const qty = typeof row.qty_status === "number" ? row.qty_status : 100;
        sumQtyByProfile.set(pid, (sumQtyByProfile.get(pid) ?? 0) + qty);
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
      }

      const { data: packetImages } = await supabase
        .from("seed_packets")
        .select("plant_profile_id, primary_image_path")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .not("primary_image_path", "is", null)
        .order("created_at", { ascending: true });
      const firstPacketImageByProfile = new Map<string, string>();
      for (const row of packetImages ?? []) {
        const pid = (row as { plant_profile_id: string; primary_image_path: string }).plant_profile_id;
        const path = (row as { primary_image_path: string }).primary_image_path;
        if (pid && path?.trim() && !firstPacketImageByProfile.has(pid)) firstPacketImageByProfile.set(pid, path.trim());
      }

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
        return {
          id: pid,
          name: (p.name as string) ?? "Unknown",
          variety: (p.variety_name as string) ?? "—",
          packet_count: count,
          avg_qty_pct,
          status: p.status as string | null,
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
          latest_purchase_date: latestPurchaseByProfile.get(pid) ?? null,
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
  }, [user?.id, refetchTrigger]);

  useEffect(() => {
    setImageErrorIds(new Set());
  }, [refetchTrigger]);

  const filteredIds = useMemo(
    () => filteredSeeds.map((s) => s.id),
    [filteredSeeds]
  );

  useEffect(() => {
    onFilteredIdsChange?.(filteredIds);
  }, [filteredIds, onFilteredIdsChange]);

  useEffect(() => {
    onCategoryChipsLoaded?.(categoryChips);
  }, [categoryChips, onCategoryChipsLoaded]);

  useEffect(() => {
    onRefineChipsLoaded?.(refineChips);
  }, [refineChips, onRefineChipsLoaded]);

  useEffect(() => {
    onVaultStatusChipsLoaded?.(vaultStatusChips);
  }, [vaultStatusChips, onVaultStatusChipsLoaded]);

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
      <div className="flex items-center justify-center py-16 text-black/60">
        Loading…
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
      <div className="rounded-card-lg bg-white p-8 shadow-card border border-black/5 text-center max-w-md mx-auto">
        <div className="flex justify-center mb-4" aria-hidden>
          <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="text-emerald-200" aria-hidden>
            <rect x="10" y="6" width="44" height="52" rx="5" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M10 18h44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M18 28h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <path d="M18 36h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <path d="M32 52v-6c0-2 2-4 4-6 1.5-1.5 1.5-4 0-5.5s-4-1.5-5.5 0c-2 2-4 4-4 6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium mb-2">Your vault is empty</p>
        <p className="text-sm text-slate-500">Tap the + button below to add a packet or scan one with your camera.</p>
      </div>
    );
  }

  if (filteredSeeds.length === 0) {
    return (
      <div className="rounded-card-lg bg-white p-6 shadow-card border border-black/5 text-center max-w-md mx-auto">
        <p className="text-slate-600">
          {q || statusFilter || tagFilters.length > 0 || categoryFilter !== null
            ? "No seeds match your search or filters. Try changing filters or search."
            : "No seeds yet. Tap + to add your first packet."}
        </p>
      </div>
    );
  }

  if (mode === "grid") {
    const isPhotoCards = gridDisplayStyle === "photo";
    /* Tight gap (8px) for both views so cards sit closer like My Garden. */
    const gridClass = isPhotoCards ? "grid-cols-2 gap-2" : "grid-cols-3 gap-2";

    return (
      <div className="relative z-10 space-y-2">
        <ul className={`grid ${gridClass}`} role="list">
          {sortedGridSeeds.map((seed, idx) => {
            const { thumbUrl, showResearching } = getThumbState(seed);
            const showSeedling = !thumbUrl || imageErrorIds.has(seed.id);
            const lp = onLongPressVariety ? getLongPressHandlers(seed.id) : null;
            const varietyPart = (seed.variety && seed.variety !== "—" ? seed.variety : "").trim();
            const firstSegmentOfVariety = varietyPart.split(/\s*[-–—]\s*/)[0]?.trim() ?? "";
            const isSingleWord = firstSegmentOfVariety.indexOf(" ") === -1 && firstSegmentOfVariety.length > 0;
            const binomial = `${seed.name} ${firstSegmentOfVariety}`.trim();
            // Italic only for lowercase species epithets (botanical convention); cultivar/series stay upright
            const isScientific = isSingleWord && firstSegmentOfVariety === firstSegmentOfVariety.toLowerCase() && looksLikeScientificName(binomial);
            const varietyDisplay = formatVarietyForDisplay(seed.variety, isScientific);

            if (isPhotoCards) {
              const cardContent = (
                <>
                  {/* Frame: 8px padding so photo doesn’t go edge-to-edge; consistent bg for placeholder and image */}
                  <div className="p-1 shrink-0">
                    <div className="relative w-full aspect-square bg-neutral-100 overflow-hidden rounded-md">
                      {showResearching ? (
                        <div className="absolute inset-0 animate-pulse bg-neutral-200 flex items-center justify-center">
                          <span className="text-xs font-medium text-neutral-500 px-2 text-center">AI Researching…</span>
                        </div>
                      ) : showSeedling ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-3xl">🌱</div>
                      ) : (
                        <img src={thumbUrl!} alt="" className="absolute inset-0 w-full h-full object-cover object-center" onError={() => markThumbError(seed.id)} />
                      )}
                      {batchSelectMode && onToggleVarietySelection && (
                        <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedVarietyIds?.has(seed.id) ?? false}
                            onChange={() => onToggleVarietySelection(seed.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-black/20 w-5 h-5"
                            aria-label={`Select ${decodeHtmlEntities(seed.name)}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-2 pt-1 pb-1.5 flex flex-col flex-1 min-h-0 items-center text-center min-w-0">
                    <h3 className="font-semibold text-black text-sm leading-tight w-full min-h-[2.25rem] flex items-center justify-center gap-1 min-w-0 mb-0.5">
                      <span className="truncate">{decodeHtmlEntities(seed.name)}</span>
                      <HealthDot seed={seed} size="sm" />
                      <span className="text-[10px] text-black/40 shrink-0" title={`${seed.packet_count} packet${seed.packet_count !== 1 ? "s" : ""}`}>{seed.packet_count}</span>
                    </h3>
                    <div className={`text-[11px] leading-tight text-black/60 w-full min-h-[2rem] line-clamp-2 break-words ${varietyDisplay ? (isScientific ? "italic" : "") : ""}`} title={varietyDisplay || undefined}>{varietyDisplay}</div>
                    <div className="mt-auto pt-1 flex items-center gap-1.5 flex-wrap justify-center min-w-0 w-full">
                      {(seed.packet_count === 0 || seed.status === "out_of_stock") && (
                        <span className="text-[10px] font-medium text-amber-700 shrink-0">Out</span>
                      )}
                      {seed.hasF1Packet && <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">F1</span>}
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
                      className={`rounded-lg bg-white shadow-sm overflow-hidden flex flex-col cursor-pointer border border-black/5 ${selectedVarietyIds?.has(seed.id) ? "ring-2 ring-emerald-500" : ""}`}
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
                      <article className="rounded-lg bg-white shadow-sm overflow-hidden flex flex-col border border-black/5 hover:border-emerald-500/40 transition-colors w-full">
                        {cardContent}
                      </article>
                    </div>
                  )}
                </li>
              );
            }

            /* Condensed: same layout as photo cards (image on top, then name · variety, title, HealthDot + count) but smaller */
            const condensedContent = (
              <>
                <div className="px-1.5 pt-1.5 shrink-0">
                  <div className="relative w-full aspect-square bg-neutral-100 overflow-hidden rounded-md">
                    {showResearching ? (
                      <div className="absolute inset-0 animate-pulse bg-neutral-200 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-neutral-500 px-1 text-center">AI…</span>
                      </div>
                    ) : showSeedling ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-xl">🌱</div>
                    ) : (
                      <img src={thumbUrl!} alt="" className="absolute inset-0 w-full h-full object-cover object-center" onError={() => markThumbError(seed.id)} />
                    )}
                    {batchSelectMode && onToggleVarietySelection && (
                      <div className="absolute top-1 left-1 z-10" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedVarietyIds?.has(seed.id) ?? false} onChange={() => onToggleVarietySelection(seed.id)} onClick={(e) => e.stopPropagation()} className="rounded border-black/20 w-4 h-4" aria-label={`Select ${decodeHtmlEntities(seed.name)}`} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-1.5 pt-1 pb-1 flex flex-col flex-1 min-h-0 items-center text-center min-w-0">
                  <h3 className="font-semibold text-black text-xs leading-tight w-full min-h-[2rem] flex items-center justify-center gap-1 min-w-0 mb-px">
                    <span className="truncate">{decodeHtmlEntities(seed.name)}</span>
                    <HealthDot seed={seed} size="sm" />
                    <span className="text-[9px] text-black/40 shrink-0" title={`${seed.packet_count} packet${seed.packet_count !== 1 ? "s" : ""}`}>{seed.packet_count}</span>
                  </h3>
                  <div className={`text-[10px] leading-tight text-black/60 w-full min-h-[1.75rem] line-clamp-2 break-words ${varietyDisplay ? (isScientific ? "italic" : "") : ""}`} title={varietyDisplay || undefined}>{varietyDisplay}</div>
                  <div className="mt-auto pt-0.5 flex items-center gap-1 flex-wrap justify-center min-w-0 w-full">
                    {(seed.packet_count === 0 || seed.status === "out_of_stock") && (
                      <span className="text-[9px] font-medium text-amber-700 shrink-0">Out</span>
                    )}
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
                    className={`rounded-lg bg-white shadow-card overflow-hidden flex flex-col cursor-pointer border border-black/5 ${selectedVarietyIds?.has(seed.id) ? "ring-2 ring-emerald-500" : ""} ${getCardBorderClass(seed)}`}
                  >
                    {condensedContent}
                  </article>
                ) : (
                  <div
                    role="link"
                    tabIndex={0}
                    className="block cursor-pointer"
                    onClick={lp ? () => lp.handleClick() : () => goToProfile(seed.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToProfile(seed.id); } }}
                    {...(lp ? { onTouchStart: lp.onTouchStart, onTouchMove: lp.onTouchMove, onTouchEnd: lp.onTouchEnd, onTouchCancel: lp.onTouchCancel } : {})}
                  >
                    <article className={`rounded-lg bg-white shadow-card overflow-hidden flex flex-col border border-black/5 hover:border-emerald-500/40 transition-colors w-full ${getCardBorderClass(seed)}`}>
                      {condensedContent}
                    </article>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  function formatGermination(val: string | null | undefined): string {
    if (!val || !String(val).trim()) return "";
    const s = String(val).trim();
    if (/\d+\s*d/i.test(s)) return s.replace(/\s*d\b/i, " d").slice(0, 12);
    return s.slice(0, 12);
  }

  function formatMaturity(days: number | null | undefined): string {
    if (days == null || !Number.isFinite(days)) return "";
    return `${days} d`;
  }

  const renderHeader = (colId: ListDataColumnId) => {
    const w = listColumnWidths[colId] ?? DEFAULT_LIST_COLUMN_WIDTHS[colId];
    const isDragging = draggedColId === colId;
    const label =
      colId === "name" ? "Plant Type" : colId === "variety" ? "Variety" : colId === "vendor" ? "Vendor" : colId === "sun" ? "Sun" : colId === "spacing" ? "Spacing" : colId === "germination" ? "Germination" : colId === "maturity" ? "Maturity" : "Pkts";
    const content =
      colId === "name" ? (
        <div className="relative flex items-center gap-1" ref={plantFilterRef}>
          <button type="button" onClick={() => handleListSort("name")} className="inline-flex items-center hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded">
            Plant Type
            <SortArrowIcon dir={listSortColumn === "name" ? listSortDir : "off"} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPlantFilterOpen((o) => {
                if (!o) setPlantFilterSearch("");
                return !o;
              });
            }}
            className={`p-0.5 rounded hover:bg-neutral-200 ${plantTypeFilter ? "text-emerald-600" : "text-neutral-400"}`}
            aria-label="Filter by plant type"
            aria-expanded={plantFilterOpen}
          >
            <FilterIcon />
          </button>
          {plantFilterOpen && (
            <div className="absolute left-0 top-full mt-1 py-1 min-w-[160px] max-h-[280px] overflow-hidden flex flex-col bg-white border border-neutral-200 rounded-lg shadow-lg z-30">
              <input type="text" value={plantFilterSearch} onChange={(e) => setPlantFilterSearch(e.target.value)} placeholder="Search categories…" className="mx-2 mb-1 px-2 py-1.5 text-sm border border-neutral-200 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              <div className="overflow-y-auto max-h-[200px]">
                <button type="button" onClick={() => { setPlantTypeFilter(null); setPlantFilterOpen(false); }} className={`block w-full text-left px-3 py-1.5 text-sm ${plantTypeFilter === null ? "bg-emerald/10 font-medium text-emerald-800" : "text-neutral-700 hover:bg-neutral-50"}`}>All</button>
                {filteredPlantNames.map((name) => (
                  <button key={name} type="button" onClick={() => { setPlantTypeFilter(name); setPlantFilterOpen(false); }} className={`block w-full text-left px-3 py-1.5 text-sm truncate ${plantTypeFilter === name ? "bg-emerald/10 font-medium text-emerald-800" : "text-neutral-700 hover:bg-neutral-50"}`}>{name}</button>
                ))}
                {filteredPlantNames.length === 0 && plantFilterSearch.trim() && <p className="px-3 py-2 text-xs text-neutral-500">No match</p>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => handleListSort(colId)} className="inline-flex items-center hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded">
          {label}
          <SortArrowIcon dir={listSortColumn === colId ? listSortDir : "off"} />
        </button>
      );
    return (
      <th
        key={colId}
        scope="col"
        style={{ width: w, minWidth: 60 }}
        className={`text-left py-2.5 px-3 font-medium text-neutral-600 whitespace-nowrap bg-white select-none relative group ${isDragging ? "opacity-50" : ""}`}
        draggable
        onDragStart={(e) => { setDraggedColId(colId); e.dataTransfer.setData("text/plain", colId); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => { setDraggedColId(null); dragOverColIdRef.current = null; }}
        onDragOver={(e) => { e.preventDefault(); if (draggedColId && draggedColId !== colId) dragOverColIdRef.current = colId; }}
        onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain"); if (from) handleColumnReorder(from, colId); dragOverColIdRef.current = null; }}
      >
        {content}
        <div
          role="separator"
          aria-orientation="vertical"
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-400/50 active:bg-emerald-500 shrink-0"
          onMouseDown={(e) => { e.preventDefault(); handleResizeStart(colId, e); }}
          title="Drag to resize column"
        />
      </th>
    );
  };

  const renderCell = (colId: ListDataColumnId, seed: VaultCardItem) => {
    switch (colId) {
      case "name":
        return <td key="name" className="py-2 px-3 align-middle text-neutral-900">{decodeHtmlEntities(seed.name)}</td>;
      case "variety":
        return (
          <td key="variety" className="py-2 px-3 align-middle font-semibold text-neutral-900">
            <span className="inline-flex items-center gap-1.5 flex-wrap">
              {decodeHtmlEntities(seed.variety)}
              {seed.hasF1Packet && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">F1</span>}
            </span>
          </td>
        );
      case "vendor":
        return <td key="vendor" className="py-2 px-3 align-middle text-neutral-700 truncate" title={seed.vendor_display ?? ""}>{seed.vendor_display?.trim() || "—"}</td>;
      case "sun":
        return <td key="sun" className="py-2 px-3 align-middle text-neutral-700">{seed.sun?.trim() || ""}</td>;
      case "spacing":
        return <td key="spacing" className="py-2 px-3 align-middle text-neutral-700">{seed.plant_spacing?.trim() || ""}</td>;
      case "germination":
        return <td key="germination" className="py-2 px-3 align-middle text-neutral-700">{formatGermination(seed.days_to_germination)}</td>;
      case "maturity":
        return <td key="maturity" className="py-2 px-3 align-middle text-neutral-700">{formatMaturity(seed.harvest_days)}</td>;
      case "pkts":
        return (
          <td key="pkts" className="py-2 px-3 align-middle">
            <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded text-xs font-medium bg-black/10 text-neutral-800">{seed.packet_count}</span>
            {(seed.packet_count === 0 || seed.status === "out_of_stock") && <span className="ml-1.5 text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Out of Stock</span>}
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative z-10 space-y-2">
      {/* Compact list for small screens (no horizontal scroll) */}
      <div className="sm:hidden rounded-xl border border-black/10 bg-white overflow-hidden">
        <ul className="divide-y divide-black/5" role="list">
          {sortedListSeeds.map((seed) => {
            const lp = onLongPressVariety ? getLongPressHandlers(seed.id) : null;
            const { thumbUrl, showResearching } = getThumbState(seed);
            const showSeedling = !thumbUrl || imageErrorIds.has(seed.id);
            return (
              <li key={seed.id}>
                <button
                  type="button"
                  onClick={() => batchSelectMode ? onToggleVarietySelection?.(seed.id) : (lp ? lp.handleClick() : goToProfile(seed.id))}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left min-h-[44px] hover:bg-gray-50 transition-colors ${batchSelectMode && selectedVarietyIds?.has(seed.id) ? "bg-emerald/5" : ""}`}
                  {...(lp && !batchSelectMode ? { onTouchStart: lp.onTouchStart, onTouchMove: lp.onTouchMove, onTouchEnd: lp.onTouchEnd, onTouchCancel: lp.onTouchCancel } : {})}
                >
                  {batchSelectMode && onToggleVarietySelection && (
                    <span className="shrink-0 flex items-center min-w-[44px] min-h-[44px] justify-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedVarietyIds?.has(seed.id) ?? false} onChange={() => onToggleVarietySelection(seed.id)} onClick={(e) => e.stopPropagation()} className="rounded border-black/20 w-5 h-5" aria-label={`Select ${decodeHtmlEntities(seed.name)}`} />
                    </span>
                  )}
                  <span className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 flex items-center justify-center">
                    {showResearching ? (
                      <span className="text-[9px] font-medium text-neutral-500">🔍</span>
                    ) : showSeedling ? (
                      <span className="text-lg">🌱</span>
                    ) : (
                      <img src={thumbUrl!} alt="" className="w-full h-full object-cover" onError={() => markThumbError(seed.id)} />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-neutral-900 truncate">{decodeHtmlEntities(seed.name)}</span>
                    <span className="block text-sm text-neutral-600 truncate">{decodeHtmlEntities(seed.variety)}</span>
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded text-xs font-medium bg-black/10 text-neutral-800">{seed.packet_count}</span>
                    {(seed.packet_count === 0 || seed.status === "out_of_stock") && <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Out</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {/* Full table for sm and up */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-black/10 bg-white">
      <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed", minWidth: (batchSelectMode ? 40 : 0) + 44 + listColumnOrder.reduce((s, id) => s + (listColumnWidths[id] ?? DEFAULT_LIST_COLUMN_WIDTHS[id]), 0) }}>
        <colgroup>
          {batchSelectMode && <col style={{ width: 40 }} />}
          <col style={{ width: 44 }} />
          {listColumnOrder.map((id) => (
            <col key={id} style={{ width: listColumnWidths[id] ?? DEFAULT_LIST_COLUMN_WIDTHS[id] }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-black/10 bg-white shadow-sm sticky top-0 z-20">
            {batchSelectMode && onToggleVarietySelection && (
              <th className="text-left py-2.5 px-3 w-10 bg-white" scope="col"><span className="sr-only">Select</span></th>
            )}
            <th className="text-left py-2.5 px-3 w-10 bg-white shrink-0" scope="col"><span className="sr-only">Icon</span></th>
            {listColumnOrder.map((id) => renderHeader(id))}
          </tr>
        </thead>
        <tbody>
          {sortedListSeeds.map((seed) => {
            const lp = onLongPressVariety ? getLongPressHandlers(seed.id) : null;
            return (
            <tr
              key={seed.id}
              role="button"
              tabIndex={0}
              onClick={() => batchSelectMode ? onToggleVarietySelection?.(seed.id) : (lp ? lp.handleClick() : goToProfile(seed.id))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); batchSelectMode ? onToggleVarietySelection?.(seed.id) : goToProfile(seed.id); } }}
              className={`group border-b border-black/5 hover:bg-gray-50 cursor-pointer transition-colors ${batchSelectMode && selectedVarietyIds?.has(seed.id) ? "bg-emerald/5" : ""}`}
              {...(lp && !batchSelectMode ? { onTouchStart: lp.onTouchStart, onTouchMove: lp.onTouchMove, onTouchEnd: lp.onTouchEnd, onTouchCancel: lp.onTouchCancel } : {})}
            >
              {batchSelectMode && onToggleVarietySelection && (
                <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedVarietyIds?.has(seed.id) ?? false} onChange={() => onToggleVarietySelection(seed.id)} onClick={(e) => e.stopPropagation()} className="rounded border-black/20" aria-label={`Select ${decodeHtmlEntities(seed.name)}`} />
                </td>
              )}
              <td className="py-2 px-3 align-middle shrink-0">
                {(() => {
                  const { thumbUrl, showResearching } = getThumbState(seed);
                  const showSeedling = !thumbUrl || imageErrorIds.has(seed.id);
                  return showResearching ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-200 shrink-0 flex items-center justify-center relative" title="Gemini is researching a photo for this variety">
                      <div className="absolute inset-0 animate-pulse bg-neutral-200" aria-hidden />
                      <span className="text-[9px] font-medium text-neutral-500 z-10">🔍</span>
                    </div>
                  ) : showSeedling ? (
                    <div className="w-10 h-10 rounded-lg bg-emerald/10 flex items-center justify-center text-lg shrink-0">🌱</div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 shrink-0 flex items-center justify-center">
                      <img src={thumbUrl!} alt="" className="w-full h-full object-cover" onError={() => markThumbError(seed.id)} />
                    </div>
                  );
                })()}
              </td>
              {listColumnOrder.map((id) => renderCell(id, seed))}
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
