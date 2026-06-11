"use client";

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { revertProfileStatusIfNoActiveGrows } from "@/lib/revertProfileStatus";
import { insertWithOfflineQueue, insertManyWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { OwnerBadge } from "@/components/OwnerBadge";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";
import { BatchLogSheet, type BatchLogBatch } from "@/components/BatchLogSheet";
import { PlantPlaceholderIcon } from "@/components/PlantPlaceholderIcon";
import { ICON_MAP } from "@/lib/styleDictionary";
import { NoMatchCard } from "@/components/NoMatchCard";
import { ListSkeleton } from "@/components/VaultSkeleton";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { fetchAllUserGrowInstances, setInstanceGroup } from "@/lib/groups";
import { useSwipeOrderSnapshot } from "@/lib/swipeOrder";
import type { WeatherSnapshotData, Group } from "@/types/garden";
import type { SelectedGroup } from "@/components/GroupTabs";

const LONG_PRESS_MS = 500;

/** Law 7: hero_image_url → hero_image_path → primary_image_path → placeholder fallback */
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

/**
 * Unified Garden batch — one grow_instance + its enrichment + groups.
 * Replaces the prior dual GrowingBatch (Active Garden) + PermanentPlanting (My Plants) types.
 *
 * is_permanent_planting drives render branches: Perennial pill + planted-ago format for perennials;
 * planting method badge + harvest progress for annuals.
 */
type GardenBatch = {
  id: string;
  plant_profile_id: string;
  sown_date: string;
  expected_harvest_date: string | null;
  status: string | null;
  is_permanent_planting: boolean;
  profile_name: string;
  profile_variety_name: string | null;
  weather_snapshot: WeatherSnapshotData;
  harvest_count: number;
  care_count: number;
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
  groups: Group[];
};

export type GardenViewHandle = {
  exitBulkMode: () => void;
  enterBulkMode: () => void;
  openBulkDeleteConfirm: () => void;
  openBulkEndBatchConfirm: () => void;
  /** Door 3 — batch-assign all selected plants to one group (or null to unassign). Throws on partial failure. */
  assignSelectedToGroup: (next: { id: string; name: string } | null) => Promise<void>;
};

export const GardenView = forwardRef<GardenViewHandle, {
  refetchTrigger: number;
  /** When set, scroll to this grow instance and clear the URL param. Used when navigating from plant profile. */
  highlightGrowId?: string | null;
  searchQuery?: string;
  /** "all" or a group UUID — client-side filter via instance.groups[] membership. */
  groupFilter: SelectedGroup;
  onLogHarvest: (batch: GardenBatch) => void;
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
  /** Called when user taps "Clear filters" in no-match state. */
  onClearFilters?: () => void;
  /** When true, enter bulk journal mode (e.g. from FAB "Add journal entry"). */
  openBulkJournalRequest?: boolean;
  onBulkJournalRequestHandled?: () => void;
  onBulkSelectionChange?: (count: number) => void;
  /** When true, open BatchLogSheet for selected batches (from FAB >> menu → Journal). */
  openBulkLogRequest?: boolean;
  onBulkLogRequestHandled?: () => void;
  /** Called when bulk mode changes (true = in bulk mode, false = exited). */
  onBulkModeChange?: (inBulkMode: boolean) => void;
  /** "grid" = small badges, "list" = detailed rows. */
  displayStyle?: "grid" | "list";
  sortBy?: "name" | "sown_date" | "harvest_date";
  sortDir?: "asc" | "desc";
  /** Called on success (e.g. batch ended, task completed). */
  onSaveMessage?: (msg: string) => void;
}>(({
  refetchTrigger,
  highlightGrowId = null,
  searchQuery = "",
  groupFilter,
  onLogHarvest,
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
  onClearFilters,
  openBulkJournalRequest = false,
  onBulkJournalRequestHandled,
  onBulkSelectionChange,
  openBulkLogRequest = false,
  onBulkLogRequestHandled,
  onBulkModeChange,
  displayStyle = "grid",
  sortBy = "sown_date",
  sortDir = "desc",
  onSaveMessage,
}, ref) => {
  const { user } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser, canEditPage } = useHousehold();
  const highlightBatchRef = useRef<HTMLElement | null>(null);
  const [batches, setBatches] = useState<GardenBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bulk select state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  // Hero URLs that failed to load (404 / hotlink-blocked external AI hero). Fall
  // back to the clean placeholder instead of the browser's broken-image icon.
  // Mirrors the profile-page gallery onError pattern (vault/[id]/page.tsx).
  const [failedThumbUrls, setFailedThumbUrls] = useState<Set<string>>(new Set());

  // Quick-tap toast
  const [quickToast, setQuickToast] = useState<string | null>(null);

  // End batch modal
  const [endBatchTarget, setEndBatchTarget] = useState<GardenBatch | null>(null);
  const [endReason, setEndReason] = useState<string>("season_ended");
  const [endNote, setEndNote] = useState("");
  const [endSaving, setEndSaving] = useState(false);

  // Delete batch confirmation
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<GardenBatch | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Bulk delete confirmation
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);
  // Bulk end batch confirmation
  const [bulkEndBatchConfirmOpen, setBulkEndBatchConfirmOpen] = useState(false);
  const [bulkEndBatchSaving, setBulkEndBatchSaving] = useState(false);

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

  const enterBulkMode = useCallback(() => {
    setBulkMode(true);
    setBulkSelected(new Set());
    onBulkSelectionChange?.(0);
    onBulkModeChange?.(true);
  }, [onBulkSelectionChange, onBulkModeChange]);

  const openBulkDeleteConfirm = useCallback(() => setBulkDeleteConfirmOpen(true), []);
  const openBulkEndBatchConfirm = useCallback(() => setBulkEndBatchConfirmOpen(true), []);

  const formatBatchDisplayName = (name: string, variety: string | null) => (variety?.trim() ? `${name} (${variety})` : name);

  const toBatchLogBatch = (b: GardenBatch): BatchLogBatch => ({
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

  // Scroll to highlighted batch when navigating from plant profile (e.g. /garden?grow=xxx)
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
    const isFamilyView = householdViewMode === "family";

    try {
      // 1. Fetch all grow_instances with groups joined (B1 helper for per-user; custom query for family).
      let rawGrows: Array<{
        id: string;
        plant_profile_id: string;
        sown_date: string;
        expected_harvest_date: string | null;
        status: string | null;
        location?: string | null;
        user_id?: string | null;
        sow_method?: "direct_sow" | "seed_start" | null;
        seeds_sown?: number | null;
        seeds_sprouted?: number | null;
        plant_count?: number | null;
        is_permanent_planting?: boolean | null;
        groups?: Group[];
      }> = [];
      if (isFamilyView) {
        const { data, error } = await supabase
          .from("grow_instances")
          .select("id, plant_profile_id, sown_date, expected_harvest_date, status, location, user_id, sow_method, seeds_sown, seeds_sprouted, plant_count, is_permanent_planting, plant_groups(groups(id, user_id, name, position, created_at, updated_at, deleted_at))")
          .is("deleted_at", null)
          .order("sown_date", { ascending: false });
        if (error) {
          setLoadError(error.message);
          return;
        }
        type RawWithJoin = {
          id: string;
          plant_profile_id: string;
          sown_date: string;
          expected_harvest_date: string | null;
          status: string | null;
          location?: string | null;
          user_id?: string | null;
          sow_method?: "direct_sow" | "seed_start" | null;
          seeds_sown?: number | null;
          seeds_sprouted?: number | null;
          plant_count?: number | null;
          is_permanent_planting?: boolean | null;
          plant_groups?: Array<{ groups: Group | null }> | null;
        };
        rawGrows = ((data ?? []) as unknown as RawWithJoin[]).map((row) => {
          const { plant_groups, ...rest } = row;
          const groups = (plant_groups ?? [])
            .map((pg) => pg.groups)
            .filter((g): g is Group => g !== null && g.deleted_at == null);
          return { ...rest, groups };
        });
      } else {
        const instances = await fetchAllUserGrowInstances(supabase, user.id);
        rawGrows = instances.map((i) => ({
          id: i.id,
          plant_profile_id: i.plant_profile_id ?? "",
          sown_date: i.sown_date,
          expected_harvest_date: i.expected_harvest_date,
          status: i.status ?? null,
          location: i.location ?? null,
          user_id: i.user_id ?? null,
          sow_method: i.sow_method ?? null,
          seeds_sown: i.seeds_sown ?? null,
          seeds_sprouted: i.seeds_sprouted ?? null,
          plant_count: i.plant_count ?? null,
          is_permanent_planting: i.is_permanent_planting ?? false,
          groups: i.groups ?? [],
        }));
      }

      // Carry-forward filter: only show currently-growing instances (status='growing' OR null/unknown).
      // Archived/dead instances live in Settings → Archived Plantings, not on Garden tab.
      const activeGrows = rawGrows.filter((r) => r.status === "growing" || r.status == null);

      if (activeGrows.length === 0) {
        setBatches([]);
        return;
      }

      // 2. plant_profiles for display + filter chips.
      const profileIds = Array.from(new Set(activeGrows.map((r) => r.plant_profile_id).filter(Boolean)));
      const { data: profiles } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name, sun, plant_spacing, days_to_germination, harvest_days, tags, hero_image_url, hero_image_path, primary_image_path")
        .in("id", profileIds);
      type ProfileShape = { id: string; name: string; variety_name: string | null; sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null; tags?: string[] | null; hero_image_url?: string | null; hero_image_path?: string | null; primary_image_path?: string | null };
      const profileMap = new Map<string, ProfileShape>((profiles ?? []).map((p: ProfileShape) => [p.id, p]));

      // 3. Parallel enrichment: weather snapshots + harvest counts + care counts.
      const growIds = activeGrows.map((r) => r.id);
      const [weatherRes, harvestRes, careRes] = await Promise.all([
        supabase.from("journal_entries").select("grow_instance_id, weather_snapshot, note").in("grow_instance_id", growIds).like("note", "Planted%").order("created_at", { ascending: true }),
        supabase.from("journal_entries").select("grow_instance_id").in("grow_instance_id", growIds).eq("entry_type", "harvest").is("deleted_at", null),
        supabase.from("care_schedules").select("grow_instance_id").in("grow_instance_id", growIds).eq("is_active", true),
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
      const careCountByGrow = new Map<string, number>();
      (careRes.data ?? []).forEach((c: { grow_instance_id: string | null }) => {
        if (c.grow_instance_id) careCountByGrow.set(c.grow_instance_id, (careCountByGrow.get(c.grow_instance_id) ?? 0) + 1);
      });

      // 4. Compose enriched batches.
      const enriched: GardenBatch[] = activeGrows
        .filter((r) => !!profileMap.get(r.plant_profile_id))
        .map((r) => {
          const p = profileMap.get(r.plant_profile_id);
          const note = plantingNoteByGrow.get(r.id);
          const sowBadge = r.sow_method === "direct_sow" ? "Direct sow" : r.sow_method === "seed_start" ? "Seed start" : badgeFromNote(note);
          return {
            id: r.id,
            plant_profile_id: r.plant_profile_id,
            sown_date: r.sown_date,
            expected_harvest_date: r.expected_harvest_date,
            status: r.status,
            is_permanent_planting: r.is_permanent_planting === true,
            profile_name: p?.name ?? "Unknown",
            profile_variety_name: p?.variety_name ?? null,
            weather_snapshot: weatherByGrow.get(r.id) ?? null,
            harvest_count: harvestCountByGrow.get(r.id) ?? 0,
            care_count: careCountByGrow.get(r.id) ?? 0,
            planting_method_badge: sowBadge,
            location: r.location,
            sun: p?.sun ?? null,
            plant_spacing: p?.plant_spacing ?? null,
            days_to_germination: p?.days_to_germination ?? null,
            harvest_days: p?.harvest_days ?? null,
            tags: p?.tags ?? null,
            user_id: r.user_id ?? null,
            sow_method: r.sow_method ?? null,
            seeds_sown: r.seeds_sown ?? null,
            seeds_sprouted: r.seeds_sprouted ?? null,
            plant_count: r.plant_count ?? null,
            hero_image_url: p?.hero_image_url ?? null,
            hero_image_path: p?.hero_image_path ?? null,
            primary_image_path: p?.primary_image_path ?? null,
            groups: r.groups ?? [],
          };
        });
      setBatches(enriched);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user?.id, householdViewMode]);

  useEffect(() => { load(); }, [load, refetchTrigger]);

  // Escape hatch: if loading for >10s, surface error so user can recover
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setLoadError("Loading is taking longer than expected");
      setLoading(false);
    }, 10000);
    return () => clearTimeout(t);
  }, [loading]);

  const maturityRange = (days: number | null | undefined): string => {
    if (days == null || !Number.isFinite(days)) return "";
    if (days < 60) return "<60";
    if (days <= 90) return "60-90";
    return "90+";
  };

  const categoryChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of batches) {
      const first = (b.profile_name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
      map.set(first, (map.get(first) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type, undefined, { sensitivity: "base" }));
  }, [batches]);

  const refineChips = useMemo(() => {
    const varietyMap = new Map<string, number>();
    const sunMap = new Map<string, number>();
    const spacingMap = new Map<string, number>();
    const germinationMap = new Map<string, number>();
    const maturityMap = new Map<string, number>();
    const tagSet = new Set<string>();
    for (const b of batches) {
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
  }, [batches]);

  const filteredByGroup = useMemo(() => {
    if (groupFilter === "all") return batches;
    return batches.filter((b) => b.groups.some((g) => g.id === groupFilter));
  }, [batches, groupFilter]);

  const filteredByRefine = useMemo(() => {
    return filteredByGroup.filter((b) => {
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
  }, [filteredByGroup, categoryFilter, varietyFilter, sunFilter, spacingFilter, germinationFilter, maturityFilter, tagFilters]);

  const q = (searchQuery ?? "").trim().toLowerCase();
  const filteredBySearch = useMemo(() => {
    if (!q) return filteredByRefine;
    return filteredByRefine.filter((b) => {
      const name = (b.profile_name ?? "").toLowerCase();
      const variety = (b.profile_variety_name ?? "").toLowerCase();
      return name.includes(q) || variety.includes(q);
    });
  }, [filteredByRefine, q]);

  /** When highlightGrowId is set, filter to only that batch so user sees applied filter and can cancel to full view. */
  const displayBatches = useMemo(() => {
    if (!highlightGrowId) return filteredBySearch;
    const match = filteredBySearch.find((b) => b.id === highlightGrowId);
    if (match) return [match];
    const fromAll = batches.find((b) => b.id === highlightGrowId);
    return fromAll ? [fromAll] : [];
  }, [highlightGrowId, filteredBySearch, batches]);

  // Report highlighted batch for "Viewing" chip when highlightGrowId matches; only call when loading done
  useEffect(() => {
    if (!onHighlightedBatch || loading) return;
    if (!highlightGrowId) {
      onHighlightedBatch(null);
      return;
    }
    const batch = displayBatches[0] ?? batches.find((b) => b.id === highlightGrowId);
    if (batch) {
      onHighlightedBatch({
        id: batch.id,
        profile_name: batch.profile_name,
        profile_variety_name: batch.profile_variety_name,
      });
    } else {
      onHighlightedBatch(null);
    }
  }, [highlightGrowId, loading, displayBatches, batches, onHighlightedBatch]);

  const sortedBatches = useMemo(() => {
    const list = [...displayBatches];
    const cmp = (a: GardenBatch, b: GardenBatch): number => {
      switch (sortBy) {
        case "name": {
          const na = (a.profile_name ?? "").trim().toLowerCase();
          const nb = (b.profile_name ?? "").trim().toLowerCase();
          const va = (a.profile_variety_name ?? "").trim().toLowerCase();
          const vb = (b.profile_variety_name ?? "").trim().toLowerCase();
          return `${na} ${va}`.localeCompare(`${nb} ${vb}`, undefined, { sensitivity: "base" });
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

  // Carry the filtered+sorted Garden order to the instance detail page so swipe / prev-next
  // traverses exactly what the user was browsing (NORTH_STAR "Take mental load OFF the user").
  const sortedBatchIds = useMemo(() => sortedBatches.map((b) => b.id), [sortedBatches]);
  useSwipeOrderSnapshot("instances", sortedBatchIds);

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
    if (!loading) onEmptyStateChange?.(filteredBySearch.length === 0);
  }, [loading, filteredBySearch.length, onEmptyStateChange]);

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
      const selected = batches.filter((b) => bulkSelected.has(b.id));
      setBatchLogBatches(selected.map(toBatchLogBatch));
      setBatchLogOpen(true);
      onBulkLogRequestHandled?.();
    }
  }, [openBulkLogRequest, bulkSelected, batches, onBulkLogRequestHandled]);

  // Quick-tap handler
  const handleQuickTap = useCallback(async (batch: GardenBatch, action: "water" | "fertilize" | "spray") => {
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

  // Bulk quick actions (water / fertilize / spray on all selected)
  const handleBulkQuickTap = useCallback(async (action: "water" | "fertilize" | "spray") => {
    if (!user?.id || bulkSelected.size === 0) return;
    try {
      const weather = await fetchWeatherSnapshot();
      const notes: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };
      const entries = Array.from(bulkSelected).map((growId) => {
        const batch = batches.find((b) => b.id === growId);
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
    }
  }, [user?.id, bulkSelected, batches, onBulkSelectionChange, onBulkModeChange]);

  // End batch with reason
  const handleEndBatch = useCallback(async () => {
    if (!user?.id || !endBatchTarget) return;
    setEndSaving(true);
    const batchId = endBatchTarget.id;
    const now = new Date().toISOString();
    const isDead = endReason === "plant_died";
    // Terminal status is always 'archived' (2-state enum, collapsed 2026-05-28 — 'dead' is no longer
    // valid and was rejected by grow_instances_status_check, leaving the planting stuck at 'growing').
    // The death is preserved via end_reason + the "death" journal entry below.
    const status = "archived";
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
        note: endNote.trim() || (isDead ? "Plant died" : "Planting ended"),
        entry_type: isDead ? "death" : "note",
        weather_snapshot: weather ?? undefined,
      });
    }

    await revertProfileStatusIfNoActiveGrows(supabase, endBatchTarget.plant_profile_id);

    setEndSaving(false);
    setEndBatchTarget(null);
    setEndReason("season_ended");
    setEndNote("");
    setBatches((prev) => prev.filter((b) => b.id !== batchId));
  }, [user?.id, endBatchTarget, endReason, endNote]);

  const handleDeleteBatch = useCallback(async () => {
    if (!user?.id || !deleteBatchTarget) return;
    setDeleteSaving(true);
    const batchId = deleteBatchTarget.id;
    const now = new Date().toISOString();
    const batchUserId = deleteBatchTarget.user_id ?? user.id;
    const { error } = await updateWithOfflineQueue("grow_instances", { deleted_at: now }, { id: batchId, user_id: batchUserId });
    if (!error) await softDeleteTasksForGrowInstance(batchId, batchUserId);
    if (!error) await revertProfileStatusIfNoActiveGrows(supabase, deleteBatchTarget.plant_profile_id);
    setDeleteSaving(false);
    setDeleteBatchTarget(null);
    if (error) {
      setQuickToast(error.message);
      setTimeout(() => setQuickToast(null), 3000);
      return;
    }
    setBatches((prev) => prev.filter((b) => b.id !== batchId));
  }, [user?.id, deleteBatchTarget]);

  const handleBulkDelete = useCallback(async () => {
    if (!user?.id || bulkSelected.size === 0) return;
    setBulkDeleteSaving(true);
    const selectedBatches = batches.filter((b) => bulkSelected.has(b.id));
    const profileIds = [...new Set(selectedBatches.map((b) => b.plant_profile_id).filter(Boolean))] as string[];
    const now = new Date().toISOString();
    let hadError = false;
    for (const batch of selectedBatches) {
      const batchUserId = batch.user_id ?? user.id;
      await updateWithOfflineQueue("journal_entries", { deleted_at: now }, { grow_instance_id: batch.id, user_id: batchUserId });
      await softDeleteTasksForGrowInstance(batch.id, batchUserId);
      const { error } = await updateWithOfflineQueue("grow_instances", { deleted_at: now }, { id: batch.id, user_id: batchUserId });
      if (error) hadError = true;
    }
    if (!hadError) {
      for (const profileId of profileIds) {
        await revertProfileStatusIfNoActiveGrows(supabase, profileId);
      }
    }
    setBulkDeleteSaving(false);
    setBulkDeleteConfirmOpen(false);
    setBulkSelected(new Set());
    setBulkMode(false);
    onBulkSelectionChange?.(0);
    onBulkModeChange?.(false);
    if (hadError) {
      setQuickToast("Couldn't delete some plantings — please refresh and try again");
      setTimeout(() => setQuickToast(null), 3000);
    } else {
      const msg = `Deleted ${selectedBatches.length} plant${selectedBatches.length !== 1 ? "s" : ""}`;
      if (onSaveMessage) onSaveMessage(msg);
      else { setQuickToast(msg); setTimeout(() => setQuickToast(null), 2000); }
    }
    load();
  }, [user?.id, bulkSelected, batches, onBulkSelectionChange, onBulkModeChange, load, onSaveMessage]);

  const handleBulkEndBatch = useCallback(async () => {
    if (!user?.id || bulkSelected.size === 0) return;
    setBulkEndBatchSaving(true);
    const selectedBatches = batches.filter((b) => bulkSelected.has(b.id));
    const now = new Date().toISOString();
    const profileIds = [...new Set(selectedBatches.map((b) => b.plant_profile_id).filter(Boolean))] as string[];
    let hadError = false;
    for (const batch of selectedBatches) {
      const batchUserId = batch.user_id ?? user.id;
      const { data, error } = await supabase
        .from("grow_instances")
        .update({ status: "archived", ended_at: now })
        .eq("id", batch.id)
        .eq("user_id", batchUserId)
        .select("id");
      if (error || !data || data.length === 0) {
        console.error("GardenView.handleBulkEndBatch: update failed", { batchId: batch.id, error });
        hadError = true;
        continue;
      }
      await softDeleteTasksForGrowInstance(batch.id, batchUserId);
    }
    if (!hadError) {
      for (const profileId of profileIds) {
        await revertProfileStatusIfNoActiveGrows(supabase, profileId);
      }
    }
    setBulkEndBatchSaving(false);
    setBulkEndBatchConfirmOpen(false);
    setBulkSelected(new Set());
    setBulkMode(false);
    onBulkSelectionChange?.(0);
    onBulkModeChange?.(false);
    if (hadError) {
      setQuickToast("Couldn't end some plantings — please refresh and try again");
      setTimeout(() => setQuickToast(null), 3000);
    } else {
      const msg = `Ended ${selectedBatches.length} planting${selectedBatches.length !== 1 ? "s" : ""}`;
      if (onSaveMessage) onSaveMessage(msg);
      else { setQuickToast(msg); setTimeout(() => setQuickToast(null), 2000); }
    }
    load();
  }, [user?.id, bulkSelected, batches, onBulkSelectionChange, onBulkModeChange, load, onSaveMessage]);

  // Door 3 — batch "Move to group". Single-membership: setInstanceGroup clears
  // any prior membership + auto-journals Added/Moved/Removed per plant. priorGroups
  // come from the loaded batch (avoids a per-plant fetch). Throws on partial
  // failure so the page can surface a toast; selection is cleared either way.
  const assignSelectedToGroup = useCallback(async (next: { id: string; name: string } | null) => {
    if (!user?.id || bulkSelected.size === 0) return;
    const selectedBatches = batches.filter((b) => bulkSelected.has(b.id));
    let hadError = false;
    for (const batch of selectedBatches) {
      const batchUserId = batch.user_id ?? user.id;
      try {
        await setInstanceGroup(supabase, {
          growInstanceId: batch.id,
          userId: batchUserId,
          plantProfileId: batch.plant_profile_id ?? null,
          nextGroup: next,
          priorGroups: batch.groups,
        });
      } catch {
        hadError = true;
      }
    }
    setBulkSelected(new Set());
    setBulkMode(false);
    onBulkSelectionChange?.(0);
    onBulkModeChange?.(false);
    load();
    if (hadError) throw new Error("group-assign-partial-failure");
  }, [user?.id, bulkSelected, batches, onBulkSelectionChange, onBulkModeChange, load]);

  useImperativeHandle(ref, () => ({
    exitBulkMode,
    enterBulkMode,
    openBulkDeleteConfirm,
    openBulkEndBatchConfirm,
    assignSelectedToGroup,
  }), [exitBulkMode, enterBulkMode, openBulkDeleteConfirm, openBulkEndBatchConfirm, assignSelectedToGroup]);

  const toggleBulkSelect = useCallback((id: string) => {
    setBulkSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  if (!user) return null;
  if (loading) {
    return (
      <div className="py-8 px-4">
        <ListSkeleton />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="py-8 px-4 text-center space-y-4">
        <p className="text-black/70 font-medium mb-2">Couldn&apos;t load Garden</p>
        <p className="text-sm text-black/50">{loadError}</p>
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
        onSaved={() => { load(); onSaveMessage?.("Saved"); }}
        onLogHarvest={(b) => { onLogHarvest(b as GardenBatch); setBatchLogOpen(false); setBatchLogBatches([]); }}
        onQuickCare={(batch, action) => { handleQuickTap(batch as GardenBatch, action); setBatchLogOpen(false); setBatchLogBatches([]); }}
        onBulkQuickCare={(_batches, action) => { handleBulkQuickTap(action); setBatchLogOpen(false); setBatchLogBatches([]); }}
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

      {bulkMode && bulkSelected.size > 0 && (
        <div className="flex items-center justify-end gap-3 flex-wrap mb-3">
          <span className="text-sm text-black/60">Selecting ({bulkSelected.size})</span>
        </div>
      )}

      {/* Bulk end batch confirmation */}
      {bulkEndBatchConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog" aria-labelledby="bulk-end-batch-title">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full p-6">
            <h2 id="bulk-end-batch-title" className="text-lg font-semibold text-black mb-2">End {bulkSelected.size} Planting{bulkSelected.size !== 1 ? "s" : ""}?</h2>
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
                {bulkEndBatchSaving ? "Ending…" : "End Batch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog" aria-labelledby="bulk-delete-title">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full p-6">
            <h2 id="bulk-delete-title" className="text-lg font-semibold text-black mb-2">Delete {bulkSelected.size} Plant{bulkSelected.size !== 1 ? "s" : ""}?</h2>
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

      {/* Empty / no-match / planting-not-found / batches */}
      <section>
        {batches.length === 0 ? (
          // True empty state — 3-part frame per ROADMAP §6 9bad88f canonical
          // (sentence-case title + period, matching SeedVaultView/ShedView peers).
          // VISION §8 em-dash convention is for missing-data CELL display, not title decoration.
          <div className="rounded-2xl bg-white border border-black/10 p-8 text-center max-w-md mx-auto" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            <p className="text-black/70 font-medium mb-2">Your garden is empty.</p>
            <p className="text-sm text-black/50 mb-6">Add a plant or set up a group to organize your garden.</p>
            <Link
              href="/vault"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Add a Plant
            </Link>
          </div>
        ) : highlightGrowId && displayBatches.length === 0 ? (
          <div className="rounded-2xl bg-white border border-black/10 p-8 text-center max-w-md mx-auto" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
            <p className="text-black/70 font-medium mb-2">Planting not found</p>
            <p className="text-sm text-black/50 mb-6">This planting may have been archived.</p>
            <button
              type="button"
              onClick={onClearGrowView}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Show All Plantings
            </button>
          </div>
        ) : sortedBatches.length === 0 ? (
          groupFilter !== "all" && filteredBySearch.length === 0 && !categoryFilter && !varietyFilter && !sunFilter && !spacingFilter && !germinationFilter && !maturityFilter && tagFilters.length === 0 && !q ? (
            // Empty group state — 3-part frame per ROADMAP §6 9bad88f canonical
            // (sentence-case title + period, matching SeedVaultView/ShedView peers).
            <div className="rounded-2xl bg-white border border-black/10 p-8 text-center max-w-md mx-auto" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
              <p className="text-black/70 font-medium mb-2">No plants in this group yet.</p>
              <p className="text-sm text-black/50 mb-6">Add a plant or move existing plants here from Manage Groups.</p>
              <Link
                href="/vault"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Add a Plant
              </Link>
            </div>
          ) : (
            <NoMatchCard
              message="No plantings match your search or filters."
              actionLabel={onClearFilters ? "Clear filters" : undefined}
              onAction={onClearFilters}
            />
          )
        ) : displayStyle === "grid" ? (
          <div className="grid grid-cols-3 gap-2">
            {sortedBatches.map((batch) => {
              const rawThumbUrl = getBatchImageUrl(batch);
              const thumbUrl = rawThumbUrl && !failedThumbUrls.has(rawThumbUrl) ? rawThumbUrl : null;
              const isPerennial = batch.is_permanent_planting === true;
              return (
                <div key={batch.id} ref={highlightGrowId === batch.id ? (highlightBatchRef as React.RefObject<HTMLDivElement>) : undefined} className={`rounded-lg bg-white overflow-hidden flex flex-col border shadow-card transition-all card-interactive ${highlightGrowId === batch.id ? "ring-2 ring-emerald-500 border-emerald-500" : bulkMode && bulkSelected.has(batch.id) ? "ring-2 ring-emerald-500 border-2 border-emerald-500" : "border-black/5"}`}>
                  <Link
                    href={`/garden/grow/${batch.id}`}
                    className="flex flex-col flex-1 min-h-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset rounded-xl group"
                    onClick={(e) => {
                      if (bulkMode && canEditPage(batch.user_id ?? "", "garden")) {
                        e.preventDefault();
                        toggleBulkSelect(batch.id);
                      }
                      if (longPressFiredRef.current) {
                        e.preventDefault();
                        longPressFiredRef.current = false;
                      }
                    }}
                    onTouchStart={canEditPage(batch.user_id ?? "", "garden") ? () => {
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
                    onTouchMove={canEditPage(batch.user_id ?? "", "garden") ? () => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    } : undefined}
                    onTouchEnd={canEditPage(batch.user_id ?? "", "garden") ? () => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    } : undefined}
                    onTouchCancel={canEditPage(batch.user_id ?? "", "garden") ? () => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    } : undefined}
                  >
                    <div className="px-1.5 pt-1.5 shrink-0">
                      <div className="relative w-full aspect-square bg-neutral-100 overflow-hidden rounded-xl">
                        {thumbUrl ? (
                          <img src={thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform" onError={() => setFailedThumbUrls((prev) => new Set(prev).add(thumbUrl))} />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-neutral-100"><PlantPlaceholderIcon size="md" /></div>
                        )}
                        {!isPerennial && batch.planting_method_badge ? (
                          <span className="absolute top-1 right-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-100/90 text-emerald-800">{batch.planting_method_badge}</span>
                        ) : null}
                        {householdViewMode === "family" && batch.user_id && batch.user_id !== user?.id && (
                          <span className="absolute top-0.5 left-0.5 z-10">
                            <OwnerBadge shorthand={getShorthandForUser(batch.user_id)} canEdit={canEditPage(batch.user_id ?? "", "garden")} size="xs" />
                          </span>
                        )}
                        {bulkMode && canEditPage(batch.user_id ?? "", "garden") && (
                          <span className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full border-2 border-black/20 flex items-center justify-center bg-white" aria-hidden>
                            {bulkSelected.has(batch.id) ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                            ) : null}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-1.5 pt-1 pb-0.5 flex flex-col flex-1 min-h-0 items-center text-center min-w-0">
                      <h3 className="font-semibold text-black text-xs leading-tight w-full min-h-[1.75rem] flex flex-col items-center text-center mb-0" title={`${decodeHtmlEntities(batch.profile_name)}${batch.profile_variety_name?.trim() ? ` (${decodeHtmlEntities(batch.profile_variety_name)})` : ""}`}>
                        <span className="block line-clamp-2 break-words text-center">
                          {decodeHtmlEntities(batch.profile_name)}
                        </span>
                        {batch.profile_variety_name?.trim() && (
                          <span className="block w-full font-normal italic text-black/60 truncate text-center">
                            {decodeHtmlEntities(batch.profile_variety_name)}
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-black/60 leading-tight line-clamp-2 w-full min-h-0">
                        {isPerennial
                          ? (formatPlantedAgo(batch.sown_date) ?? "Planted")
                          : `Sown ${new Date(batch.sown_date).toLocaleDateString()}`}
                        {!isPerennial && batch.harvest_count > 0 && ` · ${batch.harvest_count} harvest`}
                        {isPerennial && batch.care_count > 0 && ` · ${batch.care_count} care`}
                      </p>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
            <ul className="divide-y divide-black/5">
              {sortedBatches.map((batch) => {
                const sown = new Date(batch.sown_date).getTime();
                const isPerennial = batch.is_permanent_planting === true;
                const rawExpected = batch.expected_harvest_date
                  ? new Date(batch.expected_harvest_date).getTime()
                  : batch.harvest_days
                  ? sown + batch.harvest_days * 86400000
                  : null;
                const now = Date.now();
                const daysTotal = rawExpected ? Math.max(1, (rawExpected - sown) / 86400000) : null;
                const daysElapsed = (now - sown) / 86400000;
                const progress = !isPerennial && daysTotal ? Math.min(1, Math.max(0, daysElapsed / daysTotal)) : null;
                const label = batch.expected_harvest_date
                  ? `Harvest ~${new Date(batch.expected_harvest_date).toLocaleDateString()}`
                  : rawExpected
                  ? `Est. harvest ~${new Date(rawExpected).toLocaleDateString()}`
                  : "No maturity set";
                const rawThumbUrl = getBatchImageUrl(batch);
                const thumbUrl = rawThumbUrl && !failedThumbUrls.has(rawThumbUrl) ? rawThumbUrl : null;

                return (
                  <li
                    key={batch.id}
                    ref={highlightGrowId === batch.id ? (highlightBatchRef as React.RefObject<HTMLLIElement>) : undefined}
                  >
                    <div
                      className={`flex items-center gap-3 px-3 py-2 min-h-[44px] hover:bg-gray-50 transition-colors ${
                        highlightGrowId === batch.id
                          ? "ring-inset ring-2 ring-emerald-500 bg-emerald-50/80"
                          : bulkMode && bulkSelected.has(batch.id)
                          ? "ring-inset ring-2 ring-emerald-500 bg-emerald-50/80"
                          : ""
                      } ${bulkMode && canEditPage(batch.user_id ?? "", "garden") ? "cursor-pointer" : ""}`}
                      onClick={
                        bulkMode && canEditPage(batch.user_id ?? "", "garden")
                          ? (e) => {
                              if (!(e.target as HTMLElement).closest("a")) {
                                e.preventDefault();
                                toggleBulkSelect(batch.id);
                              }
                            }
                          : undefined
                      }
                    >
                      {bulkMode && canEditPage(batch.user_id ?? "", "garden") && (
                        <span className="shrink-0 w-6 h-6 rounded-full border-2 border-black/20 flex items-center justify-center bg-white" aria-hidden>
                          {bulkSelected.has(batch.id) ? (
                            <span className="w-3 h-3 rounded-full bg-blue-600" />
                          ) : null}
                        </span>
                      )}
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 overflow-hidden flex items-center justify-center">
                        {thumbUrl ? (
                          <img src={thumbUrl} alt="" className="w-full h-full object-cover" onError={() => setFailedThumbUrls((prev) => new Set(prev).add(thumbUrl))} />
                        ) : (
                          <PlantPlaceholderIcon size="sm" />
                        )}
                      </div>
                      <Link
                        href={`/garden/grow/${batch.id}`}
                        className="min-w-0 flex-1 block focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset rounded-lg -m-1 p-1 group hover:bg-emerald-50/50 transition-colors"
                        aria-label={`View plant: ${decodeHtmlEntities(formatBatchDisplayName(batch.profile_name, batch.profile_variety_name))}`}
                        onClick={(e) => {
                          if (bulkMode && canEditPage(batch.user_id ?? "", "garden")) {
                            e.preventDefault();
                            toggleBulkSelect(batch.id);
                          }
                          if (longPressFiredRef.current) {
                            e.preventDefault();
                            longPressFiredRef.current = false;
                          }
                        }}
                        onTouchStart={canEditPage(batch.user_id ?? "", "garden") ? () => {
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
                        onTouchMove={canEditPage(batch.user_id ?? "", "garden") ? () => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        } : undefined}
                        onTouchEnd={canEditPage(batch.user_id ?? "", "garden") ? () => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        } : undefined}
                        onTouchCancel={canEditPage(batch.user_id ?? "", "garden") ? () => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        } : undefined}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-neutral-900 group-hover:text-emerald-700">
                            {decodeHtmlEntities(batch.profile_name)}
                          </span>
                          {!isPerennial && batch.planting_method_badge && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{batch.planting_method_badge}</span>}
                          {householdViewMode === "family" && batch.user_id && batch.user_id !== user?.id && (
                            <OwnerBadge shorthand={getShorthandForUser(batch.user_id)} canEdit={canEditPage(batch.user_id ?? "", "garden")} size="xs" />
                          )}
                          {batch.location && <span className="text-xs text-neutral-500">{batch.location}</span>}
                        </div>
                        {batch.profile_variety_name?.trim() && (
                          <span className="block text-sm font-normal italic text-neutral-600 truncate">
                            {decodeHtmlEntities(batch.profile_variety_name)}
                          </span>
                        )}
                        <p className="text-xs text-neutral-500 mt-0.5 space-y-0.5">
                          <span className="block">
                            {isPerennial
                              ? (formatPlantedAgo(batch.sown_date) ?? `Planted ${new Date(batch.sown_date).toLocaleDateString()}`)
                              : `Sown ${new Date(batch.sown_date).toLocaleDateString()}`}
                          </span>
                          {!isPerennial && (
                            <span className="block">
                              {label}
                              {batch.seeds_sown != null && <span className="ml-1"> · {batch.seeds_sown} sown</span>}
                              {batch.seeds_sprouted != null && batch.seeds_sown != null && <span className="ml-1"> · {batch.seeds_sprouted} of {batch.seeds_sown} sprouted</span>}
                              {batch.seeds_sprouted != null && batch.seeds_sown == null && <span className="ml-1"> · {batch.seeds_sprouted} sprouted</span>}
                              {batch.plant_count != null && <span className="ml-1 font-medium text-emerald-600"> · {batch.plant_count} plants</span>}
                              {batch.harvest_count > 0 && <span className="ml-1 text-emerald-600 font-medium"> · Harvested {batch.harvest_count}x</span>}
                            </span>
                          )}
                          {isPerennial && batch.care_count > 0 && (
                            <span className="block">{batch.care_count} care</span>
                          )}
                        </p>
                        {progress != null && (
                          <div className="mt-2 h-2 rounded-full bg-black/10 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress * 100}%` }} />
                          </div>
                        )}
                      </Link>
                      {canEditPage(batch.user_id ?? "", "garden") && (
                        <div className="relative flex-shrink-0 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setBatchLogBatches([toBatchLogBatch(batch)]);
                              setBatchLogOpen(true);
                            }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 bg-white text-emerald-900 hover:bg-emerald-900/10"
                            aria-label="Add journal entry"
                          >
                            <ICON_MAP.Edit className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

    </div>
  );
});

GardenView.displayName = "GardenView";
