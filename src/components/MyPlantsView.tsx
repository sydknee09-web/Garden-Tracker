"use client";

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { insertWithOfflineQueue, insertManyWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";
import { BatchLogSheet, type BatchLogBatch } from "@/components/BatchLogSheet";
import { PlantImage } from "@/components/PlantImage";
import { NoMatchCard } from "@/components/NoMatchCard";
import { EmptyStateCard } from "@/components/EmptyStateCard";

/** One planting (grow_instance) of a permanent plant — like Active Garden batches but for perennials. */
type PermanentPlanting = {
  id: string;
  plant_profile_id: string;
  sown_date: string;
  location: string | null;
  user_id: string | null;
  profile_name: string;
  profile_variety_name: string | null;
  primary_image_path: string | null;
  hero_image_url: string | null;
  hero_image_path: string | null;
  care_count: number;
  journal_count: number;
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  tags?: string[] | null;
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

export type MyPlantsViewHandle = {
  openBulkDeleteConfirm: () => void;
  openBulkEndBatchConfirm: () => void;
};

export const MyPlantsView = forwardRef<MyPlantsViewHandle, {
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
  /** When set (e.g. from ?profile=xxx URL), filter to only this plant profile. Used when navigating from vault profile. */
  profileIdFilter?: string | null;
  /** Called when profileIdFilter is set and exactly one plant matches; reports its display name for the filter chip. */
  onProfileFilteredPlantName?: (name: string | null) => void;
  /** Called when profileIdFilter is set and filter returns 0 results (so chip can show "No plants match"). */
  onProfileFilterEmpty?: () => void;
  /** Called by parent to clear profile filter; used for empty-state Clear button when filter returns 0 results. */
  onClearProfileFilter?: () => void;
  /** Called to clear search + filters when no match (e.g. from Filter panel). Parent clears search query and filter state. */
  onClearFilters?: () => void;
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
  batchSelectMode?: boolean;
  selectedGrowIds?: Set<string>;
  onToggleGrowSelection?: (growId: string, profileId: string, userId?: string | null) => void;
  onLongPressGrow?: (growId: string, profileId: string, userId?: string | null) => void;
  /** "grid" = small badges (2–3 col), "list" = detailed rows. */
  displayStyle?: "grid" | "list";
  sortBy?: "name" | "planted_date" | "care_count";
  sortDir?: "asc" | "desc";
  /** When true, open BatchLogSheet for selected plants (from FAB >> menu → Journal). */
  openBulkLogRequest?: boolean;
  onBulkLogRequestHandled?: () => void;
  onRefetch?: () => void;
  /** Called on success (e.g. batch ended, batch deleted). */
  onSaveMessage?: (msg: string) => void;
}>(({
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
  profileIdFilter = null,
  onProfileFilteredPlantName,
  onProfileFilterEmpty,
  onClearProfileFilter,
  onClearFilters,
  onRefineChipsLoaded,
  onFilteredCountChange,
  onEmptyStateChange,
  onAddClick,
  onPermanentPlantAdded,
  batchSelectMode = false,
  selectedGrowIds = new Set<string>(),
  onToggleGrowSelection,
  onLongPressGrow,
  displayStyle = "grid",
  sortBy = "name",
  sortDir = "asc",
  openBulkLogRequest = false,
  onBulkLogRequestHandled,
  onRefetch,
  onSaveMessage,
}, ref) => {
  const router = useRouter();
  const { user } = useAuth();
  const { viewMode: householdViewMode } = useHousehold();
  const [plants, setPlants] = useState<PermanentPlanting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const [batchLogOpen, setBatchLogOpen] = useState(false);
  const [batchLogBatches, setBatchLogBatches] = useState<BatchLogBatch[]>([]);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<BatchLogBatch | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [endBatchTarget, setEndBatchTarget] = useState<BatchLogBatch | null>(null);
  const [endReason, setEndReason] = useState<"harvested" | "plant_died" | "other">("other");
  const [endNote, setEndNote] = useState("");
  const [endSaving, setEndSaving] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);
  const [bulkEndBatchConfirmOpen, setBulkEndBatchConfirmOpen] = useState(false);
  const [bulkEndBatchSaving, setBulkEndBatchSaving] = useState(false);
  const [quickToast, setQuickToast] = useState<string | null>(null);

  const openBulkDeleteConfirm = useCallback(() => setBulkDeleteConfirmOpen(true), []);
  const openBulkEndBatchConfirm = useCallback(() => setBulkEndBatchConfirmOpen(true), []);
  useImperativeHandle(ref, () => ({ openBulkDeleteConfirm, openBulkEndBatchConfirm }), [openBulkDeleteConfirm, openBulkEndBatchConfirm]);

  const LONG_PRESS_MS = 500;
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const getLongPressHandlers = useCallback(
    (growId: string, profileId: string, userId?: string | null) => {
      const startLongPress = () => {
        longPressFiredRef.current = false;
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          longPressFiredRef.current = true;
          onLongPressGrow?.(growId, profileId, userId);
        }, LONG_PRESS_MS);
      };
      return {
        onTouchStart: startLongPress,
        onTouchMove: clearLongPressTimer,
        onTouchEnd: clearLongPressTimer,
        onTouchCancel: clearLongPressTimer,
        onMouseDown: startLongPress,
        onMouseUp: clearLongPressTimer,
        onMouseLeave: clearLongPressTimer,
        handleClick: (e?: React.MouseEvent) => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            e?.preventDefault?.();
            return;
          }
          const inSelectionMode = batchSelectMode || selectedGrowIds.size > 0;
          if (inSelectionMode) {
            onToggleGrowSelection?.(growId, profileId, userId);
            return;
          }
          router.push(`/vault/${profileId}?from=garden&gardenTab=plants`);
        },
      };
    },
    [batchSelectMode, onLongPressGrow, onToggleGrowSelection, selectedGrowIds.size, clearLongPressTimer, router]
  );

  const fetchPlants = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoading(true);

    try {
      const isFamilyView = householdViewMode === "family";

      const growSelect = "id, plant_profile_id, sown_date, location, user_id, plant_profiles(name, variety_name, primary_image_path, hero_image_url, hero_image_path, sun, plant_spacing, days_to_germination, harvest_days, tags)";
      let growQuery = supabase
        .from("grow_instances")
        .select(growSelect)
        .eq("is_permanent_planting", true)
        .is("deleted_at", null)
        .order("sown_date", { ascending: false });
      if (!isFamilyView) growQuery = growQuery.eq("user_id", user.id);

      const { data: grows, error } = await growQuery;

      if (error) {
        setLoadError(error.message);
        return;
      }
      if (!grows || grows.length === 0) {
        setPlants([]);
        return;
      }

      const growIds = grows.map((g: { id: string }) => g.id);

      let careQuery = supabase.from("care_schedules").select("grow_instance_id").in("grow_instance_id", growIds).eq("is_active", true);
      let journalQuery = supabase.from("journal_entries").select("grow_instance_id").in("grow_instance_id", growIds).is("deleted_at", null);
      if (!isFamilyView) {
        careQuery = careQuery.eq("user_id", user.id);
        journalQuery = journalQuery.eq("user_id", user.id);
      }
      const [careRes, journalRes] = await Promise.all([careQuery, journalQuery]);

      const careCounts = new Map<string, number>();
      (careRes.data ?? []).forEach((c: { grow_instance_id: string | null }) => {
        if (c.grow_instance_id) careCounts.set(c.grow_instance_id, (careCounts.get(c.grow_instance_id) ?? 0) + 1);
      });
      const journalCounts = new Map<string, number>();
      (journalRes.data ?? []).forEach((j: { grow_instance_id: string | null }) => {
        if (j.grow_instance_id) journalCounts.set(j.grow_instance_id, (journalCounts.get(j.grow_instance_id) ?? 0) + 1);
      });

      type ProfileShape = { name?: string; variety_name?: string | null; primary_image_path?: string | null; hero_image_url?: string | null; hero_image_path?: string | null; sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null; tags?: string[] | null };
      const plantings: PermanentPlanting[] = grows.map((g: { id: string; plant_profile_id?: string | null; sown_date: string; location?: string | null; user_id?: string | null; plant_profiles?: ProfileShape | ProfileShape[] | null }) => {
        const raw = g.plant_profiles;
        const profile: ProfileShape | null = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
        return {
          id: g.id,
          plant_profile_id: g.plant_profile_id ?? "",
          sown_date: g.sown_date,
          location: g.location ?? null,
          user_id: g.user_id ?? null,
          profile_name: profile?.name ?? "",
          profile_variety_name: profile?.variety_name ?? null,
          primary_image_path: profile?.primary_image_path ?? null,
          hero_image_url: profile?.hero_image_url ?? null,
          hero_image_path: profile?.hero_image_path ?? null,
          care_count: careCounts.get(g.id) ?? 0,
          journal_count: journalCounts.get(g.id) ?? 0,
          sun: profile?.sun ?? null,
          plant_spacing: profile?.plant_spacing ?? null,
          days_to_germination: profile?.days_to_germination ?? null,
          harvest_days: profile?.harvest_days ?? null,
          tags: profile?.tags ?? null,
        };
      });

      setPlants(plantings);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user?.id, householdViewMode]);

  useEffect(() => { fetchPlants(); }, [fetchPlants, refetchTrigger]);

  const toBatchLogBatch = useCallback((p: PermanentPlanting): BatchLogBatch => ({
    id: p.id,
    plant_profile_id: p.plant_profile_id,
    profile_name: p.profile_name,
    profile_variety_name: p.profile_variety_name,
    location: p.location ?? undefined,
    user_id: p.user_id ?? undefined,
  }), []);

  useEffect(() => {
    if (openBulkLogRequest && selectedGrowIds.size > 0) {
      const selected = plants.filter((p) => selectedGrowIds.has(p.id));
      if (selected.length > 0) {
        setBatchLogBatches(selected.map(toBatchLogBatch));
        setBatchLogOpen(true);
        onBulkLogRequestHandled?.();
      } else {
        onBulkLogRequestHandled?.();
        if (plants.length === 0) {
          setQuickToast("Loading plants…");
          setTimeout(() => setQuickToast(null), 2000);
        }
      }
    }
  }, [openBulkLogRequest, selectedGrowIds, plants, toBatchLogBatch, onBulkLogRequestHandled]);

  const formatBatchDisplayName = (name: string, variety: string | null) =>
    variety?.trim() ? `${name} (${variety})` : name;

  const handleQuickTap = useCallback(async (batch: BatchLogBatch, action: "water" | "fertilize" | "spray") => {
    if (!user?.id) return;
    try {
      const weather = await fetchWeatherSnapshot();
      const notes: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };
      const { error } = await insertWithOfflineQueue("journal_entries", {
        user_id: user.id,
        plant_profile_id: batch.plant_profile_id,
        grow_instance_id: batch.id,
        note: notes[action],
        entry_type: "quick",
        weather_snapshot: weather ?? undefined,
      });
      if (error) { setQuickToast("Failed to save — try again"); } else { setQuickToast(`${notes[action]} ${formatBatchDisplayName(batch.profile_name, batch.profile_variety_name)}`); }
      setTimeout(() => setQuickToast(null), 2000);
    } catch {
      setQuickToast("Failed to save — try again");
      setTimeout(() => setQuickToast(null), 2000);
    }
  }, [user?.id]);

  const handleBulkQuickTap = useCallback(async (batches: BatchLogBatch[], action: "water" | "fertilize" | "spray") => {
    if (!user?.id || batches.length === 0) return;
    try {
      const weather = await fetchWeatherSnapshot();
      const notes: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };
      const entries = batches.map((b) => ({
        user_id: user.id,
        plant_profile_id: b.plant_profile_id,
        grow_instance_id: b.id,
        note: notes[action],
        entry_type: "quick" as const,
        weather_snapshot: weather ?? undefined,
      }));
      const { error } = await insertManyWithOfflineQueue("journal_entries", entries);
      if (error) {
        setQuickToast("Failed to save — try again");
        setTimeout(() => setQuickToast(null), 2000);
      } else {
        setQuickToast(`${notes[action]} (${batches.length} plant${batches.length !== 1 ? "s" : ""})`);
        setTimeout(() => setQuickToast(null), 2000);
        onRefetch?.();
      }
    } catch {
      setQuickToast("Failed to save — try again");
      setTimeout(() => setQuickToast(null), 2000);
    }
  }, [user?.id, onRefetch]);

  const handleEndBatch = useCallback(async () => {
    if (!user?.id || !endBatchTarget) return;
    setEndSaving(true);
    const batchId = endBatchTarget.id;
    const now = new Date().toISOString();
    const isDead = endReason === "plant_died";
    const status = isDead ? "dead" : "archived";
    const batchUserId = endBatchTarget.user_id ?? user.id;

    const { error: updateErr } = await updateWithOfflineQueue("grow_instances", {
      status,
      ended_at: now,
      end_reason: endReason,
    }, { id: batchId, user_id: batchUserId });

    if (updateErr) {
      setEndSaving(false);
      setQuickToast(updateErr.message);
      setTimeout(() => setQuickToast(null), 3000);
      return;
    }

    await softDeleteTasksForGrowInstance(batchId, batchUserId);

    if (endNote.trim() || isDead) {
      const weather = await fetchWeatherSnapshot();
      await insertWithOfflineQueue("journal_entries", {
        user_id: user.id,
        plant_profile_id: endBatchTarget.plant_profile_id,
        grow_instance_id: batchId,
        note: endNote.trim() || (isDead ? "Plant died" : "Batch ended"),
        entry_type: isDead ? "death" : "note",
        weather_snapshot: weather ?? undefined,
      });
    }

    setEndSaving(false);
    setEndBatchTarget(null);
    setEndReason("other");
    setEndNote("");
    setPlants((prev) => prev.filter((p) => p.id !== batchId));
    onRefetch?.();
  }, [user?.id, endBatchTarget, endReason, endNote, onRefetch]);

  const handleDeleteBatch = useCallback(async () => {
    if (!user?.id || !deleteBatchTarget) return;
    setDeleteSaving(true);
    const batchId = deleteBatchTarget.id;
    const now = new Date().toISOString();
    const batchUserId = deleteBatchTarget.user_id ?? user.id;
    const { error } = await updateWithOfflineQueue("grow_instances", { deleted_at: now }, { id: batchId, user_id: batchUserId });
    if (!error) await softDeleteTasksForGrowInstance(batchId, batchUserId);
    setDeleteSaving(false);
    setDeleteBatchTarget(null);
    if (error) {
      setQuickToast(error.message);
      setTimeout(() => setQuickToast(null), 3000);
      return;
    }
    setPlants((prev) => prev.filter((p) => p.id !== batchId));
    onRefetch?.();
  }, [user?.id, deleteBatchTarget, onRefetch]);

  const handleBulkDelete = useCallback(async () => {
    if (!user?.id || selectedGrowIds.size === 0) return;
    setBulkDeleteSaving(true);
    const now = new Date().toISOString();
    const selectedBatches = plants.filter((p) => selectedGrowIds.has(p.id));
    let hadError = false;
    for (const batch of selectedBatches) {
      const batchUserId = batch.user_id ?? user.id;
      await updateWithOfflineQueue("journal_entries", { deleted_at: now }, { grow_instance_id: batch.id, user_id: batchUserId });
      await softDeleteTasksForGrowInstance(batch.id, batchUserId);
      const { error } = await updateWithOfflineQueue("grow_instances", { deleted_at: now }, { id: batch.id, user_id: batchUserId });
      if (error) hadError = true;
    }
    setBulkDeleteSaving(false);
    setBulkDeleteConfirmOpen(false);
    if (hadError) {
      setQuickToast("Some deletions failed — try again");
      setTimeout(() => setQuickToast(null), 3000);
    } else {
      const msg = `Deleted ${selectedBatches.length} plant${selectedBatches.length !== 1 ? "s" : ""}`;
      if (onSaveMessage) onSaveMessage(msg);
      else { setQuickToast(msg); setTimeout(() => setQuickToast(null), 2000); }
    }
    onRefetch?.();
  }, [user?.id, selectedGrowIds, plants, onRefetch, onSaveMessage]);

  const handleBulkEndBatch = useCallback(async () => {
    if (!user?.id || selectedGrowIds.size === 0) return;
    setBulkEndBatchSaving(true);
    const selectedBatches = plants.filter((p) => selectedGrowIds.has(p.id));
    const now = new Date().toISOString();
    for (const batch of selectedBatches) {
      const batchUserId = batch.user_id ?? user.id;
      await updateWithOfflineQueue("grow_instances", { status: "archived", ended_at: now }, { id: batch.id, user_id: batchUserId });
      await softDeleteTasksForGrowInstance(batch.id, batchUserId);
    }
    setBulkEndBatchSaving(false);
    setBulkEndBatchConfirmOpen(false);
    const msg = `Ended ${selectedBatches.length} planting${selectedBatches.length !== 1 ? "s" : ""}`;
    if (onSaveMessage) onSaveMessage(msg);
    else { setQuickToast(msg); setTimeout(() => setQuickToast(null), 2000); }
    onRefetch?.();
  }, [user?.id, selectedGrowIds, plants, onRefetch, onSaveMessage]);

  const maturityRange = (days: number | null | undefined): string => {
    if (days == null || !Number.isFinite(days)) return "";
    if (days < 60) return "<60";
    if (days <= 90) return "60-90";
    return "90+";
  };

  const categoryChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of plants) {
      const first = (p.profile_name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
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
      const v = (p.profile_variety_name ?? "").trim() || "—";
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
      if (profileIdFilter) {
        if (p.plant_profile_id !== profileIdFilter) return false;
      }
      if (categoryFilter) {
        const first = (p.profile_name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
        if (first !== categoryFilter) return false;
      }
      if (varietyFilter != null && varietyFilter !== "") {
        const v = (p.profile_variety_name ?? "").trim();
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
  }, [plants, profileIdFilter, categoryFilter, varietyFilter, sunFilter, spacingFilter, germinationFilter, maturityFilter, tagFilters]);

  const q = (searchQuery ?? "").trim().toLowerCase();
  const filteredBySearch = useMemo(() => {
    if (!q) return filteredPlants;
    return filteredPlants.filter((p) => {
      const name = (p.profile_name ?? "").toLowerCase();
      const variety = (p.profile_variety_name ?? "").toLowerCase();
      return name.includes(q) || variety.includes(q);
    });
  }, [filteredPlants, q]);

  const sortedPlants = useMemo(() => {
    const list = [...filteredBySearch];
    const cmp = (a: PermanentPlanting, b: PermanentPlanting): number => {
      switch (sortBy) {
        case "name": {
          const na = (a.profile_name ?? "").trim().toLowerCase();
          const nb = (b.profile_name ?? "").trim().toLowerCase();
          const va = (a.profile_variety_name ?? "").trim().toLowerCase();
          const vb = (b.profile_variety_name ?? "").trim().toLowerCase();
          return `${na} ${va}`.localeCompare(`${nb} ${vb}`, undefined, { sensitivity: "base" });
        }
        case "planted_date": {
          const da = new Date(a.sown_date ?? 0).getTime();
          const db = new Date(b.sown_date ?? 0).getTime();
          return da - db;
        }
        case "care_count":
          return (a.care_count ?? 0) - (b.care_count ?? 0);
        default:
          return 0;
      }
    };
    list.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : -cmp(a, b)));
    return list;
  }, [filteredBySearch, sortBy, sortDir]);

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

  useEffect(() => {
    if (!profileIdFilter) return;
    if (filteredBySearch.length === 1) {
      const p = filteredBySearch[0];
      const name = p.profile_variety_name?.trim() ? `${p.profile_name} (${p.profile_variety_name})` : p.profile_name;
      onProfileFilteredPlantName?.(name ?? "");
    } else {
      onProfileFilteredPlantName?.(null);
      if (filteredBySearch.length === 0) onProfileFilterEmpty?.();
    }
  }, [profileIdFilter, filteredBySearch, onProfileFilteredPlantName, onProfileFilterEmpty]);

  if (loadError) {
    return (
      <div className="py-8 px-4 text-center">
        <p className="text-black/70 font-medium mb-2">Couldn&apos;t load My Plants</p>
        <p className="text-sm text-black/50 mb-4">{loadError}</p>
        <button
          type="button"
          onClick={() => fetchPlants()}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`grid gap-2 ${displayStyle === "grid" ? "grid-cols-3" : "grid-cols-1"}`}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-emerald-100 overflow-hidden animate-pulse">
            <div className={`bg-emerald-50/50 ${displayStyle === "grid" ? "aspect-square" : "aspect-[16/10]"}`} />
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
        <EmptyStateCard
          title="No permanent plants yet"
          body="Add your fruit trees, bushes, and other perennial plants here."
          actionLabel="Add a Perennial"
          onAction={() => onAddClick?.()}
          illustration={
            <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="text-emerald-400" aria-hidden>
              <path d="M32 60v-12" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M32 48c-10 0-18-8-18-18s8-18 18-18 18 8 18 18-8 18-18 18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M32 36c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
            </svg>
          }
        />
      ) : sortedPlants.length === 0 ? (
        <NoMatchCard
          message="No plants match your search or filters."
          actionLabel={profileIdFilter ? "Clear filter" : onClearFilters ? "Clear filters" : undefined}
          onAction={profileIdFilter ? onClearProfileFilter : onClearFilters}
        />
      ) : (
        <>
          {batchSelectMode && selectedGrowIds.size > 0 && (
            <div className="flex items-center justify-end gap-3 flex-wrap mb-3">
              <span className="text-sm text-black/60">Selecting ({selectedGrowIds.size})</span>
            </div>
          )}

          {bulkEndBatchConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog" aria-labelledby="bulk-end-batch-title">
              <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full p-6">
                <h2 id="bulk-end-batch-title" className="text-lg font-semibold text-black mb-2">End {selectedGrowIds.size} planting{selectedGrowIds.size !== 1 ? "s" : ""}?</h2>
                <p className="text-sm text-black/70 mb-4">
                  Selected plantings will move to Settings → Archived Plantings. History is preserved.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setBulkEndBatchConfirmOpen(false)}
                    disabled={bulkEndBatchSaving}
                    className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkEndBatch}
                    disabled={bulkEndBatchSaving}
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50 min-h-[44px]"
                  >
                    {bulkEndBatchSaving ? "Ending…" : "End batch"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {bulkDeleteConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog" aria-labelledby="bulk-delete-title">
              <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full p-6">
                <h2 id="bulk-delete-title" className="text-lg font-semibold text-black mb-2">Delete {selectedGrowIds.size} plant{selectedGrowIds.size !== 1 ? "s" : ""}?</h2>
                <p className="text-sm text-black/70 mb-4">
                  All related data (journal entries, tasks) will be removed. If you want to preserve history, use End Crop instead to archive.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setBulkDeleteConfirmOpen(false)}
                    disabled={bulkDeleteSaving}
                    className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteSaving}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 min-h-[44px]"
                  >
                    {bulkDeleteSaving ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <BatchLogSheet
            open={batchLogOpen}
            batches={batchLogBatches}
            isPermanent={true}
            onClose={() => { setBatchLogOpen(false); setBatchLogBatches([]); }}
            onSaved={() => { fetchPlants(); onRefetch?.(); }}
            onLogHarvest={() => {}}
            onQuickCare={(batch, action) => { handleQuickTap(batch, action); setBatchLogOpen(false); setBatchLogBatches([]); }}
            onBulkQuickCare={(batches, action) => { handleBulkQuickTap(batches, action); setBatchLogOpen(false); setBatchLogBatches([]); }}
          />

          {deleteBatchTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
              <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Delete Planting</h2>
                <p className="text-sm text-neutral-600 mb-4">
                  Permanently remove {formatBatchDisplayName(deleteBatchTarget.profile_name, deleteBatchTarget.profile_variety_name)}? This cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setDeleteBatchTarget(null)} className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Cancel</button>
                  <button type="button" onClick={handleDeleteBatch} disabled={deleteSaving} className="px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                    {deleteSaving ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {endBatchTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
              <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">End Planting</h2>
                <p className="text-sm text-neutral-600 mb-2">
                  {formatBatchDisplayName(endBatchTarget.profile_name, endBatchTarget.profile_variety_name)}
                </p>
                <select
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value as "harvested" | "plant_died" | "other")}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm mb-3 focus:ring-emerald-500"
                >
                  <option value="other">Other reason</option>
                  <option value="harvested">Harvested / removed</option>
                  <option value="plant_died">Plant died</option>
                </select>
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={endNote}
                  onChange={(e) => setEndNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm mb-4 focus:ring-emerald-500"
                />
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setEndBatchTarget(null)} className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Cancel</button>
                  <button type="button" onClick={handleEndBatch} disabled={endSaving} className={`px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 ${endReason === "plant_died" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}>
                    {endSaving ? "Saving..." : endReason === "plant_died" ? "Mark as Dead" : "End Batch"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {quickToast && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg" role="status" aria-live="polite">
              {quickToast}
            </div>
          )}

          {displayStyle === "list" ? (
            <ul className="space-y-4" role="list">
              {sortedPlants.map((plant) => {
                const imgUrl = getPlantImageUrl(plant);
                const handlers = getLongPressHandlers(plant.id, plant.plant_profile_id, plant.user_id);
                const selected = selectedGrowIds.has(plant.id);
                return (
                  <li key={plant.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handlers.handleClick(e as unknown as React.MouseEvent)}
                      onKeyDown={(e) => e.key === "Enter" && handlers.handleClick()}
                      {...handlers}
                      className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm transition-all group cursor-pointer min-h-[44px] ${
                        selected ? "ring-2 ring-emerald-500 border-2 border-emerald-500 bg-emerald-50/50" : "border-emerald-200/80 bg-white hover:border-emerald-300 hover:shadow-md"
                      }`}
                      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                    >
                      {batchSelectMode && (
                        <span className="shrink-0 w-6 h-6 rounded-full border-2 border-black/20 flex items-center justify-center bg-white" aria-hidden>
                          {selected ? <span className="w-3 h-3 rounded-full bg-blue-600" /> : null}
                        </span>
                      )}
                      <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden">
                        <PlantImage imageUrl={imgUrl} alt="" size="md" variant="emerald" className="group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-neutral-900 truncate">{plant.profile_name}</h3>
                        {plant.profile_variety_name && <p className="text-sm text-neutral-500 truncate">{plant.profile_variety_name}</p>}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-neutral-500">
                          {formatPlantedAgo(plant.sown_date) && <span>{formatPlantedAgo(plant.sown_date)}</span>}
                          {plant.care_count > 0 && <span>{plant.care_count} care</span>}
                          {plant.journal_count > 0 && <span>{plant.journal_count} journal</span>}
                          {plant.care_count === 0 && plant.journal_count === 0 && !formatPlantedAgo(plant.sown_date) && <span>No activity</span>}
                        </div>
                      </div>
                      {householdViewMode === "family" && plant.user_id && plant.user_id !== user?.id && (
                        <span className="shrink-0 text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500 text-white">
                          FAM
                        </span>
                      )}
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 text-[10px] font-medium">Perennial</span>
                      {(!householdViewMode || householdViewMode !== "family" || plant.user_id === user?.id) && (
                        <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => { setBatchLogBatches([toBatchLogBatch(plant)]); setBatchLogOpen(true); }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 bg-white text-emerald-600 hover:bg-emerald/10"
                            aria-label="Add journal entry"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="M8 7h8" /><path d="M8 11h8" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sortedPlants.map((plant) => {
                const imgUrl = getPlantImageUrl(plant);
                const handlers = getLongPressHandlers(plant.id, plant.plant_profile_id, plant.user_id);
                const selected = selectedGrowIds.has(plant.id);
                return (
                  <div
                    key={plant.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handlers.handleClick(e as unknown as React.MouseEvent)}
                    onKeyDown={(e) => e.key === "Enter" && handlers.handleClick()}
                    {...handlers}
                    className={`group rounded-lg overflow-hidden flex flex-col border shadow-card transition-all w-full cursor-pointer min-h-[44px] card-interactive ${
                      selected ? "ring-2 ring-emerald-500 border-2 border-emerald-500 bg-emerald-50/50" : "bg-white border-black/5 hover:border-emerald-500/40"
                    }`}
                  >
                    <div className="px-1.5 pt-1.5 shrink-0">
                      <div className="relative w-full aspect-square overflow-hidden rounded-xl">
                        {batchSelectMode && (
                          <span className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 border-black/20 flex items-center justify-center bg-white" aria-hidden>
                            {selected ? <span className="w-3 h-3 rounded-full bg-blue-600" /> : null}
                          </span>
                        )}
                        <PlantImage imageUrl={imgUrl} alt="" fill size="lg" variant="emerald" className="group-hover:scale-105 transition-transform" />
                        <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 font-medium text-[9px]" aria-hidden>
                          Perennial
                        </span>
                        {householdViewMode === "family" && plant.user_id && plant.user_id !== user?.id && (
                          <span className="absolute top-0.5 left-0.5 text-[8px] font-semibold px-1 py-0.5 rounded-full bg-violet-500 text-white leading-none">
                            FAM
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-1.5 pt-1 pb-0.5 flex flex-col flex-1 min-h-0 items-center text-center min-w-0">
                      <h3 className="font-semibold text-black text-xs leading-tight w-full min-h-[1.75rem] text-center line-clamp-2 break-words mb-0" title={plant.profile_name}>{plant.profile_name}</h3>
                      <div className={`text-[10px] leading-tight text-black/60 w-full min-h-0 line-clamp-2 break-words ${plant.profile_variety_name ? "italic" : ""}`} title={plant.profile_variety_name || undefined}>{plant.profile_variety_name || "—"}</div>
                      <div className="mt-auto pt-0.5 flex items-center gap-1 flex-wrap justify-center min-w-0 w-full text-[9px] text-black/60">
                        {formatPlantedAgo(plant.sown_date) && <span>{formatPlantedAgo(plant.sown_date)}</span>}
                        {plant.care_count > 0 && <span>{plant.care_count} care</span>}
                        {plant.journal_count > 0 && <span>{plant.journal_count} journal</span>}
                        {plant.care_count === 0 && plant.journal_count === 0 && !formatPlantedAgo(plant.sown_date) && <span>No activity</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
});
MyPlantsView.displayName = "MyPlantsView";
