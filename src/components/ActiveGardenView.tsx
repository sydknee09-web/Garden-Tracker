"use client";

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue, insertManyWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { OwnerBadge } from "@/components/OwnerBadge";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";
import { BatchLogSheet, type BatchLogBatch } from "@/components/BatchLogSheet";
import type { WeatherSnapshotData } from "@/types/garden";

const LONG_PRESS_MS = 500;

/** Law 7: hero_image_url → hero_image_path → primary_image_path → sprout fallback */
function getBatchImageUrl(batch: { hero_image_url?: string | null; hero_image_path?: string | null; primary_image_path?: string | null }): string | null {
  const url = (batch.hero_image_url ?? "").trim();
  if (url && url.startsWith("http")) {
    if (url.includes("supabase.co")) return url;
    return `/api/seed/proxy-image?url=${encodeURIComponent(url)}`;
  }
  if ((batch.hero_image_path ?? "").trim()) return supabase.storage.from("journal-photos").getPublicUrl(batch.hero_image_path!.trim()).data.publicUrl;
  if ((batch.primary_image_path ?? "").trim()) return supabase.storage.from("seed-packets").getPublicUrl(batch.primary_image_path!.trim()).data.publicUrl;
  return null;
}

type PendingItem = {
  id: string;
  plant_profile_id: string | null;
  due_date: string;
  title: string;
};

type GrowingBatch = {
  id: string;
  plant_profile_id: string;
  sown_date: string;
  expected_harvest_date: string | null;
  status: string | null;
  profile_name: string;
  profile_variety_name: string | null;
  weather_snapshot: WeatherSnapshotData;
  harvest_count: number;
  planting_method_badge: string | null;
  location?: string | null;
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  tags?: string[] | null;
  user_id?: string | null;
  sow_method?: "direct_sow" | "seed_start" | null;
  seeds_sown?: number | null;
  seeds_sprouted?: number | null;
  plant_count?: number | null;
  hero_image_url?: string | null;
  hero_image_path?: string | null;
  primary_image_path?: string | null;
};

export type ActiveGardenViewHandle = { exitBulkMode: () => void };

