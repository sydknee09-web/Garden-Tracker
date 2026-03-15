"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/useToast";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { StatusFilter, VaultSortBy } from "@/types/vault";
import { LoadingState } from "@/components/LoadingState";

const SeedVaultView = dynamic(
  () => import("@/components/SeedVaultView").then((m) => ({ default: m.SeedVaultView })),
  { ssr: false, loading: () => <LoadingState className="min-h-[200px]" /> }
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
const QuickLogModal = dynamic(
  () => import("@/components/QuickLogModal").then((m) => ({ default: m.QuickLogModal })),
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
const QuickAddSupply = dynamic(
  () => import("@/components/QuickAddSupply").then((m) => ({ default: m.QuickAddSupply })),
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
import { useUniversalAddModals } from "@/contexts/UniversalAddContext";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { hasPendingReviewData, clearReviewImportData } from "@/lib/reviewImportStorage";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { useFilterState } from "@/hooks/useFilterState";
import {
  loadFilterDefault,
  saveFilterDefault,
  clearFilterDefault,
  hasFilterDefault,
  FILTER_DEFAULT_KEYS,
} from "@/lib/filterDefaults";
import { runSeedTypeBackfill } from "@/lib/backfillSeedTypes";
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
import { reassignAndMergeProfiles } from "@/lib/mergeProfiles";
import {
  shouldClearFiltersOnMount,
  clearVaultFilters,
  getNavSection,
  setLastNavSection,
} from "@/lib/navSectionClear";
import { useVault } from "@/contexts/VaultContext";
import { ICON_MAP } from "@/lib/styleDictionary";
import {
  VaultShedWingProvider,
  VaultShedWingToolbar,
  VaultShedWingContent,
  VaultShedWingModals,
  VaultShedWingBridge,
} from "@/app/vault/components/VaultShedWing";
import {
  VaultPacketWingProvider,
  VaultPacketWingToolbar,
  VaultPacketWingContent,
  VaultPacketWingRefineModal,
  VaultPacketWingBridge,
  VaultPacketWingModals,
} from "@/app/vault/components/VaultPacketWing";
import { VaultGridRefineModal, type GridRefineSection } from "@/app/vault/components/VaultGridRefineModal";


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
  const { refetchTrigger, refetch, scrollContainerRef } = useVault();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list" | "shed">(() => getInitialViewMode(searchParams));
  const [shedModalOpen, setShedModalOpen] = useState(false);
  const [shedSelectionState, setShedSelectionState] = useState<{ shedBatchSelectMode: boolean; selectedSupplyIds: Set<string> }>({ shedBatchSelectMode: false, selectedSupplyIds: new Set() });
  const shedActionsRef = useRef<{ openSelectionActions: () => void; openQuickAdd: () => void; closeAllShedModals: () => void } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [batchAddOpen, setBatchAddOpen] = useState(false);
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  const [purchaseOrderMode, setPurchaseOrderMode] = useState<"seed" | "supply">("seed");
  const [purchaseOrderAddPlantMode, setPurchaseOrderAddPlantMode] = useState(false);
  const [batchAddPlantMode, setBatchAddPlantMode] = useState(false);
  const [packetModalOpen, setPacketModalOpen] = useState(false);
  const packetActionsRef = useRef<{ openSelectionActions: () => void; closeAllPacketModals: () => void } | null>(null);

  const [qrPrefill, setQrPrefill] = useState<SeedQRPrefill | null>(null);
  const {
    addMenuOpen,
    setAddMenuOpen,
    activeModal,
    addPlantDefaultType,
    setAddPlantDefaultType,
    openMenu,
    closeMenu,
    openSeed,
    openShed,
    openPlant,
    openTask,
    openJournal,
    closeActiveModal,
    backToMenu,
    closeAll,
  } = useUniversalAddModals();

  const anyModalOpen = batchAddOpen || scannerOpen || purchaseOrderOpen || shedModalOpen || addMenuOpen || !!activeModal || packetModalOpen;
  const skipPopOnNavigateRef = useRef(false);
  useModalBackClose(anyModalOpen, useCallback(() => {
    setQrPrefill(null);
    setBatchAddOpen(false);
    setPurchaseOrderOpen(false);
    shedActionsRef.current?.closeAllShedModals?.();
    packetActionsRef.current?.closeAllPacketModals?.();
    closeAll();
    setScannerOpen(false);
  }, [closeAll]), skipPopOnNavigateRef);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const { toast: saveToastMessage, showToast: setSaveToastMessage } = useToast();
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [selectedVarietyIds, setSelectedVarietyIds] = useState<Set<string>>(new Set());
  const [filteredVarietyIds, setFilteredVarietyIds] = useState<string[]>([]);
  const [vaultHasSeeds, setVaultHasSeeds] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [pendingHeroCount, setPendingHeroCount] = useState(0);
  const [packetSelectionState, setPacketSelectionState] = useState<{ batchSelectMode: boolean; selectedPacketIds: Set<string> }>({ batchSelectMode: false, selectedPacketIds: new Set() });
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
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const [availablePlantTypes, setAvailablePlantTypes] = useState<string[]>([]);
  const [hasPendingReview, setHasPendingReview] = useState(false);
  const [gridDisplayStyle, setGridDisplayStyle] = useState<"photo" | "condensed">("condensed");
  const [refineByOpen, setRefineByOpen] = useState(false);
  const [refineBySection, setRefineBySection] = useState<GridRefineSection>(null);
  const [sortBy, setSortBy] = useState<VaultSortBy>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectionActionsOpen, setSelectionActionsOpen] = useState(false);
  const [seedTypeChips, setSeedTypeChips] = useState<{ value: string; count: number }[]>([]);
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

  const sowParam = searchParams.get("sow");
  const gridFilters = useFilterState({
    schema: "vault",
    onClear: useCallback(() => {
      if (sowParam && /^\d{4}-\d{2}$/.test(sowParam)) router.replace("/vault", { scroll: false });
    }, [sowParam, router]),
    isFilterActive: useCallback(() => !!(sowParam && /^\d{4}-\d{2}$/.test(sowParam)), [sowParam]),
    storageKey: FILTER_DEFAULT_KEYS.vaultProfiles,
  });
  const listFilters = useFilterState({
    schema: "vault",
    onClear: useCallback(() => {
      if (sowParam && /^\d{4}-\d{2}$/.test(sowParam)) router.replace("/vault", { scroll: false });
    }, [sowParam, router]),
    isFilterActive: useCallback(() => !!(sowParam && /^\d{4}-\d{2}$/.test(sowParam)), [sowParam]),
    storageKey: FILTER_DEFAULT_KEYS.vaultPackets,
  });
  const activeFilters = viewMode === "grid" ? gridFilters : listFilters;

  useEffect(() => { setHasPendingReview(hasPendingReviewData()); }, [refetchTrigger]);

  // One-time backfill: add inferred seed type tags to existing profiles
  useEffect(() => {
    if (!user?.id || viewMode !== "grid") return;
    runSeedTypeBackfill(user.id).then((didUpdate) => {
      if (didUpdate) refetch();
    });
  }, [user?.id, viewMode]);

  const handleVaultStatusChipsLoaded = useCallback((chips: { value: StatusFilter; label: string; count: number }[]) => {
    setVaultStatusChips(chips);
  }, []);
  const handleSeedTypeChipsLoaded = useCallback((chips: { value: string; count: number }[]) => {
    setSeedTypeChips(chips);
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
    gridFilters.setTags((prev) => prev.filter((t) => tags.includes(t)));
    listFilters.setTags((prev) => prev.filter((t) => tags.includes(t)));
  }, [gridFilters.setTags, listFilters.setTags]);

  useEffect(() => {
    const el = stickyHeaderRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStickyHeaderHeight(el.offsetHeight));
    ro.observe(el);
    setStickyHeaderHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [viewMode, batchSelectMode, availableTags.length, gridFilters.filters.tags.length]);

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
    else refetch();
  }, [user?.id]);

  // When landing on vault after a profile delete, refetch list and clean URL
  useEffect(() => {
    if (searchParams.get("deleted") === "1") {
      refetch();
      router.replace("/vault", { scroll: false });
    }
  }, [searchParams, router]);

  // When landing after adding packets from Import Review, force refetch so new packet shows
  useEffect(() => {
    if (searchParams.get("added") === "1") {
      refetch();
      router.replace("/vault?status=vault", { scroll: false });
    }
  }, [searchParams, router]);

  // Open Quick Add when linked from home "Add a variety I don't have"
  useEffect(() => {
    if (searchParams.get("open") === "quickadd") {
      openSeed();
      router.replace("/vault", { scroll: false });
    }
  }, [searchParams, router, openSeed]);

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
      if (tab === "active") refetch();
    }
    const status = searchParams.get("status");
    if (status === "vault" || status === "active" || status === "low_inventory" || status === "archived") {
      const tab = searchParams.get("tab");
      if (tab === "list") listFilters.setStatus(status);
      else gridFilters.setStatus(status);
      if (searchParams.get("added") === "1") setSaveToastMessage("Added to Vault!");
    }
    const sow = searchParams.get("sow");
    if (sow) {
      setViewMode("grid");
      gridFilters.setStatus("vault");
    }
  }, [searchParams, gridFilters.setStatus, listFilters.setStatus]);

  // Clear filters when arriving from a different section (must run before restore effects)
  const hasRestoredSession = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;
    if (searchParams.get("tab") || searchParams.get("status") || searchParams.get("sow")) return;
    if (shouldClearFiltersOnMount(pathname)) {
      gridFilters.clearAllFilters();
      listFilters.clearAllFilters();
      clearVaultFilters();
      hasRestoredSession.current = true;
    }
  }, [pathname, searchParams]);

  // Restore view/filter/search from sessionStorage when no URL params
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
      const savedStatus = sessionStorage.getItem("vault-status-filter");
      if (savedStatus === "active" || savedStatus === "low_inventory" || savedStatus === "archived") {
        gridFilters.setStatus(savedStatus);
        listFilters.setStatus(savedStatus);
      }
      const savedGridStatus = sessionStorage.getItem("vault-status-filter-grid");
      if (savedGridStatus === "vault" || savedGridStatus === "active" || savedGridStatus === "low_inventory" || savedGridStatus === "archived") gridFilters.setStatus(savedGridStatus);
      const savedListStatus = sessionStorage.getItem("vault-status-filter-list");
      if (savedListStatus === "vault" || savedListStatus === "active" || savedListStatus === "low_inventory" || savedListStatus === "archived") listFilters.setStatus(savedListStatus);
      const savedSearch = sessionStorage.getItem("vault-search");
      if (typeof savedSearch === "string") setSearchQuery(savedSearch);
      const loadedSort = gridFilters.loadedSort;
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
  }, [searchParams, gridFilters.setStatus, listFilters.setStatus, gridFilters.loadedSort]);

  useEffect(() => {
    if (pathname) setLastNavSection(getNavSection(pathname));
  }, [pathname]);

  // Persist view mode, status filter, and search to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("vault-view-mode", viewMode);
      sessionStorage.setItem("vault-status-filter-grid", gridFilters.filters.status);
      sessionStorage.setItem("vault-status-filter-list", listFilters.filters.status);
      sessionStorage.setItem("vault-status-filter", activeFilters.filters.status);
    } catch {
      /* ignore */
    }
  }, [viewMode, gridFilters.filters.status, listFilters.filters.status, activeFilters.filters.status]);
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
      refetch();
      setSaveToastMessage(`${count} item${count === 1 ? "" : "s"} removed from vault.`);
    }
  }, [user?.id, selectedVarietyIds]);

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
    try {
      await reassignAndMergeProfiles(supabase, mergeMasterId, sourceIds, user.id);
      setMergeInProgress(false);
      setMergeModalOpen(false);
      setSelectedVarietyIds(new Set());
      setBatchSelectMode(false);
      refetch();
      setSaveToastMessage("Profiles merged successfully.");
    } catch (err) {
      setSaveToastMessage(err instanceof Error ? err.message : "Could not merge profiles.");
      setMergeInProgress(false);
    }
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

      const displayName = p.variety_name?.trim() ? `${decodeHtmlEntities(p.name)} (${decodeHtmlEntities(p.variety_name)})` : decodeHtmlEntities(p.name);
      const noteParts: string[] = [`Sowed ${displayName}`];
      if (plantSowMethod) noteParts.push(plantSowMethod === "seed_start" ? "via seed start" : "via direct sow");
      const noteBase = noteParts.join(" ");
      const noteText = plantNotes.trim() ? `${noteBase}. ${plantNotes.trim()}` : noteBase;

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
    refetch();
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

  const toggleTagFilter = gridFilters.toggleTagFilter;

  const clearAllFilters = useCallback(() => {
    if (viewMode === "grid") gridFilters.clearAllFilters();
    else listFilters.clearAllFilters();
    setRefineByOpen(false);
    setRefineBySection(null);
  }, [viewMode, gridFilters.clearAllFilters, listFilters.clearAllFilters]);

  const clearGridFiltersAndSearch = useCallback(() => {
    setSearchQuery("");
    gridFilters.clearAllFilters();
    setRefineByOpen(false);
    setRefineBySection(null);
    if (sowParam && /^\d{4}-\d{2}$/.test(sowParam)) router.replace("/vault", { scroll: false });
  }, [gridFilters.clearAllFilters, sowParam, router]);

  const hasActiveFilters = viewMode === "grid" ? gridFilters.hasActiveFilters : listFilters.hasActiveFilters;

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
      openSeed();
    }
  }, [router, openSeed]);

  return (
    <VaultShedWingProvider viewMode={viewMode} onSaveMessage={setSaveToastMessage}>
      <VaultShedWingBridge onShedModalOpenChange={setShedModalOpen} onShedSelectionStateChange={setShedSelectionState} shedActionsRef={shedActionsRef} />
      <VaultPacketWingProvider
        viewMode={viewMode}
        vaultFilters={listFilters}
        onEmptyStateChange={(empty) => setVaultHasSeeds(!empty)}
        onSaveMessage={setSaveToastMessage}
        onOpenScanner={() => setScannerOpen(true)}
        onAddFirst={openMenu}
        sharedSearchQuery={searchQuery}
        onSyncSearchToGrid={setSearchQuery}
      >
        <VaultPacketWingBridge
          onPacketModalOpenChange={setPacketModalOpen}
          onPacketSelectionStateChange={setPacketSelectionState}
          packetActionsRef={packetActionsRef}
          sharedSearchQuery={searchQuery}
          onSyncSearchToGrid={setSearchQuery}
        />
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
              refetch();
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
              <ICON_MAP.Shovel className="w-3.5 h-3.5 animate-spin origin-center text-amber-600" aria-hidden />
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
              onClick={() => { setViewMode("grid"); setSelectedVarietyIds(new Set()); setPacketSelectionState({ batchSelectMode: false, selectedPacketIds: new Set() }); router.replace("/vault?tab=grid", { scroll: false }); }}
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
              onClick={() => { setViewMode("list"); setSelectedVarietyIds(new Set()); setPacketSelectionState({ batchSelectMode: false, selectedPacketIds: new Set() }); router.replace("/vault?tab=list", { scroll: false }); }}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-black/60 hover:text-black"
              }`}
            >
              Packets
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "shed"}
              onClick={() => { setViewMode("shed"); setSelectedVarietyIds(new Set()); setPacketSelectionState({ batchSelectMode: false, selectedPacketIds: new Set() }); router.replace("/vault?tab=shed", { scroll: false }); }}
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

        {/* Unified toolbar: grid only; list uses VaultPacketWingToolbar */}
        {viewMode === "grid" && vaultHasSeeds && (
          <>
            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <ICON_MAP.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-black/40 pointer-events-none" aria-hidden />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search plants…"
                  className="w-full rounded-xl bg-neutral-100 border-0 pl-10 pr-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-inset"
                  aria-label="Search plants"
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
                  <ICON_MAP.Filter className="w-5 h-5 shrink-0" />
                  Filter
                  {hasActiveFilters ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald text-white text-xs font-semibold">
                      {[
                        gridFilters.filters.status !== "",
                        gridFilters.filters.tags.length > 0,
                        gridFilters.filters.vendor !== null,
                        gridFilters.filters.sun !== null,
                        gridFilters.filters.spacing !== null,
                        gridFilters.filters.germination !== null,
                        gridFilters.filters.maturity !== null,
                        gridFilters.filters.packetCount !== null,
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
                {batchSelectMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchSelectMode(false);
                      setSelectedVarietyIds(new Set());
                      setSelectionActionsOpen(false);
                    }}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
                  >
                    Cancel
                  </button>
                )}
                {!batchSelectMode && (
                  <button
                    type="button"
                    onClick={() => setBatchSelectMode(true)}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
                  >
                    Select
                  </button>
                )}
                {batchSelectMode && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
                  >
                    Select All
                  </button>
                )}
                <button
                    type="button"
                    onClick={() => setGridDisplayStyle((s) => (s === "condensed" ? "photo" : "condensed"))}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/10 bg-white ml-auto hover:bg-black/5 transition-colors"
                    title={gridDisplayStyle === "condensed" ? "Photo cards" : "Condensed grid"}
                    aria-label={gridDisplayStyle === "condensed" ? "Switch to photo cards" : "Switch to condensed grid"}
                  >
                    {gridDisplayStyle === "condensed" ? <ICON_MAP.PhotoCardsGrid className="w-5 h-5" /> : <ICON_MAP.CondensedGrid className="w-5 h-5" />}
                  </button>
              </div>
            </div>

          </>
        )}

        {viewMode === "list" && vaultHasSeeds && <VaultPacketWingToolbar />}

        {/* Shed toolbar */}
        {viewMode === "shed" && <VaultShedWingToolbar />}
      </div>

      {/* Refine By pop-up modal (Plant Profiles grid only; Seed Vault list uses VaultPacketWingRefineModal) */}
      {refineByOpen && viewMode === "grid" && (
        <VaultGridRefineModal
          open={refineByOpen}
          onClose={() => { setRefineByOpen(false); setRefineBySection(null); }}
          refineBySection={refineBySection}
          setRefineBySection={setRefineBySection}
          hasActiveFilters={hasActiveFilters}
          clearAllFilters={clearAllFilters}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortDirection={sortDirection}
          setSortDirection={setSortDirection}
          vaultFilters={gridFilters}
          vaultStatusChips={vaultStatusChips}
          seedTypeChips={seedTypeChips}
          availableTags={availableTags}
          sowingMonthChips={sowingMonthChips}
          sowParam={sowParam}
          refineChips={refineChips}
          filteredVarietyIds={filteredVarietyIds}
          router={router}
        />
      )}

      {viewMode === "shed" && <VaultShedWingContent />}

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
              statusFilter={gridFilters.filters.status as StatusFilter}
              tagFilters={gridFilters.filters.tags}
              seedTypeFilters={gridFilters.filters.seedTypes}
              onTagsLoaded={handleTagsLoaded}
              onOpenScanner={() => setScannerOpen(true)}
              onAddFirst={openMenu}
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
              onSeedTypeChipsLoaded={handleSeedTypeChipsLoaded}
              vendorFilter={gridFilters.filters.vendor}
              sunFilter={gridFilters.filters.sun}
              spacingFilter={gridFilters.filters.spacing}
              germinationFilter={gridFilters.filters.germination}
              maturityFilter={gridFilters.filters.maturity}
              packetCountFilter={gridFilters.filters.packetCount}
              onRefineChipsLoaded={handleRefineChipsLoaded}
              onVaultStatusChipsLoaded={handleVaultStatusChipsLoaded}
              onSowingMonthChipsLoaded={handleSowingMonthChipsLoaded}
              hideArchivedProfiles={false}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onClearFilters={clearGridFiltersAndSearch}
            />
          </div>
          <div className={viewMode === "list" ? "block" : "hidden"} aria-hidden={viewMode !== "list"}>
            <VaultPacketWingContent />
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
                <LoadingState message="Loading…" className="py-4" />
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
                <LoadingState message="Loading plants…" className="py-4" />
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

      {/* Selection actions menu (grid only; list uses VaultPacketWingModals) */}
      {selectionActionsOpen && viewMode === "grid" && batchSelectMode && (
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
              <p className="text-sm font-medium text-black/70">
                {selectedVarietyIds.size} selected
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <button
                type="button"
                onClick={() => { setBatchDeleteConfirmOpen(true); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size === 0 || batchDeleting}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-citrus hover:bg-black/5 disabled:opacity-50"
                aria-label="Delete selected"
              >
                <ICON_MAP.Trash2 className="w-5 h-5 shrink-0" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => { goToPlantPage(); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size === 0}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                aria-label="Plant selected"
              >
                <ICON_MAP.Shovel className="w-5 h-5 shrink-0" />
                Plant
              </button>
              <button
                type="button"
                onClick={() => { handleAddToShoppingList(); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size === 0 || addingToShoppingList}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                aria-label="Add to shopping list"
              >
                <ICON_MAP.ShoppingList className="w-5 h-5 shrink-0" />
                Shopping list
              </button>
              <button
                type="button"
                onClick={() => { openScheduleModal(); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size === 0}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                aria-label="Schedule sowing"
              >
                <ICON_MAP.Calendar className="w-5 h-5 shrink-0" />
                Plan
              </button>
              <button
                type="button"
                onClick={() => { openMergeModal(); setSelectionActionsOpen(false); }}
                disabled={selectedVarietyIds.size < 2}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                aria-label="Merge selected"
              >
                <ICON_MAP.Merge className="w-5 h-5 shrink-0" />
                Merge
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
          const hasGridSelection = batchSelectMode && selectedVarietyIds.size > 0;
          const hasPacketSelection = packetSelectionState.batchSelectMode && packetSelectionState.selectedPacketIds.size > 0;
          if (viewMode === "grid" && hasGridSelection) {
            setSelectionActionsOpen(true);
          } else if (viewMode === "list" && hasPacketSelection) {
            packetActionsRef.current?.openSelectionActions?.();
          } else if (viewMode === "shed" && shedSelectionState.shedBatchSelectMode && shedSelectionState.selectedSupplyIds.size > 0) {
            shedActionsRef.current?.openSelectionActions?.();
          } else if (addMenuOpen) {
            closeMenu();
          } else {
            setAddMenuOpen(true);
          }
        }}
        className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
          (viewMode === "grid" && batchSelectMode && selectedVarietyIds.size > 0) ||
          (viewMode === "list" && packetSelectionState.batchSelectMode && packetSelectionState.selectedPacketIds.size > 0) ||
          (viewMode === "shed" && shedSelectionState.shedBatchSelectMode && shedSelectionState.selectedSupplyIds.size > 0)
            ? "bg-amber-500 text-white"
            : addMenuOpen || !!activeModal
              ? "bg-emerald-700 text-white"
              : "bg-emerald text-white"
        }`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={
          (viewMode === "grid" && batchSelectMode) || (viewMode === "list" && packetSelectionState.batchSelectMode) || (viewMode === "shed" && shedSelectionState.shedBatchSelectMode)
            ? "Selection actions"
            : addMenuOpen
              ? "Close add menu"
              : "Add"
        }
      >
        {(viewMode === "grid" && batchSelectMode && selectedVarietyIds.size > 0) ||
        (viewMode === "list" && packetSelectionState.batchSelectMode && packetSelectionState.selectedPacketIds.size > 0) ||
        (viewMode === "shed" && shedSelectionState.shedBatchSelectMode && shedSelectionState.selectedSupplyIds.size > 0) ? (
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
            className={`transition-transform duration-200 ${addMenuOpen || !!activeModal ? "rotate-45" : "rotate-0"}`}
            aria-hidden
          >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        )}
      </button>

      {addMenuOpen && (
        <UniversalAddMenu
          open={addMenuOpen}
          onClose={closeMenu}
          pathname={pathname ?? "/vault"}
          addPlantDefaultType={addPlantDefaultType}
          setAddPlantDefaultType={setAddPlantDefaultType}
          onAddSeed={openSeed}
          onAddPlantManual={openPlant}
          onAddPlantFromVault={() => {
            skipPopOnNavigateRef.current = true;
            closeAll();
            router.push("/vault/plant?from=vault");
          }}
          onAddPlantPurchaseOrder={() => {
            closeAll();
            setPurchaseOrderMode("seed");
            setPurchaseOrderAddPlantMode(true);
            setPurchaseOrderOpen(true);
          }}
          onAddPlantPhotoImport={() => {
            closeAll();
            setBatchAddPlantMode(true);
            setBatchAddOpen(true);
          }}
          onAddToShed={openShed}
          onAddTask={openTask}
          onAddJournal={openJournal}
        />
      )}

      {activeModal === "journal" && (
        <QuickLogModal
          open
          onClose={closeActiveModal}
          onJournalAdded={() => {
            router.refresh();
            closeActiveModal();
            refetch();
          }}
        />
      )}

      {activeModal === "task" && (
        <NewTaskModal
          open
          onClose={closeActiveModal}
          onBackToMenu={backToMenu}
        />
      )}

      {activeModal === "seed" && (
        <QuickAddSeed
          open
          onClose={() => { setQrPrefill(null); closeActiveModal(); }}
          onBackToMenu={() => { setQrPrefill(null); backToMenu(); }}
          onSuccess={(opts) => {
            if (opts?.newProfileId) {
              closeActiveModal();
              router.push(`/vault/${opts.newProfileId}?added=1`);
              return;
            }
            refetch();
            router.refresh();
            if (opts?.photoBlocked) {
              setSaveToastMessage("Seed details saved. Product photo could not be saved.");
            }
          }}
          initialPrefill={qrPrefill}
          onOpenBatch={() => {
            closeActiveModal();
            setBatchAddPlantMode(false);
            setBatchAddOpen(true);
          }}
          onOpenLinkImport={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            router.push("/vault/import?embed=1");
          }}
          onStartManualImport={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            router.push("/vault/import/manual");
          }}
          onOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            setPurchaseOrderMode("seed");
            setPurchaseOrderAddPlantMode(false);
            setPurchaseOrderOpen(true);
          }}
        />
      )}

      {activeModal === "shed" && (
        <QuickAddSupply
          open
          onClose={closeActiveModal}
          onSuccess={() => refetch()}
          onBackToMenu={backToMenu}
          onOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            setPurchaseOrderMode("supply");
            setPurchaseOrderOpen(true);
          }}
          onOpenBatchPhotoImport={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            router.push("/shed/review-import");
          }}
        />
      )}

      {batchAddOpen && (
        <BatchAddSeed
          open={batchAddOpen}
          onClose={() => setBatchAddOpen(false)}
          onSuccess={() => refetch()}
          onNavigateToHero={() => {
            skipPopOnNavigateRef.current = true;
            setBatchAddOpen(false);
            router.push("/vault/import/photos/hero");
          }}
          addPlantMode={batchAddPlantMode}
          defaultProfileType={batchAddPlantMode ? (addPlantDefaultType === "permanent" ? "permanent" : "seed") : undefined}
        />
      )}

      {purchaseOrderOpen && (
      <PurchaseOrderImport
        open={purchaseOrderOpen}
        onClose={() => setPurchaseOrderOpen(false)}
        mode={purchaseOrderMode}
        defaultProfileType={purchaseOrderAddPlantMode ? (addPlantDefaultType === "permanent" ? "permanent" : "seed") : purchaseOrderMode === "seed" ? "seed" : undefined}
        addPlantMode={purchaseOrderMode === "seed" ? purchaseOrderAddPlantMode : false}
      />
      )}

      <VaultShedWingModals
        onOpenUniversalAddMenu={openMenu}
        onOpenPurchaseOrderSupply={() => {
          skipPopOnNavigateRef.current = true;
          setPurchaseOrderMode("supply");
          setPurchaseOrderOpen(true);
        }}
        skipPopOnNavigateRef={skipPopOnNavigateRef}
      />

      {activeModal === "plant" && (
        <AddPlantModal
          open
          onClose={closeActiveModal}
          onSuccess={() => { closeActiveModal(); refetch(); }}
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

      {saveToastMessage}
    </div>
    <VaultPacketWingRefineModal />
    <VaultPacketWingModals />
    </VaultPacketWingProvider>
    </VaultShedWingProvider>
  );
}

export default VaultPageInner;
