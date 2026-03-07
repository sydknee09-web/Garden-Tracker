"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const UniversalAddMenu = dynamic(
  () => import("@/components/UniversalAddMenu").then((m) => ({ default: m.UniversalAddMenu })),
  { ssr: false }
);
const NewTaskModal = dynamic(
  () => import("@/components/NewTaskModal").then((m) => ({ default: m.NewTaskModal })),
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
const AddPlantModal = dynamic(
  () => import("@/components/AddPlantModal").then((m) => ({ default: m.AddPlantModal })),
  { ssr: false }
);
const PurchaseOrderImport = dynamic(
  () => import("@/components/PurchaseOrderImport").then((m) => ({ default: m.PurchaseOrderImport })),
  { ssr: false }
);
const EditJournalModal = dynamic(
  () => import("@/components/EditJournalModal").then((m) => ({ default: m.EditJournalModal })),
  { ssr: false }
);
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { OwnerBadge } from "@/components/OwnerBadge";
import { useSync } from "@/contexts/SyncContext";
import { formatWeatherBadge } from "@/lib/weatherSnapshot";
import type { JournalEntry } from "@/types/garden";
import type { GrowInstance } from "@/types/garden";

type JournalEntryWithPlant = JournalEntry & {
  plant_name?: string;
  plant_display_name?: string; // e.g. "Tomato (Roma)"
  plant_profile_id?: string | null;
  weather_snapshot?: JournalEntry["weather_snapshot"];
};

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

type ActionInfo = { label: string; icon: "plant" | "harvest" | "growth" | "note" | "water" | "fertilize" | "spray" | "care" };

function getActionFromNote(note: string | null, entryType?: string | null): ActionInfo {
  const n = (note ?? "").toLowerCase();
  if (entryType === "quick" || entryType === "care") {
    if (n.includes("watered")) return { label: "Water", icon: "water" };
    if (n.includes("fertilized")) return { label: "Fertilize", icon: "fertilize" };
    if (n.includes("sprayed")) return { label: "Spray", icon: "spray" };
    return { label: "Care", icon: "care" };
  }
  if (n.includes("planted") || n.includes("sown") || n.includes("sow")) return { label: "Planted", icon: "plant" };
  if (n.includes("harvest")) return { label: "Harvest", icon: "harvest" };
  if (n.includes("growth") || n.includes("transplant") || n.includes("progress")) return { label: "Growth", icon: "growth" };
  if (n.includes("watered")) return { label: "Water", icon: "water" };
  if (n.includes("fertilized")) return { label: "Fertilize", icon: "fertilize" };
  if (n.includes("sprayed")) return { label: "Spray", icon: "spray" };
  return { label: "Note", icon: "note" };
}

/** Collapse repeated notes into "Label ×N". */
function combineNotes(notes: (string | null)[]): string {
  const counts = new Map<string, number>();
  for (const n of notes) {
    const t = (n ?? "").trim();
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([text, num]) => (num > 1 ? `${text} ×${num}` : text))
    .join(", ");
}

/** Pick display action for a group: harvest > planting > care > growth > note. */
function getActionForGroup(group: JournalEntryWithPlant[]): ActionInfo {
  const has = (type: string) => group.some((e) => (e.entry_type ?? "").toLowerCase() === type);
  if (has("harvest")) return { label: "Harvest", icon: "harvest" };
  if (has("planting")) return { label: "Planted", icon: "plant" };
  if (has("quick") || has("care")) return { label: "Care", icon: "care" };
  if (has("growth")) return { label: "Growth", icon: "growth" };
  const first = group[0];
  return getActionFromNote(first.note, first.entry_type);
}

/** One row per journal entry (Section 6: one entry can tag multiple plants). */
function groupEntriesForTable(entries: (JournalEntryWithPlant & { plant_display_names?: string[]; plant_profile_ids?: string[] })[]): { date: string; note: string | null; action: ActionInfo; plantNames: string[]; plant_profile_ids: string[]; entryIds: string[]; plant_profile_id: string | null; owner_user_id: string | null }[] {
  return entries
    .map((e) => {
      const plantNames = (e as JournalEntryWithPlant & { plant_display_names?: string[] }).plant_display_names
        ?? [(e.plant_display_name ?? e.plant_name ?? "General")];
      const ids = (e as JournalEntryWithPlant & { plant_profile_ids?: string[] }).plant_profile_ids ?? (e.plant_profile_id ? [e.plant_profile_id] : []);
      const action = getActionForGroup([e]);
      return {
        date: e.created_at,
        note: e.note ?? null,
        action,
        plantNames,
        plant_profile_ids: ids,
        entryIds: [e.id],
        plant_profile_id: e.plant_profile_id ?? null,
        owner_user_id: e.user_id ?? null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Insert year/month section headers into table rows for glanceable timeline. */
function tableRowsWithSections(
  rows: { date: string; note: string | null; action: ReturnType<typeof getActionFromNote>; plantNames: string[]; plant_profile_ids: string[]; entryIds: string[]; plant_profile_id: string | null; owner_user_id: string | null }[]
): ({ type: "section"; label: string } | { type: "row"; row: (typeof rows)[0] })[] {
  const out: ({ type: "section"; label: string } | { type: "row"; row: (typeof rows)[0] })[] = [];
  let lastYM = "";
  for (const row of rows) {
    const d = new Date(row.date);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (ym !== lastYM) {
      out.push({ type: "section", label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }) });
      lastYM = ym;
    }
    out.push({ type: "row", row });
  }
  return out;
}

function TableIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3h18v18H3z" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  );
}
function LayoutGridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
function TimelineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="2" x2="12" y2="22" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="12" cy="14" r="2" />
      <line x1="14" y1="6" x2="20" y2="6" />
      <line x1="4" y1="14" x2="10" y2="14" />
    </svg>
  );
}

