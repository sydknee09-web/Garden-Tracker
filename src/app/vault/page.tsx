"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SeedVaultView, type StatusFilter } from "@/components/SeedVaultView";
import { QuickAddSeed } from "@/components/QuickAddSeed";
import { BatchAddSeed } from "@/components/BatchAddSeed";
import { QRScannerModal } from "@/components/QRScannerModal";
import { parseSeedFromQR, type SeedQRPrefill } from "@/lib/parseSeedFromQR";
import { supabase } from "@/lib/supabase";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { useAuth } from "@/contexts/AuthContext";
import { getTagStyle } from "@/components/TagBadges";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { hasPendingReviewData, clearReviewImportData } from "@/lib/reviewImportStorage";
import { compressImage } from "@/lib/compressImage";
import { useModalBackClose } from "@/hooks/useModalBackClose";

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

function VaultPageInner() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"grid" | "list" | "active" | "plants">("grid");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [batchAddOpen, setBatchAddOpen] = useState(false);

  useModalBackClose(quickAddOpen, useCallback(() => {
    setQuickAddOpen(false);
    setQrPrefill(null);
  }, []));
  useModalBackClose(batchAddOpen, useCallback(() => setBatchAddOpen(false), []));
  useModalBackClose(scannerOpen, useCallback(() => setScannerOpen(false), []));
  const [qrPrefill, setQrPrefill] = useState<SeedQRPrefill | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("vault");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [selectedVarietyIds, setSelectedVarietyIds] = useState<Set<string>>(new Set());
  const [filteredVarietyIds, setFilteredVarietyIds] = useState<string[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
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
  const searchParams = useSearchParams();
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const [availablePlantTypes, setAvailablePlantTypes] = useState<string[]>([]);
  const [hasPendingReview, setHasPendingReview] = useState(false);
  const [gridDisplayStyle, setGridDisplayStyle] = useState<"photo" | "condensed">("condensed");
  const [refineByOpen, setRefineByOpen] = useState(false);
  const [refineBySection, setRefineBySection] = useState<"vault" | "tags" | "plantType" | "variety" | "vendor" | "sun" | "spacing" | "germination" | "maturity" | "packetCount" | null>(null);
  const [selectionActionsOpen, setSelectionActionsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categoryChips, setCategoryChips] = useState<{ type: string; count: number }[]>([]);
  const [varietyFilter, setVarietyFilter] = useState<string | null>(null);
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);
  const [sunFilter, setSunFilter] = useState<string | null>(null);
  const [spacingFilter, setSpacingFilter] = useState<string | null>(null);
  const [germinationFilter, setGerminationFilter] = useState<string | null>(null);
  const [maturityFilter, setMaturityFilter] = useState<string | null>(null);
  const [packetCountFilter, setPacketCountFilter] = useState<string | null>(null);
  const [refineChips, setRefineChips] = useState<{
    variety: { value: string; count: number }[];
    vendor: { value: string; count: number }[];
    sun: { value: string; count: number }[];
    spacing: { value: string; count: number }[];
    germination: { value: string; count: number }[];
    maturity: { value: string; count: number }[];
    packetCount: { value: string; count: number }[];
  }>({ variety: [], vendor: [], sun: [], spacing: [], germination: [], maturity: [], packetCount: [] });

  useEffect(() => { setHasPendingReview(hasPendingReviewData()); }, [refetchTrigger]);

  const handleCategoryChipsLoaded = useCallback((chips: { type: string; count: number }[]) => {
    setCategoryChips(chips);
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
    setTagFilters((prev) => prev.filter((t) => tags.includes(t)));
  }, []);

  useEffect(() => {
    const el = stickyHeaderRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStickyHeaderHeight(el.offsetHeight));
    ro.observe(el);
    setStickyHeaderHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [viewMode, batchSelectMode, availableTags.length, tagFilters.length]);

  useEffect(() => {
    if (!tagDropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (tagDropdownRef.current?.contains(e.target as Node)) return;
      setTagDropdownOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [tagDropdownOpen]);

  // Load plant type options for list-view dropdown (schedule_defaults + common)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase.from("schedule_defaults").select("plant_type").eq("user_id", user.id);
      const fromSchedule = (data ?? []).map((r: { plant_type?: string }) => (r.plant_type ?? "").trim()).filter(Boolean);
      const common = ["Imported seed", "Bean", "Cucumber", "Tomato", "Pepper", "Lettuce", "Squash", "Pea", "Carrot", "Basil"];
      setAvailablePlantTypes(Array.from(new Set([...common, ...fromSchedule])).sort((a, b) => a.localeCompare(b)));
    })();
  }, [user?.id]);

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

  // Sync tab from URL (e.g. /vault?tab=active after planting) and refetch so new plantings show
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "active" || tab === "grid" || tab === "list" || tab === "plants") {
      setViewMode(tab);
      if (tab === "active") setRefetchTrigger((t) => t + 1);
    } else if (tab === "table") {
      setViewMode("list");
    }
    const status = searchParams.get("status");
    if (status === "vault" || status === "active" || status === "low_inventory" || status === "archived") {
      setStatusFilter(status);
    }
  }, [searchParams]);

  // Restore view/filter/search from sessionStorage when no URL params (cross-session continuity)
  const hasRestoredSession = useRef(false);
  useEffect(() => {
    if (hasRestoredSession.current || typeof window === "undefined") return;
    if (searchParams.get("tab") || searchParams.get("status")) return;
    hasRestoredSession.current = true;
    try {
      const savedView = sessionStorage.getItem("vault-view-mode");
      if (savedView === "grid" || savedView === "list" || savedView === "active" || savedView === "plants") setViewMode(savedView);
      else if (savedView === "table") setViewMode("list");
      const savedGridStyle = sessionStorage.getItem("vault-grid-style");
      if (savedGridStyle === "photo" || savedGridStyle === "condensed") setGridDisplayStyle(savedGridStyle);
      const savedStatus = sessionStorage.getItem("vault-status-filter");
      if (savedStatus === "" || savedStatus === "vault" || savedStatus === "active" || savedStatus === "low_inventory" || savedStatus === "archived") setStatusFilter(savedStatus);
      const savedSearch = sessionStorage.getItem("vault-search");
      if (typeof savedSearch === "string") setSearchQuery(savedSearch);
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  // Persist view mode, status filter, and search to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("vault-view-mode", viewMode);
      sessionStorage.setItem("vault-status-filter", statusFilter);
    } catch {
      /* ignore */
    }
  }, [viewMode, statusFilter]);
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
    for (const id of Array.from(selectedVarietyIds)) {
      const { data: softDeleted } = await supabase
        .from("plant_profiles")
        .update({ deleted_at: now })
        .eq("id", id)
        .eq("user_id", uid)
        .select("id");
      if (softDeleted && softDeleted.length > 0) continue;
      const { error: e2 } = await supabase.from("plant_varieties").delete().eq("id", id).eq("user_id", uid);
      if (e2) {
        setSaveToastMessage(`Could not delete: ${e2.message}`);
        failed = true;
        break;
      }
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

  const [scheduleProfiles, setScheduleProfiles] = useState<{ id: string; name: string; variety_name: string | null }[]>([]);
  const [scheduleDefaults, setScheduleDefaults] = useState<{
    plant_type: string;
    planting_window?: string | null;
    sow_jan: boolean;
    sow_feb: boolean;
    sow_mar: boolean;
    sow_apr: boolean;
    sow_may: boolean;
    sow_jun: boolean;
    sow_jul: boolean;
    sow_aug: boolean;
    sow_sep: boolean;
    sow_oct: boolean;
    sow_nov: boolean;
    sow_dec: boolean;
  }[]>([]);
  const [scheduleDueDate, setScheduleDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (!scheduleModalOpen || !user?.id || selectedVarietyIds.size === 0) {
      return;
    }
    setScheduleDueDate(new Date().toISOString().slice(0, 10));
    let cancelled = false;
    (async () => {
      const ids = Array.from(selectedVarietyIds);
      const [profilesRes, defaultsRes] = await Promise.all([
        supabase.from("plant_profiles").select("id, name, variety_name").in("id", ids).eq("user_id", user.id),
        supabase.from("schedule_defaults").select("plant_type, planting_window, sow_jan, sow_feb, sow_mar, sow_apr, sow_may, sow_jun, sow_jul, sow_aug, sow_sep, sow_oct, sow_nov, sow_dec").eq("user_id", user.id),
      ]);
      if (!cancelled) {
        setScheduleProfiles((profilesRes.data ?? []) as { id: string; name: string; variety_name: string | null }[]);
        setScheduleDefaults((defaultsRes.data ?? []) as {
        plant_type: string;
        planting_window?: string | null;
        sow_jan: boolean;
        sow_feb: boolean;
        sow_mar: boolean;
        sow_apr: boolean;
        sow_may: boolean;
        sow_jun: boolean;
        sow_jul: boolean;
        sow_aug: boolean;
        sow_sep: boolean;
        sow_oct: boolean;
        sow_nov: boolean;
        sow_dec: boolean;
      }[]);
      }
    })();
    return () => { cancelled = true; };
  }, [scheduleModalOpen, user?.id, selectedVarietyIds]);

  const isSowNow = useCallback((profile: { name: string; variety_name: string | null }, defaults: { plant_type: string; sow_jan: boolean; sow_feb: boolean; sow_mar: boolean; sow_apr: boolean; sow_may: boolean; sow_jun: boolean; sow_jul: boolean; sow_aug: boolean; sow_sep: boolean; sow_oct: boolean; sow_nov: boolean; sow_dec: boolean }[]) => {
    const now = new Date();
    const monthIndex = now.getMonth();
    const monthCol = ["sow_jan", "sow_feb", "sow_mar", "sow_apr", "sow_may", "sow_jun", "sow_jul", "sow_aug", "sow_sep", "sow_oct", "sow_nov", "sow_dec"][monthIndex] as keyof (typeof defaults)[0];
    const startPlantTypes = new Set(defaults.filter((s) => s[monthCol] === true).map((s) => s.plant_type.trim().toLowerCase()));
    const nameNorm = (profile.name ?? "").trim().toLowerCase();
    const firstWord = nameNorm.split(/\s+/)[0];
    return startPlantTypes.has(nameNorm) || startPlantTypes.has(firstWord ?? "") || Array.from(startPlantTypes).some((t) => nameNorm.includes(t) || t.includes(nameNorm));
  }, []);

  const MONTH_ABBREV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const getSowingWindowLabel = useCallback((profile: { name: string }, defaults: { plant_type: string; planting_window?: string | null; sow_jan: boolean; sow_feb: boolean; sow_mar: boolean; sow_apr: boolean; sow_may: boolean; sow_jun: boolean; sow_jul: boolean; sow_aug: boolean; sow_sep: boolean; sow_oct: boolean; sow_nov: boolean; sow_dec: boolean }[]) => {
    const nameNorm = (profile.name ?? "").trim().toLowerCase();
    const firstWord = nameNorm.split(/\s+/)[0];
    const row = defaults.find((s) => {
      const t = (s.plant_type ?? "").trim().toLowerCase();
      return t === nameNorm || t === (firstWord ?? "") || nameNorm.includes(t) || t.includes(nameNorm);
    });
    if (!row) return null;
    if (row.planting_window?.trim()) return row.planting_window.trim();
    const cols = ["sow_jan", "sow_feb", "sow_mar", "sow_apr", "sow_may", "sow_jun", "sow_jul", "sow_aug", "sow_sep", "sow_oct", "sow_nov", "sow_dec"] as const;
    const indices = cols.map((_, i) => i).filter((i) => row[cols[i]] === true);
    if (indices.length === 0) return null;
    const runs: number[][] = [];
    let run: number[] = [indices[0]!];
    for (let i = 1; i < indices.length; i++) {
      if (indices[i]! === indices[i - 1]! + 1) run.push(indices[i]!);
      else { runs.push(run); run = [indices[i]!]; }
    }
    runs.push(run);
    return runs.map((r) => r.length >= 2 ? `${MONTH_ABBREV[r[0]!]}–${MONTH_ABBREV[r[r.length - 1]!]}` : MONTH_ABBREV[r[0]!]).join(", ");
  }, []);

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
  const [plantScheduleDefaults, setPlantScheduleDefaults] = useState<{
    plant_type: string;
    planting_window?: string | null;
    sow_jan: boolean;
    sow_feb: boolean;
    sow_mar: boolean;
    sow_apr: boolean;
    sow_may: boolean;
    sow_jun: boolean;
    sow_jul: boolean;
    sow_aug: boolean;
    sow_sep: boolean;
    sow_oct: boolean;
    sow_nov: boolean;
    sow_dec: boolean;
  }[]>([]);
  const [plantDate, setPlantDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [plantNotes, setPlantNotes] = useState("");
  type PlantProfileForModal = { id: string; name: string; variety_name: string | null; harvest_days: number | null };
  type SeedPacketRow = { id: string; qty_status: number; created_at?: string };
  type PlantQuantityChoice = "50%" | "1 Pkt" | "All";
  type PlantModalRow = { profile: PlantProfileForModal; packets: SeedPacketRow[]; quantityChoice: PlantQuantityChoice };
  const [plantModalRows, setPlantModalRows] = useState<PlantModalRow[]>([]);
  useEffect(() => {
    if (!plantModalOpen || !user?.id || selectedVarietyIds.size === 0) return;
    setPlantDate(new Date().toISOString().slice(0, 10));
    setPlantNotes("");
    let cancelled = false;
    (async () => {
      const ids = Array.from(selectedVarietyIds);
      const [profilesRes, defaultsRes, packetsRes] = await Promise.all([
        supabase.from("plant_profiles").select("id, name, variety_name, harvest_days").in("id", ids).eq("user_id", user.id),
        supabase.from("schedule_defaults").select("plant_type, planting_window, sow_jan, sow_feb, sow_mar, sow_apr, sow_may, sow_jun, sow_jul, sow_aug, sow_sep, sow_oct, sow_nov, sow_dec").eq("user_id", user.id),
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
      if (!cancelled && defaultsRes.data) {
        setPlantScheduleDefaults(defaultsRes.data as {
          plant_type: string;
          planting_window?: string | null;
          sow_jan: boolean;
          sow_feb: boolean;
          sow_mar: boolean;
          sow_apr: boolean;
          sow_may: boolean;
          sow_jun: boolean;
          sow_jul: boolean;
          sow_aug: boolean;
          sow_sep: boolean;
          sow_oct: boolean;
          sow_nov: boolean;
          sow_dec: boolean;
        }[]);
      }
    })();
    return () => { cancelled = true; };
  }, [plantModalOpen, user?.id, selectedVarietyIds]);

  const consumePackets = useCallback(async (profileId: string, toUse: number, packets: SeedPacketRow[]): Promise<boolean> => {
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
      const toUse = choice === "All" ? effectiveTotal : choice === "1 Pkt" ? 1 : effectiveTotal * 0.5;

      const harvestDays = p.harvest_days != null && p.harvest_days > 0 ? p.harvest_days : null;
      const expectedHarvestDate = harvestDays != null
        ? new Date(new Date(sownDate).getTime() + harvestDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null;

      const { data: growRow, error: growErr } = await supabase
        .from("grow_instances")
        .insert({
          user_id: user.id,
          plant_profile_id: p.id,
          sown_date: sownDate,
          expected_harvest_date: expectedHarvestDate ?? null,
          status: "growing",
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
        await supabase.from("plant_profiles").update({ status: "out_of_stock" }).eq("id", p.id).eq("user_id", user.id);
        await supabase.from("shopping_list").upsert(
          { user_id: user.id, plant_profile_id: p.id, is_purchased: false },
          { onConflict: "user_id,plant_profile_id", ignoreDuplicates: false }
        );
      }
    }
    setPlantConfirming(false);
    if (errMsg) {
      setSaveToastMessage(`Could not complete planting: ${errMsg}`);
      return;
    }
    setPlantModalOpen(false);
    setSelectedVarietyIds(new Set());
    setBatchSelectMode(false);
    setRefetchTrigger((t) => t + 1);
    setSaveToastMessage("Planted!");
    setTimeout(() => router.push("/garden?tab=active"), 600);
  }, [user?.id, plantModalRows, plantDate, plantNotes, router, consumePackets]);

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

  function toggleTagFilter(tag: string) {
    setTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleQRScan(value: string) {
    const trimmed = value.trim();
    const uuidRegex =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = trimmed.match(uuidRegex);
    const possibleId = match ? match[0] : trimmed;
    let { data } = await supabase.from("plant_profiles").select("id").eq("id", possibleId).maybeSingle();
    if (!data?.id) {
      const res = await supabase.from("plant_varieties").select("id").eq("id", possibleId).maybeSingle();
      data = res.data;
    }
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
  }

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
      <div ref={stickyHeaderRef} className="sticky top-11 z-50 h-auto min-h-0 -mx-6 px-6 pt-1 pb-2 bg-white/95 backdrop-blur-md border-b border-black/5 shadow-sm">
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

        <div className="flex border-b border-black/10 mb-2 -mx-6 px-6" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              viewMode === "grid"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-black/60 hover:text-black"
            }`}
          >
            Plant Profiles
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              viewMode === "list"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-black/60 hover:text-black"
            }`}
          >
            Seed Vault
          </button>
        </div>

        {/* Unified toolbar: search + (Refine by | view toggle | Select | batch actions) for vault tabs */}
        {(viewMode === "grid" || viewMode === "list") && (
          <>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search seeds…"
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                  aria-label="Search seeds"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 gap-y-2 relative z-40">
                <button
                  type="button"
                  onClick={() => { setRefineByOpen(true); setRefineBySection(null); }}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 flex items-center gap-2 shrink-0"
                  aria-label="Refine by status, tags, plant type"
                >
                  Refine by
                  {(viewMode === "grid" || viewMode === "list") && (
                    (statusFilter !== "" && statusFilter !== "vault") || tagFilters.length > 0 || categoryFilter !== null ||
                    varietyFilter !== null || vendorFilter !== null || sunFilter !== null || spacingFilter !== null ||
                    germinationFilter !== null || maturityFilter !== null || packetCountFilter !== null
                  ) ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald text-white text-xs font-semibold">
                      {[
                        statusFilter !== "" && statusFilter !== "vault",
                        tagFilters.length > 0,
                        categoryFilter !== null,
                        varietyFilter !== null,
                        vendorFilter !== null,
                        sunFilter !== null,
                        spacingFilter !== null,
                        germinationFilter !== null,
                        maturityFilter !== null,
                        packetCountFilter !== null,
                      ].filter(Boolean).length}
                    </span>
                  ) : null}
                </button>
                {!batchSelectMode && (viewMode === "grid" || viewMode === "list") && (
                  <button
                    type="button"
                    onClick={() => setBatchSelectMode(true)}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 shrink-0"
                  >
                    Select
                  </button>
                )}
                {viewMode === "grid" && (
                  <div className="inline-flex rounded-xl p-1 border border-black/10 bg-white shadow-soft ml-auto" role="tablist" aria-label="Grid display style">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={gridDisplayStyle === "photo"}
                      onClick={() => setGridDisplayStyle("photo")}
                      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${gridDisplayStyle === "photo" ? "bg-emerald text-white" : "text-black/60 hover:text-black"}`}
                      title="Photo cards"
                      aria-label="Photo cards"
                    >
                      <PhotoCardsGridIcon />
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={gridDisplayStyle === "condensed"}
                      onClick={() => setGridDisplayStyle("condensed")}
                      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${gridDisplayStyle === "condensed" ? "bg-emerald text-white" : "text-black/60 hover:text-black"}`}
                      title="Condensed"
                      aria-label="Condensed"
                    >
                      <CondensedGridIcon />
                    </button>
                  </div>
                )}
                {batchSelectMode && (viewMode === "grid" || viewMode === "list") && (
                  <div className="flex flex-wrap items-center gap-2 bg-neutral-50/80 rounded-lg px-2 py-1.5 border border-black/5" role="toolbar" aria-label="Selection">
                    <button
                      type="button"
                      onClick={() => { setBatchSelectMode(false); setSelectedVarietyIds(new Set()); setSelectionActionsOpen(false); }}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 text-sm font-medium text-black/80 bg-white hover:bg-black/5 shrink-0"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 text-sm font-medium text-black/80 bg-white hover:bg-black/5 shrink-0"
                    >
                      Select All
                    </button>
                  </div>
                )}
              </div>
            </div>

          </>
        )}
      </div>

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
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-black/10">
              <h2 id="refine-by-title" className="text-lg font-semibold text-black">Refine by</h2>
              <button
                type="button"
                onClick={() => { setRefineByOpen(false); setRefineBySection(null); }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-black/60 hover:bg-black/5 hover:text-black"
                aria-label="Close"
              >
                <span className="text-xl leading-none" aria-hidden>×</span>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">
              {/* Content for Plant Profiles / Seed Vault / Table */}
              {(viewMode === "grid" || viewMode === "list") && (
                <>
                  <div className="border-b border-black/5">
                    <button
                      type="button"
                      onClick={() => setRefineBySection((s) => (s === "vault" ? null : "vault"))}
                      className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                      aria-expanded={refineBySection === "vault"}
                    >
                      <span>Vault status</span>
                      <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "vault" ? "▴" : "▾"}</span>
                    </button>
                    {refineBySection === "vault" && (
                      <div className="px-4 pb-3 pt-0 space-y-0.5">
                        {(["", "vault", "active", "low_inventory", "archived"] as const).map((value) => {
                          const label = value === "" ? "All" : value === "vault" ? "Vaulted" : value === "active" ? "Active" : value === "low_inventory" ? "Low inventory" : "Archived";
                          const selected = statusFilter === value;
                          return (
                            <button
                              key={value || "all"}
                              type="button"
                              onClick={() => setStatusFilter(value)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                            >
                              {label}
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
                        <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "tags" ? "▴" : "▾"}</span>
                      </button>
                      {refineBySection === "tags" && (
                        <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                          {availableTags.map((tag) => {
                            const checked = tagFilters.includes(tag);
                            return (
                              <label
                                key={tag}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 cursor-pointer min-h-[44px]"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTagFilter(tag)}
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
                        <span>Plant type</span>
                        <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "plantType" ? "▴" : "▾"}</span>
                      </button>
                      {refineBySection === "plantType" && (
                        <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                          <button
                            type="button"
                            onClick={() => setCategoryFilter(null)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${categoryFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                          >
                            All
                          </button>
                          {categoryChips.map(({ type, count }) => {
                            const selected = categoryFilter === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setCategoryFilter(type)}
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
                  {/* Variety, Vendor, Sun, Spacing, Germination, Maturity, Packet count (Seed Vault / Table) */}
                  {(viewMode === "grid" || viewMode === "list") && (
                    <>
                      {refineChips.variety.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "variety" ? null : "variety"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "variety"}>
                            <span>Variety</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "variety" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "variety" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => setVarietyFilter(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${varietyFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.variety.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setVarietyFilter(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${varietyFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.vendor.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "vendor" ? null : "vendor"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "vendor"}>
                            <span>Vendor</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "vendor" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "vendor" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => setVendorFilter(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${vendorFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.vendor.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setVendorFilter(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${vendorFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.sun.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "sun" ? null : "sun"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "sun"}>
                            <span>Sun</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "sun" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "sun" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => setSunFilter(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sunFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.sun.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setSunFilter(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sunFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.spacing.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "spacing" ? null : "spacing"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "spacing"}>
                            <span>Spacing</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "spacing" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "spacing" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => setSpacingFilter(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${spacingFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.spacing.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setSpacingFilter(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${spacingFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.germination.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "germination" ? null : "germination"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "germination"}>
                            <span>Germination</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "germination" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "germination" && (
                            <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto overscroll-behavior-contain space-y-0.5">
                              <button type="button" onClick={() => setGerminationFilter(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${germinationFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.germination.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setGerminationFilter(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${germinationFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.maturity.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "maturity" ? null : "maturity"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "maturity"}>
                            <span>Maturity</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "maturity" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "maturity" && (
                            <div className="px-4 pb-3 pt-0 space-y-0.5">
                              <button type="button" onClick={() => setMaturityFilter(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${maturityFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.maturity.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setMaturityFilter(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${maturityFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value === "<60" ? "<60 days" : value === "60-90" ? "60–90 days" : "90+ days"} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {refineChips.packetCount.length > 0 && (
                        <div className="border-b border-black/5">
                          <button type="button" onClick={() => setRefineBySection((s) => (s === "packetCount" ? null : "packetCount"))} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]" aria-expanded={refineBySection === "packetCount"}>
                            <span>Packet count</span>
                            <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "packetCount" ? "▴" : "▾"}</span>
                          </button>
                          {refineBySection === "packetCount" && (
                            <div className="px-4 pb-3 pt-0 space-y-0.5">
                              <button type="button" onClick={() => setPacketCountFilter(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${packetCountFilter === null ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>All</button>
                              {refineChips.packetCount.map(({ value, count }) => (
                                <button key={value} type="button" onClick={() => setPacketCountFilter(value)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${packetCountFilter === value ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}>{value === "2+" ? "2+ packets" : value === "1" ? "1 packet" : "0 packets"} ({count})</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <footer className="flex-shrink-0 border-t border-black/10 px-4 py-3">
              <button
                type="button"
                onClick={() => { setRefineByOpen(false); setRefineBySection(null); }}
                className="w-full min-h-[48px] rounded-xl bg-emerald text-white font-medium text-sm"
              >
                Show results ({filteredVarietyIds.length})
              </button>
            </footer>
          </div>
        </>
      )}

      {(viewMode === "grid" || viewMode === "list") && (
        <div className="relative z-10 pt-2">
          <SeedVaultView
            mode={viewMode}
            refetchTrigger={refetchTrigger}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            tagFilters={tagFilters}
            onTagsLoaded={handleTagsLoaded}
            onOpenScanner={() => setScannerOpen(true)}
            batchSelectMode={batchSelectMode}
            selectedVarietyIds={selectedVarietyIds}
            onToggleVarietySelection={toggleVarietySelection}
            onLongPressVariety={handleLongPressVariety}
            onFilteredIdsChange={setFilteredVarietyIds}
            onPendingHeroCountChange={setPendingHeroCount}
            availablePlantTypes={availablePlantTypes}
            onPlantTypeChange={handlePlantTypeChange}
            plantNowFilter={false}
            gridDisplayStyle={viewMode === "grid" ? gridDisplayStyle : undefined}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            onCategoryChipsLoaded={handleCategoryChipsLoaded}
            varietyFilter={varietyFilter}
            vendorFilter={vendorFilter}
            sunFilter={sunFilter}
            spacingFilter={spacingFilter}
            germinationFilter={germinationFilter}
            maturityFilter={maturityFilter}
            packetCountFilter={packetCountFilter}
            onRefineChipsLoaded={handleRefineChipsLoaded}
            hideArchivedProfiles={false}
          />
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
                    const sowNow = isSowNow(p, scheduleDefaults);
                    const sowingWindow = getSowingWindowLabel(p, scheduleDefaults);
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
                    const sowingWindow = getSowingWindowLabel(p, plantScheduleDefaults);
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-black/60">Use:</span>
                          {(["50%", "1 Pkt", "All"] as const).map((opt) => (
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
                onClick={() => setPlantModalOpen(false)}
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
                onClick={() => { handleBatchDelete(); setSelectionActionsOpen(false); }}
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
                <span className="w-5 h-5 shrink-0 text-lg leading-none" aria-hidden>🛒</span>
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

      <button
        type="button"
        onClick={() => {
          if ((viewMode === "grid" || viewMode === "list") && batchSelectMode) {
            setSelectionActionsOpen(true);
          } else {
            setQuickAddOpen(true);
          }
        }}
        className="fixed right-6 z-30 w-14 h-14 rounded-full bg-emerald text-white shadow-card flex items-center justify-center text-2xl font-light hover:opacity-90 transition-opacity"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={(viewMode === "grid" || viewMode === "list") && batchSelectMode ? "Selection actions" : "Quick add seed"}
      >
        +
      </button>

      <QuickAddSeed
        open={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false);
          setQrPrefill(null);
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
          setQuickAddOpen(false);
          router.push("/vault/import");
        }}
        onStartManualImport={() => {
          setQuickAddOpen(false);
          router.push("/vault/import/manual");
        }}
      />

      <BatchAddSeed
        open={batchAddOpen}
        onClose={() => setBatchAddOpen(false)}
        onSuccess={() => setRefetchTrigger((t) => t + 1)}
      />

      <QRScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleQRScan}
      />

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

export default function VaultPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-600">Loading…</div>}>
      <VaultPageInner />
    </Suspense>
  );
}