export const ActiveGardenView = forwardRef<ActiveGardenViewHandle, {
  refetchTrigger: number;
  /** When set, scroll to this grow instance and clear the URL param. Used when navigating from plant profile. */
  highlightGrowId?: string | null;
  searchQuery?: string;
  onLogGrowth: (batch: GrowingBatch) => void;
  onLogHarvest: (batch: GrowingBatch) => void;
  onEndCrop: (batch: GrowingBatch) => void;
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
  /** Called when loading done: batch info for "Viewing" chip, or null if not found. Only called when !loading. */
  onHighlightedBatch?: (batch: { id: string; profile_name: string; profile_variety_name: string | null } | null) => void;
  /** Called when user taps "Show all" in empty state (batch not found). Clears grow param. */
  onClearGrowView?: () => void;
  /** When true, enter bulk journal mode (e.g. from FAB "Add journal entry"). */
  openBulkJournalRequest?: boolean;
  onBulkJournalRequestHandled?: () => void;
  onBulkSelectionChange?: (count: number) => void;
  /** When true, open BatchLogSheet for selected batches (from FAB pencil when selections exist). */
  openBulkLogRequest?: boolean;
  onBulkLogRequestHandled?: () => void;
  /** Called when bulk mode changes (true = in bulk mode, false = exited). */
  onBulkModeChange?: (inBulkMode: boolean) => void;
  /** "grid" = small badges, "list" = detailed rows. */
  displayStyle?: "grid" | "list";
  sortBy?: "name" | "sown_date" | "harvest_date";
  sortDir?: "asc" | "desc";
}>(({
  refetchTrigger,
  highlightGrowId = null,
  searchQuery = "",
  onLogGrowth,
  onLogHarvest,
  onEndCrop,
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
  onHighlightedBatch,
  onClearGrowView,
  openBulkJournalRequest = false,
  onBulkJournalRequestHandled,
  onBulkSelectionChange,
  openBulkLogRequest = false,
  onBulkLogRequestHandled,
  onBulkModeChange,
  displayStyle = "list",
  sortBy = "sown_date",
  sortDir = "desc",
}, ref) => {
  const { user } = useAuth();
  const { viewMode, getShorthandForUser, canEditUser } = useHousehold();
  const highlightBatchRef = useRef<HTMLElement | null>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [growing, setGrowing] = useState<GrowingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bulk select state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Quick-tap toast
  const [quickToast, setQuickToast] = useState<string | null>(null);

  // End batch modal
  const [endBatchTarget, setEndBatchTarget] = useState<GrowingBatch | null>(null);
  const [endReason, setEndReason] = useState<string>("season_ended");
  const [endNote, setEndNote] = useState("");
  const [endSaving, setEndSaving] = useState(false);

  // Delete batch confirmation
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<GrowingBatch | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Bulk delete confirmation
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);

  // BatchLogSheet (single or bulk)
  const [batchLogOpen, setBatchLogOpen] = useState(false);
  const [batchLogBatches, setBatchLogBatches] = useState<BatchLogBatch[]>([]);
  const longPressFiredRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exitBulkMode = useCallback(() => {
    setBulkMode(false);
    setBulkSelected(new Set());
    onBulkSelectionChange?.(0);
    onBulkModeChange?.(false);
  }, [onBulkSelectionChange, onBulkModeChange]);

  useImperativeHandle(ref, () => ({ exitBulkMode }), [exitBulkMode]);

  const formatBatchDisplayName = (name: string, variety: string | null) => (variety?.trim() ? `${name} (${variety})` : name);

  const toBatchLogBatch = (b: GrowingBatch): BatchLogBatch => ({
    id: b.id,
    plant_profile_id: b.plant_profile_id,
    profile_name: b.profile_name,
    profile_variety_name: b.profile_variety_name,
    seeds_sown: b.seeds_sown ?? null,
    seeds_sprouted: b.seeds_sprouted ?? null,
    plant_count: b.plant_count ?? null,
    location: b.location ?? null,
    user_id: b.user_id ?? null,
  });

  // Scroll to highlighted batch when navigating from plant profile (e.g. /garden?tab=active&grow=xxx)
  // Keep grow param in URL so user sees "Viewing" chip and can cancel; do not auto-clear
  useEffect(() => {
    if (!highlightGrowId || !highlightBatchRef.current) return;
    const el = highlightBatchRef.current;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightGrowId, loading]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const isFamilyView = viewMode === "family";

    try {
    let pendingQuery = supabase
      .from("tasks")
      .select("id, plant_profile_id, due_date, title")
      .is("deleted_at", null)
      .eq("category", "sow")
      .is("completed_at", null)
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(50);
    if (!isFamilyView) pendingQuery = pendingQuery.eq("user_id", user.id);
    const { data: taskRows } = await pendingQuery;
    setPending((taskRows ?? []) as PendingItem[]);

    let growQuery = supabase
      .from("grow_instances")
      .select("id, plant_profile_id, sown_date, expected_harvest_date, status, location, user_id, sow_method, seeds_sown, seeds_sprouted, plant_count")
      .is("deleted_at", null)
      .in("status", ["growing", "pending"])
      .order("sown_date", { ascending: false })
      .limit(100);
    if (!isFamilyView) growQuery = growQuery.eq("user_id", user.id);
    const { data: growRows } = await growQuery;

    if (!growRows?.length) { setGrowing([]); return; }

    const profileIds = Array.from(new Set((growRows as { plant_profile_id: string }[]).map((r) => r.plant_profile_id).filter(Boolean)));
    const { data: profiles } = await supabase.from("plant_profiles").select("id, name, variety_name, sun, plant_spacing, days_to_germination, harvest_days, tags, hero_image_url, hero_image_path, primary_image_path").in("id", profileIds);
    const profileMap = new Map((profiles ?? []).map((p: { id: string; name: string; variety_name: string | null; sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null; tags?: string[] | null; hero_image_url?: string | null; hero_image_path?: string | null; primary_image_path?: string | null }) => [p.id, p]));

    const growIds = (growRows as { id: string }[]).map((r) => r.id);
    const [weatherRes, harvestRes] = await Promise.all([
      supabase.from("journal_entries").select("grow_instance_id, weather_snapshot, note").in("grow_instance_id", growIds).like("note", "Planted%").order("created_at", { ascending: true }),
      supabase.from("journal_entries").select("grow_instance_id").in("grow_instance_id", growIds).eq("entry_type", "harvest"),
    ]);

    const weatherByGrow = new Map<string, WeatherSnapshotData>();
    const plantingNoteByGrow = new Map<string, string>();
    (weatherRes.data ?? []).forEach((j: { grow_instance_id: string; weather_snapshot: WeatherSnapshotData; note?: string }) => {
      if (j.grow_instance_id && !weatherByGrow.has(j.grow_instance_id)) {
        weatherByGrow.set(j.grow_instance_id, j.weather_snapshot ?? null);
        if (j.note?.trim()) plantingNoteByGrow.set(j.grow_instance_id, j.note.trim());
      }
    });
    const badgeFromNote = (note: string | undefined): string | null => {
      if (!note) return null;
      const hasDirect = /direct\s*sow|direct\s*&|direct\s*and/i.test(note);
      const hasGreenhouse = /greenhouse/i.test(note);
      if (hasDirect && hasGreenhouse) return "Direct & Greenhouse";
      if (hasGreenhouse) return "Greenhouse";
      if (hasDirect) return "Direct";
      return null;
    };
    const harvestCountByGrow = new Map<string, number>();
    (harvestRes.data ?? []).forEach((h: { grow_instance_id: string | null }) => {
      if (h.grow_instance_id) harvestCountByGrow.set(h.grow_instance_id, (harvestCountByGrow.get(h.grow_instance_id) ?? 0) + 1);
    });

    const batches: GrowingBatch[] = (growRows as { id: string; plant_profile_id: string; sown_date: string; expected_harvest_date: string | null; status: string | null; location?: string | null; user_id?: string | null; sow_method?: "direct_sow" | "seed_start" | null; seeds_sown?: number | null; seeds_sprouted?: number | null; plant_count?: number | null }[])
      .map((r) => {
        const p = profileMap.get(r.plant_profile_id);
        const note = plantingNoteByGrow.get(r.id);
        const sowBadge = r.sow_method === "direct_sow" ? "Direct sow" : r.sow_method === "seed_start" ? "Seed start" : badgeFromNote(note);
        return {
          id: r.id, plant_profile_id: r.plant_profile_id, sown_date: r.sown_date,
          expected_harvest_date: r.expected_harvest_date, status: r.status,
          profile_name: p?.name ?? "Unknown", profile_variety_name: p?.variety_name ?? null,
          weather_snapshot: weatherByGrow.get(r.id) ?? null, harvest_count: harvestCountByGrow.get(r.id) ?? 0,
          planting_method_badge: sowBadge, location: r.location,
          sun: p?.sun ?? null, plant_spacing: p?.plant_spacing ?? null,
          days_to_germination: p?.days_to_germination ?? null, harvest_days: p?.harvest_days ?? null,
          tags: p?.tags ?? null, user_id: r.user_id ?? null,
          sow_method: r.sow_method ?? null, seeds_sown: r.seeds_sown ?? null, seeds_sprouted: r.seeds_sprouted ?? null, plant_count: r.plant_count ?? null,
          hero_image_url: p?.hero_image_url ?? null, hero_image_path: p?.hero_image_path ?? null, primary_image_path: p?.primary_image_path ?? null,
        };
      });
    setGrowing(batches);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
    setLoading(false);
    }
  }, [user?.id, viewMode]);

  useEffect(() => { load(); }, [load, refetchTrigger]);

  const maturityRange = (days: number | null | undefined): string => {
    if (days == null || !Number.isFinite(days)) return "";
    if (days < 60) return "<60";
    if (days <= 90) return "60-90";
    return "90+";
  };

  const categoryChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of growing) {
      const first = (b.profile_name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
      map.set(first, (map.get(first) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type, undefined, { sensitivity: "base" }));
  }, [growing]);

  const refineChips = useMemo(() => {
    const varietyMap = new Map<string, number>();
    const sunMap = new Map<string, number>();
    const spacingMap = new Map<string, number>();
    const germinationMap = new Map<string, number>();
    const maturityMap = new Map<string, number>();
    const tagSet = new Set<string>();
    for (const b of growing) {
      const v = (b.profile_variety_name ?? "").trim() || "—";
      varietyMap.set(v, (varietyMap.get(v) ?? 0) + 1);
      const sun = (b.sun ?? "").trim();
      if (sun) sunMap.set(sun, (sunMap.get(sun) ?? 0) + 1);
      const sp = (b.plant_spacing ?? "").trim();
      if (sp) spacingMap.set(sp, (spacingMap.get(sp) ?? 0) + 1);
      const g = (b.days_to_germination ?? "").trim();
      if (g) germinationMap.set(g, (germinationMap.get(g) ?? 0) + 1);
      const m = maturityRange(b.harvest_days ?? null);
      if (m) maturityMap.set(m, (maturityMap.get(m) ?? 0) + 1);
      (b.tags ?? []).forEach((t) => tagSet.add(t));
    }
    return {
      variety: Array.from(varietyMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      sun: Array.from(sunMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      spacing: Array.from(spacingMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      germination: Array.from(germinationMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      maturity: (["<60", "60-90", "90+"] as const).filter((k) => maturityMap.has(k)).map((value) => ({ value, count: maturityMap.get(value) ?? 0 })),
      tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    };
  }, [growing]);

  const filteredGrowing = useMemo(() => {
    return growing.filter((b) => {
      if (categoryFilter) {
        const first = (b.profile_name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
        if (first !== categoryFilter) return false;
      }
      if (varietyFilter != null && varietyFilter !== "") {
        const v = (b.profile_variety_name ?? "").trim();
        if (v !== varietyFilter) return false;
      }
      if (sunFilter != null && sunFilter !== "") {
        const sun = (b.sun ?? "").trim();
        if (sun !== sunFilter) return false;
      }
      if (spacingFilter != null && spacingFilter !== "") {
        const sp = (b.plant_spacing ?? "").trim();
        if (sp !== spacingFilter) return false;
      }
      if (germinationFilter != null && germinationFilter !== "") {
        const g = (b.days_to_germination ?? "").trim();
        if (g !== germinationFilter) return false;
      }
      if (maturityFilter != null && maturityFilter !== "") {
        if (maturityRange(b.harvest_days ?? null) !== maturityFilter) return false;
      }
      if (tagFilters.length > 0) {
        const batchTags = b.tags ?? [];
        if (!tagFilters.some((t) => batchTags.includes(t))) return false;
      }
      return true;
    });
  }, [growing, categoryFilter, varietyFilter, sunFilter, spacingFilter, germinationFilter, maturityFilter, tagFilters]);

  const q = (searchQuery ?? "").trim().toLowerCase();
  const filteredBySearch = useMemo(() => {
    if (!q) return filteredGrowing;
    return filteredGrowing.filter((b) => {
      const name = (b.profile_name ?? "").toLowerCase();
      const variety = (b.profile_variety_name ?? "").toLowerCase();
      return name.includes(q) || variety.includes(q);
    });
  }, [filteredGrowing, q]);

  /** When highlightGrowId is set, filter to only that batch so user sees applied filter and can cancel to full view. */
  const displayBatches = useMemo(() => {
    if (!highlightGrowId) return filteredBySearch;
    const match = filteredBySearch.find((b) => b.id === highlightGrowId);
    if (match) return [match];
    const fromGrowing = growing.find((b) => b.id === highlightGrowId);
    return fromGrowing ? [fromGrowing] : [];
  }, [highlightGrowId, filteredBySearch, growing]);

  // Report highlighted batch for "Viewing" chip when highlightGrowId matches; only call when loading done
  useEffect(() => {
    if (!onHighlightedBatch || loading) return;
    if (!highlightGrowId) {
      onHighlightedBatch(null);
      return;
    }
    const batch = displayBatches[0] ?? growing.find((b) => b.id === highlightGrowId);
    if (batch) {
      onHighlightedBatch({
        id: batch.id,
        profile_name: batch.profile_name,
        profile_variety_name: batch.profile_variety_name,
      });
    } else {
      onHighlightedBatch(null);
    }
  }, [highlightGrowId, loading, displayBatches, growing, onHighlightedBatch]);

  const sortedBatches = useMemo(() => {
    const list = [...displayBatches];
    const cmp = (a: GrowingBatch, b: GrowingBatch): number => {
      switch (sortBy) {
        case "name": {
          const na = (a.profile_name ?? "").trim().toLowerCase();
          const nb = (b.profile_name ?? "").trim().toLowerCase();
          const va = (a.profile_variety_name ?? "").trim().toLowerCase();
          const vb = (b.profile_variety_name ?? "").trim().toLowerCase();
          const keyA = `${na} ${va}`;
          const keyB = `${nb} ${vb}`;
          return keyA.localeCompare(keyB, undefined, { sensitivity: "base" });
        }
        case "sown_date": {
          const da = new Date(a.sown_date).getTime();
          const db = new Date(b.sown_date).getTime();
          return da - db;
        }
        case "harvest_date": {
          const rawA = a.expected_harvest_date ? new Date(a.expected_harvest_date).getTime() : a.harvest_days ? new Date(a.sown_date).getTime() + (a.harvest_days * 86400000) : 0;
          const rawB = b.expected_harvest_date ? new Date(b.expected_harvest_date).getTime() : b.harvest_days ? new Date(b.sown_date).getTime() + (b.harvest_days * 86400000) : 0;
          return rawA - rawB;
        }
        default:
          return 0;
      }
    };
    list.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : -cmp(a, b)));
    return list;
  }, [displayBatches, sortBy, sortDir]);

  const filteredPending = useMemo(() => {
    if (!q) return pending;
    return pending.filter((p) => (p.title ?? "").toLowerCase().includes(q));
  }, [pending, q]);

  useEffect(() => {
    onCategoryChipsLoaded?.(categoryChips);
  }, [categoryChips, onCategoryChipsLoaded]);

  useEffect(() => {
    onRefineChipsLoaded?.(refineChips);
  }, [refineChips, onRefineChipsLoaded]);

  useEffect(() => {
    onFilteredCountChange?.(filteredPending.length + displayBatches.length);
  }, [filteredPending.length, displayBatches.length, onFilteredCountChange]);

  useEffect(() => {
    if (!loading) onEmptyStateChange?.(filteredPending.length === 0 && displayBatches.length === 0);
  }, [loading, filteredPending.length, displayBatches.length, onEmptyStateChange]);

  // Enter bulk mode when parent requests it (e.g. FAB "Add journal entry").
  useEffect(() => {
    if (openBulkJournalRequest) {
      setBulkMode(true);
      onBulkJournalRequestHandled?.();
      onBulkModeChange?.(true);
    }
  }, [openBulkJournalRequest, onBulkJournalRequestHandled, onBulkModeChange]);

  useEffect(() => {
    onBulkSelectionChange?.(bulkSelected.size);
  }, [bulkSelected.size, onBulkSelectionChange]);

  useEffect(() => {
    if (openBulkLogRequest && bulkSelected.size > 0) {
      const selected = growing.filter((b) => bulkSelected.has(b.id));
      setBatchLogBatches(selected.map(toBatchLogBatch));
      setBatchLogOpen(true);
      onBulkLogRequestHandled?.();
    }
  }, [openBulkLogRequest, bulkSelected, growing, onBulkLogRequestHandled]);


  // Quick-tap handler
  const handleQuickTap = useCallback(async (batch: GrowingBatch, action: "water" | "fertilize" | "spray") => {
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

  // Bulk journal
  const handleBulkSubmit = useCallback(async () => {
    if (!user?.id || bulkSelected.size === 0 || !bulkNote.trim()) return;
    setBulkSaving(true);
    try {
      const weather = await fetchWeatherSnapshot();
      const entries = Array.from(bulkSelected).map((growId) => {
        const batch = growing.find((b) => b.id === growId);
        return {
          user_id: user.id,
          plant_profile_id: batch?.plant_profile_id ?? null,
          grow_instance_id: growId,
          note: bulkNote.trim(),
          entry_type: "note" as const,
          weather_snapshot: weather ?? undefined,
        };
      });
      const { error } = await insertManyWithOfflineQueue("journal_entries", entries);
      if (error) { setQuickToast("Failed to save journal entries"); setTimeout(() => setQuickToast(null), 2500); }
      setBulkNote("");
      setBulkSelected(new Set());
      setBulkMode(false);
    } catch {
      setQuickToast("Failed to save — try again");
      setTimeout(() => setQuickToast(null), 2500);
    } finally {
      setBulkSaving(false);
    }
  }, [user?.id, bulkSelected, bulkNote, growing]);

  // Bulk quick actions (water / fertilize / spray on all selected)
  const handleBulkQuickTap = useCallback(async (action: "water" | "fertilize" | "spray") => {
    if (!user?.id || bulkSelected.size === 0) return;
    setBulkSaving(true);
    try {
      const weather = await fetchWeatherSnapshot();
      const notes: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };
      const entries = Array.from(bulkSelected).map((growId) => {
        const batch = growing.find((b) => b.id === growId);
        return {
          user_id: user.id,
          plant_profile_id: batch?.plant_profile_id ?? null,
          grow_instance_id: growId,
          note: notes[action],
          entry_type: "quick" as const,
          weather_snapshot: weather ?? undefined,
        };
      });
      const { error } = await insertManyWithOfflineQueue("journal_entries", entries);
      if (error) {
        setQuickToast("Failed to save — try again");
        setTimeout(() => setQuickToast(null), 2000);
      } else {
        setQuickToast(`${notes[action]} (${bulkSelected.size} plant${bulkSelected.size !== 1 ? "s" : ""})`);
        setTimeout(() => setQuickToast(null), 2000);
        setBulkSelected(new Set());
        setBulkMode(false);
        onBulkSelectionChange?.(0);
        onBulkModeChange?.(false);
      }
    } catch {
      setQuickToast("Failed to save — try again");
      setTimeout(() => setQuickToast(null), 2000);
    } finally {
      setBulkSaving(false);
    }
  }, [user?.id, bulkSelected, growing, onBulkSelectionChange, onBulkModeChange]);

  // End batch with reason
  const handleEndBatch = useCallback(async () => {
    if (!user?.id || !endBatchTarget) return;
    setEndSaving(true);
    const batchId = endBatchTarget.id;
    const now = new Date().toISOString();
    const isDead = endReason === "plant_died";
    const status = isDead ? "dead" : "archived";

    const { error: updateErr } = await updateWithOfflineQueue("grow_instances", {
      status,
      ended_at: now,
      end_reason: endReason,
    }, { id: batchId, user_id: user.id });

    if (updateErr) {
      setEndSaving(false);
      setQuickToast(updateErr.message);
      setTimeout(() => setQuickToast(null), 3000);
      return;
    }

    await softDeleteTasksForGrowInstance(batchId, user.id);

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
    setEndReason("season_ended");
    setEndNote("");
    setGrowing((prev) => prev.filter((b) => b.id !== batchId));
    load();
  }, [user?.id, endBatchTarget, endReason, endNote, load]);

  const handleDeleteBatch = useCallback(async () => {
    if (!user?.id || !deleteBatchTarget) return;
    setDeleteSaving(true);
    const batchId = deleteBatchTarget.id;
    const now = new Date().toISOString();
    const { error } = await updateWithOfflineQueue("grow_instances", { deleted_at: now }, { id: batchId, user_id: user.id });
    if (!error) await softDeleteTasksForGrowInstance(batchId, user.id);
    setDeleteSaving(false);
    setDeleteBatchTarget(null);
    if (error) {
      setQuickToast(error.message);
      setTimeout(() => setQuickToast(null), 3000);
      return;
    }
    setGrowing((prev) => prev.filter((b) => b.id !== batchId));
    load();
  }, [user?.id, deleteBatchTarget, load]);

  const handleBulkDelete = useCallback(async () => {
    if (!user?.id || bulkSelected.size === 0) return;
    setBulkDeleteSaving(true);
    const now = new Date().toISOString();
    const selectedBatches = growing.filter((b) => bulkSelected.has(b.id));
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
    setBulkSelected(new Set());
    setBulkMode(false);
    onBulkSelectionChange?.(0);
    onBulkModeChange?.(false);
    if (hadError) {
      setQuickToast("Some deletions failed — try again");
      setTimeout(() => setQuickToast(null), 3000);
    } else {
      setQuickToast(`Deleted ${selectedBatches.length} plant${selectedBatches.length !== 1 ? "s" : ""}`);
      setTimeout(() => setQuickToast(null), 2000);
    }
    load();
  }, [user?.id, bulkSelected, growing, onBulkSelectionChange, onBulkModeChange, load]);

  const toggleBulkSelect = useCallback((id: string) => {
    setBulkSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  if (!user) return null;
  if (loading) return <div className="py-8 text-center text-black/50 text-sm">Loading Active Garden...</div>;
  if (loadError) {
    return (
      <div className="py-8 px-4 text-center">
        <p className="text-black/70 font-medium mb-2">Couldn&apos;t load Active Garden</p>
        <p className="text-sm text-black/50 mb-4">{loadError}</p>
        <button
          type="button"
          onClick={() => load()}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick toast */}
      {quickToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-fade-in">
          {quickToast}
        </div>
      )}

      {/* End Batch Modal */}
      {endBatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">End Batch</h2>
            <p className="text-sm text-neutral-600 mb-4">{formatBatchDisplayName(endBatchTarget.profile_name, endBatchTarget.profile_variety_name)}</p>
            <div className="space-y-3 mb-4">
              {[
                { value: "season_ended", label: "Season Ended" },
                { value: "harvested_all", label: "Harvested All" },
                { value: "plant_died", label: "Plant Died" },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="end-reason" value={opt.value} checked={endReason === opt.value} onChange={() => setEndReason(opt.value)} className="text-emerald-600 focus:ring-emerald-500" />
                  <span className={`text-sm font-medium ${opt.value === "plant_died" ? "text-red-600" : "text-neutral-700"}`}>{opt.label}</span>
                </label>
              ))}
            </div>
            <textarea
              placeholder="Optional note..."
              value={endNote}
              onChange={(e) => setEndNote(e.target.value)}
              rows={2}
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

      {/* BatchLogSheet */}
      <BatchLogSheet
        open={batchLogOpen}
        batches={batchLogBatches}
        onClose={() => { setBatchLogOpen(false); setBatchLogBatches([]); }}
        onSaved={() => { load(); }}
        onLogHarvest={(b) => { onLogHarvest(b as GrowingBatch); setBatchLogOpen(false); setBatchLogBatches([]); }}
        onEndBatch={(b) => { setEndBatchTarget(b as GrowingBatch); setBatchLogOpen(false); setBatchLogBatches([]); }}
        onDeleteBatch={(b) => { setDeleteBatchTarget(b as GrowingBatch); setBatchLogOpen(false); setBatchLogBatches([]); }}
        onQuickCare={(batch, action) => { handleQuickTap(batch as GrowingBatch, action); setBatchLogOpen(false); setBatchLogBatches([]); }}
        onBulkQuickCare={(batches, action) => { handleBulkQuickTap(action); setBatchLogOpen(false); setBatchLogBatches([]); }}
      />

      {/* Delete Batch Confirmation */}
      {deleteBatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Delete Batch</h2>
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

      {/* Bulk mode: Cancel is in parent Filter row (like Vault). Selecting + Delete when items selected. */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="flex items-center justify-end gap-3 flex-wrap mb-3">
          <span className="text-sm text-black/60">Selecting ({bulkSelected.size})</span>
          <button
            type="button"
            onClick={() => setBulkDeleteConfirmOpen(true)}
            className="min-w-[44px] min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
            aria-label="Delete selected plants"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Delete
          </button>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog" aria-labelledby="bulk-delete-title">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full p-6">
            <h2 id="bulk-delete-title" className="text-lg font-semibold text-black mb-2">Delete {bulkSelected.size} plant{bulkSelected.size !== 1 ? "s" : ""}?</h2>
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

      {/* Growing batches */}
      <section>
        {filteredBySearch.length === 0 && filteredPending.length === 0 ? (
          <div className="rounded-2xl bg-white border border-black/10 p-8 text-center max-w-md mx-auto" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            <div className="flex justify-center mb-4" aria-hidden>
              <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="text-emerald-300" aria-hidden>
                <rect x="6" y="36" width="52" height="22" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M10 36V26c0-2 2-4 4-4h36c2 0 4 2 4 4v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M18 50v-2M32 50v-2M46 50v-2" stroke="#78716c" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                <path d="M28 18c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
              </svg>
            </div>
            <p className="text-black/70 font-medium mb-2">Your garden is ready for its first seeds.</p>
            <p className="text-sm text-black/50 mb-6">You haven&apos;t planted anything yet.</p>
            <Link
              href="/vault"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm"
            >
              Go to Seed Vault
            </Link>
          </div>
        ) : highlightGrowId && displayBatches.length === 0 ? (
          <div className="rounded-2xl bg-white border border-black/10 p-8 text-center max-w-md mx-auto" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            <p className="text-black/70 font-medium mb-2">Planting not found</p>
            <p className="text-sm text-black/50 mb-6">This planting may have been archived.</p>
            <button
              type="button"
              onClick={onClearGrowView}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm"
            >
              Show all plantings
            </button>
          </div>
        ) : sortedBatches.length === 0 ? (
          <p className="text-black/50 text-sm py-4">No active batches. Plant from the Seed Vault to see them here.</p>
        ) : displayStyle === "grid" ? (
          <div className="grid grid-cols-3 gap-2">
            {sortedBatches.map((batch) => {
              const thumbUrl = getBatchImageUrl(batch);
              return (
                <div key={batch.id} ref={highlightGrowId === batch.id ? (highlightBatchRef as React.RefObject<HTMLDivElement>) : undefined} className={`rounded-lg bg-white overflow-hidden flex flex-col border border-black/5 shadow-card ${highlightGrowId === batch.id ? "ring-2 ring-emerald-500" : ""}`}>
                  <Link
                    href={`/vault/${batch.plant_profile_id}?tab=plantings&from=garden&gardenTab=active`}
                    className="flex flex-col flex-1 min-h-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset rounded-xl group"
                    onClick={(e) => {
                      if (bulkMode && canEditUser(batch.user_id ?? "")) {
                        e.preventDefault();
                        toggleBulkSelect(batch.id);
                      }
                      if (longPressFiredRef.current) {
                        e.preventDefault();
                        longPressFiredRef.current = false;
                      }
                    }}
                    onTouchStart={canEditUser(batch.user_id ?? "") ? () => {
                      longPressFiredRef.current = false;
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = setTimeout(() => {
                        longPressTimerRef.current = null;
                        longPressFiredRef.current = true;
                        setBulkMode(true);
                        setBulkSelected((prev) => new Set(prev).add(batch.id));
                        onBulkModeChange?.(true);
                      }, LONG_PRESS_MS);
                    } : undefined}
                    onTouchMove={canEditUser(batch.user_id ?? "") ? () => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    } : undefined}
                    onTouchEnd={canEditUser(batch.user_id ?? "") ? () => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    } : undefined}
                    onTouchCancel={canEditUser(batch.user_id ?? "") ? () => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    } : undefined}
                  >
                    <div className="px-1.5 pt-1.5 shrink-0">
                      <div className="relative w-full aspect-square bg-neutral-100 overflow-hidden rounded-md">
                        {thumbUrl ? (
                          <img src={thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-xl">🌱</div>
                        )}
                        {batch.planting_method_badge && (
                          <span className="absolute top-1 right-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-100/90 text-emerald-800">{batch.planting_method_badge}</span>
                        )}
                        {viewMode === "family" && batch.user_id && (
                          <span className="absolute top-0.5 right-0.5">
                            <OwnerBadge shorthand={getShorthandForUser(batch.user_id)} canEdit={canEditUser(batch.user_id)} size="xs" />
                          </span>
                        )}
                        {bulkMode && canEditUser(batch.user_id ?? "") && (
                          <div className="absolute bottom-1 left-1" onClick={(e) => e.stopPropagation()} role="presentation">
                            <input
                              type="checkbox"
                              checked={bulkSelected.has(batch.id)}
                              onChange={() => toggleBulkSelect(batch.id)}
                              className="w-4 h-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="px-1.5 pt-1 pb-0.5 flex flex-col flex-1 min-h-0 items-center text-center min-w-0">
                      <h3 className="font-semibold text-black text-xs leading-tight w-full min-h-[1.75rem] flex items-center justify-center truncate mb-0">{formatBatchDisplayName(batch.profile_name, batch.profile_variety_name)}</h3>
                      <p className="text-[10px] text-black/60 leading-tight line-clamp-2 w-full min-h-0">
                        Sown {new Date(batch.sown_date).toLocaleDateString()}
                        {batch.harvest_count > 0 && ` · ${batch.harvest_count} harvest`}
                      </p>
                    </div>
                  </Link>
                  {canEditUser(batch.user_id ?? "") && (
                    <div className="px-1.5 pb-1 pt-0 border-t border-black/5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBatchLogBatches([toBatchLogBatch(batch)]);
                          setBatchLogOpen(true);
                        }}
                        className="min-w-[44px] min-h-[36px] w-full flex items-center justify-center rounded-md border border-black/10 bg-white text-emerald-600 hover:bg-emerald/10"
                        aria-label="Log care or journal entry"
                      >
                        <CareHandsIcon />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <>
          <ul className="space-y-4">
            {sortedBatches.map((batch) => {
              const sown = new Date(batch.sown_date).getTime();
              const rawExpected = batch.expected_harvest_date
                ? new Date(batch.expected_harvest_date).getTime()
                : batch.harvest_days
                ? sown + batch.harvest_days * 86400000
                : null;
              const now = Date.now();
              const daysTotal = rawExpected ? Math.max(1, (rawExpected - sown) / 86400000) : null;
              const daysElapsed = (now - sown) / 86400000;
              const progress = daysTotal ? Math.min(1, Math.max(0, daysElapsed / daysTotal)) : null;
              const label = batch.expected_harvest_date
                ? `Harvest ~${new Date(batch.expected_harvest_date).toLocaleDateString()}`
                : rawExpected
                ? `Est. harvest ~${new Date(rawExpected).toLocaleDateString()}`
                : "No maturity set";
              const thumbUrl = getBatchImageUrl(batch);

              return (
                <li
                  key={batch.id}
                  ref={highlightGrowId === batch.id ? (highlightBatchRef as React.RefObject<HTMLLIElement>) : undefined}
                  className={`rounded-xl border border-emerald-200/80 bg-white p-4 shadow-sm ${highlightGrowId === batch.id ? "ring-2 ring-emerald-500 ring-offset-2" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Bulk checkbox — only for editable batches */}
                    {bulkMode && canEditUser(batch.user_id ?? "") && (
                      <input
                        type="checkbox"
                        checked={bulkSelected.has(batch.id)}
                        onChange={() => toggleBulkSelect(batch.id)}
                        className="mt-1 w-5 h-5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                      />
                    )}
                    {/* Plant profile thumbnail (Law 7 hierarchy) */}
                    <div className="shrink-0 w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-100 overflow-hidden flex items-center justify-center">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl" aria-hidden>🌱</span>
                      )}
                    </div>
                    <Link
                      href={`/vault/${batch.plant_profile_id}?tab=plantings&from=garden&gardenTab=active`}
                      className="min-w-0 flex-1 block focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset rounded-lg -m-1 p-1 group hover:bg-emerald-50/50 transition-colors"
                      aria-label={`View plant: ${formatBatchDisplayName(batch.profile_name, batch.profile_variety_name)}`}
                      onClick={(e) => {
                        if (bulkMode && canEditUser(batch.user_id ?? "")) {
                          e.preventDefault();
                          toggleBulkSelect(batch.id);
                        }
                        if (longPressFiredRef.current) {
                          e.preventDefault();
                          longPressFiredRef.current = false;
                        }
                      }}
                      onTouchStart={canEditUser(batch.user_id ?? "") ? () => {
                        longPressFiredRef.current = false;
                        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = setTimeout(() => {
                          longPressTimerRef.current = null;
                          longPressFiredRef.current = true;
                          setBulkMode(true);
                          setBulkSelected((prev) => new Set(prev).add(batch.id));
                          onBulkModeChange?.(true);
                        }, LONG_PRESS_MS);
                      } : undefined}
                      onTouchMove={canEditUser(batch.user_id ?? "") ? () => {
                        if (longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                      } : undefined}
                      onTouchEnd={canEditUser(batch.user_id ?? "") ? () => {
                        if (longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                      } : undefined}
                      onTouchCancel={canEditUser(batch.user_id ?? "") ? () => {
                        if (longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                      } : undefined}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-black/90 group-hover:text-emerald-700">
                          {formatBatchDisplayName(batch.profile_name, batch.profile_variety_name)}
                        </span>
                        {batch.planting_method_badge && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{batch.planting_method_badge}</span>}
                        {viewMode === "family" && batch.user_id && (
                          <OwnerBadge shorthand={getShorthandForUser(batch.user_id)} canEdit={canEditUser(batch.user_id)} size="xs" />
                        )}
                        {batch.location && <span className="text-xs text-neutral-500">{batch.location}</span>}
                      </div>
                      <p className="text-xs text-black/50 mt-0.5">
                        Sown {new Date(batch.sown_date).toLocaleDateString()} – {label}
                        {batch.seeds_sown != null && <span className="ml-1"> · {batch.seeds_sown} sown</span>}
                        {batch.seeds_sprouted != null && batch.seeds_sown != null && <span className="ml-1"> · {batch.seeds_sprouted} of {batch.seeds_sown} sprouted</span>}
                        {batch.seeds_sprouted != null && batch.seeds_sown == null && <span className="ml-1"> · {batch.seeds_sprouted} sprouted</span>}
                        {batch.plant_count != null && <span className="ml-1 font-medium text-emerald-600"> · {batch.plant_count} plants</span>}
                        {batch.harvest_count > 0 && <span className="ml-1 text-emerald-600 font-medium"> · Harvested {batch.harvest_count}x</span>}
                      </p>
                      {progress != null && (
                        <div className="mt-2 h-2 rounded-full bg-black/10 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress * 100}%` }} />
                        </div>
                      )}
                    </Link>
                    {canEditUser(batch.user_id ?? "") && (
                      <div className="relative flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setBatchLogBatches([toBatchLogBatch(batch)]);
                            setBatchLogOpen(true);
                          }}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 bg-white text-emerald-600 hover:bg-emerald/10"
                          aria-label="Log care or journal entry"
                        >
                          <CareHandsIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </section>
    </div>
  );
});

/** Hands/care icon: cupped hands with heart and sprout — for logging care journal entries. */
function CareHandsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* Cupped hands (left and right) */}
      <path d="M5 19c0-3 2-6 5-7 1.5-.5 3 0 4 1" />
      <path d="M19 19c0-3-2-6-5-7-1.5-.5-3 0-4 1" />
      {/* Heart */}
      <path d="M12 8.5C10.5 7 8 7.5 8 9.5c0 2 4 4 4 4s4-2 4-4c0-2-2.5-2.5-4-1z" />
      {/* Small sprout/leaf from heart */}
      <path d="M13 11v1.5c0 .8.6 1.5 1.2 1.5" />
    </svg>
  );
}
function PencilIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>; }
function BasketIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l-1.5 10H6.5L5 8z" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M4 10h16" /></svg>; }
function ArchiveIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" /></svg>; }
function TrashIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>; }