/** Group journal entries by plant for timeline view */
function groupEntriesByPlant(entries: JournalEntryWithPlant[]): { plantName: string; profileId: string | null; entries: JournalEntryWithPlant[] }[] {
  const map = new Map<string, { plantName: string; profileId: string | null; entries: JournalEntryWithPlant[] }>();
  for (const e of entries) {
    const key = e.plant_profile_id ?? "__general__";
    if (!map.has(key)) {
      map.set(key, { plantName: e.plant_display_name ?? e.plant_name ?? "General", profileId: e.plant_profile_id || null, entries: [] });
    }
    map.get(key)!.entries.push(e);
  }
  // Sort groups by most recent entry first
  return Array.from(map.values()).sort((a, b) => {
    const da = a.entries[0]?.created_at ?? "";
    const db = b.entries[0]?.created_at ?? "";
    return db.localeCompare(da);
  });
}
function PlantIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M12 8a4 4 0 0 1-4 4 4 4 0 0 1-1.5-7.5A4 4 0 0 1 12 2" />
    </svg>
  );
}
function HarvestIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 8h14l-1.5 10H6.5L5 8z" />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function NoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function GrowthIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22v-6" />
      <path d="M12 16a4 4 0 0 1-4-4V4" />
      <path d="M12 16a4 4 0 0 0 4-4V4" />
    </svg>
  );
}
function WaterIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}
function FertilizeIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}
function SprayIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h4v14H3zM17 6h4v14h-4zM7 6h10v4H7z" />
    </svg>
  );
}
function CareIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function ActionIcon({ icon }: { icon: ActionInfo["icon"] }) {
  switch (icon) {
    case "plant": return <PlantIcon />;
    case "harvest": return <HarvestIconSmall />;
    case "growth": return <GrowthIconSmall />;
    case "water": return <WaterIconSmall />;
    case "fertilize": return <FertilizeIconSmall />;
    case "spray": return <SprayIconSmall />;
    case "care": return <CareIconSmall />;
    default: return <NoteIcon />;
  }
}

