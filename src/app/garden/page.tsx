"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { GardenView, type GardenViewHandle } from "@/components/GardenView";
import { GroupTabs, type SelectedGroup } from "@/components/GroupTabs";
import { HarvestModal } from "@/components/HarvestModal";
import dynamic from "next/dynamic";
import { AddPlantModal } from "@/components/AddPlantModal";
import { PurchaseOrderImport } from "@/components/PurchaseOrderImport";

const UniversalAddMenu = dynamic(
  () => import("@/components/UniversalAddMenu").then((m) => ({ default: m.UniversalAddMenu })),
  { ssr: false }
);
const QuickAddSeed = dynamic(
  () => import("@/components/QuickAddSeed").then((m) => ({ default: m.QuickAddSeed })),
  { ssr: false }
);
const BatchAddSeed = dynamic(
  () => import("@/components/BatchAddSeed").then((m) => ({ default: m.BatchAddSeed })),
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
const NewTaskModal = dynamic(
  () => import("@/components/NewTaskModal").then((m) => ({ default: m.NewTaskModal })),
  { ssr: false }
);
const QuickLogModal = dynamic(
  () => import("@/components/QuickLogModal").then((m) => ({ default: m.QuickLogModal })),
  { ssr: false }
);
const GrowInstanceModal = dynamic(
  () => import("@/components/GrowInstanceModal").then((m) => ({ default: m.GrowInstanceModal })),
  { ssr: false }
);
import { getTagStyle } from "@/components/TagBadges";
import { supabase } from "@/lib/supabase";
import { revertProfileStatusIfNoActiveGrows } from "@/lib/revertProfileStatus";
import { insertWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { useUniversalAddModals } from "@/contexts/UniversalAddContext";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { compressImage } from "@/lib/compressImage";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { useDebounce } from "@/hooks/useDebounce";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "@/hooks/useToast";
import { useDesktopPhotoCapture } from "@/hooks/useDesktopPhotoCapture";
import { useFilterState } from "@/hooks/useFilterState";
import { FILTER_DEFAULT_KEYS } from "@/lib/filterDefaults";
import { generateCareTasks } from "@/lib/generateCareTasks";
import type { RefineChips, Group } from "@/types/garden";
import { fetchUserGroups } from "@/lib/groups";

type GrowingBatchForLog = { id: string; plant_profile_id: string; profile_name: string; profile_variety_name: string | null };

function GardenPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // B2: unified Garden tab; selected group drives client-side filter via instance.groups[].
  // sessionStorage key: "all" sentinel or a group UUID. Legacy values ("active"/"plants") from
  // pre-B2 dual-tab era map → "all" so users don't get stuck on a stale tab indicator.
  const [selectedGroup, setSelectedGroup] = useSessionStorage<SelectedGroup>("garden-selected-group", "all", {
    serialize: (v) => v,
    deserialize: (s) => (s === "active" || s === "plants" ? "all" : (s || "all") as SelectedGroup),
  });
  const tabParam = searchParams.get("tab");
  const groupParam = searchParams.get("group");
  const effectiveGroup: SelectedGroup = groupParam || (tabParam === "active" || tabParam === "plants" ? "all" : selectedGroup);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const { toast, showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryChips, setCategoryChips] = useState<{ type: string; count: number }[]>([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [refineByOpen, setRefineByOpen] = useState(false);
  const [refineBySection, setRefineBySection] = useState<"plantType" | "variety" | "sun" | "spacing" | "germination" | "maturity" | "tags" | "sort" | null>(null);
  const [refineChips, setRefineChips] = useState<RefineChips | null>(null);

  const profileParam = searchParams.get("profile");
  const fromParam = searchParams.get("from");
  const closeRefinePanel = useCallback(() => {
    setRefineByOpen(false);
    setRefineBySection(null);
  }, []);
  // B2: single unified filter state (replaces the prior dual per-tab filter pair).
  // Sort default `sown_date desc` per VISION §8 default-sort-by-use-case lock (Garden is a
  // discovery surface — most-recent first). `care_count` axis dropped vs. legacy My Plants.
  const filters = useFilterState({
    schema: "garden",
    onClear: closeRefinePanel,
    isFilterActive: () => !!profileParam,
    storageKey: FILTER_DEFAULT_KEYS.gardenActive,
  });
  const [sortBy, setSortBy] = useSessionStorage<"name" | "sown_date" | "harvest_date">("garden-sort-by", "sown_date", {
    serialize: (v) => v,
    deserialize: (s) => (s === "name" || s === "sown_date" || s === "harvest_date" ? s : "sown_date"),
  });
  const [sortDir, setSortDir] = useSessionStorage<"asc" | "desc">("garden-sort-dir", "desc", {
    serialize: (v) => v,
    deserialize: (s) => (s === "asc" || s === "desc" ? s : "desc"),
  });
  const sortLoadedRef = useRef(false);
  useEffect(() => {
    const ls = filters.loadedSort;
    if (ls && !sortLoadedRef.current) {
      sortLoadedRef.current = true;
      if (["name", "sown_date", "harvest_date"].includes(ls.sortBy)) {
        setSortBy(ls.sortBy as "name" | "sown_date" | "harvest_date");
        setSortDir(ls.sortDir);
      }
    }
  }, [filters.loadedSort, setSortBy, setSortDir]);
  const [openBulkJournal, setOpenBulkJournal] = useState(false);
  const [bulkSelectedCount, setBulkSelectedCount] = useState(0);
  const [bulkModeActive, setBulkModeActive] = useState(false);
  const [openBulkLog, setOpenBulkLog] = useState(false);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  // Door 3 — batch "Move to group" destination picker.
  const [moveGroupPickerOpen, setMoveGroupPickerOpen] = useState(false);
  const [moveGroups, setMoveGroups] = useState<Group[]>([]);
  const [moving, setMoving] = useState(false);
  const {
    addMenuOpen,
    setAddMenuOpen,
    activeModal,
    addPlantDefaultType,
    setAddPlantDefaultType,
    openMenu,
    closeMenu,
    openShed,
    shedInitialName,
    openPlant,
    closeActiveModal,
    backToMenu,
    closeAll,
    openMenuOnScreen,
  } = useUniversalAddModals();
  const [displayStyle, setDisplayStyle] = useSessionStorage<"grid" | "list">("garden-display-style", "grid", {
    serialize: (v) => v,
    deserialize: (s) => (s === "grid" || s === "list" ? s : "grid"),
  });

  const MAX_JOURNAL_PHOTOS = 10;
  const quickAddFileRef = useRef<HTMLInputElement>(null);
  const quickAddGalleryRef = useRef<HTMLInputElement>(null);
  const gardenRef = useRef<GardenViewHandle | null>(null);
  const [selectionActionsOpen, setSelectionActionsOpen] = useState(false);
  const [logHarvestBatch, setLogHarvestBatch] = useState<GrowingBatchForLog | null>(null);
  const [quickAddJournalOpen, setQuickAddJournalOpen] = useState(false);
  const [quickAddNote, setQuickAddNote] = useState("");
  const [quickAddPhotos, setQuickAddPhotos] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  const [purchaseOrderMode, setPurchaseOrderMode] = useState<"seed" | "supply">("seed");
  const [purchaseOrderAddPlantMode, setPurchaseOrderAddPlantMode] = useState(false);
  const [batchAddPlantMode, setBatchAddPlantMode] = useState(false);
  const [batchAddSeedOpen, setBatchAddSeedOpen] = useState(false);
  const [batchAddSupplyOpen, setBatchAddSupplyOpen] = useState(false);
  const skipPopOnNavigateRef = useRef(false);
  useModalBackClose(addMenuOpen, closeMenu, skipPopOnNavigateRef);
  const [profileFilteredPlantName, setProfileFilteredPlantName] = useState<string | null>(null);
  const [profileFilterEmpty, setProfileFilterEmpty] = useState(false);
  const [highlightedBatch, setHighlightedBatch] = useState<{ id: string; profile_name: string; profile_variety_name: string | null } | null>(null);
  const [highlightResolved, setHighlightResolved] = useState(false);

  const addQuickAddPhoto = useCallback((file: File) => {
    setQuickAddPhotos((prev) => (prev.length >= MAX_JOURNAL_PHOTOS ? prev : [...prev, { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }]));
  }, []);
  const quickAddWebcam = useDesktopPhotoCapture(addQuickAddPhoto);

  const growParam = searchParams.get("grow");

  useEffect(() => {
    if (user?.id) generateCareTasks(user.id);
  }, [user?.id]);

  // B2: unified Garden tab has no lifecycle-based default for add-plant type.
  // Default to "seasonal" (the more common path) — user picks perennial via the form's toggle.
  useEffect(() => {
    if (addMenuOpen) {
      setAddPlantDefaultType("seasonal");
    }
  }, [addMenuOpen, setAddPlantDefaultType]);

  useEffect(() => {
    if (!profileParam) {
      setProfileFilteredPlantName(null);
      setProfileFilterEmpty(false);
    }
  }, [profileParam]);

  useEffect(() => {
    if (!growParam) {
      setHighlightedBatch(null);
      setHighlightResolved(false);
    } else {
      setHighlightResolved(false);
    }
  }, [growParam]);

  const handleHighlightedBatch = useCallback((batch: { id: string; profile_name: string; profile_variety_name: string | null } | null) => {
    setHighlightedBatch(batch);
    setHighlightResolved(true);
  }, []);

  // Auto-clear stale grow param when batch not found — rescues user from "0 items" trap
  const hasClearedStaleGrowRef = useRef(false);
  useEffect(() => {
    if (highlightResolved && !highlightedBatch && growParam && !hasClearedStaleGrowRef.current) {
      hasClearedStaleGrowRef.current = true;
      router.replace("/garden");
    }
    if (!growParam) hasClearedStaleGrowRef.current = false;
  }, [highlightResolved, highlightedBatch, growParam, router]);

  // B2: one-time URL migration — legacy /garden?tab=active|plants → /garden (clean URL).
  // Preserves grow/profile/from params if present.
  const hasMigratedTabParamRef = useRef(false);
  useEffect(() => {
    if (hasMigratedTabParamRef.current) return;
    if (tabParam === "active" || tabParam === "plants") {
      hasMigratedTabParamRef.current = true;
      const preserved: string[] = [];
      if (growParam) preserved.push(`grow=${encodeURIComponent(growParam)}`);
      if (profileParam) preserved.push(`profile=${encodeURIComponent(profileParam)}`);
      if (fromParam) preserved.push(`from=${encodeURIComponent(fromParam)}`);
      const qs = preserved.length > 0 ? `?${preserved.join("&")}` : "";
      router.replace(`/garden${qs}`);
    }
  }, [tabParam, growParam, profileParam, fromParam, router]);

  // B2: sync sessionStorage from URL group param when present (URL is source of truth per Library
  // regression lock `c45d6c6` — URL wins on every render; sessionStorage fills the gap only when
  // URL is bare).
  useEffect(() => {
    if (groupParam) setSelectedGroup(groupParam as SelectedGroup);
  }, [groupParam, setSelectedGroup]);

  const setGroup = useCallback(
    (group: SelectedGroup) => {
      setSelectedGroup(group);
      const preserved: string[] = [];
      if (group !== "all") preserved.push(`group=${encodeURIComponent(group)}`);
      if (growParam) preserved.push(`grow=${encodeURIComponent(growParam)}`);
      if (profileParam) preserved.push(`profile=${encodeURIComponent(profileParam)}`);
      const qs = preserved.length > 0 ? `?${preserved.join("&")}` : "";
      router.replace(`/garden${qs}`);
    },
    [setSelectedGroup, router, growParam, profileParam]
  );

  const searchDebounced = useDebounce(searchQuery, 300);

  useEscapeKey(addMenuOpen || !!activeModal, closeAll);
  useEscapeKey(refineByOpen, () => { setRefineByOpen(false); setRefineBySection(null); });
  useEscapeKey(
    !addMenuOpen && !refineByOpen && (!!profileParam || !!growParam),
    () => { if (profileParam) clearProfileFilter(); else if (growParam) clearGrowView(); }
  );

  const handleCategoryChipsLoaded = useCallback((chips: { type: string; count: number }[]) => {
    setCategoryChips(chips);
  }, []);
  const handleRefineChipsLoaded = useCallback((chips: RefineChips) => {
    setRefineChips(chips);
  }, []);

  const buildGardenUrl = useCallback(() => {
    const preserved: string[] = [];
    if (effectiveGroup !== "all") preserved.push(`group=${encodeURIComponent(effectiveGroup)}`);
    return preserved.length > 0 ? `/garden?${preserved.join("&")}` : "/garden";
  }, [effectiveGroup]);

  const clearAllFilters = useCallback(() => {
    filters.clearAllFilters();
    if (profileParam) router.replace(buildGardenUrl());
  }, [filters.clearAllFilters, profileParam, router, buildGardenUrl]);

  const clearProfileFilter = useCallback(() => {
    filters.clearAllFilters();
    if (profileParam) router.replace(buildGardenUrl());
  }, [filters.clearAllFilters, profileParam, router, buildGardenUrl]);

  const clearSearchAndFilters = useCallback(() => {
    setSearchQuery("");
    filters.clearAllFilters();
    if (growParam || profileParam) router.replace(buildGardenUrl());
  }, [filters.clearAllFilters, growParam, profileParam, router, buildGardenUrl]);

  const clearGrowView = useCallback(() => {
    if (growParam) router.replace(buildGardenUrl());
  }, [growParam, router, buildGardenUrl]);

  const filterCount = filters.filterCount;

  const openLogHarvest = useCallback((batch: GrowingBatchForLog) => {
    setLogHarvestBatch(batch);
  }, []);

  const handleQuickAddSubmit = useCallback(async () => {
    if (!user?.id) return;
    const noteTrim = quickAddNote.trim() || null;
    const uploadedPaths: string[] = [];
    for (const p of quickAddPhotos) {
      setQuickAddSaving(true);
      const { blob } = await compressImage(p.file);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
      if (upErr) {
        setQuickAddError(upErr.message || "Failed to upload photo.");
        setQuickAddSaving(false);
        return;
      }
      uploadedPaths.push(path);
    }
    const firstPath = uploadedPaths[0] ?? null;
    if (!noteTrim && uploadedPaths.length === 0) {
      setQuickAddError("Add a note or photo.");
      return;
    }
    setQuickAddSaving(true);
    setQuickAddError(null);
    const weatherSnapshot = await fetchWeatherSnapshot();
    const toInsert: Array<{ growId: string | null; profileId: string | null; userId?: string | null }> = [{ growId: null, profileId: null }];
    let insertErr: { message: string } | null = null;
    const hasPhoto = uploadedPaths.length > 0;
    try {
      for (const { growId, profileId } of toInsert) {
        if (hasPhoto) {
          const { data: entry, error } = await supabase.from("journal_entries").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growId,
            seed_packet_id: null,
            note: noteTrim,
            entry_type: "note",
            image_file_path: firstPath,
            weather_snapshot: weatherSnapshot ?? undefined,
          }).select("id").single();
          if (error) {
            insertErr = error;
            break;
          }
          if (entry && uploadedPaths.length > 0) {
            await supabase.from("journal_entry_photos").insert(uploadedPaths.map((path, i) => ({ journal_entry_id: (entry as { id: string }).id, image_file_path: path, sort_order: i, user_id: user.id })));
          }
        } else {
          const { error } = await insertWithOfflineQueue("journal_entries", {
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growId,
            seed_packet_id: null,
            note: noteTrim,
            entry_type: "note",
            image_file_path: null,
            weather_snapshot: weatherSnapshot ?? undefined,
          } as Record<string, unknown>);
          if (error) {
            insertErr = error;
            break;
          }
        }
      }
    } finally {
      setQuickAddSaving(false);
    }
    if (insertErr) {
      setQuickAddError(insertErr.message);
      return;
    }
    setQuickAddJournalOpen(false);
    setQuickAddNote("");
    quickAddPhotos.forEach((p) => { if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl); });
    setQuickAddPhotos([]);
    setRefetchTrigger((t) => t + 1);
  }, [user?.id, quickAddNote, quickAddPhotos]);

  // Door 3 — batch "Move to group". Opens a destination picker; applies to all
  // selected plants via the GardenView imperative handle (single-membership +
  // auto-journal handled in setInstanceGroup). "Mark as perennial/annual" bulk
  // actions removed — annual/perennial is now a variety-level edit at the Library
  // (profile_type), not a per-plant batch action.
  const openMoveGroupPicker = useCallback(async () => {
    setSelectionActionsOpen(false);
    if (user?.id) {
      const groups = await fetchUserGroups(supabase, user.id);
      setMoveGroups(groups);
    }
    setMoveGroupPickerOpen(true);
  }, [user?.id]);

  const handleMoveSelectedToGroup = useCallback(
    async (next: { id: string; name: string } | null) => {
      setMoving(true);
      try {
        await gardenRef.current?.assignSelectedToGroup(next);
        setBulkToast(next ? `Moved to ${next.name}` : "Removed from group");
      } catch {
        setBulkToast("Couldn't move plants — try again.");
      } finally {
        setMoving(false);
        setMoveGroupPickerOpen(false);
        setRefetchTrigger((t) => t + 1);
        setTimeout(() => setBulkToast(null), 2000);
      }
    },
    []
  );

  return (
    <div className="min-h-screen pb-24">
      {toast}
      <div className="px-6 pt-0 pb-6">
        <div className="sticky top-11 z-40 -mx-6 px-6 pt-1 pb-2 bg-white/95 backdrop-blur-md border-b border-black/5 shadow-sm">
          {/* B2: GroupTabs replaces Active Garden / My Plants dual-tab toggle.
              Vault sub-tab primitive cohesion anchor — same emerald-500 STATE token (VISION §8). */}
          <GroupTabs
            selectedGroup={effectiveGroup}
            onSelectGroup={setGroup}
            refetchTrigger={refetchTrigger}
            onMutated={() => setRefetchTrigger((t) => t + 1)}
          />

        {/* Always show toolbar (search, filter, toggle) so users can search/add even when list is empty */}
            <div className="flex gap-2 mb-2 mt-2">
              <div className="flex-1 relative">
                <ICON_MAP.Search stroke="currentColor" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none w-[18px] h-[18px]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your garden…"
                  className="w-full rounded-xl bg-neutral-100 border-0 pl-10 pr-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-inset"
                  aria-label="Search plants"
                />
              </div>
            </div>

            {/* Filter/view chips: show when navigating from plant profile or instance deep-link */}
            {(profileParam || growParam) ? (
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {profileParam && (
                  <span className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-sm font-medium">
                    Showing: {profileFilterEmpty ? "No plants match" : (profileFilteredPlantName ?? "Loading…")}
                    <button
                      type="button"
                      onClick={clearProfileFilter}
                      className="min-w-[44px] min-h-[44px] -m-1 flex items-center justify-center rounded-lg hover:bg-emerald-100/80 transition-colors"
                      aria-label="Clear filter and show all plants"
                    >
                      <span aria-hidden>×</span>
                    </button>
                  </span>
                )}
                {growParam && (
                  <span className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-sm font-medium">
                    Viewing: {!highlightResolved ? "Loading…" : highlightedBatch ? (highlightedBatch.profile_variety_name?.trim() ? `${highlightedBatch.profile_name} (${highlightedBatch.profile_variety_name})` : highlightedBatch.profile_name) : "Planting not found"}
                    <button
                      type="button"
                      onClick={clearGrowView}
                      className="min-w-[44px] min-h-[44px] -m-1 flex items-center justify-center rounded-lg hover:bg-emerald-100/80 transition-colors"
                      aria-label="Clear view and show all plantings"
                    >
                      <span aria-hidden>×</span>
                    </button>
                  </span>
                )}
              </div>
            ) : null}

            {/* Mobile rescue: when 0 items and filter applied, show prominent "Show all" so user can clear without scrolling */}
            {filteredCount === 0 && (growParam || profileParam) && (
              <div className="flex items-center justify-between gap-3 mb-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-sm text-amber-800">No items match. Clear to see all.</span>
                <button
                  type="button"
                  onClick={growParam ? clearGrowView : clearProfileFilter}
                  className="min-h-[44px] min-w-[44px] shrink-0 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
                >
                  Show All
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => { setRefineByOpen(true); setRefineBySection(null); }}
                className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 flex items-center gap-2"
                aria-label="Filter by plant type"
              >
                <ICON_MAP.Filter className="w-5 h-5 shrink-0" />
                Filter
                {filterCount > 0 ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald text-white text-xs font-semibold">
                    {filterCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (bulkModeActive) gardenRef.current?.exitBulkMode();
                  else gardenRef.current?.enterBulkMode();
                }}
                className={`min-h-[44px] min-w-[44px] rounded-xl border px-4 py-2 text-sm font-medium flex items-center gap-2 ${
                  bulkModeActive
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-black/10 bg-white text-black/80 hover:bg-black/5"
                }`}
                aria-label={bulkModeActive ? "Cancel selection" : "Select items"}
              >
                {bulkModeActive ? "Cancel" : "Select"}
              </button>
              {filterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald/10 shrink-0"
                  aria-label="Clear All Filters"
                >
                  Clear filters
                </button>
              )}
              <span className="text-sm text-black/50">
                {filteredCount} item{filteredCount !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => setDisplayStyle((s) => (s === "grid" ? "list" : "grid"))}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/10 bg-white ml-auto hover:bg-black/5 transition-colors"
                title={displayStyle === "grid" ? "List View" : "Grid View"}
                aria-label={displayStyle === "grid" ? "Switch to list view" : "Switch to grid view"}
              >
                {displayStyle === "grid" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                ) : (
                  <ICON_MAP.PhotoCardsGrid stroke="currentColor" className="w-5 h-5" />
                )}
              </button>
            </div>
        </div>

        {refineByOpen && (
          <>
            <button type="button" className="fixed inset-0 z-50 bg-black/20" aria-label="Close" onClick={() => { setRefineByOpen(false); setRefineBySection(null); }} />
            <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[51] bg-white rounded-2xl shadow-lg border border-black/10 flex flex-col max-h-[85vh] min-h-0">
              <header className="flex items-center justify-between gap-2 p-4 border-b border-black/10">
                <h2 id="refine-by-title" className="text-lg font-semibold text-black">Filter</h2>
                <div className="flex items-center gap-1">
                  {filterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                      aria-label="Clear All Filters"
                    >
                      Clear Filters
                    </button>
                  )}
                  <button type="button" onClick={() => { setRefineByOpen(false); setRefineBySection(null); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/60 hover:bg-black/5" aria-label="Close">
                    <span className="text-xl leading-none" aria-hidden>×</span>
                  </button>
                </div>
              </header>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="border-b border-black/5">
                  <button
                    type="button"
                    onClick={() => setRefineBySection((s) => (s === "sort" ? null : "sort"))}
                    className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                    aria-expanded={refineBySection === "sort"}
                  >
                    <span>Sort By</span>
                    <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sort" ? "▴" : "▾"}</span>
                  </button>
                  {refineBySection === "sort" && (
                    <div className="px-4 pb-3 pt-0 space-y-0.5">
                      <>
                        {(["name", "sown_date", "harvest_date"] as const).map((opt) => {
                          const selected = sortBy === opt;
                          const label = opt === "name" ? "Name" : opt === "sown_date" ? "Date sown" : "Harvest date";
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                if (sortBy === opt) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                                else setSortBy(opt);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                            >
                              {label}
                              {selected && <span className="text-xs text-black/50">{sortDir === "asc" ? "↑" : "↓"}</span>}
                            </button>
                          );
                        })}
                      </>
                    </div>
                  )}
                </div>
                <div className="border-b border-black/5">
                  <button
                    type="button"
                    onClick={() => setRefineBySection((s) => (s === "plantType" ? null : "plantType"))}
                    className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                    aria-expanded={refineBySection === "plantType"}
                  >
                    <span>Plant Type</span>
                    <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "plantType" ? "▴" : "▾"}</span>
                  </button>
                  {refineBySection === "plantType" && (
                    <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                      <button
                        type="button"
                        onClick={() => filters.setCategory(null)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm bg-emerald/10 text-emerald-800 font-medium"
                      >
                        All
                      </button>
                      {categoryChips.map(({ type, count }) => {
                        const selected = filters.filters.category === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => filters.setCategory(type)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                          >
                            {type} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {(() => {
                  const chips = refineChips;
                  const f = filters;
                  const setVariety = f.setVariety;
                  const setSun = f.setSun;
                  const setSpacing = f.setSpacing;
                  const setGermination = f.setGermination;
                  const setMaturity = f.setMaturity;
                  const varietyFilter = f.filters.variety;
                  const sunFilter = f.filters.sun;
                  const spacingFilter = f.filters.spacing;
                  const germinationFilter = f.filters.germination;
                  const maturityFilter = f.filters.maturity;
                  const tagFilters = f.filters.tags;
                  const toggleTag = f.toggleTagFilter;
                  if (!chips) return null;
                  return (
                    <>
                      {chips.variety.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "variety" ? null : "variety"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "variety"}>
                            <span>Variety</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "variety" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "variety" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                              <button type="button" onClick={() => setVariety(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${varietyFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {chips.variety.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setVariety(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${varietyFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {chips.sun.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "sun" ? null : "sun"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "sun"}>
                            <span>Sun</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sun" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "sun" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                              <button type="button" onClick={() => setSun(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sunFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {chips.sun.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setSun(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sunFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {chips.spacing.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "spacing" ? null : "spacing"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "spacing"}>
                            <span>Spacing</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "spacing" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "spacing" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                              <button type="button" onClick={() => setSpacing(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${spacingFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {chips.spacing.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setSpacing(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${spacingFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {chips.germination.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "germination" ? null : "germination"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "germination"}>
                            <span>Germination</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "germination" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "germination" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                              <button type="button" onClick={() => setGermination(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${germinationFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {chips.germination.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setGermination(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${germinationFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {chips.maturity.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "maturity" ? null : "maturity"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "maturity"}>
                            <span>Maturity</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "maturity" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "maturity" && (
                            <div className="px-4 pb-3 pt-0 space-y-0.5">
                              <button type="button" onClick={() => setMaturity(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${maturityFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {chips.maturity.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setMaturity(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${maturityFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value === "<60" ? "<60 days" : value === "60-90" ? "60–90 days" : "90+ days"} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {chips.tags.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "tags" ? null : "tags"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "tags"}>
                            <span>Tags</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "tags" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "tags" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                              {chips.tags.map((tag) => {
                                const checked = tagFilters.includes(tag);
                                return (
                                  <label key={tag} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]">
                                    <input type="checkbox" checked={checked} onChange={() => toggleTag(tag)} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" aria-label={`Filter by ${tag}`} />
                                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${getTagStyle(tag)}`}>{tag}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <footer className="flex-shrink-0 border-t border-black/10 px-4 py-3 space-y-2">
                {(() => {
                  const f = filters;
                  const handleSaveDefault = () => f.saveAsDefault({ sortBy, sortDir });
                  return (
                    <div className="flex items-center gap-2">
                      {!f.hasDefault && (
                        <button
                          type="button"
                          onClick={handleSaveDefault}
                          className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                          aria-label="Save current filters and sort as default"
                        >
                          Save Default
                        </button>
                      )}
                      {f.hasDefault && (
                        <button
                          type="button"
                          onClick={f.clearDefault}
                          className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-black/60 hover:bg-black/5"
                          aria-label="Reset saved default filters"
                        >
                          Reset Default
                        </button>
                      )}
                    </div>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => { setRefineByOpen(false); setRefineBySection(null); }}
                  className="w-full min-h-[48px] rounded-xl bg-emerald text-white font-medium text-sm"
                >
                  Show Results ({filteredCount})
                </button>
              </footer>
            </div>
          </>
        )}

        {/* B2: unified view consumes fetchAllUserGrowInstances (B1 helper).
            Card-tap → /garden?grow=<id> (instance modal everywhere — fixes the prior
            My-Plants → /vault/<profile> divergence flagged by Syd 2026-05-29). */}
        <div className="pt-2">
          <GardenView
            ref={gardenRef}
            refetchTrigger={refetchTrigger}
            highlightGrowId={growParam}
            onHighlightedBatch={handleHighlightedBatch}
            onClearGrowView={clearGrowView}
            onClearFilters={clearSearchAndFilters}
            onSaveMessage={showToast}
            searchQuery={searchDebounced}
            groupFilter={effectiveGroup}
            onLogHarvest={openLogHarvest}
            categoryFilter={filters.filters.category}
            onCategoryChipsLoaded={handleCategoryChipsLoaded}
            varietyFilter={filters.filters.variety}
            sunFilter={filters.filters.sun}
            spacingFilter={filters.filters.spacing}
            germinationFilter={filters.filters.germination}
            maturityFilter={filters.filters.maturity}
            tagFilters={filters.filters.tags}
            onRefineChipsLoaded={handleRefineChipsLoaded}
            onFilteredCountChange={setFilteredCount}
            onEmptyStateChange={() => { /* not used in B2; reserved for future */ }}
            openBulkJournalRequest={openBulkJournal}
            onBulkJournalRequestHandled={() => setOpenBulkJournal(false)}
            onBulkSelectionChange={setBulkSelectedCount}
            openBulkLogRequest={openBulkLog}
            onBulkLogRequestHandled={() => setOpenBulkLog(false)}
            onBulkModeChange={setBulkModeActive}
            displayStyle={displayStyle}
            sortBy={sortBy}
            sortDir={sortDir}
          />
        </div>
      </div>

      {/* B2: Log Growth standalone modal removed — BatchLogSheet inside GardenView handles
          quick journal entries via the row Edit button. */}

      <HarvestModal
        open={!!logHarvestBatch}
        onClose={() => setLogHarvestBatch(null)}
        onSaved={() => { setRefetchTrigger((p: number) => p + 1); setLogHarvestBatch(null); showToast("Harvest logged"); }}
        profileId={logHarvestBatch?.plant_profile_id ?? ""}
        growInstanceId={logHarvestBatch?.id ?? ""}
        displayName={logHarvestBatch ? (logHarvestBatch.profile_variety_name?.trim() ? `${decodeHtmlEntities(logHarvestBatch.profile_name)} (${decodeHtmlEntities(logHarvestBatch.profile_variety_name)})` : decodeHtmlEntities(logHarvestBatch.profile_name)) : ""}
      />

      {/* B2: End Crop standalone confirm removed — GardenView's End Batch modal handles it
          via the bulk-end-batch and single-row End Batch paths. */}

      {quickAddJournalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-black">Add Journal Entry</h2>
              {bulkSelectedCount > 0 && (
                <p className="text-sm text-black/60 mt-1">{bulkSelectedCount} plant{bulkSelectedCount !== 1 ? "s" : ""} selected</p>
              )}
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-medium text-black/60 mb-1">Note (required)</label>
                <textarea value={quickAddNote} onChange={(e) => setQuickAddNote(e.target.value)} placeholder="What did you notice?" rows={3} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-black/60 mb-1">Photo (optional, max {MAX_JOURNAL_PHOTOS})</label>
                <input ref={quickAddFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && quickAddPhotos.length < MAX_JOURNAL_PHOTOS) { setQuickAddPhotos((prev) => [...prev, { id: crypto.randomUUID(), file: f, previewUrl: URL.createObjectURL(f) }]); } e.target.value = ""; }} />
                <input ref={quickAddGalleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = e.target.files; if (files?.length) { setQuickAddPhotos((prev) => { const toAdd = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, MAX_JOURNAL_PHOTOS - prev.length); return [...prev, ...toAdd.map((f) => ({ id: crypto.randomUUID(), file: f, previewUrl: URL.createObjectURL(f) }))]; }); } e.target.value = ""; }} />
                {quickAddWebcam.webcamActive ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video ref={quickAddWebcam.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={quickAddWebcam.captureFromWebcam} className="min-h-[44px] min-w-[44px] py-2.5 px-4 rounded-lg bg-emerald text-white text-sm font-medium">Capture</button>
                      <button type="button" onClick={quickAddWebcam.stopWebcam} className="min-h-[44px] py-2.5 px-4 rounded-lg border border-black/10 text-sm font-medium text-black/80">Cancel</button>
                    </div>
                  </div>
                ) : quickAddPhotos.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {quickAddPhotos.map((p) => (
                        <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden bg-black/5">
                          <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => { setQuickAddPhotos((prev) => { const x = prev.find((i) => i.id === p.id); if (x?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(x.previewUrl); return prev.filter((i) => i.id !== p.id); }); }} className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">×</button>
                        </div>
                      ))}
                    </div>
                    {quickAddPhotos.length < MAX_JOURNAL_PHOTOS && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { if (quickAddWebcam.isMobile) quickAddFileRef.current?.click(); else quickAddWebcam.startWebcam(); }} className="min-h-[44px] py-2 px-3 rounded-lg border border-teal-gus/40 text-teal-gus text-sm font-medium hover:bg-teal-gus/10">Take Photo</button>
                        <button type="button" onClick={() => quickAddGalleryRef.current?.click()} className="min-h-[44px] py-2 px-3 rounded-lg border border-teal-gus/40 text-teal-gus text-sm font-medium hover:bg-teal-gus/10">From Gallery</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {quickAddWebcam.webcamError && <p className="text-sm text-amber-600">{quickAddWebcam.webcamError}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { if (quickAddWebcam.isMobile) quickAddFileRef.current?.click(); else quickAddWebcam.startWebcam(); }} className="flex-1 min-h-[44px] py-3 rounded-xl border border-teal-gus/40 text-teal-gus font-medium hover:bg-teal-gus/10">Take Photo</button>
                      <button type="button" onClick={() => quickAddGalleryRef.current?.click()} className="flex-1 min-h-[44px] py-3 rounded-xl border border-teal-gus/40 text-teal-gus font-medium hover:bg-teal-gus/10">From Gallery</button>
                    </div>
                  </div>
                )}
              </div>
              {quickAddError && <p className="text-sm text-red-600" role="alert">{quickAddError}</p>}
            </div>
            <div className="p-4 border-t border-black/10 flex gap-2 justify-end">
              <button type="button" onClick={() => { setQuickAddJournalOpen(false); setQuickAddNote(""); quickAddPhotos.forEach((p) => { if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl); }); setQuickAddPhotos([]); setQuickAddError(null); }} className="px-4 py-2 rounded-lg border border-black/10 text-sm font-medium text-black/80">Cancel</button>
              <button type="button" disabled={quickAddSaving} onClick={handleQuickAddSubmit} className="px-4 py-2 rounded-lg bg-emerald text-white text-sm font-medium disabled:opacity-60">{quickAddSaving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {addMenuOpen && (
        <UniversalAddMenu
          open={addMenuOpen}
          onClose={closeMenu}
          pathname={pathname ?? "/garden"}
          addPlantDefaultType={addPlantDefaultType}
          setAddPlantDefaultType={setAddPlantDefaultType}
          onAddPlantPurchaseOrder={() => {
            closeAll();
            setPurchaseOrderMode("seed");
            setPurchaseOrderAddPlantMode(true);
            setPurchaseOrderOpen(true);
          }}
          onAddPlantPhotoImport={() => {
            closeAll();
            setBatchAddPlantMode(true);
            setBatchAddSeedOpen(true);
          }}
          onSeedOpenBatch={() => {
            closeAll();
            setBatchAddPlantMode(false);
            setBatchAddSeedOpen(true);
          }}
          onSeedStartManualImport={() => {
            skipPopOnNavigateRef.current = true;
            closeAll();
            router.push("/vault/import/manual");
          }}
          onSeedOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            closeAll();
            setPurchaseOrderMode("seed");
            setPurchaseOrderAddPlantMode(false);
            setPurchaseOrderOpen(true);
          }}
          onSupplyOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            closeAll();
            setPurchaseOrderMode("supply");
            setPurchaseOrderOpen(true);
          }}
          onSupplyOpenBatchPhotoImport={() => {
            skipPopOnNavigateRef.current = true;
            closeAll();
            setBatchAddSupplyOpen(true);
          }}
        />
      )}

      {activeModal === "journal" && (
        <QuickLogModal
          open
          onClose={closeActiveModal}
          onJournalAdded={() => {
            router.refresh();
            closeActiveModal();
            setRefetchTrigger((t) => t + 1);
          }}
          onAddSupplyFromEmptyState={(searchString) => {
            closeActiveModal();
            openShed(searchString);
          }}
        />
      )}

      {activeModal === "task" && (
        <NewTaskModal
          open
          onClose={closeActiveModal}
          onSuccess={() => {
            showToast("Task added");
            setRefetchTrigger((t) => t + 1);
          }}
        />
      )}

      {activeModal === "seed" && (
        <QuickAddSeed
          open
          onClose={closeActiveModal}
          onSuccess={(opts) => {
            if (opts?.newProfileId) {
              closeActiveModal();
              router.push(`/vault/${opts.newProfileId}?added=1`);
              return;
            }
            setRefetchTrigger((t) => t + 1);
          }}
          onOpenBatch={() => {
            closeActiveModal();
            setBatchAddPlantMode(false);
            setBatchAddSeedOpen(true);
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

      {/* Unconditional mount so React.lazy (next/dynamic) pre-resolves on page hydration —
          eliminates the Suspense first-render gap when chip-tap flips open=true. */}
      <BatchAddSeed
        open={batchAddSeedOpen}
        onClose={() => setBatchAddSeedOpen(false)}
        onBack={() => {
          setBatchAddSeedOpen(false);
          openMenuOnScreen(batchAddPlantMode ? "add-plant" : "seed");
        }}
        onSuccess={() => setRefetchTrigger((t) => t + 1)}
        onNavigateToHero={() => {
          skipPopOnNavigateRef.current = true;
          setBatchAddSeedOpen(false);
          router.push("/vault/import/photos/hero");
        }}
        addPlantMode={batchAddPlantMode}
        defaultProfileType={batchAddPlantMode ? (addPlantDefaultType === "permanent" ? "permanent" : "seed") : undefined}
      />

      {activeModal === "shed" && (
        <QuickAddSupply
          open
          onClose={closeActiveModal}
          onSuccess={() => setRefetchTrigger((t) => t + 1)}
          initialName={shedInitialName}
          onOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            setPurchaseOrderMode("supply");
            setPurchaseOrderOpen(true);
          }}
          onOpenBatchPhotoImport={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            setBatchAddSupplyOpen(true);
          }}
        />
      )}

      <BatchAddSupply
        open={batchAddSupplyOpen}
        onClose={() => setBatchAddSupplyOpen(false)}
        onBack={() => {
          setBatchAddSupplyOpen(false);
          openMenuOnScreen("shed");
        }}
        onSuccess={() => setRefetchTrigger((t) => t + 1)}
      />

      {/* Selection actions menu (when items selected): FAB >> opens this.
          B2: unified action set — Mark as Perennial / Mark as Annual / Delete / End Batch / Journal.
          Bulk handlers route through GardenView's imperative handle. */}
      {selectionActionsOpen && bulkModeActive && bulkSelectedCount > 0 && (
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
                {bulkSelectedCount} selected
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <button
                type="button"
                onClick={openMoveGroupPicker}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-emerald-700 hover:bg-black/5"
                aria-label="Move to group"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                </svg>
                Move to group
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenBulkLog(true);
                  setSelectionActionsOpen(false);
                }}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5"
                aria-label="Journal"
              >
                <ICON_MAP.ManualEntry stroke="currentColor" className="w-5 h-5 shrink-0" />
                Journal
              </button>
              <button
                type="button"
                onClick={() => {
                  gardenRef.current?.openBulkEndBatchConfirm();
                  setSelectionActionsOpen(false);
                }}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-amber-700 hover:bg-black/5"
                aria-label="End Batch"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                  <path d="M12 22V12" />
                  <path d="M12 12 2 7l10 5 10-5-10-5Z" />
                  <path d="M2 17 10 12 20 17" />
                </svg>
                End batch
              </button>
              <button
                type="button"
                onClick={() => {
                  gardenRef.current?.openBulkDeleteConfirm();
                  setSelectionActionsOpen(false);
                }}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-black/5"
                aria-label="Delete selected"
              >
                <ICON_MAP.Trash stroke="currentColor" className="w-5 h-5 shrink-0" />
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {moveGroupPickerOpen && (
        <>
          <div
            className="fixed inset-0 z-[99] bg-black/40"
            aria-hidden
            onClick={() => {
              if (!moving) setMoveGroupPickerOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Move to group"
            className="fixed left-4 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+1rem)] z-[100] rounded-2xl bg-white shadow-xl border border-black/10 overflow-hidden max-h-[70vh] flex flex-col"
          >
            <div className="flex-shrink-0 px-4 py-3 border-b border-black/10">
              <p className="text-sm font-medium text-black/70">
                Move {bulkSelectedCount} {bulkSelectedCount === 1 ? "plant" : "plants"} to…
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {moveGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={moving}
                  onClick={() => handleMoveSelectedToGroup({ id: g.id, name: g.name })}
                  className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/80 hover:bg-black/5 disabled:opacity-50"
                >
                  {g.name}
                </button>
              ))}
              <button
                type="button"
                disabled={moving}
                onClick={() => handleMoveSelectedToGroup(null)}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-black/60 hover:bg-black/5 disabled:opacity-50"
              >
                No group / Unassigned
              </button>
              {moveGroups.length === 0 && (
                <p className="px-4 py-3 text-sm text-neutral-500 italic">
                  No groups yet — create one with Manage in the tab row.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {!(bulkModeActive && bulkSelectedCount === 0) && (
        <button
          type="button"
          onClick={() => {
            if (bulkModeActive && bulkSelectedCount > 0) {
              setSelectionActionsOpen(true);
            } else {
              setAddMenuOpen(!addMenuOpen);
            }
          }}
          className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
            bulkModeActive && bulkSelectedCount > 0
              ? "bg-amber-500 text-white"
              : addMenuOpen
                ? "bg-emerald-700 text-white"
                : "bg-emerald text-white"
          }`}
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
          aria-label={
            bulkModeActive && bulkSelectedCount > 0
              ? "Selection actions"
              : addMenuOpen
                ? "Close menu"
                : "Add to garden"
          }
        >
          {bulkModeActive && bulkSelectedCount > 0 ? (
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
              className={`transition-transform duration-200 ${addMenuOpen ? "rotate-45" : "rotate-0"}`}
              aria-hidden
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      )}

      {bulkToast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg animate-fade-in ${bulkToast.includes("Couldn") ? "bg-amber-600" : "bg-emerald-600"}`} role="status" aria-live="polite">
          {bulkToast}
        </div>
      )}

      {activeModal === "plant" && (
        <AddPlantModal open onClose={closeActiveModal} onBackToMenu={backToMenu} onSuccess={() => { closeActiveModal(); setRefetchTrigger((t) => t + 1); }} defaultPlantType={addPlantDefaultType} stayInGarden />
      )}
      <PurchaseOrderImport
        open={purchaseOrderOpen}
        onClose={() => setPurchaseOrderOpen(false)}
        onBack={() => {
          setPurchaseOrderOpen(false);
          openMenuOnScreen(
            purchaseOrderMode === "supply"
              ? "shed"
              : purchaseOrderAddPlantMode
                ? "add-plant"
                : "seed"
          );
        }}
        mode={purchaseOrderMode}
        defaultProfileType={purchaseOrderAddPlantMode ? (addPlantDefaultType === "permanent" ? "permanent" : "seed") : purchaseOrderMode === "seed" ? "seed" : undefined}
        addPlantMode={purchaseOrderMode === "seed" ? purchaseOrderAddPlantMode : false}
      />

      {growParam && (
        <GrowInstanceModal
          growId={growParam}
          initialTab={(() => {
            const t = searchParams.get("instanceTab");
            return t === "care" || t === "journal" || t === "history" || t === "overview" ? t : undefined;
          })()}
          focusScheduleId={searchParams.get("schedule") ?? undefined}
          onGroupChanged={() => setRefetchTrigger((t) => t + 1)}
          onClose={() => {
            if (fromParam === "profile" && profileParam) router.push(`/vault/${profileParam}`);
            else router.replace(buildGardenUrl());
          }}
          backHref={fromParam === "profile" && profileParam ? `/vault/${profileParam}` : undefined}
          onLogHarvest={(batch) => {
            router.replace(buildGardenUrl());
            setLogHarvestBatch({
              id: batch.id,
              plant_profile_id: batch.plant_profile_id,
              profile_name: batch.profile_name,
              profile_variety_name: batch.profile_variety_name,
            });
          }}
        />
      )}
    </div>
  );
}

export default function GardenPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-600">Loading…</div>}>
      <GardenPageInner />
    </Suspense>
  );
}
