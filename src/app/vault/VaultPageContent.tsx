"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { StatusFilter, VaultSortBy, PacketStatusFilter } from "@/types/vault";

const SeedVaultView = dynamic(
  () => import("@/components/SeedVaultView").then((m) => ({ default: m.SeedVaultView })),
  { ssr: false, loading: () => <div className="min-h-[200px] flex items-center justify-center text-neutral-500">Loading…</div> }
);

const PacketVaultLazy = dynamic(
  () => import("./PacketVaultLazy").then((m) => ({ default: m.PacketVaultLazy })),
  { ssr: false, loading: () => <div className="min-h-[200px] flex items-center justify-center text-neutral-500">Loading packets…</div> }
);

const ShedView = dynamic(
  () => import("@/components/ShedView").then((m) => ({ default: m.ShedView })),
  { ssr: false, loading: () => <div className="min-h-[200px] flex items-center justify-center text-neutral-500">Loading shed…</div> }
);
/** Lazy-load modals so vault initial render never pulls zone10b/BatchAddSeed chunk. */
const SupplyPicker = dynamic(
  () => import("@/components/SupplyPicker").then((m) => ({ default: m.SupplyPicker })),
  { ssr: false }
);
const QuickAddSeed = dynamic(
  () => import("@/components/QuickAddSeed").then((m) => ({ default: m.QuickAddSeed })),
  { ssr: false }
);
const QuickAddSupply = dynamic(
  () => import("@/components/QuickAddSupply").then((m) => ({ default: m.QuickAddSupply })),
  { ssr: false }
);
const BatchAddSupply = dynamic(
  () => import("@/components/BatchAddSupply").then((m) => ({ default: m.BatchAddSupply })),
  { ssr: false }
);
const PurchaseOrderImport = dynamic(
  () => import("@/components/PurchaseOrderImport").then((m) => ({ default: m.PurchaseOrderImport })),
  { ssr: false }
);

const BatchAddSeed = dynamic(
  () => import("@/components/BatchAddSeed").then((m) => ({ default: m.BatchAddSeed })),
  { ssr: false }
);
const UniversalAddMenu = dynamic(
  () => import("@/components/UniversalAddMenu").then((m) => ({ default: m.UniversalAddMenu })),
  { ssr: false }
);
const NewTaskModal = dynamic(
  () => import("@/components/NewTaskModal").then((m) => ({ default: m.NewTaskModal })),
  { ssr: false }
);
const AddPlantModal = dynamic(
  () => import("@/components/AddPlantModal").then((m) => ({ default: m.AddPlantModal })),
  { ssr: false }
);
import { parseSeedFromQR, type SeedQRPrefill } from "@/lib/parseSeedFromQR";

const QRScannerModal = dynamic(
  () => import("@/components/QRScannerModal").then((m) => ({ default: m.QRScannerModal })),
  { ssr: false }
);
import { supabase } from "@/lib/supabase";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { useAuth } from "@/contexts/AuthContext";
import { getTagStyle } from "@/components/TagBadges";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { hasPendingReviewData, clearReviewImportData } from "@/lib/reviewImportStorage";
import { compressImage } from "@/lib/compressImage";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { useFilterState } from "@/hooks/useFilterState";
import {
  loadFilterDefault,
  saveFilterDefault,
  clearFilterDefault,
  hasFilterDefault,
  FILTER_DEFAULT_KEYS,
} from "@/lib/filterDefaults";
/** Minimal sow-month check without loading zone10b (avoids init error). */
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
/** Simple sowing window display (planting_window or empty). */
function getSowingWindowLabelSimple(p: { planting_window?: string | null }): string | null {
  return p.planting_window?.trim() || null;
}
import { cascadeAllForDeletedProfiles } from "@/lib/cascadeOnProfileDelete";
import {
  shouldClearFiltersOnMount,
  clearVaultFilters,
  getNavSection,
  setLastNavSection,
} from "@/lib/navSectionClear";

const SAVE_TOAST_DURATION_MS = 5000;

function ShovelIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {/* Handle */}
      <path d="M12 2v9" />
      {/* Blade (spade head) */}
      <path d="M12 11 8 11 5 22h14l-3-11H12z" />
    </svg>
  );
}
function Trash2Icon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function MergeIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M8 6h3v3H8z" />
      <path d="M13 6h3v3h-3z" />
      <path d="M10.5 12v6M8 15h5" />
    </svg>
  );
}
function ShoppingListIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
/** Photo cards = image-dominant 2-col grid (4 quadrants). */
function PhotoCardsGridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
/** Condensed = denser 3-col grid (6 cells). */
function CondensedGridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9.5" y="2" width="5" height="5" />
      <rect x="17" y="2" width="5" height="5" />
      <rect x="2" y="9.5" width="5" height="5" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <rect x="17" y="9.5" width="5" height="5" />
    </svg>
  );
}

function getInitialViewMode(searchParams: URLSearchParams | null): "grid" | "list" | "shed" {
  if (!searchParams) return "grid";
  const sow = searchParams.get("sow");
  if (sow && /^\d{4}-\d{2}$/.test(sow)) return "grid";
  const tab = searchParams.get("tab");
  if (tab === "list" || tab === "table") return "list";
  if (tab === "shed") return "shed";
  if (tab === "grid") return "grid";
  if (tab === "active" || tab === "plants") return "grid";
  return "grid";
}

function VaultPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list" | "shed">(() => getInitialViewMode(searchParams));
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [shedQuickAddOpen, setShedQuickAddOpen] = useState(false);
  const [batchAddSupplyOpen, setBatchAddSupplyOpen] = useState(false);
  const [universalAddMenuOpen, setUniversalAddMenuOpen] = useState(false);
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [addPlantDefaultType, setAddPlantDefaultType] = useState<"permanent" | "seasonal">("seasonal");
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [batchAddOpen, setBatchAddOpen] = useState(false);
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  const [purchaseOrderMode, setPurchaseOrderMode] = useState<"seed" | "supply">("seed");
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);

  const [qrPrefill, setQrPrefill] = useState<SeedQRPrefill | null>(null);
  const anyModalOpen = quickAddOpen || batchAddOpen || scannerOpen || purchaseOrderOpen || shedQuickAddOpen || batchAddSupplyOpen || universalAddMenuOpen || showAddPlantModal || newTaskModalOpen;
  const skipPopOnNavigateRef = useRef(false);
  useModalBackClose(anyModalOpen, useCallback(() => {
    setQuickAddOpen(false);
    setQrPrefill(null);
    setBatchAddOpen(false);
    setPurchaseOrderOpen(false);
    setShedQuickAddOpen(false);
    setBatchAddSupplyOpen(false);
    setUniversalAddMenuOpen(false);
    setShowAddPlantModal(false);
    setNewTaskModalOpen(false);
    setScannerOpen(false);
  }, []), skipPopOnNavigateRef);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [selectedVarietyIds, setSelectedVarietyIds] = useState<Set<string>>(new Set());
  const [filteredVarietyIds, setFilteredVarietyIds] = useState<string[]>([]);
  const [filteredPacketCount, setFilteredPacketCount] = useState(0);
  const [vaultHasSeeds, setVaultHasSeeds] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [pendingHeroCount, setPendingHeroCount] = useState(0);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeMasterId, setMergeMasterId] = useState<string | null>(null);
  const [mergeProfiles, setMergeProfiles] = useState<{ id: string; name: string; variety_name: string | null; packet_count?: number }[]>([]);
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleConfirming, setScheduleConfirming] = useState(false);
  const [plantModalOpen, setPlantModalOpen] = useState(false);
  const [plantConfirming, setPlantConfirming] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const [availablePlantTypes, setAvailablePlantTypes] = useState<string[]>([]);
  const [hasPendingReview, setHasPendingReview] = useState(false);
  const [gridDisplayStyle, setGridDisplayStyle] = useState<"photo" | "condensed">("condensed");
  const [refineByOpen, setRefineByOpen] = useState(false);
  const [refineBySection, setRefineBySection] = useState<"sort" | "vault" | "tags" | "plantType" | "sowingMonth" | "variety" | "vendor" | "sun" | "spacing" | "germination" | "maturity" | "packetCount" | "packetVendor" | "packetSow" | null>(null);
  const [sortBy, setSortBy] = useState<VaultSortBy>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectionActionsOpen, setSelectionActionsOpen] = useState(false);
  const [shedSearchQuery, setShedSearchQuery] = useState("");
  const [shedCategoryFilter, setShedCategoryFilter] = useState<string | null>(() => {
    const loaded = loadFilterDefault<string>(FILTER_DEFAULT_KEYS.vaultShed);
    if (typeof loaded === "string" && ["fertilizer", "pesticide", "soil_amendment", "other"].includes(loaded)) return loaded;
    return null;
  });
  const [shedHasDefault, setShedHasDefault] = useState(() => hasFilterDefault(FILTER_DEFAULT_KEYS.vaultShed));
  const [shedBatchSelectMode, setShedBatchSelectMode] = useState(false);
  const [selectedSupplyIds, setSelectedSupplyIds] = useState<Set<string>>(new Set());
  const [shedFilterOpen, setShedFilterOpen] = useState(false);
  const [shedDisplayStyle, setShedDisplayStyle] = useState<"grid" | "list">("list");
  const [shedBatchDeleting, setShedBatchDeleting] = useState(false);
  const [filteredSupplyIds, setFilteredSupplyIds] = useState<string[]>([]);
  const [shedSelectionActionsOpen, setShedSelectionActionsOpen] = useState(false);
  const [categoryChips, setCategoryChips] = useState<{ type: string; count: number }[]>([]);
  const [sowingMonthChips, setSowingMonthChips] = useState<{ month: number; monthName: string; count: number }[]>([]);
  const [refineChips, setRefineChips] = useState<{
    variety: { value: string; count: number }[];
    vendor: { value: string; count: number }[];
    sun: { value: string; count: number }[];
    spacing: { value: string; count: number }[];
    germination: { value: string; count: number }[];
    maturity: { value: string; count: number }[];
    packetCount: { value: string; count: number }[];
  }>({ variety: [], vendor: [], sun: [], spacing: [], germination: [], maturity: [], packetCount: [] });
  const [vaultStatusChips, setVaultStatusChips] = useState<{ value: StatusFilter; label: string; count: number }[]>([]);

  // Packet Vault (Seed Vault tab) — separate filters, tab-specific
  type PacketFilterDefault = { status: string; vendor: string | null; sowMonth: string | null; sortBy: string; sortDirection: string };
  const [packetSearchQuery, setPacketSearchQuery] = useState("");
  const [packetStatusFilter, setPacketStatusFilter] = useState<PacketStatusFilter>("");
  const [packetVendorFilter, setPacketVendorFilter] = useState<string | null>(null);
  const [packetSortBy, setPacketSortBy] = useState<"date" | "variety" | "vendor" | "qty" | "rating">("date");
  const [packetSortDirection, setPacketSortDirection] = useState<"asc" | "desc">("desc");
  const [packetSowMonth, setPacketSowMonth] = useState<string | null>(null);
  const [packetHasDefault, setPacketHasDefault] = useState(() => hasFilterDefault(FILTER_DEFAULT_KEYS.vaultPackets));
  const [packetStatusChips, setPacketStatusChips] = useState<{ value: PacketStatusFilter; label: string; count: number }[]>([]);
  const [packetVendorChips, setPacketVendorChips] = useState<{ value: string; count: number }[]>([]);

  const sowParam = searchParams.get("sow");
  const hasPacketActiveFilters = packetStatusFilter !== "" || packetVendorFilter !== null || (packetSowMonth != null && /^\d{4}-\d{2}$/.test(packetSowMonth));
  const clearPacketFilters = useCallback(() => {
    setPacketStatusFilter("");
    setPacketVendorFilter(null);
    setPacketSowMonth(null);
  }, []);
  const vaultFilters = useFilterState({
    schema: "vault",
    onClear: useCallback(() => {
      if (sowParam && /^\d{4}-\d{2}$/.test(sowParam)) router.replace("/vault", { scroll: false });
    }, [sowParam, router]),
    isFilterActive: useCallback(() => !!(sowParam && /^\d{4}-\d{2}$/.test(sowParam)), [sowParam]),
    storageKey: FILTER_DEFAULT_KEYS.vaultProfiles,
  });

  useEffect(() => { setHasPendingReview(hasPendingReviewData()); }, [refetchTrigger]);

  // Load packet filter defaults on mount
  useEffect(() => {
    const loaded = loadFilterDefault<PacketFilterDefault>(FILTER_DEFAULT_KEYS.vaultPackets);
    if (!loaded || typeof loaded !== "object") return;
    const status = typeof loaded.status === "string" ? (loaded.status as PacketStatusFilter) : "";
    const vendor = typeof loaded.vendor === "string" ? loaded.vendor : loaded.vendor === null ? null : null;
    const sowMonth = typeof loaded.sowMonth === "string" && /^\d{4}-\d{2}$/.test(loaded.sowMonth) ? loaded.sowMonth : null;
    const sortBy = ["date", "variety", "vendor", "qty", "rating"].includes(loaded.sortBy) ? loaded.sortBy as "date" | "variety" | "vendor" | "qty" | "rating" : "date";
    const sortDirection = loaded.sortDirection === "asc" || loaded.sortDirection === "desc" ? loaded.sortDirection : "desc";
    setPacketStatusFilter(status);
    setPacketVendorFilter(vendor);
    setPacketSowMonth(sowMonth);
    setPacketSortBy(sortBy);
    setPacketSortDirection(sortDirection);
  }, []);

  const shedCategoryFromUrl = searchParams.get("category");
  useEffect(() => {
    if (viewMode === "shed" && shedCategoryFromUrl && ["fertilizer", "pesticide", "soil_amendment", "other"].includes(shedCategoryFromUrl)) {
      setShedCategoryFilter(shedCategoryFromUrl);
    }
  }, [viewMode, shedCategoryFromUrl]);

  const handleVaultStatusChipsLoaded = useCallback((chips: { value: StatusFilter; label: string; count: number }[]) => {
    setVaultStatusChips(chips);
  }, []);
  const handleCategoryChipsLoaded = useCallback((chips: { type: string; count: number }[]) => {
    setCategoryChips(chips);
  }, []);
  const handleSowingMonthChipsLoaded = useCallback((chips: { month: number; monthName: string; count: number }[]) => {
    setSowingMonthChips(chips);
  }, []);
  const handleRefineChipsLoaded = useCallback((chips: {
    variety: { value: string; count: number }[];
    vendor: { value: string; count: number }[];
    sun: { value: string; count: number }[];
    spacing: { value: string; count: number }[];
    germination: { value: string; count: number }[];
    maturity: { value: string; count: number }[];
    packetCount: { value: string; count: number }[];
  }) => {
    setRefineChips(chips);
  }, []);
  const handleTagsLoaded = useCallback((tags: string[]) => {
    setAvailableTags(tags);
    vaultFilters.setTags((prev) => prev.filter((t) => tags.includes(t)));
  }, [vaultFilters.setTags]);

  useEffect(() => {
    const el = stickyHeaderRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStickyHeaderHeight(el.offsetHeight));
    ro.observe(el);
    setStickyHeaderHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [viewMode, batchSelectMode, availableTags.length, vaultFilters.filters.tags.length]);

  useEffect(() => {
    if (!tagDropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (tagDropdownRef.current?.contains(e.target as Node)) return;
      setTagDropdownOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [tagDropdownOpen]);

  // Load plant type options for list-view dropdown (distinct first-words from plant_profiles + common)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase.from("plant_profiles").select("name").eq("user_id", user.id).is("deleted_at", null);
      const fromProfiles = (data ?? [])
        .map((r: { name?: string }) => (r.name ?? "").trim().split(/\s+/)[0]?.trim())
        .filter(Boolean);
      const common = ["Imported seed", "Bean", "Cucumber", "Tomato", "Pepper", "Lettuce", "Squash", "Pea", "Carrot", "Basil"];
      setAvailablePlantTypes(Array.from(new Set([...common, ...fromProfiles])).sort((a, b) => a.localeCompare(b)));
    })();
  }, [user?.id, refetchTrigger]);

  const handlePlantTypeChange = useCallback(async (profileId: string, newName: string) => {
    if (!user?.id || !newName.trim()) return;
    const { error } = await supabase.from("plant_profiles").update({ name: newName.trim(), updated_at: new Date().toISOString() }).eq("id", profileId).eq("user_id", user.id);
    if (error) setSaveToastMessage(`Could not update: ${error.message}`);
    else setRefetchTrigger((t) => t + 1);
  }, [user?.id]);

  // When landing on vault after a profile delete, refetch list and clean URL
  useEffect(() => {
    if (searchParams.get("deleted") === "1") {
      setRefetchTrigger((t) => t + 1);
      router.replace("/vault", { scroll: false });
    }
  }, [searchParams, router]);

  // When landing after adding packets from Import Review, force refetch so new packet shows
  useEffect(() => {
    if (searchParams.get("added") === "1") {
      setRefetchTrigger((t) => t + 1);
      router.replace("/vault?status=vault", { scroll: false });
    }
  }, [searchParams, router]);

  // Open Quick Add when linked from home "Add a variety I don't have"
  useEffect(() => {
    if (searchParams.get("open") === "quickadd") {
      setQuickAddOpen(true);
      router.replace("/vault", { scroll: false });
    }
  }, [searchParams, router]);

  // Sync tab from URL (e.g. /vault?tab=active after planting) and refetch so new plantings show
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "grid" || tab === "list" || tab === "shed") {
      setViewMode(tab);
    } else if (tab === "table") {
      setViewMode("list");
    } else if (tab === "active" || tab === "plants") {
      // Legacy tab values — fall back to Plant Profiles (grid) and refresh
      setViewMode("grid");
      if (tab === "active") setRefetchTrigger((t) => t + 1);
    }
    const status = searchParams.get("status");
    if (status === "vault" || status === "active" || status === "low_inventory" || status === "archived") {
      vaultFilters.setStatus(status);
      if (searchParams.get("added") === "1") setSaveToastMessage("Added to Vault!");
    }
    const sow = searchParams.get("sow");
    if (sow) {
      setViewMode("grid");
      vaultFilters.setStatus("vault");
    }
  }, [searchParams, vaultFilters.setStatus]);

  // Clear filters when arriving from a different section (must run before restore effects)
  const hasRestoredSession = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;
    if (searchParams.get("tab") || searchParams.get("status") || searchParams.get("sow")) return;
    if (shouldClearFiltersOnMount(pathname)) {
      clearVaultFilters();
      hasRestoredSession.current = true;
    }
  }, [pathname, searchParams]);

  // Restore packet filters from sessionStorage (tab-specific, always restore)
  const packetFiltersRestoredRef = useRef(false);
  useEffect(() => {
    if (packetFiltersRestoredRef.current || typeof window === "undefined") return;
    packetFiltersRestoredRef.current = true;
    try {
      const savedPacketSearch = sessionStorage.getItem("packet-vault-search");
      if (typeof savedPacketSearch === "string") setPacketSearchQuery(savedPacketSearch);
      const savedPacketStatus = sessionStorage.getItem("packet-vault-status");
      if (savedPacketStatus === "vault" || savedPacketStatus === "active" || savedPacketStatus === "low_inventory" || savedPacketStatus === "archived") setPacketStatusFilter(savedPacketStatus);
      const savedPacketVendor = sessionStorage.getItem("packet-vault-vendor");
      if (savedPacketVendor) setPacketVendorFilter(savedPacketVendor);
      const savedPacketSow = sessionStorage.getItem("packet-vault-sow");
      if (savedPacketSow && /^\d{4}-\d{2}$/.test(savedPacketSow)) setPacketSowMonth(savedPacketSow);
      const savedPacketSort = sessionStorage.getItem("packet-vault-sort");
      if (savedPacketSort) {
        try {
          const { sortBy: sb, sortDirection: sd } = JSON.parse(savedPacketSort) as { sortBy?: string; sortDirection?: "asc" | "desc" };
          if (["date", "variety", "vendor", "qty", "rating"].includes(sb ?? "")) setPacketSortBy(sb as "date" | "variety" | "vendor" | "qty" | "rating");
          if (sd === "asc" || sd === "desc") setPacketSortDirection(sd);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Restore view/filter/search from sessionStorage when no URL params (cross-session continuity)
  useEffect(() => {
    if (hasRestoredSession.current || typeof window === "undefined") return;
    if (searchParams.get("tab") || searchParams.get("status") || searchParams.get("sow")) return;
    hasRestoredSession.current = true;
    try {
      const savedView = sessionStorage.getItem("vault-view-mode");
      if (savedView === "grid" || savedView === "list" || savedView === "shed") setViewMode(savedView);
      else if (savedView === "table") setViewMode("list");
      // Legacy values ("active", "plants") fall back to the default "grid" (Plant Profiles)
      const savedGridStyle = sessionStorage.getItem("vault-grid-style");
      if (savedGridStyle === "photo" || savedGridStyle === "condensed") setGridDisplayStyle(savedGridStyle);
      else if (savedGridStyle === "gallery") setGridDisplayStyle("photo"); // migrate away from removed gallery view
      const savedShedStyle = sessionStorage.getItem("vault-shed-display-style");
      if (savedShedStyle === "grid" || savedShedStyle === "list") setShedDisplayStyle(savedShedStyle);
      const savedStatus = sessionStorage.getItem("vault-status-filter");
      // Restore only explicit non-default filters; treat "" and legacy "vault" (In storage) as All
      if (savedStatus === "active" || savedStatus === "low_inventory" || savedStatus === "archived") vaultFilters.setStatus(savedStatus);
      const savedSearch = sessionStorage.getItem("vault-search");
      if (typeof savedSearch === "string") setSearchQuery(savedSearch);
      const loadedSort = vaultFilters.loadedSort;
      if (loadedSort && ["purchase_date", "name", "date_added", "variety", "packet_count"].includes(loadedSort.sortBy)) {
        setSortBy(loadedSort.sortBy as VaultSortBy);
        setSortDirection(loadedSort.sortDir);
      } else {
        const savedSort = sessionStorage.getItem("vault-sort");
        if (savedSort) {
          try {
            const { sortBy: sb, sortDirection: sd } = JSON.parse(savedSort) as { sortBy?: string; sortDirection?: "asc" | "desc" };
            if (sb === "purchase_date" || sb === "name" || sb === "date_added" || sb === "variety" || sb === "packet_count") setSortBy(sb);
            if (sd === "asc" || sd === "desc") setSortDirection(sd);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, [searchParams, vaultFilters.setStatus, vaultFilters.loadedSort]);

  useEffect(() => {
    if (pathname) setLastNavSection(getNavSection(pathname));
  }, [pathname]);

  // Persist view mode, status filter, and search to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("vault-view-mode", viewMode);
      sessionStorage.setItem("vault-status-filter", vaultFilters.filters.status);
    } catch {
      /* ignore */
    }
  }, [viewMode, vaultFilters.filters.status]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("vault-grid-style", gridDisplayStyle);
    } catch {
      /* ignore */
    }
  }, [gridDisplayStyle]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("vault-shed-display-style", shedDisplayStyle);
    } catch {
      /* ignore */
    }
  }, [shedDisplayStyle]);
  // Restore shed display style on mount (runs even when tab=shed in URL, unlike hasRestoredSession)
  const shedStyleRestoredRef = useRef(false);
  useEffect(() => {
    if (shedStyleRestoredRef.current || typeof window === "undefined") return;
    shedStyleRestoredRef.current = true;
    try {
      const saved = sessionStorage.getItem("vault-shed-display-style");
      if (saved === "grid" || saved === "list") setShedDisplayStyle(saved);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("vault-search", searchQuery);
    } catch {
      /* ignore */
    }
  }, [searchQuery]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("vault-sort", JSON.stringify({ sortBy, sortDirection }));
    } catch {
      /* ignore */
    }
  }, [sortBy, sortDirection]);
  // Packet vault filters — separate persistence
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("packet-vault-search", packetSearchQuery);
      sessionStorage.setItem("packet-vault-status", packetStatusFilter);
      sessionStorage.setItem("packet-vault-vendor", packetVendorFilter ?? "");
      sessionStorage.setItem("packet-vault-sow", packetSowMonth ?? "");
      sessionStorage.setItem("packet-vault-sort", JSON.stringify({ sortBy: packetSortBy, sortDirection: packetSortDirection }));
    } catch {
      /* ignore */
    }
  }, [packetSearchQuery, packetStatusFilter, packetVendorFilter, packetSowMonth, packetSortBy, packetSortDirection]);

  const toggleVarietySelection = useCallback((plantVarietyId: string) => {
    setSelectedVarietyIds((prev) => {
      const next = new Set(prev);
      if (next.has(plantVarietyId)) next.delete(plantVarietyId);
      else next.add(plantVarietyId);
      return next;
    });
  }, []);

  const handleLongPressVariety = useCallback((plantVarietyId: string) => {
    setBatchSelectMode(true);
    setSelectedVarietyIds((prev) => new Set([...prev, plantVarietyId]));
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedVarietyIds.size === 0) return;
    const uid = user?.id;
    if (!uid) {
      setSaveToastMessage("You must be signed in to delete.");
      return;
    }
    setBatchDeleting(true);
    let failed = false;
    const now = new Date().toISOString();
    const profileIdsCascaded: string[] = [];
    for (const id of Array.from(selectedVarietyIds)) {
      const { data: softDeleted } = await supabase
        .from("plant_profiles")
        .update({ deleted_at: now })
        .eq("id", id)
        .eq("user_id", uid)
        .select("id");
      if (softDeleted && softDeleted.length > 0) {
        profileIdsCascaded.push(id);
      }
    }
    if (!failed && profileIdsCascaded.length > 0) {
      await cascadeAllForDeletedProfiles(supabase, profileIdsCascaded, uid);
    }
    setBatchDeleting(false);
    if (!failed) {
      const count = selectedVarietyIds.size;
      setSelectedVarietyIds(new Set());
      setBatchSelectMode(false);
      setRefetchTrigger((t) => t + 1);
      setSaveToastMessage(`${count} item${count === 1 ? "" : "s"} removed from vault.`);
    }
  }, [user?.id, selectedVarietyIds]);

  const handleShedBatchDelete = useCallback(async () => {
    if (selectedSupplyIds.size === 0) return;
    const uid = user?.id;
    if (!uid) {
      setSaveToastMessage("You must be signed in to delete.");
      return;
    }
    setShedBatchDeleting(true);
    const now = new Date().toISOString();
    const ids = Array.from(selectedSupplyIds);
    const { error } = await supabase
      .from("supply_profiles")
      .update({ deleted_at: now })
      .in("id", ids)
      .eq("user_id", uid);
    setShedBatchDeleting(false);
    if (error) {
      setSaveToastMessage(`Could not delete: ${error.message}`);
      return;
    }
    const count = ids.length;
    setSelectedSupplyIds(new Set());
    setShedBatchSelectMode(false);
    setRefetchTrigger((t) => t + 1);
    setSaveToastMessage(`${count} supply${count === 1 ? "" : " supplies"} removed.`);
  }, [user?.id, selectedSupplyIds]);

  const handleSelectAll = useCallback(() => {
    setSelectedVarietyIds(new Set(filteredVarietyIds));
  }, [filteredVarietyIds]);

  const openMergeModal = useCallback(async () => {
    if (selectedVarietyIds.size < 2 || !user?.id) return;
    const ids = Array.from(selectedVarietyIds);
    const { data: rows } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name")
      .in("id", ids)
      .eq("user_id", user.id);
    const profiles = (rows ?? []) as { id: string; name: string; variety_name: string | null }[];
    if (profiles.length < 2) {
      setSaveToastMessage("Merge only works for plant profiles. Some selected items may be legacy.");
      return;
    }
    const { data: packetCounts } = await supabase
      .from("seed_packets")
      .select("plant_profile_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("plant_profile_id", ids);
    const countByProfile = new Map<string, number>();
    for (const r of packetCounts ?? []) {
      const pid = (r as { plant_profile_id: string }).plant_profile_id;
      countByProfile.set(pid, (countByProfile.get(pid) ?? 0) + 1);
    }
    const withCounts = profiles.map((p) => ({ ...p, packet_count: countByProfile.get(p.id) ?? 0 }));
    setMergeProfiles(withCounts);
    setMergeMasterId(profiles[0]?.id ?? null);
    setMergeModalOpen(true);
  }, [user?.id, selectedVarietyIds]);

  const handleConfirmMerge = useCallback(async () => {
    if (!mergeMasterId || mergeProfiles.length < 2 || !user?.id) return;
    const sourceIds = mergeProfiles.filter((p) => p.id !== mergeMasterId).map((p) => p.id);
    if (sourceIds.length === 0) return;
    setMergeInProgress(true);
    const { error: updateErr } = await supabase
      .from("seed_packets")
      .update({ plant_profile_id: mergeMasterId })
      .in("plant_profile_id", sourceIds)
      .eq("user_id", user.id);
    if (updateErr) {
      setSaveToastMessage(`Could not move packets: ${updateErr.message}`);
      setMergeInProgress(false);
      return;
    }
    const now = new Date().toISOString();
    const { error: deleteErr } = await supabase
      .from("plant_profiles")
      .update({ deleted_at: now })
      .in("id", sourceIds)
      .eq("user_id", user.id);
    if (deleteErr) {
      setSaveToastMessage(`Could not remove source profiles: ${deleteErr.message}`);
      setMergeInProgress(false);
      return;
    }
    await cascadeAllForDeletedProfiles(supabase, sourceIds, user.id);
    setMergeInProgress(false);
    setMergeModalOpen(false);
    setSelectedVarietyIds(new Set());
    setBatchSelectMode(false);
    setRefetchTrigger((t) => t + 1);
    setSaveToastMessage("Profiles merged successfully.");
  }, [user?.id, mergeMasterId, mergeProfiles]);

  const openScheduleModal = useCallback(() => {
    if (selectedVarietyIds.size === 0) return;
    setScheduleModalOpen(true);
  }, [selectedVarietyIds.size]);

  const [scheduleProfiles, setScheduleProfiles] = useState<{ id: string; name: string; variety_name: string | null; planting_window?: string | null }[]>([]);
  const [scheduleDueDate, setScheduleDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (!scheduleModalOpen || !user?.id || selectedVarietyIds.size === 0) return;
    setScheduleDueDate(new Date().toISOString().slice(0, 10));
    let cancelled = false;
    (async () => {
      const ids = Array.from(selectedVarietyIds);
      const { data } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name, planting_window")
        .in("id", ids)
        .eq("user_id", user.id);
      if (!cancelled) setScheduleProfiles((data ?? []) as { id: string; name: string; variety_name: string | null; planting_window?: string | null }[]);
    })();
    return () => { cancelled = true; };
  }, [scheduleModalOpen, user?.id, selectedVarietyIds]);

  const handleConfirmSchedule = useCallback(async () => {
    if (!user?.id || scheduleProfiles.length === 0) return;
    setScheduleConfirming(true);
    const dueDate = scheduleDueDate;
    const rows = scheduleProfiles.map((p) => ({
      user_id: user.id,
      plant_profile_id: p.id,
      category: "sow" as const,
      due_date: dueDate,
      title: `Sow ${p.variety_name?.trim() ? `${decodeHtmlEntities(p.name)} (${decodeHtmlEntities(p.variety_name)})` : decodeHtmlEntities(p.name)}`,
    }));
    const { error } = await supabase.from("tasks").insert(rows);
    setScheduleConfirming(false);
    if (error) {
      setSaveToastMessage(`Could not create tasks: ${error.message}`);
      return;
    }
    setScheduleModalOpen(false);
    setSelectedVarietyIds(new Set());
    setBatchSelectMode(false);
    setSaveToastMessage(`Created ${rows.length} sowing task${rows.length === 1 ? "" : "s"}. Check Home or Calendar.`);
    router.refresh();
  }, [user?.id, scheduleProfiles, scheduleDueDate, router]);

  const goToPlantPage = useCallback(() => {
    if (selectedVarietyIds.size === 0) return;
    const ids = Array.from(selectedVarietyIds).join(",");
    router.push(`/vault/plant?ids=${encodeURIComponent(ids)}`);
  }, [selectedVarietyIds, router]);

  const [plantProfiles, setPlantProfiles] = useState<{ id: string; name: string; variety_name: string | null; harvest_days: number | null }[]>([]);
  const [plantDate, setPlantDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [plantNotes, setPlantNotes] = useState("");
  type PlantProfileForModal = { id: string; name: string; variety_name: string | null; harvest_days: number | null; planting_window?: string | null };
  type SeedPacketRow = { id: string; qty_status: number; created_at?: string };
  type PlantQuantityChoice = "Half" | "One packet" | "All";
  type PlantModalRow = { profile: PlantProfileForModal; packets: SeedPacketRow[]; quantityChoice: PlantQuantityChoice };
  const [plantModalRows, setPlantModalRows] = useState<PlantModalRow[]>([]);
  const [plantSowMethod, setPlantSowMethod] = useState<"direct_sow" | "seed_start" | null>(null);
  const [plantSeedsSownByProfileId, setPlantSeedsSownByProfileId] = useState<Record<string, number | "">>({});
  const [plantPlantCountByProfileId, setPlantPlantCountByProfileId] = useState<Record<string, number | "">>({});
  const [plantSelectedSupplyIds, setPlantSelectedSupplyIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!plantModalOpen || !user?.id || selectedVarietyIds.size === 0) return;
    setPlantDate(new Date().toISOString().slice(0, 10));
    setPlantNotes("");
    setPlantSowMethod(null);
    setPlantSeedsSownByProfileId({});
    setPlantPlantCountByProfileId({});
    let cancelled = false;
    (async () => {
      const ids = Array.from(selectedVarietyIds);
      const [profilesRes, packetsRes] = await Promise.all([
        supabase.from("plant_profiles").select("id, name, variety_name, harvest_days, planting_window").in("id", ids).eq("user_id", user.id),
        supabase.from("seed_packets").select("id, plant_profile_id, qty_status, created_at").in("plant_profile_id", ids).eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: true }),
      ]);
      if (!cancelled && profilesRes.data) {
        const profiles = profilesRes.data as PlantProfileForModal[];
        setPlantProfiles(profiles);
        const packets = (packetsRes.data ?? []) as { id: string; plant_profile_id: string; qty_status: number; created_at?: string }[];
        const byProfile = new Map<string, SeedPacketRow[]>();
        for (const pk of packets) {
          const list = byProfile.get(pk.plant_profile_id) ?? [];
          list.push({ id: pk.id, qty_status: pk.qty_status, created_at: pk.created_at });
          byProfile.set(pk.plant_profile_id, list);
        }
        setPlantModalRows(profiles.map((p) => ({
          profile: p,
          packets: byProfile.get(p.id) ?? [],
          quantityChoice: "1 Pkt" as PlantQuantityChoice,
        })));
      }
    })();
    return () => { cancelled = true; };
  }, [plantModalOpen, user?.id, selectedVarietyIds]);

  const consumePackets = useCallback(async (profileId: string, toUse: number, packets: SeedPacketRow[]) => {
    if (!user?.id || toUse <= 0) return true;
    const now = new Date().toISOString();
    let need = toUse;
    for (const pk of packets) {
      const packetValue = pk.qty_status / 100;
      if (need >= packetValue - 1e-6) {
        // Law 2 & 3: soft delete and archive when qty reaches 0
        await supabase.from("seed_packets").update({ qty_status: 0, is_archived: true, deleted_at: now }).eq("id", pk.id).eq("user_id", user.id);
        need -= packetValue;
      } else {
        const remaining = Math.round((packetValue - need) * 100);
        const newQty = Math.max(0, Math.min(100, remaining));
        if (newQty <= 0) {
          await supabase.from("seed_packets").update({ qty_status: 0, is_archived: true, deleted_at: now }).eq("id", pk.id).eq("user_id", user.id);
        } else {
          await supabase.from("seed_packets").update({ qty_status: newQty }).eq("id", pk.id).eq("user_id", user.id);
        }
        need = 0;
        break;
      }
      if (need <= 0) break;
    }
    return true;
  }, [user?.id]);

  const handleConfirmPlant = useCallback(async (plantAllSeeds?: boolean) => {
    if (!user?.id || plantModalRows.length === 0) return;
    setPlantConfirming(true);
    const sownDate = plantDate;
    const noteText = plantNotes.trim() ? `Planted. ${plantNotes.trim()}` : "Planted";
    const nowIso = new Date().toISOString();
    const weatherSnapshot = await fetchWeatherSnapshot();
    let errMsg: string | null = null;
    for (const row of plantModalRows) {
      const p = row.profile;
      const effectiveTotal = row.packets.reduce((s, pk) => s + pk.qty_status / 100, 0);
      const choice = plantAllSeeds ? "All" : row.quantityChoice;
      const toUse = choice === "All" ? effectiveTotal : choice === "One packet" ? 1 : effectiveTotal * 0.5;

      const harvestDays = p.harvest_days != null && p.harvest_days > 0 ? p.harvest_days : null;
      const expectedHarvestDate = harvestDays != null
        ? new Date(new Date(sownDate).getTime() + harvestDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null;

      const seedsSownVal = plantSeedsSownByProfileId[p.id];
      const seedsSownNum = seedsSownVal === "" || seedsSownVal == null ? null : Number(seedsSownVal);
      const seedsSownFinal = typeof seedsSownNum === "number" && !Number.isNaN(seedsSownNum) && seedsSownNum >= 0 ? seedsSownNum : null;

      const plantCountVal = plantPlantCountByProfileId[p.id];
      const plantCountNum = plantCountVal === "" || plantCountVal == null ? null : Number(plantCountVal);
      const plantCountFinal = typeof plantCountNum === "number" && !Number.isNaN(plantCountNum) && plantCountNum >= 0 ? plantCountNum : null;

      const { data: growRow, error: growErr } = await supabase
        .from("grow_instances")
        .insert({
          user_id: user.id,
          plant_profile_id: p.id,
          sown_date: sownDate,
          expected_harvest_date: expectedHarvestDate ?? null,
          status: "growing",
          sow_method: plantSowMethod,
          seeds_sown: seedsSownFinal,
          plant_count: plantCountFinal,
        })
        .select("id")
        .single();
      if (growErr || !growRow?.id) {
        errMsg = growErr?.message ?? "Could not create planting record.";
        break;
      }

      const { error: journalErr } = await supabase.from("journal_entries").insert({
        user_id: user.id,
        plant_profile_id: p.id,
        grow_instance_id: growRow.id,
        note: noteText,
        entry_type: "planting",
        weather_snapshot: weatherSnapshot ?? undefined,
      });
      if (journalErr) {
        errMsg = journalErr.message;
        break;
      }

      // Care entries for supplies used at planting (e.g. seed starter, fertilizer at sowing)
      for (const supplyId of plantSelectedSupplyIds) {
        await supabase.from("journal_entries").insert({
          user_id: user.id,
          plant_profile_id: p.id,
          grow_instance_id: growRow.id,
          supply_profile_id: supplyId,
          note: "Used at planting",
          entry_type: "care",
        });
      }

      const displayName = p.variety_name?.trim() ? `${decodeHtmlEntities(p.name)} (${decodeHtmlEntities(p.variety_name)})` : decodeHtmlEntities(p.name);
      await supabase.from("tasks").insert({
        user_id: user.id,
        plant_profile_id: p.id,
        grow_instance_id: growRow.id,
        category: "sow",
        due_date: sownDate,
        completed_at: nowIso,
        title: `Sow ${displayName}`,
      });

      if (expectedHarvestDate) {
        await supabase.from("tasks").insert({
          user_id: user.id,
          plant_profile_id: p.id,
          grow_instance_id: growRow.id,
          category: "harvest",
          due_date: expectedHarvestDate,
          title: `Harvest ${displayName}`,
        });
      }

      const used = Math.min(toUse, effectiveTotal);
      if (used > 0 && row.packets.length > 0) {
        await consumePackets(p.id, used, row.packets);
      }

      const remainingAfter = effectiveTotal - used;
      if (remainingAfter <= 0) {
        await supabase.from("shopping_list").upsert(
          { user_id: user.id, plant_profile_id: p.id, is_purchased: false },
          { onConflict: "user_id,plant_profile_id", ignoreDuplicates: false }
        );
      }
      await supabase.from("plant_profiles").update({ status: "active" }).eq("id", p.id).eq("user_id", user.id);
    }
    setPlantConfirming(false);
    if (errMsg) {
      setSaveToastMessage(`Could not complete planting: ${errMsg}`);
      return;
    }
    setPlantModalOpen(false);
    setSelectedVarietyIds(new Set());
    setPlantSelectedSupplyIds(new Set());
    setBatchSelectMode(false);
    setRefetchTrigger((t) => t + 1);
    setSaveToastMessage("Planted!");
    setTimeout(() => router.push("/garden?tab=active"), 600);
  }, [user?.id, plantModalRows, plantDate, plantNotes, plantSowMethod, plantSeedsSownByProfileId, plantPlantCountByProfileId, plantSelectedSupplyIds, router, consumePackets]);

  const setPlantRowQuantity = useCallback((profileId: string, choice: PlantQuantityChoice) => {
    setPlantModalRows((prev) => prev.map((r) => (r.profile.id === profileId ? { ...r, quantityChoice: choice } : r)));
  }, []);

  const handlePlantAll = useCallback(() => {
    handleConfirmPlant(true);
  }, [handleConfirmPlant]);

  const [addingToShoppingList, setAddingToShoppingList] = useState(false);
  const handleAddToShoppingList = useCallback(async () => {
    if (!user?.id || selectedVarietyIds.size === 0) return;
    setAddingToShoppingList(true);
    const ids = Array.from(selectedVarietyIds);
    const rows = ids.map((plant_profile_id) => ({
      user_id: user.id,
      plant_profile_id,
      is_purchased: false,
    }));
    const { error } = await supabase.from("shopping_list").upsert(rows, {
      onConflict: "user_id,plant_profile_id",
      ignoreDuplicates: false,
    });
    setAddingToShoppingList(false);
    if (error) {
      setSaveToastMessage(`Could not add to list: ${error.message}`);
      return;
    }
    setSaveToastMessage(`Added ${ids.length} item${ids.length === 1 ? "" : "s"} to shopping list.`);
    setSelectedVarietyIds(new Set());
    setBatchSelectMode(false);
  }, [user?.id, selectedVarietyIds]);

  useEffect(() => {
    if (!saveToastMessage) return;
    const t = setTimeout(() => setSaveToastMessage(null), SAVE_TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [saveToastMessage]);

  const toggleTagFilter = vaultFilters.toggleTagFilter;

  const clearAllFilters = useCallback(() => {
    if (viewMode === "list") {
      clearPacketFilters();
    } else {
      vaultFilters.clearAllFilters();
    }
    setRefineByOpen(false);
    setRefineBySection(null);
  }, [viewMode, vaultFilters.clearAllFilters, clearPacketFilters]);

  const hasActiveFilters = viewMode === "list" ? hasPacketActiveFilters : vaultFilters.hasActiveFilters;

  const handleQRScan = useCallback(async (value: string) => {
    const trimmed = value.trim();
    const uuidRegex =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = trimmed.match(uuidRegex);
    const possibleId = match ? match[0] : trimmed;
    const { data } = await supabase.from("plant_profiles").select("id").eq("id", possibleId).maybeSingle();
    if (data?.id) {
      setScannerOpen(false);
      router.push(`/vault/${data.id}`);
      return;
    }
    const prefill = parseSeedFromQR(trimmed);
    if (Object.keys(prefill).length > 0) {
      setQrPrefill(prefill);
      setScannerOpen(false);
      setQuickAddOpen(true);
    }
  }, [router]);

  return (
    <div className="px-6 pt-0 pb-10">
      {hasPendingReview && (
        <div className="w-full mb-3 mt-2 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 relative">
          <button
            type="button"
            onClick={() => router.push("/vault/review-import")}
            className="flex-1 flex items-center justify-between gap-3 text-left hover:bg-amber-100/50 rounded-lg -m-1 p-1 transition-colors min-w-0"
          >
            <span className="text-sm font-medium text-amber-800">You have items pending review from a previous import.</span>
            <span className="text-sm text-amber-600 font-medium shrink-0">Review now &rarr;</span>
          </button>
          <button
            type="button"
            onClick={() => {
              clearReviewImportData();
              setRefetchTrigger((t) => t + 1);
            }}
            className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-amber-700 hover:bg-amber-200/80 transition-colors"
            aria-label="Cancel batch and dismiss"
            title="Cancel batch"
          >
            <span className="text-lg font-medium leading-none" aria-hidden>×</span>
          </button>
        </div>
      )}
      <div ref={stickyHeaderRef} className="sticky top-11 z-50 h-auto min-h-0 -mx-6 px-6 pt-1 pb-2 bg-white/95 backdrop-blur-md border-b border-black/5 shadow-sm pointer-events-none [&_*]:pointer-events-none [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto [&_a]:pointer-events-auto">
        <div className="flex items-center gap-2 mb-2 relative z-10 flex-wrap">
          {pendingHeroCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 text-xs text-neutral-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-1 shrink-0"
              title={`Gemini is researching photos for ${pendingHeroCount} new variet${pendingHeroCount === 1 ? "y" : "ies"}…`}
            >
              <ShovelIcon className="w-3.5 h-3.5 animate-spin text-amber-600" aria-hidden />
              <span>AI Researching…</span>
            </span>
          )}
        </div>

        <div className="flex mb-3 -mx-6 px-6" role="tablist" aria-label="View">
          <div className="inline-flex rounded-xl p-1 bg-neutral-100 gap-0.5" role="group">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "grid"}
              onClick={() => { setViewMode("grid"); router.replace("/vault?tab=grid", { scroll: false }); }}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-black/60 hover:text-black"
              }`}
            >
              Plant Profiles
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "list"}
              onClick={() => { setViewMode("list"); router.replace("/vault?tab=list", { scroll: false }); }}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-black/60 hover:text-black"
              }`}
            >
              Seed Vault
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "shed"}
              onClick={() => { setViewMode("shed"); router.replace("/vault?tab=shed", { scroll: false }); }}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "shed"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-black/60 hover:text-black"
              }`}
            >
              Shed
            </button>
          </div>
        </div>

        {/* Unified toolbar: search + (Filter | view toggle | Select | batch actions) — hidden when vault is empty */}
        {(viewMode === "grid" || viewMode === "list") && vaultHasSeeds && (
          <>
            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  value={viewMode === "list" ? packetSearchQuery : searchQuery}
                  onChange={(e) => (viewMode === "list" ? setPacketSearchQuery(e.target.value) : setSearchQuery(e.target.value))}
                  placeholder={viewMode === "list" ? "Search packets…" : "Search plants…"}
                  className="w-full rounded-xl bg-neutral-100 border-0 pl-10 pr-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-inset"
                  aria-label={viewMode === "list" ? "Search packets" : "Search plants"}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 gap-y-2 relative z-40">
                <button
                  type="button"
                  onClick={() => { setRefineByOpen(true); setRefineBySection(null); }}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 flex items-center gap-2 shrink-0"
                  aria-label="Filter by status, tags, plant type"
                >
                  Filter
                  {hasActiveFilters ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald text-white text-xs font-semibold">
                      {viewMode === "list"
                        ? [packetStatusFilter !== "", packetVendorFilter !== null, packetSowMonth != null && /^\d{4}-\d{2}$/.test(packetSowMonth)].filter(Boolean).length
                        : [
                            vaultFilters.filters.status !== "",
                            vaultFilters.filters.tags.length > 0,
                            vaultFilters.filters.category !== null,
                            vaultFilters.filters.variety !== null,
                            vaultFilters.filters.vendor !== null,
                            vaultFilters.filters.sun !== null,
                            vaultFilters.filters.spacing !== null,
                            vaultFilters.filters.germination !== null,
                            vaultFilters.filters.maturity !== null,
                            vaultFilters.filters.packetCount !== null,
                            !!sowParam && /^\d{4}-\d{2}$/.test(sowParam),
                          ].filter(Boolean).length}
                    </span>
                  ) : null}
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald/10 shrink-0"
                    aria-label="Clear all filters"
                  >
                    Clear filters
                  </button>
                )}
                {(viewMode === "grid" || viewMode === "list") && (
                  <button
                    type="button"
                    onClick={() => {
                    if (batchSelectMode) {
                      setBatchSelectMode(false);
                      setSelectedVarietyIds(new Set());
                      setSelectionActionsOpen(false);
                    } else {
                      setBatchSelectMode(true);
                    }
                  }}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
                  >
                    {batchSelectMode ? "Cancel" : "Select"}
                  </button>
                )}
                {batchSelectMode && (viewMode === "grid" || viewMode === "list") && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
                  >
                    Select All
                  </button>
                )}
                {viewMode === "grid" && (
                  <button
                    type="button"
                    onClick={() => setGridDisplayStyle((s) => (s === "condensed" ? "photo" : "condensed"))}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/10 bg-white ml-auto hover:bg-black/5 transition-colors"
                    title={gridDisplayStyle === "condensed" ? "Photo cards" : "Condensed grid"}
                    aria-label={gridDisplayStyle === "condensed" ? "Switch to photo cards" : "Switch to condensed grid"}
                  >
                    {gridDisplayStyle === "condensed" ? <PhotoCardsGridIcon /> : <CondensedGridIcon />}
                  </button>
                )}
              </div>
            </div>

          </>
        )}

        {/* Shed toolbar: same header as plant profiles / seed vault */}
        {viewMode === "shed" && (
          <>
            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  value={shedSearchQuery}
                  onChange={(e) => setShedSearchQuery(e.target.value)}
                  placeholder="Search supplies…"
                  className="w-full rounded-xl bg-neutral-100 border-0 pl-10 pr-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-inset min-h-[44px]"
                  aria-label="Search supplies"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 gap-y-2 relative z-40">
                <button
                  type="button"
                  onClick={() => setShedFilterOpen(true)}
                  className={`min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 flex items-center gap-2 shrink-0 ${shedCategoryFilter ? "ring-2 ring-emerald/40" : ""}`}
                  aria-label="Filter by category"
                >
                  Filter
                  {shedCategoryFilter && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald text-white text-xs font-semibold">1</span>
                  )}
                </button>
                {shedCategoryFilter && (
                  <button
                    type="button"
                    onClick={() => { setShedCategoryFilter(null); router.replace("/vault?tab=shed", { scroll: false }); }}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald/10 shrink-0"
                    aria-label="Clear category filter"
                  >
                    Clear filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (shedBatchSelectMode) {
                      setShedBatchSelectMode(false);
                      setSelectedSupplyIds(new Set());
                    } else {
                      setShedBatchSelectMode(true);
                    }
                  }}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
                >
                  {shedBatchSelectMode ? "Cancel" : "Select"}
                </button>
                {shedBatchSelectMode && filteredSupplyIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSupplyIds(new Set(filteredSupplyIds))}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5"
                    id="shed-select-all"
                  >
                    Select All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShedDisplayStyle((s) => (s === "grid" ? "list" : "grid"))}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/10 bg-white ml-auto hover:bg-black/5 transition-colors"
                  title={shedDisplayStyle === "grid" ? "List view" : "Grid view"}
                  aria-label={shedDisplayStyle === "grid" ? "Switch to list view" : "Switch to grid view"}
                >
                  {shedDisplayStyle === "grid" ? (
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
            </div>
          </>
        )}
      </div>

      {/* Shed category filter modal */}
      {shedFilterOpen && viewMode === "shed" && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/40"
            aria-hidden
            onClick={() => setShedFilterOpen(false)}
          />
          <div
            className="fixed left-4 right-4 top-1/2 z-[101] -translate-y-1/2 rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col max-w-md mx-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shed-filter-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-black/10">
              <h2 id="shed-filter-title" className="text-lg font-semibold text-black">Filter by category</h2>
              <button
                type="button"
                onClick={() => setShedFilterOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-black/60 hover:bg-black/5 hover:text-black"
                aria-label="Close"
              >
                <span className="text-xl leading-none" aria-hidden>×</span>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {[
                { value: null, label: "All" },
                { value: "fertilizer", label: "Fertilizer" },
                { value: "pesticide", label: "Pesticide" },
                { value: "soil_amendment", label: "Soil Amendment" },
                { value: "other", label: "Other" },
              ].map(({ value, label }) => {
                const selected = shedCategoryFilter === value;
                return (
                  <button
                    key={value ?? "all"}
                    type="button"
                    onClick={() => {
                      setShedCategoryFilter(value);
                      router.replace(value ? `/vault?tab=shed&category=${value}` : "/vault?tab=shed", { scroll: false });
                      setShedFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <footer className="flex-shrink-0 border-t border-black/10 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                {!shedHasDefault && (
                  <button
                    type="button"
                    onClick={() => {
                      saveFilterDefault(FILTER_DEFAULT_KEYS.vaultShed, shedCategoryFilter);
                      setShedHasDefault(true);
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                    aria-label="Save current filter as default"
                  >
                    Save Default
                  </button>
                )}
                {shedHasDefault && (
                  <button
                    type="button"
                    onClick={() => {
                      clearFilterDefault(FILTER_DEFAULT_KEYS.vaultShed);
                      setShedHasDefault(false);
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-black/60 hover:bg-black/5"
                    aria-label="Reset saved default filter"
                  >
                    Reset Default
                  </button>
                )}
              </div>
            </footer>
          </div>
        </>
      )}

      {/* Refine By pop-up modal (shared across Plant Profiles, Seed Vault, Active Garden, My Plants) */}
      {refineByOpen && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/40"
            aria-hidden
            onClick={() => { setRefineByOpen(false); setRefineBySection(null); }}
          />
          <div
            className="fixed left-4 right-4 top-1/2 z-[101] -translate-y-1/2 rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col max-w-md mx-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refine-by-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-black/10">
              <h2 id="refine-by-title" className="text-lg font-semibold text-black">Filter</h2>
              <div className="flex items-center gap-1">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                    aria-label="Clear all filters"
                  >
                    Clear filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setRefineByOpen(false); setRefineBySection(null); }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-black/60 hover:bg-black/5 hover:text-black"
                  aria-label="Close"
                >
                  <span className="text-xl leading-none" aria-hidden>×</span>
                </button>
              </div>
            </header>
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
              {/* Content for Plant Profiles (grid) vs Seed Vault / Packets (list) — separate per tab */}
              {(viewMode === "grid" || viewMode === "list") && (
                <>
                  {viewMode === "list" ? (
                    /* Packet Vault Refine By — Sort, Status, Vendor, Sow */
                    <>
                      <div className="border-b border-black/5">
                        <button type="button" onClick={() => setRefineBySection((s) => (s === "sort" ? null : "sort"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "sort"}>
                          <span>Sort</span>
                          <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sort" ? "▼" : "▸"}</span>
                        </button>
                        {refineBySection === "sort" && (
                          <div className="px-4 pb-3 pt-0 space-y-0.5">
                            {[
                              { sortBy: "date" as const, sortDirection: "desc" as const, label: "Purchase date (newest first)" },
                              { sortBy: "date" as const, sortDirection: "asc" as const, label: "Purchase date (oldest first)" },
                              { sortBy: "variety" as const, sortDirection: "asc" as const, label: "Variety (A–Z)" },
                              { sortBy: "variety" as const, sortDirection: "desc" as const, label: "Variety (Z–A)" },
                              { sortBy: "vendor" as const, sortDirection: "asc" as const, label: "Vendor (A–Z)" },
                              { sortBy: "vendor" as const, sortDirection: "desc" as const, label: "Vendor (Z–A)" },
                              { sortBy: "qty" as const, sortDirection: "desc" as const, label: "Quantity (most first)" },
                              { sortBy: "qty" as const, sortDirection: "asc" as const, label: "Quantity (least first)" },
                              { sortBy: "rating" as const, sortDirection: "desc" as const, label: "Rating (highest first)" },
                            ].map(({ sortBy: sb, sortDirection: sd, label }) => {
                              const selected = packetSortBy === sb && packetSortDirection === sd;
                              return (
                                <button key={`${sb}-${sd}`} type="button" onClick={() => { setPacketSortBy(sb); setPacketSortDirection(sd); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="border-b border-black/5">
                        <button type="button" onClick={() => setRefineBySection((s) => (s === "vault" ? null : "vault"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "vault"}>
                          <span>Vault Status</span>
                          <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "vault" ? "▼" : "▸"}</span>
                        </button>
                        {refineBySection === "vault" && (
                          <div className="px-4 pb-3 pt-0 space-y-0.5">
                            {(packetStatusChips.length > 0 ? packetStatusChips : [
                              { value: "" as PacketStatusFilter, label: "All", count: 0 },
                              { value: "vault" as PacketStatusFilter, label: "In Storage", count: 0 },
                              { value: "active" as PacketStatusFilter, label: "Active", count: 0 },
                              { value: "low_inventory" as PacketStatusFilter, label: "Low Inventory", count: 0 },
                              { value: "archived" as PacketStatusFilter, label: "Archived", count: 0 },
                            ]).map(({ value, label, count }) => {
                              const selected = packetStatusFilter === value;
                              return (
                                <button key={value || "all"} type="button" onClick={() => setPacketStatusFilter(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>
                                  {label} ({count})
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {packetVendorChips.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "packetVendor" ? null : "packetVendor"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "packetVendor"}>
                            <span>Vendor</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "packetVendor" ? "▼" : "▸"}</span>
                          </button>
                          {refineBySection === "packetVendor" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                              <button type="button" onClick={() => setPacketVendorFilter(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${packetVendorFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {packetVendorChips.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setPacketVendorFilter(value === "—" ? null : value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${packetVendorFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="border-b border-black/5">
                        <button type="button" onClick={() => setRefineBySection((s) => (s === "packetSow" ? null : "packetSow"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "packetSow"}>
                          <span>Plant this month</span>
                          <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "packetSow" ? "▼" : "▸"}</span>
                        </button>
                        {refineBySection === "packetSow" && (
                          <div className="px-4 pb-3 pt-0 space-y-0.5">
                            <button type="button" onClick={() => setPacketSowMonth(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${!packetSowMonth ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                            <button
                              type="button"
                              onClick={() => {
                                const now = new Date();
                                setPacketSowMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${packetSowMonth === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}` ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                            >
                              Plant Now
                            </button>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                              const year = new Date().getFullYear();
                              const sowVal = `${year}-${String(month).padStart(2, "0")}`;
                              const monthName = new Date(2000, month - 1).toLocaleString("default", { month: "long" });
                              const selected = packetSowMonth === sowVal;
                              return (
                                <button key={month} type="button" onClick={() => setPacketSowMonth(sowVal)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>
                                  {monthName}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Plant Profiles Refine By — existing profile sections */
                    <>
                  <div className="border-b border-black/5">
                    <button
                      type="button"
                      onClick={() => setRefineBySection((s) => (s === "sort" ? null : "sort"))}
                      className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                      aria-expanded={refineBySection === "sort"}
                    >
                      <span>Sort</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sort" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "sort" && (
                      <div className="px-4 pb-3 pt-0 space-y-0.5">
                        {[
                          { sortBy: "purchase_date" as const, sortDirection: "desc" as const, label: "Purchase date (newest first)" },
                          { sortBy: "purchase_date" as const, sortDirection: "asc" as const, label: "Purchase date (oldest first)" },
                          { sortBy: "name" as const, sortDirection: "asc" as const, label: "Name (A–Z)" },
                          { sortBy: "name" as const, sortDirection: "desc" as const, label: "Name (Z–A)" },
                          { sortBy: "date_added" as const, sortDirection: "desc" as const, label: "Date added (newest first)" },
                          { sortBy: "date_added" as const, sortDirection: "asc" as const, label: "Date added (oldest first)" },
                          { sortBy: "variety" as const, sortDirection: "asc" as const, label: "Variety (A–Z)" },
                          { sortBy: "variety" as const, sortDirection: "desc" as const, label: "Variety (Z–A)" },
                          { sortBy: "packet_count" as const, sortDirection: "desc" as const, label: "Packet Count (most first)" },
                          { sortBy: "packet_count" as const, sortDirection: "asc" as const, label: "Packet Count (fewest first)" },
                        ].map(({ sortBy: sb, sortDirection: sd, label }) => {
                          const selected = sortBy === sb && sortDirection === sd;
                          return (
                            <button
                              key={`${sb}-${sd}`}
                              type="button"
                              onClick={() => { setSortBy(sb); setSortDirection(sd); }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="border-b border-black/5">
                    <button
                      type="button"
                      onClick={() => setRefineBySection((s) => (s === "vault" ? null : "vault"))}
                      className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                      aria-expanded={refineBySection === "vault"}
                    >
                      <span>Vault Status</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "vault" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "vault" && (
                      <div className="px-4 pb-3 pt-0 space-y-0.5">
                        {(vaultStatusChips.length > 0 ? vaultStatusChips : [
                          { value: "" as StatusFilter, label: "All", count: 0 },
                          { value: "vault" as StatusFilter, label: "In Storage", count: 0 },
                          { value: "active" as StatusFilter, label: "Active", count: 0 },
                          { value: "low_inventory" as StatusFilter, label: "Low Inventory", count: 0 },
                          { value: "archived" as StatusFilter, label: "Archived", count: 0 },
                        ]).map(({ value, label, count }) => {
                          const selected = vaultFilters.filters.status === value;
                          return (
                            <button
                              key={value || "all"}
                              type="button"
                              onClick={() => vaultFilters.setStatus(value)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                            >
                              {label} ({count})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {availableTags.length > 0 && (
                    <div className="border-b border-black/5">
                      <button
                        type="button"
                        onClick={() => setRefineBySection((s) => (s === "tags" ? null : "tags"))}
                        className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                        aria-expanded={refineBySection === "tags"}
                      >
                        <span>Tags</span>
                        <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "tags" ? "▼" : "▸"}</span>
                      </button>
                      {refineBySection === "tags" && (
                        <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                          {availableTags.map((tag) => {
                            const checked = vaultFilters.filters.tags.includes(tag);
                            return (
                              <label
                                key={tag}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => vaultFilters.toggleTagFilter(tag)}
                                  className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                                  aria-label={`Filter by ${tag}`}
                                />
                                <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${getTagStyle(tag)}`}>
                                  {tag}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {categoryChips.length > 0 && (
                    <div className="border-b border-black/5">
                      <button
                        type="button"
                        onClick={() => setRefineBySection((s) => (s === "plantType" ? null : "plantType"))}
                        className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                        aria-expanded={refineBySection === "plantType"}
                      >
                        <span>Plant Type</span>
                        <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "plantType" ? "▼" : "▸"}</span>
                      </button>
                      {refineBySection === "plantType" && (
                        <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                          <button
                            type="button"
                            onClick={() => vaultFilters.setCategory(null)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.category === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                          >
                            All
                          </button>
                          {categoryChips.map(({ type, count }) => {
                            const selected = vaultFilters.filters.category === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => vaultFilters.setCategory(type)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                              >
                                {type} ({count})
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="border-b border-black/5">
                    <button
                      type="button"
                      onClick={() => setRefineBySection((s) => (s === "sowingMonth" ? null : "sowingMonth"))}
                      className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                      aria-expanded={refineBySection === "sowingMonth"}
                    >
                      <span>Sowing Month</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sowingMonth" ? "▼" : "▸"}</span>
                    </button>
                    {refineBySection === "sowingMonth" && (
                      <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                        <button
                          type="button"
                          onClick={() => { router.replace("/vault", { scroll: false }); setRefineByOpen(false); setRefineBySection(null); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${!sowParam ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const sow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                            router.push(`/vault?sow=${sow}`);
                            setRefineByOpen(false);
                            setRefineBySection(null);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm min-h-[44px] ${
                            sowParam && /^\d{4}-\d{2}$/.test(sowParam) && sowParam === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
                              ? "bg-emerald/10 text-emerald-800 font-medium"
                              : "text-black/80 hover:bg-black/5"
                          }`}
                        >
                          Plant Now
                        </button>
                        {sowingMonthChips.map(({ month, monthName, count }) => {
                          const year = new Date().getFullYear();
                          const sowVal = `${year}-${String(month).padStart(2, "0")}`;
                          const selected = sowParam === sowVal;
                          return (
                            <button
                              key={month}
                              type="button"
                              onClick={() => { router.push(`/vault?sow=${sowVal}`); setRefineByOpen(false); setRefineBySection(null); }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                            >
                              {monthName} ({count})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Variety, Vendor, Sun, Spacing, Germination, Maturity, Packet count — Plant Profiles only */}
                  {viewMode === "grid" && (
                    <>
                      {refineChips.variety.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "variety" ? null : "variety"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "variety"}>
                            <span>Variety</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "variety" ? "▼" : "▸"}</span>
                          </button>
                          {refineBySection === "variety" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => vaultFilters.setVariety(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.variety === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.variety.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => vaultFilters.setVariety(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${vaultFilters.filters.variety === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.vendor.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "vendor" ? null : "vendor"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "vendor"}>
                            <span>Vendor</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "vendor" ? "▼" : "▸"}</span>
                          </button>
                          {refineBySection === "vendor" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => vaultFilters.setVendor(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.vendor === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.vendor.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => vaultFilters.setVendor(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${vaultFilters.filters.vendor === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.sun.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "sun" ? null : "sun"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "sun"}>
                            <span>Sun</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sun" ? "▼" : "▸"}</span>
                          </button>
                          {refineBySection === "sun" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => vaultFilters.setSun(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.sun === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.sun.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => vaultFilters.setSun(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.sun === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.spacing.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "spacing" ? null : "spacing"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "spacing"}>
                            <span>Spacing</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "spacing" ? "▼" : "▸"}</span>
                          </button>
                          {refineBySection === "spacing" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => vaultFilters.setSpacing(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.spacing === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.spacing.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => vaultFilters.setSpacing(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${vaultFilters.filters.spacing === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.germination.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "germination" ? null : "germination"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "germination"}>
                            <span>Germination</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "germination" ? "▼" : "▸"}</span>
                          </button>
                          {refineBySection === "germination" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => vaultFilters.setGermination(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.germination === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.germination.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => vaultFilters.setGermination(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${vaultFilters.filters.germination === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.maturity.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "maturity" ? null : "maturity"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "maturity"}>
                            <span>Maturity</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "maturity" ? "▼" : "▸"}</span>
                          </button>
                          {refineBySection === "maturity" && (
                            <div className="px-4 pb-3 pt-0 space-y-0.5">
                              <button type="button" onClick={() => vaultFilters.setMaturity(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.maturity === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.maturity.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => vaultFilters.setMaturity(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.maturity === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value === "<60" ? "<60 days" : value === "60-90" ? "60–90 days" : "90+ days"} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.packetCount.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "packetCount" ? null : "packetCount"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "packetCount"}>
                            <span>Packet Count</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "packetCount" ? "▼" : "▸"}</span>
                          </button>
                          {refineBySection === "packetCount" && (
                            <div className="px-4 pb-3 pt-0 space-y-0.5">
                              <button type="button" onClick={() => vaultFilters.setPacketCount(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.packetCount === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.packetCount.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => vaultFilters.setPacketCount(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vaultFilters.filters.packetCount === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value === "2+" ? "2+ packets" : value === "1" ? "1 packet" : "0 packets"} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
            </div>
            <footer className="flex-shrink-0 border-t border-black/10 px-4 py-3 space-y-2">
              {viewMode === "grid" ? (
                <div className="flex items-center gap-2">
                  {!vaultFilters.hasDefault && (
                    <button
                      type="button"
                      onClick={() => vaultFilters.saveAsDefault({ sortBy, sortDirection })}
                      className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                      aria-label="Save current filters and sort as default"
                    >
                      Save Default
                    </button>
                  )}
                  {vaultFilters.hasDefault && (
                    <button
                      type="button"
                      onClick={vaultFilters.clearDefault}
                      className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-black/60 hover:bg-black/5"
                      aria-label="Reset saved default filters"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {!packetHasDefault && (
                    <button
                      type="button"
                      onClick={() => {
                        saveFilterDefault(FILTER_DEFAULT_KEYS.vaultPackets, {
                          status: packetStatusFilter,
                          vendor: packetVendorFilter,
                          sowMonth: packetSowMonth,
                          sortBy: packetSortBy,
                          sortDirection: packetSortDirection,
                        });
                        setPacketHasDefault(true);
                      }}
                      className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                      aria-label="Save current filters and sort as default"
                    >
                      Save Default
                    </button>
                  )}
                  {packetHasDefault && (
                    <button
                      type="button"
                      onClick={() => {
                        clearFilterDefault(FILTER_DEFAULT_KEYS.vaultPackets);
                        setPacketHasDefault(false);
                      }}
                      className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-black/60 hover:bg-black/5"
                      aria-label="Reset saved default filters"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => { setRefineByOpen(false); setRefineBySection(null); }}
                className="w-full min-h-[48px] rounded-xl bg-emerald text-white font-medium text-sm"
              >
                Show Results ({viewMode === "list" ? filteredPacketCount : filteredVarietyIds.length})
              </button>
            </footer>
          </div>
        </>
      )}

      {viewMode === "shed" && (
        <div className="relative z-10 pt-2 pointer-events-auto">
          <ShedView
            embedded
            refetchTrigger={refetchTrigger}
            categoryFromUrl={searchParams.get("category")}
            scrollContainerRef={scrollContainerRef}
            searchQuery={shedSearchQuery}
            categoryFilter={shedCategoryFilter}
            displayStyle={shedDisplayStyle}
            batchSelectMode={shedBatchSelectMode}
            selectedIds={selectedSupplyIds}
            onToggleSelection={(id) => {
              setSelectedSupplyIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onLongPress={(id) => {
              setShedBatchSelectMode(true);
              setSelectedSupplyIds((prev) => new Set([...prev, id]));
            }}
            onFilteredIdsChange={setFilteredSupplyIds}
          />
        </div>
      )}

      {(viewMode === "grid" || viewMode === "list") && (
        <div className="relative z-10 pt-2">
          {/* Both views mounted; visibility toggled for instant tab switching */}
          <div className={viewMode === "grid" ? "block" : "hidden"} aria-hidden={viewMode !== "grid"}>
            {sowParam && /^\d{4}-\d{2}$/.test(sowParam) && (
              <div className="mb-3 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-emerald-800">
                  Plant this month ({(() => {
                    const [, m] = sowParam.split("-").map(Number);
                    return new Date(2000, (m ?? 1) - 1).toLocaleString("default", { month: "long" });
                  })()})
                </span>
                <Link href="/vault" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 underline">Show all</Link>
              </div>
            )}
            <SeedVaultView
              mode="grid"
              refetchTrigger={refetchTrigger}
              scrollContainerRef={scrollContainerRef}
              searchQuery={searchQuery}
              statusFilter={vaultFilters.filters.status as StatusFilter}
              tagFilters={vaultFilters.filters.tags}
              onTagsLoaded={handleTagsLoaded}
              onOpenScanner={() => setScannerOpen(true)}
              onAddFirst={() => setUniversalAddMenuOpen(true)}
              batchSelectMode={batchSelectMode}
              selectedVarietyIds={selectedVarietyIds}
              onToggleVarietySelection={toggleVarietySelection}
              onLongPressVariety={handleLongPressVariety}
              onFilteredIdsChange={setFilteredVarietyIds}
              onPendingHeroCountChange={setPendingHeroCount}
              onEmptyStateChange={(empty) => setVaultHasSeeds(!empty)}
              availablePlantTypes={availablePlantTypes}
              onPlantTypeChange={handlePlantTypeChange}
              plantNowFilter={!!sowParam}
              sowMonth={sowParam && /^\d{4}-\d{2}$/.test(sowParam) ? sowParam : null}
              gridDisplayStyle={gridDisplayStyle}
              categoryFilter={vaultFilters.filters.category}
              onCategoryFilterChange={vaultFilters.setCategory}
              onCategoryChipsLoaded={handleCategoryChipsLoaded}
              varietyFilter={vaultFilters.filters.variety}
              vendorFilter={vaultFilters.filters.vendor}
              sunFilter={vaultFilters.filters.sun}
              spacingFilter={vaultFilters.filters.spacing}
              germinationFilter={vaultFilters.filters.germination}
              maturityFilter={vaultFilters.filters.maturity}
              packetCountFilter={vaultFilters.filters.packetCount}
              onRefineChipsLoaded={handleRefineChipsLoaded}
              onVaultStatusChipsLoaded={handleVaultStatusChipsLoaded}
              onSowingMonthChipsLoaded={handleSowingMonthChipsLoaded}
              hideArchivedProfiles={false}
              sortBy={sortBy}
              sortDirection={sortDirection}
            />
          </div>
          <div className={viewMode === "list" ? "block" : "hidden"} aria-hidden={viewMode !== "list"}>
            {packetSowMonth && /^\d{4}-\d{2}$/.test(packetSowMonth) && (
              <div className="mb-3 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-emerald-800">
                  Plant this month ({(() => {
                    const [, m] = packetSowMonth.split("-").map(Number);
                    return new Date(2000, (m ?? 1) - 1).toLocaleString("default", { month: "long" });
                  })()})
                </span>
                <button type="button" onClick={() => setPacketSowMonth(null)} className="text-sm font-medium text-emerald-700 hover:text-emerald-800 underline">Show all</button>
              </div>
            )}
            <PacketVaultLazy
              refetchTrigger={refetchTrigger}
              scrollContainerRef={scrollContainerRef}
              searchQuery={packetSearchQuery}
              statusFilter={packetStatusFilter}
              vendorFilter={packetVendorFilter}
              sortBy={packetSortBy}
              sortDirection={packetSortDirection}
              sowMonth={packetSowMonth}
              batchSelectMode={batchSelectMode}
              selectedProfileIds={selectedVarietyIds}
              onToggleProfileSelection={toggleVarietySelection}
              onLongPressPacket={handleLongPressVariety}
              onFilteredIdsChange={setFilteredVarietyIds}
              onFilteredCountChange={setFilteredPacketCount}
              onEmptyStateChange={(empty) => setVaultHasSeeds(!empty)}
              onOpenScanner={() => setScannerOpen(true)}
              onAddFirst={() => setUniversalAddMenuOpen(true)}
              onPacketStatusChipsLoaded={setPacketStatusChips}
              onPacketVendorChipsLoaded={setPacketVendorChips}
            />
          </div>
        </div>
      )}

      {mergeModalOpen && mergeProfiles.length >= 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="merge-dialog-title">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-6 pb-2">
              <h2 id="merge-dialog-title" className="text-lg font-semibold text-neutral-900">Merge Confirmation</h2>
              <p className="text-sm text-neutral-600 mt-2">Choose which profile is the <strong>Master</strong> (keeps its name and growing data). The others will be removed and their packets moved to the master. Result: one Variety with all Packets combined.</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 border-t border-neutral-100">
              <fieldset className="mb-4">
                <legend className="text-sm font-medium text-neutral-700 mb-2">Master profile</legend>
                <div className="space-y-2">
                  {mergeProfiles.map((p) => {
                    const label = p.variety_name?.trim() ? `${decodeHtmlEntities(p.name)} — ${decodeHtmlEntities(p.variety_name)}` : decodeHtmlEntities(p.name);
                    const pkts = p.packet_count ?? 0;
                    return (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="merge-master"
                          checked={mergeMasterId === p.id}
                          onChange={() => setMergeMasterId(p.id)}
                          className="rounded-full border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-neutral-900">{label}</span>
                        <span className="text-neutral-500 text-xs">({pkts} Pkt{pkts !== 1 ? "s" : ""})</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {mergeMasterId && (
                <>
                  <p className="text-sm font-medium text-neutral-700 mb-1">Source profiles (will be deleted)</p>
                  <ul className="list-disc list-inside text-sm text-neutral-600 mb-4">
                    {mergeProfiles
                      .filter((p) => p.id !== mergeMasterId)
                      .map((p) => {
                        const label = p.variety_name?.trim() ? `${decodeHtmlEntities(p.name)} — ${decodeHtmlEntities(p.variety_name)}` : decodeHtmlEntities(p.name);
                        const pkts = p.packet_count ?? 0;
                        return <li key={p.id}>{label}{pkts > 0 ? ` (${pkts} packet${pkts !== 1 ? "s" : ""})` : ""}</li>;
                      })}
                  </ul>
                  <p className="text-sm text-neutral-700 mb-2 rounded-lg bg-neutral-50 p-3">
                    All seed packets from the selected profiles will be moved to{" "}
                    <strong>
                      {(() => {
                        const m = mergeProfiles.find((x) => x.id === mergeMasterId);
                        return m?.variety_name?.trim() ? `${decodeHtmlEntities(m.name)} — ${decodeHtmlEntities(m.variety_name)}` : decodeHtmlEntities(m?.name ?? "");
                      })()}
                    </strong>
                    . You will have 1 Variety with {mergeProfiles.reduce((s, p) => s + (p.packet_count ?? 0), 0)} Packet{mergeProfiles.reduce((s, p) => s + (p.packet_count ?? 0), 0) !== 1 ? "s" : ""}.
                  </p>
                </>
              )}
            </div>
            <div className="flex-shrink-0 flex gap-3 justify-end p-4 border-t-2 border-neutral-200 bg-white rounded-b-xl">
              <button
                type="button"
                onClick={() => setMergeModalOpen(false)}
                disabled={mergeInProgress}
                className="px-4 py-2.5 rounded-lg border-2 border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={!mergeMasterId || mergeInProgress}
                className="px-5 py-2.5 rounded-lg font-semibold shadow-md disabled:opacity-50 border-0 !bg-emerald-600 !text-white hover:!bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                {mergeInProgress ? "Merging…" : "Confirm Merge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Sowing modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-black">Schedule Sowing</h2>
              <p className="text-sm text-black/60 mt-1">Create a sowing task for each selected variety.</p>
              <div className="mt-3">
                <label htmlFor="schedule-due-date" className="block text-xs font-medium text-black/60 mb-1">Due date</label>
                <input
                  id="schedule-due-date"
                  type="date"
                  value={scheduleDueDate}
                  onChange={(e) => setScheduleDueDate(e.target.value)}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {scheduleProfiles.length === 0 ? (
                <p className="text-black/50 text-sm">Loading…</p>
              ) : (
                <ul className="space-y-2">
                  {scheduleProfiles.map((p) => {
                    const displayName = p.variety_name?.trim() ? `${decodeHtmlEntities(p.name)} (${decodeHtmlEntities(p.variety_name)})` : decodeHtmlEntities(p.name);
                    const sowNow = isPlantableInMonthSimple(p.planting_window, new Date().getMonth());
                    const sowingWindow = getSowingWindowLabelSimple(p);
                    return (
                      <li key={p.id} className="py-2 px-3 rounded-lg bg-neutral-50 border border-black/5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-black/90">{displayName}</span>
                          {sowNow && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Sow Now</span>}
                        </div>
                        {sowingWindow && <p className="text-xs text-black/50">Sowing window: {sowingWindow}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-black/10 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-black/10 text-sm font-medium text-black/80 hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={scheduleConfirming || scheduleProfiles.length === 0}
                onClick={handleConfirmSchedule}
                className="px-4 py-2 rounded-lg bg-emerald text-white text-sm font-medium disabled:opacity-60"
              >
                {scheduleConfirming ? "Creating…" : "Create tasks"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Planting modal */}
      {plantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-black">Confirm Planting</h2>
              <p className="text-sm text-black/60 mt-1">Create a journal entry for each; choose how much seed to use per variety. Harvest tasks will appear on Home when maturity days are set.</p>
              {plantModalRows.length > 0 && (
                <button
                  type="button"
                  onClick={handlePlantAll}
                  disabled={plantConfirming || plantModalRows.every((r) => r.packets.length === 0)}
                  className="mt-3 w-full py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500"
                >
                  Plant All Seeds
                </button>
              )}
              <div className="mt-3">
                <label htmlFor="plant-date" className="block text-xs font-medium text-black/60 mb-1">Planting date</label>
                <input
                  id="plant-date"
                  type="date"
                  value={plantDate}
                  onChange={(e) => setPlantDate(e.target.value)}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-3">
                <label htmlFor="plant-notes" className="block text-xs font-medium text-black/60 mb-1">Notes (hillside details)</label>
                <textarea
                  id="plant-notes"
                  value={plantNotes}
                  onChange={(e) => setPlantNotes(e.target.value)}
                  placeholder="e.g. Lower terrace, added compost"
                  rows={2}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm resize-none"
                />
              </div>
              <div className="mt-3">
                <span className="block text-xs font-medium text-black/60 mb-1.5">Sow method</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPlantSowMethod("direct_sow")}
                    className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg border text-sm font-medium ${
                      plantSowMethod === "direct_sow" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-black/10 text-black/70 hover:bg-black/5"
                    }`}
                  >
                    Direct sow
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlantSowMethod("seed_start")}
                    className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg border text-sm font-medium ${
                      plantSowMethod === "seed_start" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-black/10 text-black/70 hover:bg-black/5"
                    }`}
                  >
                    Seed start (transplant later)
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <SupplyPicker
                  selectedIds={plantSelectedSupplyIds}
                  onChange={setPlantSelectedSupplyIds}
                  label="Supplies used (optional)"
                  placeholder="e.g. seed starter, fertilizer at sowing"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {plantModalRows.length === 0 ? (
                <p className="text-black/50 text-sm">Loading…</p>
              ) : (
                <ul className="space-y-3">
                  {plantModalRows.map((row) => {
                    const p = row.profile;
                    const displayName = p.variety_name?.trim() ? `${decodeHtmlEntities(p.name)} (${decodeHtmlEntities(p.variety_name)})` : decodeHtmlEntities(p.name);
                    const harvestLabel = p.harvest_days != null && p.harvest_days > 0
                      ? `Harvest in ~${p.harvest_days} days`
                      : "No maturity set";
                    const sowingWindow = getSowingWindowLabelSimple(p);
                    const packetCount = row.packets.length;
                    const effectiveTotal = row.packets.reduce((s, pk) => s + pk.qty_status / 100, 0);
                    const maxPct = packetCount > 0 ? Math.min(100, (effectiveTotal / Math.max(1, packetCount)) * 100) : 0;
                    return (
                      <li key={p.id} className="py-2 px-3 rounded-lg bg-neutral-50 border border-black/5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-black/90">{displayName}</span>
                          <span className="text-xs text-black/50">{harvestLabel}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-black/60 mb-1">Seed status</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${maxPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-black/70 shrink-0">
                              {packetCount} Pkt{packetCount !== 1 ? "s" : ""} ({effectiveTotal.toFixed(1)})
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-black/60 shrink-0">Seeds sown (optional)</label>
                            <input
                              type="number"
                              min={0}
                              value={plantSeedsSownByProfileId[p.id] ?? ""}
                              onChange={(e) => setPlantSeedsSownByProfileId((prev) => ({ ...prev, [p.id]: e.target.value === "" ? "" : Number(e.target.value) }))}
                              placeholder="e.g. 12"
                              className="w-20 rounded-lg border border-black/10 px-2 py-1.5 text-xs text-black min-h-[36px]"
                              aria-label={`Seeds sown for ${displayName}`}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-black/60 shrink-0">Plant count (optional)</label>
                            <input
                              type="number"
                              min={0}
                              value={plantPlantCountByProfileId[p.id] ?? ""}
                              onChange={(e) => setPlantPlantCountByProfileId((prev) => ({ ...prev, [p.id]: e.target.value === "" ? "" : Number(e.target.value) }))}
                              placeholder="e.g. 12"
                              className="w-20 rounded-lg border border-black/10 px-2 py-1.5 text-xs text-black min-h-[36px]"
                              aria-label={`Plant count for ${displayName}`}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-black/60">Use:</span>
                          {(["Half", "One packet", "All"] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setPlantRowQuantity(p.id, opt)}
                              className={`min-h-[32px] px-2.5 rounded-lg text-xs font-medium border ${
                                row.quantityChoice === opt
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-black/70 border-black/20 hover:bg-black/5"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        {sowingWindow && <p className="text-xs text-black/50">Sowing window: {sowingWindow}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-black/10 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setPlantModalOpen(false); setPlantSelectedSupplyIds(new Set()); }}
                className="px-4 py-2 rounded-lg border border-black/10 text-sm font-medium text-black/80 hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={plantConfirming || plantModalRows.length === 0}
                onClick={() => handleConfirmPlant()}
                className="px-4 py-2 rounded-lg bg-emerald text-white text-sm font-medium disabled:opacity-60"
              >
                {plantConfirming ? "Planting…" : "Confirm planting"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selection actions menu (when plants selected): plus opens this instead of quick add */}
      {selectionActionsOpen && (viewMode === "grid" || viewMode === "list") && batchSelectMode && (
        <>
          <div
            className="fixed inset-0 z-[99] bg-black/40"
            aria-hidden
            onClick={() => setSelectionActionsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Selection actions"
            className="fixed left-4 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+1rem)] z-[100] rounded-2xl bg-white shadow-xl border border-black/10 overflow-hidden max-h-[70vh] flex flex-col"
          >
            <div className="flex-shrink-0 px-4 py-3 border-b border-black/10">
              <p className="text-sm font-medium text-black/70">{selectedVarietyIds.size} selected</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <button
                type="button"
                onClick={() => { setBatchDeleteConfirmOpen(true); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size === 0 || batchDeleting}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-citrus hover:bg-black/5 disabled:opacity-50"
                aria-label="Delete selected"
              >
                <Trash2Icon className="w-5 h-5 shrink-0" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => { goToPlantPage(); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size === 0}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                aria-label="Plant selected"
              >
                <ShovelIcon className="w-5 h-5 shrink-0" />
                Plant
              </button>
              <button
                type="button"
                onClick={() => { handleAddToShoppingList(); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size === 0 || addingToShoppingList}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                aria-label="Add to shopping list"
              >
                <ShoppingListIcon className="w-5 h-5 shrink-0" />
                Shopping list
              </button>
              <button
                type="button"
                onClick={() => { openScheduleModal(); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size === 0}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                aria-label="Schedule sowing"
              >
                <CalendarIcon className="w-5 h-5 shrink-0" />
                Plan
              </button>
              <button
                type="button"
                onClick={() => { openMergeModal(); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size < 2}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                aria-label="Merge selected"
              >
                <MergeIcon className="w-5 h-5 shrink-0" />
                Merge
              </button>
            </div>
          </div>
        </>
      )}

      {/* Shed selection actions menu */}
      {shedSelectionActionsOpen && viewMode === "shed" && shedBatchSelectMode && (
        <>
          <div
            className="fixed inset-0 z-[99] bg-black/40"
            aria-hidden
            onClick={() => setShedSelectionActionsOpen(false)}
          />
          <div
            role="menu"
            aria-label="Shed selection actions"
            className="fixed left-4 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+1rem)] z-[100] rounded-2xl bg-white shadow-xl border border-black/10 overflow-hidden max-h-[70vh] flex flex-col"
          >
            <div className="flex-1 overflow-y-auto py-2">
              <button
                type="button"
                onClick={() => { handleShedBatchDelete(); setShedSelectionActionsOpen(false); }}
                disabled={selectedSupplyIds.size === 0 || shedBatchDeleting}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-citrus hover:bg-black/5 disabled:opacity-50"
                aria-label="Delete selected"
              >
                <Trash2Icon className="w-5 h-5 shrink-0" />
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Batch delete plant profiles confirmation */}
      {batchDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="alertdialog" aria-modal="true" aria-labelledby="batch-delete-title">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full p-6">
            <h2 id="batch-delete-title" className="text-lg font-semibold text-black mb-2">Delete {selectedVarietyIds.size} plant profile{selectedVarietyIds.size !== 1 ? "s" : ""}?</h2>
            <p className="text-sm text-black/70 mb-4">
              This will remove the selected profiles and all associated data: seed packets, growing instances, journal entries, and care schedules. This cannot be undone.
            </p>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              If you want to keep varieties for reference, consider archiving seed packets instead of deleting.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setBatchDeleteConfirmOpen(false)}
                disabled={batchDeleting}
                className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 min-h-[44px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleBatchDelete();
                  setBatchDeleteConfirmOpen(false);
                }}
                disabled={batchDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 min-h-[44px]"
              >
                {batchDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if ((viewMode === "grid" || viewMode === "list") && batchSelectMode && selectedVarietyIds.size > 0) {
            setSelectionActionsOpen(true);
          } else if (viewMode === "shed" && shedBatchSelectMode && selectedSupplyIds.size > 0) {
            setShedSelectionActionsOpen(true);
          } else if (universalAddMenuOpen) {
            setUniversalAddMenuOpen(false);
          } else {
            setUniversalAddMenuOpen(true);
          }
        }}
        className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
          ((viewMode === "grid" || viewMode === "list") && batchSelectMode && selectedVarietyIds.size > 0) ||
          (viewMode === "shed" && shedBatchSelectMode && selectedSupplyIds.size > 0)
            ? "bg-amber-500 text-white"
            : universalAddMenuOpen
              ? "bg-emerald-700 text-white"
              : "bg-emerald text-white"
        }`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={
          ((viewMode === "grid" || viewMode === "list") && batchSelectMode) || (viewMode === "shed" && shedBatchSelectMode)
            ? "Selection actions"
            : universalAddMenuOpen
              ? "Close add menu"
              : "Add"
        }
      >
        {((viewMode === "grid" || viewMode === "list") && batchSelectMode && selectedVarietyIds.size > 0) ||
        (viewMode === "shed" && shedBatchSelectMode && selectedSupplyIds.size > 0) ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-slide-in-chevron" aria-hidden>
            <path d="M7 6l4 6-4 6" />
            <path d="M13 6l4 6-4 6" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${quickAddOpen || shedQuickAddOpen ? "rotate-45" : "rotate-0"}`}
            aria-hidden
          >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        )}
      </button>

      {universalAddMenuOpen && (
        <UniversalAddMenu
          open={universalAddMenuOpen}
          onClose={() => setUniversalAddMenuOpen(false)}
          pathname={pathname ?? "/vault"}
          onAddSeed={() => {
            setUniversalAddMenuOpen(false);
            setQuickAddOpen(true);
          }}
          onAddPlantManual={(defaultType) => {
            setUniversalAddMenuOpen(false);
            setAddPlantDefaultType(defaultType);
            setShowAddPlantModal(true);
          }}
          onAddPlantFromVault={() => {
            skipPopOnNavigateRef.current = true;
            setUniversalAddMenuOpen(false);
            router.push("/vault/plant?from=vault");
          }}
          onAddPlantPurchaseOrder={() => {
            setUniversalAddMenuOpen(false);
            setPurchaseOrderMode("seed");
            setPurchaseOrderOpen(true);
          }}
          onAddToShed={() => {
            setUniversalAddMenuOpen(false);
            setShedQuickAddOpen(true);
          }}
          onAddTask={() => {
            setUniversalAddMenuOpen(false);
            setNewTaskModalOpen(true);
          }}
          onAddJournal={() => {
            skipPopOnNavigateRef.current = true;
            setUniversalAddMenuOpen(false);
            router.push("/journal/new");
          }}
        />
      )}

      {newTaskModalOpen && (
        <NewTaskModal
          open={newTaskModalOpen}
          onClose={() => setNewTaskModalOpen(false)}
          onBackToMenu={() => {
            setNewTaskModalOpen(false);
            setUniversalAddMenuOpen(true);
          }}
        />
      )}

      {quickAddOpen && (
      <QuickAddSeed
        open={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false);
          setQrPrefill(null);
        }}
        onBackToMenu={() => {
          setQuickAddOpen(false);
          setQrPrefill(null);
          setUniversalAddMenuOpen(true);
        }}
        onSuccess={(opts) => {
          setRefetchTrigger((t) => t + 1);
          router.refresh();
          if (opts?.photoBlocked) {
            setSaveToastMessage("Seed details saved. Product photo could not be saved.");
          }
        }}
        initialPrefill={qrPrefill}
        onOpenBatch={() => {
          setQuickAddOpen(false);
          setBatchAddOpen(true);
        }}
        onOpenLinkImport={() => {
          skipPopOnNavigateRef.current = true;
          setQuickAddOpen(false);
          router.push("/vault/import?embed=1");
        }}
        onStartManualImport={() => {
          skipPopOnNavigateRef.current = true;
          setQuickAddOpen(false);
          router.push("/vault/import/manual");
        }}
        onOpenPurchaseOrder={() => {
          skipPopOnNavigateRef.current = true;
          setQuickAddOpen(false);
          setPurchaseOrderMode("seed");
          setPurchaseOrderOpen(true);
        }}
      />
      )}

      {batchAddOpen && (
        <BatchAddSeed
          open={batchAddOpen}
          onClose={() => setBatchAddOpen(false)}
          onSuccess={() => setRefetchTrigger((t) => t + 1)}
          onNavigateToHero={() => {
            skipPopOnNavigateRef.current = true;
            setBatchAddOpen(false);
            router.push("/vault/import/photos/hero");
          }}
        />
      )}

      {purchaseOrderOpen && (
      <PurchaseOrderImport
        open={purchaseOrderOpen}
        onClose={() => setPurchaseOrderOpen(false)}
        mode={purchaseOrderMode}
        defaultProfileType={purchaseOrderMode === "seed" ? "seed" : undefined}
      />
      )}

      <QuickAddSupply
        open={shedQuickAddOpen}
        onClose={() => setShedQuickAddOpen(false)}
        onSuccess={() => setRefetchTrigger((t) => t + 1)}
        onBackToMenu={() => {
          setShedQuickAddOpen(false);
          setUniversalAddMenuOpen(true);
        }}
        onOpenPurchaseOrder={() => {
          skipPopOnNavigateRef.current = true;
          setShedQuickAddOpen(false);
          setPurchaseOrderMode("supply");
          setPurchaseOrderOpen(true);
        }}
        onOpenBatchPhotoImport={() => {
          skipPopOnNavigateRef.current = true;
          setShedQuickAddOpen(false);
          setBatchAddSupplyOpen(true);
        }}
      />

      {batchAddSupplyOpen && (
        <BatchAddSupply
          open={batchAddSupplyOpen}
          onClose={() => setBatchAddSupplyOpen(false)}
          onSuccess={() => setRefetchTrigger((t) => t + 1)}
        />
      )}

      {showAddPlantModal && (
        <AddPlantModal
          open={showAddPlantModal}
          onClose={() => setShowAddPlantModal(false)}
          onSuccess={() => setRefetchTrigger((t) => t + 1)}
          defaultPlantType={addPlantDefaultType}
          stayInGarden={false}
        />
      )}

      {scannerOpen && (
        <QRScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleQRScan}
        />
      )}

      {saveToastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-4 right-4 max-w-md mx-auto z-50 px-4 py-3 rounded-xl bg-black/85 text-white text-sm shadow-lg flex items-center justify-center"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px) + 4rem)" }}
        >
          {saveToastMessage}
        </div>
      )}
    </div>
  );
}

export default VaultPageInner;