export default function JournalPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser, canEditPage } = useHousehold();
  const { setSyncing } = useSync();
  const [entries, setEntries] = useState<JournalEntryWithPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const viewFromUrl = searchParams.get("view");
  const [viewMode, setViewMode] = useState<"table" | "grid" | "timeline">(() => {
    // URL param takes priority; otherwise restore from sessionStorage; fallback to gallery
    if (viewFromUrl === "timeline" || viewFromUrl === "table" || viewFromUrl === "grid") return viewFromUrl;
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("journal-view-mode");
      if (saved === "grid" || saved === "table" || saved === "timeline") return saved;
    }
    return "grid";
  });
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [deleteConfirmEntryIds, setDeleteConfirmEntryIds] = useState<string[] | null>(null);
  const [selectionActionsOpen, setSelectionActionsOpen] = useState(false);
  const [universalAddMenuOpen, setUniversalAddMenuOpen] = useState(false);
  const [quickAddSeedOpen, setQuickAddSeedOpen] = useState(false);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [batchAddSeedOpen, setBatchAddSeedOpen] = useState(false);
  const [shedQuickAddOpen, setShedQuickAddOpen] = useState(false);
  const [batchAddSupplyOpen, setBatchAddSupplyOpen] = useState(false);
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [addPlantDefaultType, setAddPlantDefaultType] = useState<"permanent" | "seasonal">("seasonal");
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  const [purchaseOrderMode, setPurchaseOrderMode] = useState<"seed" | "supply">("seed");
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const skipPopOnNavigateRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    if (viewFromUrl === "timeline") setViewMode("timeline");
    else if (viewFromUrl === "grid") setViewMode("grid");
    else if (viewFromUrl === "table") setViewMode("table");
  }, [viewFromUrl]);

  // Persist journal view so it survives navigation within the app
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { sessionStorage.setItem("journal-view-mode", viewMode); } catch { /* ignore */ }
  }, [viewMode]);

  // Sync URL to view so back button restores the same view (mobile)
  useEffect(() => {
    if (viewFromUrl === viewMode) return;
    router.replace(`/journal?view=${viewMode}`, { scroll: false });
  }, [viewMode, viewFromUrl, router]);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchJournal() {
      if (!user) return;
      let journalQuery = supabase
        .from("journal_entries")
        .select("id, plant_profile_id, grow_instance_id, note, photo_url, image_file_path, weather_snapshot, entry_type, harvest_weight, harvest_unit, harvest_quantity, created_at, user_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (householdViewMode !== "family") journalQuery = journalQuery.eq("user_id", user.id);
      const { data: rows, error: e } = await journalQuery;

      if (cancelled) return;
      if (e) {
        setError(e.message);
        setEntries([]);
        setLoading(false);
        return;
      }

      const entryIds = (rows ?? []).map((r: { id: string }) => r.id);
      const entryToProfileIds: Record<string, string[]> = {};
      const entryToPhotoPaths: Record<string, string[]> = {};
      if (entryIds.length > 0) {
        const [jepRes, photosRes] = await Promise.all([
          supabase.from("journal_entry_plants").select("journal_entry_id, plant_profile_id").in("journal_entry_id", entryIds),
          supabase.from("journal_entry_photos").select("journal_entry_id, image_file_path, sort_order").in("journal_entry_id", entryIds).order("sort_order", { ascending: true }),
        ]);
        (jepRes.data ?? []).forEach((row: { journal_entry_id: string; plant_profile_id: string }) => {
          if (!entryToProfileIds[row.journal_entry_id]) entryToProfileIds[row.journal_entry_id] = [];
          entryToProfileIds[row.journal_entry_id].push(row.plant_profile_id);
        });
        (photosRes.data ?? []).forEach((row: { journal_entry_id: string; image_file_path: string }) => {
          if (!entryToPhotoPaths[row.journal_entry_id]) entryToPhotoPaths[row.journal_entry_id] = [];
          entryToPhotoPaths[row.journal_entry_id].push(row.image_file_path);
        });
      }

      const profileIds = new Set<string>();
      (rows ?? []).forEach((r: { plant_profile_id: string | null }) => {
        if (r.plant_profile_id) profileIds.add(r.plant_profile_id);
      });
      Object.values(entryToProfileIds).flat().forEach((id) => profileIds.add(id));
      const names: Record<string, string> = {};
      const displayNames: Record<string, string> = {};
      if (profileIds.size > 0) {
        const { data: profileRows } = await supabase.from("plant_profiles").select("id, name, variety_name").in("id", Array.from(profileIds)).is("deleted_at", null);
        (profileRows ?? []).forEach((p: { id: string; name: string; variety_name?: string | null }) => {
          names[p.id] = p.name;
          displayNames[p.id] = p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name;
        });
      }

      const withNames = (rows ?? []).map((r: JournalEntry & { plant_profile_id?: string | null }) => {
        const jepIds = entryToProfileIds[r.id] ?? [];
        const ids = jepIds.length > 0 ? jepIds : (r.plant_profile_id ? [r.plant_profile_id] : []);
        const plantNames = ids.map((id) => names[id] ?? "Unknown").filter((n) => n !== "Unknown" || ids.length === 0);
        const plantDisplayNames = ids.map((id) => displayNames[id] ?? names[id] ?? "General");
        const plant_name = plantDisplayNames[0] ?? "General";
        const plant_display_name = plant_name;
        const plant_profile_id = ids[0] ?? r.plant_profile_id ?? null;
        const photoPaths = entryToPhotoPaths[r.id] ?? (r.image_file_path ? [r.image_file_path] : []);
        return { ...r, plant_name, plant_display_name, plant_profile_id, plant_profile_ids: ids, plant_display_names: plantDisplayNames, photo_paths: photoPaths };
      });
      const filtered = withNames.filter((r: JournalEntryWithPlant & { plant_profile_ids?: string[] }) => {
        const ids = r.plant_profile_ids ?? (r.plant_profile_id ? [r.plant_profile_id] : []);
        if (ids.length === 0) return true;
        return ids.some((id) => (names as Record<string, string>)[id] != null);
      });
      setEntries(filtered);
      setLoading(false);
    }

    fetchJournal();
    return () => {
      cancelled = true;
    };
  }, [user?.id, householdViewMode, refetchTrigger]);

  const LONG_PRESS_MS = 500;
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const toggleRowSelection = useCallback((entryIds: string[]) => {
    setSelectedEntryIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = entryIds.every((id) => prevSet.has(id));
      if (allSelected) {
        entryIds.forEach((id) => prevSet.delete(id));
      } else {
        entryIds.forEach((id) => prevSet.add(id));
      }
      return Array.from(prevSet);
    });
  }, []);

  const getLongPressHandlers = useCallback(
    (entryIds: string[], plantProfileId?: string | null, ownerUserId?: string | null) => {
      const startLongPress = () => {
        longPressFiredRef.current = false;
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          longPressFiredRef.current = true;
          toggleRowSelection(entryIds);
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
          if (selectedEntryIds.length > 0) {
            e?.preventDefault?.();
            toggleRowSelection(entryIds);
          }
        },
      };
    },
    [clearLongPressTimer, toggleRowSelection, selectedEntryIds.length]
  );

  function requestBulkDelete(ids: string[]) {
    setDeleteConfirmEntryIds(ids);
  }

  async function requestBulkArchive(ids: string[]) {
    if (!user || ids.length === 0) return;
    setSelectionActionsOpen(false);
    setSelectedEntryIds((prev) => prev.filter((id) => !ids.includes(id)));
    const now = new Date().toISOString();
    for (const entryId of ids) {
      const { error: e } = await updateWithOfflineQueue("journal_entries", { deleted_at: now }, { id: entryId, user_id: user.id });
      if (e) {
        setError(e.message);
        return;
      }
    }
    setEntries((prev) => prev.filter((x) => !ids.includes(x.id)));
  }

  async function confirmBulkDeleteEntry() {
    if (!user || !deleteConfirmEntryIds?.length) return;
    const ids = deleteConfirmEntryIds;
    setDeleteConfirmEntryIds(null);
    setSelectedEntryIds((prev) => prev.filter((id) => !ids.includes(id)));
    const now = new Date().toISOString();
    for (const entryId of ids) {
      const { error: e } = await updateWithOfflineQueue("journal_entries", { deleted_at: now }, { id: entryId, user_id: user.id });
      if (e) {
        setError(e.message);
        return;
      }
    }
    setEntries((prev) => prev.filter((x) => !ids.includes(x.id)));
  }

  const isRowSelected = useCallback(
    (entryIds: string[]) => entryIds.length > 0 && entryIds.every((id) => selectedEntryIds.includes(id)),
    [selectedEntryIds]
  );

  if (loading) {
    return (
      <div className="px-6 pt-2 pb-6">
        <p className="text-muted text-sm mb-4">Notes and photos</p>
        <div className="rounded-2xl bg-white p-8 shadow-card border border-black/5 text-center text-black/60">
          Loading…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 pt-2 pb-6">
        <div className="rounded-2xl bg-white p-6 shadow-card border border-black/5">
          <p className="text-citrus font-medium">Could not load journal</p>
          <p className="text-sm text-black/60 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 px-6 pt-2 pb-24 min-h-[60vh] box-border">
      <div className="sticky top-11 z-30 -mx-6 px-6 pt-2 pb-3 mb-4 bg-paper border-b border-black/5">
        <div className="flex mb-3" role="tablist" aria-label="Journal view">
          <div className="inline-flex rounded-xl p-1 bg-neutral-100 gap-0.5" role="group">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "table"}
              onClick={() => {
                setViewMode("table");
                router.replace("/journal?view=table", { scroll: false });
              }}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${viewMode === "table" ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"}`}
              title="Table view"
              aria-label="Table view"
            >
              <TableIcon />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "grid"}
              onClick={() => {
                setViewMode("grid");
                router.replace("/journal?view=grid", { scroll: false });
              }}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${viewMode === "grid" ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"}`}
              title="Gallery view"
              aria-label="Gallery view"
            >
              <LayoutGridIcon />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "timeline"}
              onClick={() => {
                setViewMode("timeline");
                router.replace("/journal?view=timeline", { scroll: false });
              }}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${viewMode === "timeline" ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"}`}
              title="Timeline view"
              aria-label="Timeline view"
            >
              <TimelineIcon />
            </button>
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-card-lg bg-white p-8 shadow-card border border-black/5 text-center max-w-md mx-auto">
          <div className="flex justify-center mb-4" aria-hidden>
            <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="text-emerald-200" aria-hidden>
              <rect x="8" y="4" width="48" height="56" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="12" y="12" width="40" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
              <circle cx="32" cy="26" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
              <path d="M20 48h24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
          </div>
          <p className="text-slate-600 font-medium mb-2">No journal entries yet</p>
          <p className="text-sm text-slate-500 mb-4">
            {(() => {
              const prompts = [
                "What's looking green today? Take a photo of your first sprout!",
                "Capture today's progress. How did your plants change?",
                "Log a quick note—what did you water, harvest, or notice?",
                "Snap a photo of your garden. Small moments add up.",
                "What's blooming or growing? Document it.",
                "Quick check-in: how are your seedlings doing?",
                "Capture the light. Morning or evening—what do you see?",
              ];
              const day = new Date().getDay();
              return prompts[day % prompts.length];
            })()}
          </p>
          <p className="text-xs text-slate-400">Tap the + button below to add your first entry.</p>
        </div>
      ) : viewMode === "table" ? (
        <>
          {/* Mobile: card layout — no horizontal scroll */}
          <div className="sm:hidden space-y-3 pb-24 -mx-6 px-4">
            {tableRowsWithSections(groupEntriesForTable(entries)).map((item) => {
              if (item.type === "section") {
                return (
                  <h2 key={`section-${item.label}`} className="text-sm font-semibold text-slate-700 pt-2 first:pt-0 sticky top-11 bg-paper -mx-4 px-4 py-1 z-10">
                    {item.label}
                  </h2>
                );
              }
              const row = item.row;
              const rowId = row.entryIds[0];
              const isExpanded = expandedNoteId === rowId;
              const lp = getLongPressHandlers(row.entryIds, row.plant_profile_id, row.owner_user_id);
              const selected = isRowSelected(row.entryIds);
              return (
                <article
                  key={rowId}
                  className={`rounded-xl border bg-white p-4 shadow-card ${selected ? "ring-2 ring-emerald bg-emerald/5 border-emerald/30" : "border-black/10"}`}
                  {...(lp ? { onTouchStart: lp.onTouchStart, onTouchMove: lp.onTouchMove, onTouchEnd: lp.onTouchEnd, onTouchCancel: lp.onTouchCancel, onMouseDown: lp.onMouseDown, onMouseUp: lp.onMouseUp, onMouseLeave: lp.onMouseLeave } : {})}
                  onClick={lp?.handleClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lp?.handleClick(); } }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <time dateTime={row.date} className="text-sm text-black/80 shrink-0">
                      {new Date(row.date).toLocaleDateString()}
                    </time>
                    <span className="inline-flex items-center gap-1.5 text-black/80 shrink-0">
                      <ActionIcon icon={row.action.icon} />
                      <span className="text-sm font-medium">{row.action.label}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {row.plantNames.map((name, i) => {
                      const profileId = row.plant_profile_ids?.[i] ?? row.plant_profile_id;
                      const pillClass = "inline-flex items-center justify-center px-2 py-1 rounded-full bg-emerald/10 text-emerald-800 text-xs font-medium min-w-[44px] min-h-[44px]";
                      return profileId ? (
                        <Link
                          key={`${name}-${i}`}
                          href={`/vault/${profileId}?tab=journal`}
                          onClick={(e) => e.stopPropagation()}
                          className={pillClass}
                        >
                          {name}
                        </Link>
                      ) : (
                        <span key={`${name}-${i}`} className={pillClass}>{name}</span>
                      );
                    })}
                    {householdViewMode === "family" && row.owner_user_id && (
                      <OwnerBadge shorthand={getShorthandForUser(row.owner_user_id)} canEdit={canEditPage(row.owner_user_id ?? "", "journal")} size="xs" />
                    )}
                  </div>
                  {row.note ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        if (selectedEntryIds.length > 0) {
                          e.stopPropagation();
                          return;
                        }
                        setExpandedNoteId(isExpanded ? null : rowId);
                      }}
                      className="text-left w-full block text-sm text-black/90"
                    >
                      <span className={isExpanded ? "" : "line-clamp-3"} title={row.note}>
                        {row.note}
                      </span>
                    </button>
                  ) : (
                    <span className="text-sm text-black/40">—</span>
                  )}
                </article>
              );
            })}
          </div>
          {/* Desktop: table layout */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-black/10 bg-white -mx-6 px-6 pb-24">
            <table className="w-full min-w-[480px] text-sm border-collapse" role="grid" aria-label="Journal entries">
              <thead>
                <tr className="border-b border-black/10 bg-neutral-50/80">
                  <th className="text-left py-2.5 pr-3 text-xs font-semibold text-black/70 whitespace-nowrap w-[90px]">Date</th>
                  <th className="text-left py-2.5 pr-3 text-xs font-semibold text-black/70 whitespace-nowrap w-[100px]">Action</th>
                  <th className="text-left py-2.5 pr-3 text-xs font-semibold text-black/70 min-w-[120px]">Plants</th>
                  <th className="text-left py-2.5 pr-3 text-xs font-semibold text-black/70 min-w-[140px] max-w-[240px]">Note</th>
                </tr>
              </thead>
              <tbody>
                {tableRowsWithSections(groupEntriesForTable(entries)).map((item) => {
                  if (item.type === "section") {
                    return (
                      <tr key={`section-${item.label}`} className="bg-slate-100/80 border-b border-black/10">
                        <td colSpan={4} className="py-2 px-3 text-sm font-semibold text-slate-700 sticky top-0 bg-slate-100/95">
                          {item.label}
                        </td>
                      </tr>
                    );
                  }
                  const row = item.row;
                  const rowId = row.entryIds[0];
                  const isExpanded = expandedNoteId === rowId;
                  const lp = getLongPressHandlers(row.entryIds, row.plant_profile_id, row.owner_user_id);
                  const selected = isRowSelected(row.entryIds);
                  return (
                    <tr
                      key={rowId}
                      className={`border-b border-black/5 align-top ${selected ? "bg-emerald/10 ring-1 ring-emerald/30" : "hover:bg-black/[0.02]"}`}
                      {...(lp ? { onTouchStart: lp.onTouchStart, onTouchMove: lp.onTouchMove, onTouchEnd: lp.onTouchEnd, onTouchCancel: lp.onTouchCancel, onMouseDown: lp.onMouseDown, onMouseUp: lp.onMouseUp, onMouseLeave: lp.onMouseLeave } : {})}
                      onClick={lp?.handleClick}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lp?.handleClick(); } }}
                    >
                      <td className="py-2.5 pr-3 text-black/80 whitespace-nowrap">
                        <time dateTime={row.date}>{new Date(row.date).toLocaleDateString()}</time>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-black/80">
                          <ActionIcon icon={row.action.icon} />
                          <span>{row.action.label}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {row.plantNames.map((name, i) => {
                            const profileId = row.plant_profile_ids?.[i] ?? row.plant_profile_id;
                            const pillClass = "inline-flex items-center justify-center px-2 py-1 rounded-full bg-emerald/10 text-emerald-800 text-xs font-medium min-w-[44px] min-h-[44px]";
                            return profileId ? (
                              <Link
                                key={`${name}-${i}`}
                                href={`/vault/${profileId}?tab=journal`}
                                onClick={(e) => e.stopPropagation()}
                                className={pillClass}
                              >
                                {name}
                              </Link>
                            ) : (
                              <span key={`${name}-${i}`} className={pillClass}>{name}</span>
                            );
                          })}
                          {householdViewMode === "family" && row.owner_user_id && (
                            <OwnerBadge shorthand={getShorthandForUser(row.owner_user_id)} canEdit={canEditPage(row.owner_user_id ?? "", "journal")} size="xs" />
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 min-w-0">
                        {row.note ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              if (selectedEntryIds.length > 0) {
                                e.stopPropagation();
                                return;
                              }
                              setExpandedNoteId(isExpanded ? null : rowId);
                            }}
                            className="text-left w-full block min-w-0"
                          >
                            <span className={isExpanded ? "" : "line-clamp-2"} title={row.note}>
                              {row.note}
                            </span>
                          </button>
                        ) : (
                          <span className="text-black/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : viewMode === "timeline" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-24">
          {/* Plant gallery: click opens that plant's journal in vault; no blank photo placeholder */}
          {groupEntriesByPlant(entries).map((group) => {
            const firstWithImage = group.entries.find((e) => {
              const paths = (e as JournalEntryWithPlant & { photo_paths?: string[] })?.photo_paths ?? [];
              return paths.length > 0 || e.image_file_path || e.photo_url;
            });
            const thumbSrc = firstWithImage
              ? (() => {
                  const paths = (firstWithImage as JournalEntryWithPlant & { photo_paths?: string[] })?.photo_paths ?? [];
                  if (paths.length > 0) return supabase.storage.from("journal-photos").getPublicUrl(paths[0]).data.publicUrl;
                  if (firstWithImage.image_file_path) return supabase.storage.from("journal-photos").getPublicUrl(firstWithImage.image_file_path).data.publicUrl;
                  return firstWithImage.photo_url ?? null;
                })()
              : null;
            const href = group.profileId ? `/vault/${group.profileId}?tab=journal` : null;
            const card = (
              <div className="rounded-2xl bg-white border border-black/10 overflow-hidden shadow-card flex flex-col">
                {thumbSrc ? (
                  <div className="relative aspect-[4/3] bg-neutral-50 shrink-0">
                    <Image
                      src={thumbSrc}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 33vw"
                      unoptimized={thumbSrc.startsWith("data:") || !thumbSrc.includes("supabase.co")}
                    />
                  </div>
                ) : null}
                <div className="p-3 flex-1 flex flex-col justify-center">
                  <p className="text-sm font-semibold text-black/90 line-clamp-1">{group.plantName}</p>
                  <p className="text-xs text-black/50 mt-0.5">{group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}</p>
                </div>
              </div>
            );
            return (
              <div key={group.profileId ?? "__general__"}>
                {href ? (
                  <Link href={href} className="block min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-offset-2 rounded-2xl">
                    {card}
                  </Link>
                ) : (
                  <div className="opacity-90">{card}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-w-lg mx-auto pb-24">
          {/* Instagram-style feed: one card per (day, plant), photo then note */}
          {groupEntriesForTable(entries).map((row) => {
            const entry = entries.find((e) => e.id === row.entryIds[0]);
            const photoPaths = (entry as JournalEntryWithPlant & { photo_paths?: string[] })?.photo_paths ?? [];
            const imageUrls =
              photoPaths.length > 0
                ? photoPaths.map((p) => supabase.storage.from("journal-photos").getPublicUrl(p).data.publicUrl)
                : entry?.image_file_path
                  ? [supabase.storage.from("journal-photos").getPublicUrl(entry.image_file_path).data.publicUrl]
                  : entry?.photo_url
                    ? [entry.photo_url]
                    : [];
            const hasImages = imageUrls.length > 0;
            const rowId = row.entryIds[0];
            const lp = getLongPressHandlers(row.entryIds, row.plant_profile_id, row.owner_user_id);
            const selected = isRowSelected(row.entryIds);
            return (
              <article
                key={rowId}
                className={`rounded-2xl bg-white border overflow-hidden mb-6 shadow-card ${selected ? "ring-2 ring-emerald bg-emerald/5 border-emerald/30" : "border-black/10"}`}
                {...(lp ? { onTouchStart: lp.onTouchStart, onTouchMove: lp.onTouchMove, onTouchEnd: lp.onTouchEnd, onTouchCancel: lp.onTouchCancel, onMouseDown: lp.onMouseDown, onMouseUp: lp.onMouseUp, onMouseLeave: lp.onMouseLeave } : {})}
                onClick={lp?.handleClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lp?.handleClick(); } }}
              >
                {/* Photo only when present; no blank placeholder */}
                {hasImages && (
                  <div className="relative aspect-square bg-neutral-100">
                    {imageUrls.length === 1 ? (
                      <Image
                        src={imageUrls[0]}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 512px) 100vw, 512px"
                        unoptimized={imageUrls[0].startsWith("data:") || !imageUrls[0].includes("supabase.co")}
                      />
                    ) : (
                      <div className="flex overflow-x-auto snap-x snap-mandatory h-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {imageUrls.map((url, i) => (
                          <div key={i} className="relative shrink-0 w-full h-full snap-center">
                            <Image
                              src={url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="(max-width: 512px) 100vw, 512px"
                              loading={i === 0 ? "eager" : "lazy"}
                              unoptimized={url.startsWith("data:") || !url.includes("supabase.co")}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    {imageUrls.length > 1 && (
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5" aria-hidden>
                        {imageUrls.map((_, i) => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-sm" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Note and meta (text bubble when no photo) */}
                <div className="p-4">
                  {row.note && <p className="text-black/90 text-sm mb-3">{row.note}</p>}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {row.plantNames.map((name, i) => {
                        const profileId = row.plant_profile_ids?.[i] ?? row.plant_profile_id;
                        const pillClass = "inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium text-emerald-700 bg-emerald/10 min-w-[44px] min-h-[44px]";
                        return profileId ? (
                          <Link
                            key={`${name}-${i}`}
                            href={`/vault/${profileId}?tab=journal`}
                            onClick={(e) => e.stopPropagation()}
                            className={pillClass}
                          >
                            {name}
                          </Link>
                        ) : (
                          <span key={`${name}-${i}`} className={pillClass}>{name}</span>
                        );
                      })}
                      {householdViewMode === "family" && row.owner_user_id && (
                        <OwnerBadge shorthand={getShorthandForUser(row.owner_user_id)} canEdit={canEditPage(row.owner_user_id ?? "", "journal")} size="xs" />
                      )}
                    </div>
                    <time dateTime={row.date} className="text-xs text-black/50 shrink-0">
                      {new Date(row.date).toLocaleDateString()}
                    </time>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editEntryId && (() => {
        const entry = entries.find((e) => e.id === editEntryId) as (JournalEntryWithPlant & { photo_paths?: string[]; plant_profile_ids?: string[]; plant_display_names?: string[] }) | undefined;
        if (!entry) return null;
        return (
          <EditJournalModal
            entry={entry}
            onClose={() => setEditEntryId(null)}
            onSaved={() => {
              setRefetchTrigger((t) => t + 1);
              setEditEntryId(null);
            }}
            canEdit={canEditPage(entry.user_id ?? "", "journal")}
          />
        );
      })()}

      <button
        type="button"
        onClick={() => {
          if (selectedEntryIds.length > 0) {
            setSelectionActionsOpen(true);
          } else if (universalAddMenuOpen) {
            setUniversalAddMenuOpen(false);
          } else {
            setUniversalAddMenuOpen(true);
          }
        }}
        className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
          selectedEntryIds.length > 0 ? "bg-amber-500 text-white" : universalAddMenuOpen ? "bg-emerald-700 text-white" : "bg-emerald text-white"
        }`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={selectedEntryIds.length > 0 ? "Actions for selected" : universalAddMenuOpen ? "Close add menu" : "Add"}
      >
        {selectedEntryIds.length > 0 ? (
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
          pathname={pathname ?? "/journal"}
          onAddSeed={() => {
            setUniversalAddMenuOpen(false);
            setQuickAddSeedOpen(true);
          }}
          onAddPlantManual={(defaultType) => {
            setUniversalAddMenuOpen(false);
            setAddPlantDefaultType(defaultType);
            setShowAddPlantModal(true);
          }}
          onAddPlantFromVault={() => {
            skipPopOnNavigateRef.current = true;
            setUniversalAddMenuOpen(false);
            router.push("/vault/plant?from=journal");
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

      {quickAddSeedOpen && (
        <QuickAddSeed
          open={quickAddSeedOpen}
          onClose={() => setQuickAddSeedOpen(false)}
          onBackToMenu={() => {
            setQuickAddSeedOpen(false);
            setUniversalAddMenuOpen(true);
          }}
          onSuccess={() => setRefetchTrigger((t) => t + 1)}
          onOpenBatch={() => {
            setQuickAddSeedOpen(false);
            setBatchAddSeedOpen(true);
          }}
          onOpenLinkImport={() => {
            skipPopOnNavigateRef.current = true;
            setQuickAddSeedOpen(false);
            router.push("/vault/import?embed=1");
          }}
          onStartManualImport={() => {
            skipPopOnNavigateRef.current = true;
            setQuickAddSeedOpen(false);
            router.push("/vault/import/manual");
          }}
          onOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            setQuickAddSeedOpen(false);
            setPurchaseOrderMode("seed");
            setPurchaseOrderOpen(true);
          }}
        />
      )}

      {batchAddSeedOpen && (
        <BatchAddSeed
          open={batchAddSeedOpen}
          onClose={() => setBatchAddSeedOpen(false)}
          onSuccess={() => setRefetchTrigger((t) => t + 1)}
          onNavigateToHero={() => {
            skipPopOnNavigateRef.current = true;
            setBatchAddSeedOpen(false);
            router.push("/vault/import/photos/hero");
          }}
        />
      )}

      {shedQuickAddOpen && (
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
      )}

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

      {purchaseOrderOpen && (
        <PurchaseOrderImport
          open={purchaseOrderOpen}
          onClose={() => setPurchaseOrderOpen(false)}
          mode={purchaseOrderMode}
          defaultProfileType={purchaseOrderMode === "seed" ? "seed" : undefined}
        />
      )}

      {selectionActionsOpen && selectedEntryIds.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            aria-hidden
            onClick={() => setSelectionActionsOpen(false)}
          />
          <div
            className="fixed left-4 right-4 bottom-20 z-50 rounded-3xl bg-white border border-neutral-200/80 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="selection-actions-title"
          >
            <h2 id="selection-actions-title" className="text-xl font-bold text-center text-neutral-900 mb-1">
              {selectedEntryIds.length} selected
            </h2>
            <p className="text-sm text-neutral-500 text-center mb-4">Choose an action.</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setSelectionActionsOpen(false);
                  requestBulkDelete(selectedEntryIds);
                }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-citrus/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0">
                  <TrashIcon />
                </span>
                Trash
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectionActionsOpen(false);
                  requestBulkArchive(selectedEntryIds);
                }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0">
                  <ArchiveIcon />
                </span>
                Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectionActionsOpen(false);
                  const firstId = selectedEntryIds[0];
                  if (firstId) {
                    setSelectedEntryIds([]);
                    setEditEntryId(firstId);
                  }
                }}
                disabled={selectedEntryIds.length !== 1}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0">
                  <PencilEditIcon />
                </span>
                Edit {selectedEntryIds.length === 1 ? "entry" : "(select one)"}
              </button>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setSelectionActionsOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {deleteConfirmEntryIds && deleteConfirmEntryIds.length > 0 && (
        <div
          className="fixed bottom-24 left-4 right-4 z-50 max-w-md mx-auto rounded-xl bg-white border border-black/10 shadow-lg p-4 flex items-center justify-between gap-3"
          role="dialog"
          aria-live="polite"
          aria-label="Confirm delete"
        >
          <p className="text-sm font-medium text-black/80">
            Delete {deleteConfirmEntryIds.length} journal {deleteConfirmEntryIds.length === 1 ? "entry" : "entries"}?
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDeleteConfirmEntryIds(null)}
              className="min-w-[44px] min-h-[44px] px-4 rounded-lg border border-black/15 text-sm font-medium text-black/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmBulkDeleteEntry}
              className="min-w-[44px] min-h-[44px] px-4 rounded-lg bg-citrus text-white text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
    </svg>
  );
}

function PencilEditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
