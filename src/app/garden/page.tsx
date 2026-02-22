"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ActiveGardenView, type ActiveGardenViewHandle } from "@/components/ActiveGardenView";
import { MyPlantsView } from "@/components/MyPlantsView";
import { HarvestModal } from "@/components/HarvestModal";
import { AddPlantModal } from "@/components/AddPlantModal";
import { PurchaseOrderImport } from "@/components/PurchaseOrderImport";
import { getTagStyle } from "@/components/TagBadges";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { compressImage } from "@/lib/compressImage";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { useDebounce } from "@/hooks/useDebounce";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useFilterState } from "@/hooks/useFilterState";
import type { RefineChips } from "@/types/garden";

type GrowingBatchForLog = { id: string; plant_profile_id: string; profile_name: string; profile_variety_name: string | null };

function GardenPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useSessionStorage<"active" | "plants">("garden-view-mode", "active", {
    serialize: (v) => v,
    deserialize: (s) => (s === "active" || s === "plants" ? s : "active"),
  });
  const tabParam = searchParams.get("tab");
  const viewModeFromUrl = tabParam === "active" || tabParam === "plants" ? tabParam : null;
  const effectiveViewMode = viewModeFromUrl ?? viewMode;
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [plantsSearchQuery, setPlantsSearchQuery] = useState("");
  const [activeCategoryChips, setActiveCategoryChips] = useState<{ type: string; count: number }[]>([]);
  const [activeFilteredCount, setActiveFilteredCount] = useState(0);
  const [plantsCategoryChips, setPlantsCategoryChips] = useState<{ type: string; count: number }[]>([]);
  const [plantsFilteredCount, setPlantsFilteredCount] = useState(0);
  const [plantsHasItems, setPlantsHasItems] = useState(false);
  const [activeHasItems, setActiveHasItems] = useState(false);
  const [refineByOpen, setRefineByOpen] = useState(false);
  const [refineBySection, setRefineBySection] = useState<"plantType" | "variety" | "sun" | "spacing" | "germination" | "maturity" | "tags" | "sort" | null>(null);
  const [activeRefineChips, setActiveRefineChips] = useState<RefineChips | null>(null);
  const [plantsRefineChips, setPlantsRefineChips] = useState<RefineChips | null>(null);

  const profileParam = searchParams.get("profile");
  const closeRefinePanel = useCallback(() => {
    setRefineByOpen(false);
    setRefineBySection(null);
  }, []);
  const activeFilters = useFilterState({ schema: "garden", onClear: closeRefinePanel });
  const plantsFilters = useFilterState({
    schema: "garden",
    onClear: closeRefinePanel,
    isFilterActive: () => !!profileParam,
  });
  const [activeSortBy, setActiveSortBy] = useSessionStorage<"name" | "sown_date" | "harvest_date">("garden-active-sort", "sown_date", {
    serialize: (v) => v,
    deserialize: (s) => (s === "name" || s === "sown_date" || s === "harvest_date" ? s : "sown_date"),
  });
  const [activeSortDir, setActiveSortDir] = useSessionStorage<"asc" | "desc">("garden-active-sort-dir", "desc", {
    serialize: (v) => v,
    deserialize: (s) => (s === "asc" || s === "desc" ? s : "desc"),
  });
  const [plantsSortBy, setPlantsSortBy] = useSessionStorage<"name" | "planted_date" | "care_count">("garden-plants-sort", "name", {
    serialize: (v) => v,
    deserialize: (s) => (s === "name" || s === "planted_date" || s === "care_count" ? s : "name"),
  });
  const [plantsSortDir, setPlantsSortDir] = useSessionStorage<"asc" | "desc">("garden-plants-sort-dir", "asc", {
    serialize: (v) => v,
    deserialize: (s) => (s === "asc" || s === "desc" ? s : "asc"),
  });
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [openBulkJournalForActive, setOpenBulkJournalForActive] = useState(false);
  const [bulkSelectedCount, setBulkSelectedCount] = useState(0);
  const [bulkModeActive, setBulkModeActive] = useState(false);
  const [openBulkLogForActive, setOpenBulkLogForActive] = useState(false);
  const [addedToMyPlantsToast, setAddedToMyPlantsToast] = useState(false);
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [addPlantDefaultType, setAddPlantDefaultType] = useState<"permanent" | "seasonal">("seasonal");
  const [activeDisplayStyle, setActiveDisplayStyle] = useSessionStorage<"grid" | "list">("garden-active-display-style", "list", {
    serialize: (v) => v,
    deserialize: (s) => (s === "grid" || s === "list" ? s : "list"),
  });
  const [plantsDisplayStyle, setPlantsDisplayStyle] = useSessionStorage<"grid" | "list">("garden-plants-display-style", "grid", {
    serialize: (v) => v,
    deserialize: (s) => (s === "grid" || s === "list" ? s : "grid"),
  });

  const [logGrowthBatch, setLogGrowthBatch] = useState<GrowingBatchForLog | null>(null);
  const [logGrowthNote, setLogGrowthNote] = useState("");
  const [logGrowthFile, setLogGrowthFile] = useState<File | null>(null);
  const [logGrowthPreview, setLogGrowthPreview] = useState<string | null>(null);
  const [logGrowthSaving, setLogGrowthSaving] = useState(false);
  const [logGrowthError, setLogGrowthError] = useState<string | null>(null);
  const fileInputLogGrowthRef = useRef<HTMLInputElement>(null);
  const quickAddFileRef = useRef<HTMLInputElement>(null);
  const activeGardenRef = useRef<ActiveGardenViewHandle | null>(null);
  const [logHarvestBatch, setLogHarvestBatch] = useState<GrowingBatchForLog | null>(null);
  const [endCropConfirmBatch, setEndCropConfirmBatch] = useState<GrowingBatchForLog | null>(null);
  const [selectedPlantProfileIds, setSelectedPlantProfileIds] = useState<Set<string>>(new Set());
  const [quickAddJournalOpen, setQuickAddJournalOpen] = useState(false);
  const [quickAddNote, setQuickAddNote] = useState("");
  const [quickAddPhoto, setQuickAddPhoto] = useState<File | null>(null);
  const [quickAddPhotoPreview, setQuickAddPhotoPreview] = useState<string | null>(null);
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  const [profileFilteredPlantName, setProfileFilteredPlantName] = useState<string | null>(null);
  const [profileFilterEmpty, setProfileFilterEmpty] = useState(false);
  const [highlightedBatch, setHighlightedBatch] = useState<{ id: string; profile_name: string; profile_variety_name: string | null } | null>(null);
  const [highlightResolved, setHighlightResolved] = useState(false);

  const growParam = searchParams.get("grow");

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
      router.replace("/garden?tab=active");
    }
    if (!growParam) hasClearedStaleGrowRef.current = false;
  }, [highlightResolved, highlightedBatch, growParam, router]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "active" || tab === "plants") setViewMode(tab);
    if (tab === "active") setRefetchTrigger((t) => t + 1);
  }, [searchParams, setViewMode]);

  const setTab = useCallback(
    (tab: "active" | "plants") => {
      setViewMode(tab);
      const preserve = tab === "active" && growParam ? `&grow=${encodeURIComponent(growParam)}` : tab === "plants" && profileParam ? `&profile=${encodeURIComponent(profileParam)}` : "";
      router.replace(tab === "active" ? `/garden?tab=active${preserve}` : `/garden?tab=plants${preserve}`);
    },
    [setViewMode, router, growParam, profileParam]
  );

  const activeSearchDebounced = useDebounce(activeSearchQuery, 300);
  const plantsSearchDebounced = useDebounce(plantsSearchQuery, 300);

  useEscapeKey(fabMenuOpen, () => setFabMenuOpen(false));
  useEscapeKey(refineByOpen, () => { setRefineByOpen(false); setRefineBySection(null); });
  useEscapeKey(
    !fabMenuOpen && !refineByOpen && (!!profileParam || !!growParam),
    () => { if (profileParam) clearProfileFilter(); else if (growParam) clearGrowView(); }
  );

  const handleActiveCategoryChipsLoaded = useCallback((chips: { type: string; count: number }[]) => {
    setActiveCategoryChips(chips);
  }, []);
  const handlePlantsCategoryChipsLoaded = useCallback((chips: { type: string; count: number }[]) => {
    setPlantsCategoryChips(chips);
  }, []);
  const handleActiveRefineChipsLoaded = useCallback((chips: RefineChips) => {
    setActiveRefineChips(chips);
  }, []);
  const handlePlantsRefineChipsLoaded = useCallback((chips: RefineChips) => {
    setPlantsRefineChips(chips);
  }, []);

  const clearAllFilters = useCallback(() => {
    activeFilters.clearAllFilters();
    plantsFilters.clearAllFilters();
    if (effectiveViewMode === "plants" && profileParam) {
      router.replace("/garden?tab=plants");
    }
  }, [activeFilters.clearAllFilters, plantsFilters.clearAllFilters, effectiveViewMode, profileParam, router]);

  const clearProfileFilter = useCallback(() => {
    plantsFilters.clearAllFilters();
    if (profileParam) router.replace("/garden?tab=plants");
  }, [plantsFilters.clearAllFilters, profileParam, router]);

  const clearGrowView = useCallback(() => {
    if (growParam) router.replace("/garden?tab=active");
  }, [growParam, router]);

  const activeFilterCount = activeFilters.filterCount;
  const plantsFilterCount = plantsFilters.filterCount;

  const openLogGrowth = useCallback((batch: GrowingBatchForLog) => {
    setLogGrowthBatch(batch);
    setLogGrowthNote("");
    setLogGrowthFile(null);
    setLogGrowthPreview(null);
    setLogGrowthError(null);
  }, []);

  const openLogHarvest = useCallback((batch: GrowingBatchForLog) => {
    setLogHarvestBatch(batch);
  }, []);

  const handleEndCrop = useCallback((batch: GrowingBatchForLog) => {
    setEndCropConfirmBatch(batch);
  }, []);

  const handlePermanentPlantAdded = useCallback(() => {
    if (effectiveViewMode === "active") {
      setTab("plants");
      setAddedToMyPlantsToast(true);
      setTimeout(() => setAddedToMyPlantsToast(false), 2500);
    }
  }, [effectiveViewMode, setTab]);

  const confirmEndCrop = useCallback(async () => {
    if (!user?.id || !endCropConfirmBatch) return;
    const { error } = await supabase
      .from("grow_instances")
      .update({ status: "archived", ended_at: new Date().toISOString() })
      .eq("id", endCropConfirmBatch.id)
      .eq("user_id", user.id);
    if (error) return;
    await softDeleteTasksForGrowInstance(endCropConfirmBatch.id, user.id);

    // Revert profile status when no active grows remain
    const profileId = endCropConfirmBatch.plant_profile_id;
    const { data: activeGrows } = await supabase
      .from("grow_instances")
      .select("id")
      .eq("plant_profile_id", profileId)
      .eq("user_id", user.id)
      .in("status", ["growing", "pending"])
      .is("deleted_at", null);
    if (!activeGrows?.length) {
      const { data: stockedPackets } = await supabase
        .from("seed_packets")
        .select("id")
        .eq("plant_profile_id", profileId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .or("is_archived.is.null,is_archived.eq.false")
        .gt("qty_status", 0);
      const revertStatus = stockedPackets?.length ? "in_stock" : "out_of_stock";
      await supabase.from("plant_profiles").update({ status: revertStatus }).eq("id", profileId).eq("user_id", user.id);
    }

    setEndCropConfirmBatch(null);
    setRefetchTrigger((t) => t + 1);
  }, [user?.id, endCropConfirmBatch]);

  const handleLogGrowthSubmit = useCallback(async () => {
    if (!user?.id || !logGrowthBatch) return;
    setLogGrowthSaving(true);
    setLogGrowthError(null);
    let imagePath: string | null = null;
    if (logGrowthFile) {
      const { blob } = await compressImage(logGrowthFile);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) {
        setLogGrowthError(upErr.message || "Failed to upload photo. Try again.");
        setLogGrowthSaving(false);
        return;
      }
      imagePath = path;
    }
    const weatherSnapshot = await fetchWeatherSnapshot();
    const noteTrim = logGrowthNote.trim() || null;
    const { error: journalErr } = await supabase.from("journal_entries").insert({
      user_id: user.id,
      plant_profile_id: logGrowthBatch.plant_profile_id,
      grow_instance_id: logGrowthBatch.id,
      note: noteTrim,
      entry_type: "growth",
      image_file_path: imagePath,
      weather_snapshot: weatherSnapshot ?? undefined,
    });
    setLogGrowthSaving(false);
    if (journalErr) {
      setLogGrowthError(journalErr.message || "Failed to save. Try again.");
      return;
    }
    setLogGrowthBatch(null);
    setRefetchTrigger((t) => t + 1);
  }, [user?.id, logGrowthBatch, logGrowthNote, logGrowthFile]);

  const handleQuickAddSubmit = useCallback(async () => {
    if (!user?.id) return;
    const noteTrim = quickAddNote.trim() || null;
    let imagePath: string | null = null;
    if (quickAddPhoto) {
      setQuickAddSaving(true);
      const { blob } = await compressImage(quickAddPhoto);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) {
        setQuickAddError(upErr.message || "Failed to upload photo.");
        setQuickAddSaving(false);
        return;
      }
      imagePath = path;
    }
    if (!noteTrim && !imagePath) {
      setQuickAddError("Add a note or photo.");
      return;
    }
    setQuickAddSaving(true);
    setQuickAddError(null);
    const weatherSnapshot = await fetchWeatherSnapshot();
    const idsToInsert = selectedPlantProfileIds.size > 0 ? Array.from(selectedPlantProfileIds) : [null];
    let insertErr: { message: string } | null = null;
    try {
      for (const profileId of idsToInsert) {
        const { error } = await insertWithOfflineQueue("journal_entries", {
          user_id: user.id,
          plant_profile_id: profileId,
          grow_instance_id: null,
          seed_packet_id: null,
          note: noteTrim,
          entry_type: "note",
          image_file_path: imagePath,
          weather_snapshot: weatherSnapshot ?? undefined,
        } as Record<string, unknown>);
        if (error) {
          insertErr = error;
          break;
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
    setQuickAddPhoto(null);
    if (quickAddPhotoPreview) {
      URL.revokeObjectURL(quickAddPhotoPreview);
      setQuickAddPhotoPreview(null);
    }
    setSelectedPlantProfileIds(new Set());
    setRefetchTrigger((t) => t + 1);
  }, [user?.id, quickAddNote, quickAddPhoto, quickAddPhotoPreview, selectedPlantProfileIds]);

  return (
    <div className="min-h-screen pb-24">
      <div className="px-6 pt-0 pb-6">
        <div className="sticky top-11 z-40 -mx-6 px-6 pt-1 pb-2 bg-white/95 backdrop-blur-md border-b border-black/5 shadow-sm">
          <div className="flex mb-3" role="tablist" aria-label="View">
            <div className="inline-flex rounded-xl p-1 bg-neutral-100 gap-0.5" role="group">
            <Link
              href={growParam ? `/garden?tab=active&grow=${encodeURIComponent(growParam)}` : "/garden?tab=active"}
              role="tab"
              aria-selected={effectiveViewMode === "active"}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center ${
                effectiveViewMode === "active" ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"
              }`}
            >
              Active Garden
            </Link>
            <Link
              href={profileParam ? `/garden?tab=plants&profile=${encodeURIComponent(profileParam)}` : "/garden?tab=plants"}
              role="tab"
              aria-selected={effectiveViewMode === "plants"}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center ${
                effectiveViewMode === "plants" ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"
              }`}
            >
              My Plants
            </Link>
          </div>
        </div>

        {/* Always show toolbar (search, filter, toggle) so users can search/add even when list is empty */}
        {(effectiveViewMode === "active" || effectiveViewMode === "plants") && (
          <>
            <div className="flex gap-2 mb-2 mt-2">
              <div className="flex-1 relative">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  value={effectiveViewMode === "active" ? activeSearchQuery : plantsSearchQuery}
                  onChange={(e) => (effectiveViewMode === "active" ? setActiveSearchQuery(e.target.value) : setPlantsSearchQuery(e.target.value))}
                  placeholder={effectiveViewMode === "active" ? "Search your garden…" : "Search plants…"}
                  className="w-full rounded-xl bg-neutral-100 border-0 pl-10 pr-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-inset"
                  aria-label={effectiveViewMode === "active" ? "Search batches" : "Search plants"}
                />
              </div>
            </div>

            {/* Filter/view chips: show when navigating from plant profile with profile or grow param */}
            {(effectiveViewMode === "plants" && profileParam) || (effectiveViewMode === "active" && growParam) ? (
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {effectiveViewMode === "plants" && profileParam && (
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
                {effectiveViewMode === "active" && growParam && (
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
            {((effectiveViewMode === "active" && activeFilteredCount === 0 && growParam) || (effectiveViewMode === "plants" && plantsFilteredCount === 0 && profileParam)) && (
              <div className="flex items-center justify-between gap-3 mb-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-sm text-amber-800">No items match. Clear to see all.</span>
                <button
                  type="button"
                  onClick={effectiveViewMode === "active" ? clearGrowView : clearProfileFilter}
                  className="min-h-[44px] min-w-[44px] shrink-0 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
                >
                  Show all
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
                Filter
                {(effectiveViewMode === "active" && activeFilterCount > 0) || (effectiveViewMode === "plants" && plantsFilterCount > 0) ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald text-white text-xs font-semibold">
                    {effectiveViewMode === "active" ? activeFilterCount : plantsFilterCount}
                  </span>
                ) : null}
              </button>
              {((effectiveViewMode === "active" && activeFilterCount > 0) || (effectiveViewMode === "plants" && plantsFilterCount > 0)) && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald/10 shrink-0"
                  aria-label="Clear all filters"
                >
                  Clear filters
                </button>
              )}
              {effectiveViewMode === "active" && bulkModeActive && (
                <button
                  type="button"
                  onClick={() => activeGardenRef.current?.exitBulkMode()}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
                >
                  Cancel
                </button>
              )}
              {effectiveViewMode === "plants" && selectedPlantProfileIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPlantProfileIds(new Set())}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
                >
                  Cancel
                </button>
              )}
              <span className="text-sm text-black/50">
                {effectiveViewMode === "active" ? activeFilteredCount : plantsFilteredCount} item{(effectiveViewMode === "active" ? activeFilteredCount : plantsFilteredCount) !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() =>
                  effectiveViewMode === "active"
                    ? setActiveDisplayStyle((s) => (s === "grid" ? "list" : "grid"))
                    : setPlantsDisplayStyle((s) => (s === "grid" ? "list" : "grid"))
                }
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/10 bg-white ml-auto hover:bg-black/5 transition-colors"
                title={effectiveViewMode === "active" ? (activeDisplayStyle === "grid" ? "List view" : "Grid view") : plantsDisplayStyle === "grid" ? "List view" : "Grid view"}
                aria-label={effectiveViewMode === "active" ? (activeDisplayStyle === "grid" ? "Switch to list view" : "Switch to grid view") : plantsDisplayStyle === "grid" ? "Switch to list view" : "Switch to grid view"}
              >
                {(effectiveViewMode === "active" ? activeDisplayStyle : plantsDisplayStyle) === "grid" ? (
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
        </div>

        {refineByOpen && (
          <>
            <button type="button" className="fixed inset-0 z-20 bg-black/20" aria-label="Close" onClick={() => { setRefineByOpen(false); setRefineBySection(null); }} />
            <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-30 bg-white rounded-2xl shadow-lg border border-black/10 flex flex-col max-h-[70vh]">
              <header className="flex items-center justify-between gap-2 p-4 border-b border-black/10">
                <h2 id="refine-by-title" className="text-lg font-semibold text-black">Filter</h2>
                <div className="flex items-center gap-1">
                  {((effectiveViewMode === "active" && activeFilterCount > 0) || (effectiveViewMode === "plants" && plantsFilterCount > 0)) && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald/10"
                      aria-label="Clear all filters"
                    >
                      Clear filters
                    </button>
                  )}
                  <button type="button" onClick={() => { setRefineByOpen(false); setRefineBySection(null); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/60 hover:bg-black/5" aria-label="Close">
                    <span className="text-xl leading-none" aria-hidden>×</span>
                  </button>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto">
                <div className="border-b border-black/5">
                  <button
                    type="button"
                    onClick={() => setRefineBySection((s) => (s === "sort" ? null : "sort"))}
                    className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                    aria-expanded={refineBySection === "sort"}
                  >
                    <span>Sort by</span>
                    <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sort" ? "▴" : "▾"}</span>
                  </button>
                  {refineBySection === "sort" && (
                    <div className="px-4 pb-3 pt-0 space-y-0.5">
                      {effectiveViewMode === "active" ? (
                        <>
                          {(["name", "sown_date", "harvest_date"] as const).map((opt) => {
                            const selected = activeSortBy === opt;
                            const label = opt === "name" ? "Name" : opt === "sown_date" ? "Date sown" : "Harvest date";
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  if (activeSortBy === opt) setActiveSortDir((d) => (d === "asc" ? "desc" : "asc"));
                                  else setActiveSortBy(opt);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                              >
                                {label}
                                {selected && <span className="text-xs text-black/50">{activeSortDir === "asc" ? "↑" : "↓"}</span>}
                              </button>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          {(["name", "planted_date", "care_count"] as const).map((opt) => {
                            const selected = plantsSortBy === opt;
                            const label = opt === "name" ? "Name" : opt === "planted_date" ? "Date planted" : "Care count";
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  if (plantsSortBy === opt) setPlantsSortDir((d) => (d === "asc" ? "desc" : "asc"));
                                  else setPlantsSortBy(opt);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                              >
                                {label}
                                {selected && <span className="text-xs text-black/50">{plantsSortDir === "asc" ? "↑" : "↓"}</span>}
                              </button>
                            );
                          })}
                        </>
                      )}
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
                        onClick={() => (effectiveViewMode === "active" ? activeFilters.setCategory(null) : plantsFilters.setCategory(null))}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm bg-emerald/10 text-emerald-800 font-medium"
                      >
                        All
                      </button>
                      {(effectiveViewMode === "active" ? activeCategoryChips : plantsCategoryChips).map(({ type, count }) => {
                        const selected = effectiveViewMode === "active" ? activeFilters.filters.category === type : plantsFilters.filters.category === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => (effectiveViewMode === "active" ? activeFilters.setCategory(type) : plantsFilters.setCategory(type))}
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
                  const chips = effectiveViewMode === "active" ? activeRefineChips : plantsRefineChips;
                  const f = effectiveViewMode === "active" ? activeFilters : plantsFilters;
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
              <footer className="flex-shrink-0 border-t border-black/10 px-4 py-3">
                <button
                  type="button"
                  onClick={() => { setRefineByOpen(false); setRefineBySection(null); }}
                  className="w-full min-h-[48px] rounded-xl bg-emerald text-white font-medium text-sm"
                >
                  Show results ({effectiveViewMode === "active" ? activeFilteredCount : plantsFilteredCount})
                </button>
              </footer>
            </div>
          </>
        )}

        {effectiveViewMode === "active" && (
          <div className="pt-2">
            <ActiveGardenView
              ref={activeGardenRef}
              refetchTrigger={refetchTrigger}
              highlightGrowId={growParam}
              onHighlightedBatch={handleHighlightedBatch}
              onClearGrowView={clearGrowView}
              searchQuery={activeSearchDebounced}
              onLogGrowth={openLogGrowth}
              onLogHarvest={openLogHarvest}
              onEndCrop={handleEndCrop}
              categoryFilter={activeFilters.filters.category}
              onCategoryChipsLoaded={handleActiveCategoryChipsLoaded}
              varietyFilter={activeFilters.filters.variety}
              sunFilter={activeFilters.filters.sun}
              spacingFilter={activeFilters.filters.spacing}
              germinationFilter={activeFilters.filters.germination}
              maturityFilter={activeFilters.filters.maturity}
              tagFilters={activeFilters.filters.tags}
              onRefineChipsLoaded={handleActiveRefineChipsLoaded}
              onFilteredCountChange={setActiveFilteredCount}
              onEmptyStateChange={(empty) => setActiveHasItems(!empty)}
              openBulkJournalRequest={openBulkJournalForActive}
              onBulkJournalRequestHandled={() => setOpenBulkJournalForActive(false)}
              onBulkSelectionChange={setBulkSelectedCount}
              openBulkLogRequest={openBulkLogForActive}
              onBulkLogRequestHandled={() => setOpenBulkLogForActive(false)}
              onBulkModeChange={setBulkModeActive}
              displayStyle={activeDisplayStyle}
              sortBy={activeSortBy}
              sortDir={activeSortDir}
            />
          </div>
        )}

        {effectiveViewMode === "plants" && (
          <div className="pt-2">
            <MyPlantsView
              refetchTrigger={refetchTrigger}
              searchQuery={plantsSearchDebounced}
              onPermanentPlantAdded={handlePermanentPlantAdded}
              categoryFilter={plantsFilters.filters.category}
              profileIdFilter={profileParam}
              onProfileFilteredPlantName={(name) => {
                setProfileFilteredPlantName(name);
                if (name) setProfileFilterEmpty(false);
              }}
              onProfileFilterEmpty={() => setProfileFilterEmpty(true)}
              onClearProfileFilter={clearProfileFilter}
              onCategoryChipsLoaded={handlePlantsCategoryChipsLoaded}
              varietyFilter={plantsFilters.filters.variety}
              sunFilter={plantsFilters.filters.sun}
              spacingFilter={plantsFilters.filters.spacing}
              germinationFilter={plantsFilters.filters.germination}
              maturityFilter={plantsFilters.filters.maturity}
              tagFilters={plantsFilters.filters.tags}
              onRefineChipsLoaded={handlePlantsRefineChipsLoaded}
              onFilteredCountChange={setPlantsFilteredCount}
              onEmptyStateChange={(empty) => setPlantsHasItems(!empty)}
              onAddClick={() => { setAddPlantDefaultType("permanent"); setShowAddPlantModal(true); }}
              selectedProfileIds={selectedPlantProfileIds}
              onToggleProfileSelection={(id) => setSelectedPlantProfileIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
              onLongPressProfile={(id) => setSelectedPlantProfileIds((prev) => new Set(prev).add(id))}
              displayStyle={plantsDisplayStyle}
              sortBy={plantsSortBy}
              sortDir={plantsSortDir}
            />
          </div>
        )}
      </div>

      {logGrowthBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-black">Log Growth</h2>
              <p className="text-sm text-black/60 mt-1">{logGrowthBatch.profile_variety_name?.trim() ? `${decodeHtmlEntities(logGrowthBatch.profile_name)} (${decodeHtmlEntities(logGrowthBatch.profile_variety_name)})` : decodeHtmlEntities(logGrowthBatch.profile_name)}</p>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-medium text-black/60 mb-1">Photo (optional)</label>
                <input
                  ref={fileInputLogGrowthRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setLogGrowthFile(f);
                      setLogGrowthPreview(URL.createObjectURL(f));
                    }
                    e.target.value = "";
                  }}
                />
                {logGrowthPreview ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
                    <img src={logGrowthPreview} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setLogGrowthFile(null); setLogGrowthPreview(null); }} className="absolute top-2 right-2 py-1 px-2 rounded bg-black/60 text-white text-xs">Remove</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputLogGrowthRef.current?.click()} className="min-w-[44px] min-h-[44px] w-full py-4 rounded-xl border border-black/10 text-black/60 hover:bg-black/5 text-sm">Choose photo or take one</button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black/60 mb-1">Note</label>
                <textarea value={logGrowthNote} onChange={(e) => setLogGrowthNote(e.target.value)} placeholder="Growth update, note…" rows={3} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm resize-none" />
              </div>
              {logGrowthError && <p className="text-sm text-red-600" role="alert">{logGrowthError}</p>}
            </div>
            <div className="p-4 border-t border-black/10 flex gap-2 justify-end">
              <button type="button" onClick={() => { setLogGrowthBatch(null); setLogGrowthError(null); if (logGrowthPreview) URL.revokeObjectURL(logGrowthPreview); setLogGrowthPreview(null); }} className="px-4 py-2 rounded-lg border border-black/10 text-sm font-medium text-black/80">Cancel</button>
              <button type="button" disabled={logGrowthSaving} onClick={handleLogGrowthSubmit} className="px-4 py-2 rounded-lg bg-emerald text-white text-sm font-medium disabled:opacity-60">{logGrowthSaving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      <HarvestModal
        open={!!logHarvestBatch}
        onClose={() => setLogHarvestBatch(null)}
        onSaved={() => { setRefetchTrigger((p: number) => p + 1); setLogHarvestBatch(null); }}
        profileId={logHarvestBatch?.plant_profile_id ?? ""}
        growInstanceId={logHarvestBatch?.id ?? ""}
        displayName={logHarvestBatch ? (logHarvestBatch.profile_variety_name?.trim() ? `${decodeHtmlEntities(logHarvestBatch.profile_name)} (${decodeHtmlEntities(logHarvestBatch.profile_variety_name)})` : decodeHtmlEntities(logHarvestBatch.profile_name)) : ""}
      />

      {endCropConfirmBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full p-4">
            <h2 className="text-lg font-semibold text-black">End Crop?</h2>
            <p className="text-sm text-black/70 mt-2">
              {endCropConfirmBatch.profile_variety_name?.trim() ? `${decodeHtmlEntities(endCropConfirmBatch.profile_name)} (${decodeHtmlEntities(endCropConfirmBatch.profile_variety_name)})` : decodeHtmlEntities(endCropConfirmBatch.profile_name)} will move to Settings → Archived Plantings.
            </p>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setEndCropConfirmBatch(null)} className="px-4 py-2 rounded-lg border border-black/10 text-sm font-medium text-black/80">Cancel</button>
              <button type="button" onClick={confirmEndCrop} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700">End Crop</button>
            </div>
          </div>
        </div>
      )}

      {quickAddJournalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-black">Add Journal Entry</h2>
              {selectedPlantProfileIds.size > 0 && (
                <p className="text-sm text-black/60 mt-1">{selectedPlantProfileIds.size} plant{selectedPlantProfileIds.size !== 1 ? "s" : ""} selected</p>
              )}
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-medium text-black/60 mb-1">Note (required)</label>
                <textarea value={quickAddNote} onChange={(e) => setQuickAddNote(e.target.value)} placeholder="What did you notice?" rows={3} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-black/60 mb-1">Photo (optional)</label>
                <input ref={quickAddFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setQuickAddPhoto(f); setQuickAddPhotoPreview(URL.createObjectURL(f)); } e.target.value = ""; }} />
                {quickAddPhotoPreview ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
                    <img src={quickAddPhotoPreview} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setQuickAddPhoto(null); if (quickAddPhotoPreview) URL.revokeObjectURL(quickAddPhotoPreview); setQuickAddPhotoPreview(null); }} className="absolute top-2 right-2 py-1 px-2 rounded bg-black/60 text-white text-xs">Remove</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => quickAddFileRef.current?.click()} className="min-w-[44px] min-h-[44px] w-full py-4 rounded-xl border border-black/10 text-black/60 hover:bg-black/5 text-sm">Take photo or choose from files</button>
                )}
              </div>
              {quickAddError && <p className="text-sm text-red-600" role="alert">{quickAddError}</p>}
            </div>
            <div className="p-4 border-t border-black/10 flex gap-2 justify-end">
              <button type="button" onClick={() => { setQuickAddJournalOpen(false); setQuickAddNote(""); setQuickAddPhoto(null); if (quickAddPhotoPreview) { URL.revokeObjectURL(quickAddPhotoPreview); setQuickAddPhotoPreview(null); } setQuickAddError(null); }} className="px-4 py-2 rounded-lg border border-black/10 text-sm font-medium text-black/80">Cancel</button>
              <button type="button" disabled={quickAddSaving} onClick={handleQuickAddSubmit} className="px-4 py-2 rounded-lg bg-emerald text-white text-sm font-medium disabled:opacity-60">{quickAddSaving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {fabMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={() => setFabMenuOpen(false)} />
          <div
            className="fixed left-4 right-4 bottom-20 z-50 rounded-3xl bg-white border border-neutral-200/80 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="garden-fab-title"
          >
            <h2 id="garden-fab-title" className="text-xl font-bold text-center text-neutral-900 mb-1">{effectiveViewMode === "plants" ? "Add permanent plant" : "Add to garden"}</h2>
            <p className="text-sm text-neutral-500 text-center mb-4">{effectiveViewMode === "plants" ? "Add trees, perennials, and other long-lived plants." : "What would you like to add?"}</p>
            <div className="space-y-3">
              {effectiveViewMode === "active" && (
                <button type="button" onClick={() => { router.push("/vault/plant?from=garden"); setFabMenuOpen(false); }} className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]">
                  <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>🌿</span>
                  Add from Vault
                </button>
              )}
              <button type="button" onClick={() => { setAddPlantDefaultType(effectiveViewMode === "plants" ? "permanent" : "seasonal"); setShowAddPlantModal(true); setFabMenuOpen(false); }} className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]">
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>🌱</span>
                {effectiveViewMode === "plants" ? "Add permanent plant" : "Add plant"}
              </button>
              <button type="button" onClick={() => { if (effectiveViewMode === "active") setOpenBulkJournalForActive(true); else { setQuickAddJournalOpen(true); } setFabMenuOpen(false); }} className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]">
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📖</span>
                Add journal entry
              </button>
              {effectiveViewMode === "plants" && (
                <button type="button" onClick={() => { setPurchaseOrderOpen(true); setFabMenuOpen(false); }} className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]">
                  <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📷</span>
                  Scan purchase order
                </button>
              )}
              <div className="pt-4">
                <button type="button" onClick={() => setFabMenuOpen(false)} className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {!(effectiveViewMode === "active" && bulkModeActive && bulkSelectedCount === 0) && (
        <button
          type="button"
          onClick={() => {
            if (effectiveViewMode === "active" && bulkModeActive && bulkSelectedCount > 0) {
              setOpenBulkLogForActive(true);
            } else {
              setFabMenuOpen((o) => !o);
            }
          }}
          className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
            fabMenuOpen ? "bg-emerald-700 text-white" : "bg-emerald text-white"
          }`}
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
          aria-label={
            effectiveViewMode === "active" && bulkModeActive && bulkSelectedCount > 0
              ? "Log for selected plants"
              : fabMenuOpen
                ? "Close menu"
                : effectiveViewMode === "plants"
                  ? "Add permanent plant"
                  : "Add to garden"
          }
        >
          {effectiveViewMode === "active" && bulkModeActive && bulkSelectedCount > 0 ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
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
              className={`transition-transform duration-200 ${fabMenuOpen ? "rotate-45" : "rotate-0"}`}
              aria-hidden
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      )}

      {addedToMyPlantsToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-fade-in" role="status" aria-live="polite">
          Added to My Plants
        </div>
      )}

      <AddPlantModal open={showAddPlantModal} onClose={() => setShowAddPlantModal(false)} onSuccess={() => setRefetchTrigger((t) => t + 1)} defaultPlantType={addPlantDefaultType} stayInGarden hidePlantTypeToggle />
      <PurchaseOrderImport
        open={purchaseOrderOpen}
        onClose={() => setPurchaseOrderOpen(false)}
        defaultProfileType="permanent"
      />
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
