"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PlantPlaceholderIcon } from "@/components/PlantPlaceholderIcon";
import { ICON_MAP } from "@/lib/styleDictionary";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useToast } from "@/hooks/useToast";
import { insertWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import type { GrowInstance, JournalEntry, Task, SupplyProfile } from "@/types/garden";
import type { BatchLogBatch } from "@/components/BatchLogSheet";
import dynamic from "next/dynamic";

const BatchLogSheet = dynamic(
  () => import("@/components/BatchLogSheet").then((m) => ({ default: m.BatchLogSheet })),
  { ssr: false }
);

export interface GrowInstanceModalProps {
  growId: string;
  onClose: () => void;
  /** When set, Back button navigates here then closes; otherwise just closes. */
  backHref?: string | null;
  /** When user taps Harvest in BatchLogSheet, close modal and open HarvestModal for this batch. */
  onLogHarvest?: (batch: BatchLogBatch) => void;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PlantProfileSummary {
  id: string;
  name: string;
  variety_name?: string | null;
  hero_image_url?: string | null;
  hero_image_path?: string | null;
  primary_image_path?: string | null;
}

type ActiveTab = "overview" | "history";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatAge(sowDate: string, endDate?: string | null): string {
  const start = new Date(sowDate + "T12:00:00");
  const finish = endDate ? new Date(endDate + "T12:00:00") : new Date();
  const diffMs = finish.getTime() - start.getTime();
  if (diffMs < 0) return "Not yet planted";
  const days = Math.floor(diffMs / 86400000);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.floor(days / 7)} wk${Math.floor(days / 7) === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} mo`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years} yr ${remMonths} mo` : `${years} yr`;
}

function formatShortDate(value: string | null | undefined): string {
  if (value == null || String(value).trim() === "") return "—";
  const d = new Date(value.includes("T") ? value : value + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysFromToday(dateStr: string): number {
  const target = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function statusColors(status: string | null | undefined): string {
  switch (status) {
    case "growing": return "bg-emerald-100 text-emerald-800";
    case "pending": return "bg-blue-100 text-blue-800";
    case "harvested": return "bg-amber-100 text-amber-800";
    case "dead": return "bg-red-100 text-red-800";
    case "archived": return "bg-neutral-100 text-neutral-600";
    default: return "bg-neutral-100 text-neutral-600";
  }
}

function TASK_CATEGORY_LABELS(cat: string): string {
  const map: Record<string, string> = {
    water: "Watered",
    fertilize: "Fertilized",
    prune: "Pruned",
    pest: "Pest treatment",
    harvest: "Harvested",
    transplant: "Transplanted",
    sow: "Sowed",
    other: "Care",
  };
  return map[cat] ?? cat;
}

function ENTRY_TYPE_LABELS(type: string | null | undefined): string {
  const map: Record<string, string> = {
    planting: "Planted",
    growth: "Growth update",
    harvest: "Harvested",
    note: "Note",
    care: "Care",
    pest: "Pest treatment",
    death: "Plant died",
    quick: "Quick log",
  };
  return map[type ?? ""] ?? "Journal entry";
}

function getJournalImageUrl(entry: JournalEntry): string | null {
  if (entry.image_file_path) {
    return supabase.storage.from("journal-photos").getPublicUrl(entry.image_file_path).data.publicUrl;
  }
  return entry.photo_url ?? null;
}

function isPlaceholderHeroUrl(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return true;
  return u === "/seedling-icon.svg" || u.endsWith("/seedling-icon.svg");
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function GrowInstanceModal({ growId, onClose, backHref, onLogHarvest }: GrowInstanceModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const instanceId = growId;

  const [grow, setGrow] = useState<GrowInstance | null>(null);
  const [profile, setProfile] = useState<PlantProfileSummary | null>(null);
  const [packetImagePath, setPacketImagePath] = useState<string | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [tasks, setTasks] = useState<(Task & { plant_name?: string })[]>([]);
  const [supplyMap, setSupplyMap] = useState<Record<string, SupplyProfile>>({});
  const [entrySupplyIds, setEntrySupplyIds] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [batchLogOpen, setBatchLogOpen] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    if (!user || !instanceId) return;
    setLoading(true);
    setError(null);
    try {
      // Grow instance — allow household reads (no hard user_id filter so shared plants show)
      const { data: growData, error: growErr } = await supabase
        .from("grow_instances")
        .select("*")
        .eq("id", instanceId)
        .is("deleted_at", null)
        .single();

      if (growErr || !growData) { setError("Plant not found."); setLoading(false); return; }
      setGrow(growData as GrowInstance);

      // Linked seed packet image (fallback when profile has no hero)
      let packetPath: string | null = null;
      if (growData.seed_packet_id) {
        const { data: pkt } = await supabase
          .from("seed_packets")
          .select("primary_image_path")
          .eq("id", growData.seed_packet_id)
          .is("deleted_at", null)
          .single();
        const p = (pkt as { primary_image_path?: string | null } | null)?.primary_image_path?.trim();
        if (p) packetPath = p;
      }
      if (!packetPath && growData.plant_profile_id) {
        const { data: pkts } = await supabase
          .from("seed_packets")
          .select("primary_image_path")
          .eq("plant_profile_id", growData.plant_profile_id)
          .is("deleted_at", null)
          .not("primary_image_path", "is", null)
          .order("created_at", { ascending: true })
          .limit(1);
        const p = (pkts?.[0] as { primary_image_path?: string } | undefined)?.primary_image_path?.trim();
        if (p) packetPath = p;
      }
      setPacketImagePath(packetPath);

      // Plant profile
      if (growData.plant_profile_id) {
        const { data: profileData } = await supabase
          .from("plant_profiles")
          .select("id, name, variety_name, hero_image_url, hero_image_path, primary_image_path")
          .eq("id", growData.plant_profile_id)
          .single();
        if (profileData) setProfile(profileData as PlantProfileSummary);
      }

      // Journal entries for this grow (all types, ordered newest first)
      const { data: journalData } = await supabase
        .from("journal_entries")
        .select("id, plant_profile_id, grow_instance_id, seed_packet_id, note, photo_url, image_file_path, weather_snapshot, entry_type, harvest_weight, harvest_unit, harvest_quantity, created_at, user_id, supply_profile_id, deleted_at")
        .eq("grow_instance_id", instanceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      const entries = (journalData ?? []) as JournalEntry[];
      setJournalEntries(entries);

      // journal_entry_supplies for multi-supply (read when present, else fall back to supply_profile_id)
      const entryIds = entries.map((e) => e.id);
      let entrySupplyIds: Record<string, string[]> = {};
      if (entryIds.length > 0) {
        const { data: jesData } = await supabase
          .from("journal_entry_supplies")
          .select("journal_entry_id, supply_profile_id")
          .in("journal_entry_id", entryIds);
        for (const row of jesData ?? []) {
          const eid = (row as { journal_entry_id: string }).journal_entry_id;
          const sid = (row as { supply_profile_id: string }).supply_profile_id;
          if (!entrySupplyIds[eid]) entrySupplyIds[eid] = [];
          entrySupplyIds[eid].push(sid);
        }
      }
      setEntrySupplyIds(entrySupplyIds);

      // Tasks for this grow
      const { data: taskData } = await supabase
        .from("tasks")
        .select("id, title, category, due_date, completed_at, created_at, grow_instance_id, plant_profile_id, care_schedule_id, user_id")
        .eq("grow_instance_id", instanceId)
        .is("deleted_at", null)
        .order("due_date", { ascending: true });
      setTasks((taskData ?? []) as (Task & { plant_name?: string })[]);

      // Supply profiles referenced by journal entries (from journal_entry_supplies or supply_profile_id)
      const supplyIdsFromEntries = entries.flatMap((e) => {
        const fromJes = entrySupplyIds[e.id];
        if (fromJes?.length) return fromJes;
        return e.supply_profile_id ? [e.supply_profile_id] : [];
      });
      const supplyIds = [...new Set(supplyIdsFromEntries)];
      if (supplyIds.length > 0) {
        const { data: supplyData } = await supabase
          .from("supply_profiles")
          .select("id, name, brand, category")
          .in("id", supplyIds);
        const map: Record<string, SupplyProfile> = {};
        for (const s of supplyData ?? []) map[s.id] = s as SupplyProfile;
        setSupplyMap(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plant.");
    } finally {
      setLoading(false);
    }
  }, [user, instanceId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (editingLocation && locationInputRef.current) locationInputRef.current.focus(); }, [editingLocation]);

  // ---------------------------------------------------------------------------
  // Back navigation
  // ---------------------------------------------------------------------------
  const handleBack = useCallback(() => {
    if (backHref) router.push(backHref);
    onClose();
  }, [backHref, onClose, router]);

  const handleGoToVault = useCallback(() => {
    onClose();
    if (profile?.id) router.push(`/vault/${profile.id}`);
  }, [profile?.id, onClose, router]);

  useEscapeKey(true, onClose);
  const trapRef = useFocusTrap(true);

  // ---------------------------------------------------------------------------
  // Hero image (Law 7 for this grow: journal → profile hero → profile packet → sprout)
  // ---------------------------------------------------------------------------
  function heroImageUrl(): string | null {
    // 1. Latest journal photo for this grow
    const firstWithPhoto = journalEntries.find((e) => e.image_file_path || e.photo_url);
    if (firstWithPhoto) return getJournalImageUrl(firstWithPhoto);
    // 2. Plant profile hero_image_path (journal-photos bucket)
    if (profile?.hero_image_path?.trim()) {
      return supabase.storage.from("journal-photos").getPublicUrl(profile.hero_image_path.trim()).data.publicUrl;
    }
    // 3. Plant profile hero_image_url (external)
    if (!isPlaceholderHeroUrl(profile?.hero_image_url)) return profile?.hero_image_url ?? null;
    // 4. Plant profile packet image (primary_image_path in seed-packets bucket)
    if (profile?.primary_image_path?.trim()) {
      return supabase.storage.from("seed-packets").getPublicUrl(profile.primary_image_path.trim()).data.publicUrl;
    }
    // 5. Linked or profile packet image (from seed_packets)
    if (packetImagePath) {
      return supabase.storage.from("seed-packets").getPublicUrl(packetImagePath).data.publicUrl;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Stats — next milestone
  // ---------------------------------------------------------------------------
  function nextMilestone(): string | null {
    const parts: string[] = [];

    if (grow?.expected_harvest_date) {
      const days = daysFromToday(grow.expected_harvest_date);
      if (days > 0) {
        parts.push(`Harvest in ~${days}d`);
      }
    }

    const nextTask = tasks.find((t) => !t.completed_at && t.due_date);
    if (nextTask?.due_date) {
      const label = (nextTask.title ?? TASK_CATEGORY_LABELS(nextTask.category)).trim();
      const dueLabel = formatShortDate(nextTask.due_date);
      if (dueLabel !== "—") parts.push(`Next: ${label} ${dueLabel}`);
    }

    return parts.length > 0 ? parts.join(" · ") : null;
  }

  // ---------------------------------------------------------------------------
  // Last fertilized
  // ---------------------------------------------------------------------------
  function lastFertilized(): { date: string; productName: string | null } | null {
    const fertEntry = journalEntries.find((e) => {
      const ids = entrySupplyIds[e.id] ?? (e.supply_profile_id ? [e.supply_profile_id] : []);
      const hasFert = ids.some((sid) => supplyMap[sid]?.category === "fertilizer");
      return e.entry_type === "care" || hasFert;
    });
    if (!fertEntry) return null;
    const ids = entrySupplyIds[fertEntry.id] ?? (fertEntry.supply_profile_id ? [fertEntry.supply_profile_id] : []);
    const fertSupply = ids.find((sid) => supplyMap[sid]?.category === "fertilizer") ?? ids[0];
    const supply = fertSupply ? supplyMap[fertSupply] : null;
    const productName = supply ? [supply.brand, supply.name].filter(Boolean).join(" ") || supply.name : null;
    return { date: fertEntry.created_at, productName };
  }

  // ---------------------------------------------------------------------------
  // Last watered (from quick journal entries with "watered" in note)
  // ---------------------------------------------------------------------------
  function lastWatered(): string | null {
    const wateredEntry = journalEntries.find(
      (e) => e.entry_type === "quick" && (e.note ?? "").toLowerCase().includes("watered")
    );
    return wateredEntry?.created_at ?? null;
  }

  // ---------------------------------------------------------------------------
  // Save location
  // ---------------------------------------------------------------------------
  async function saveLocation() {
    if (!grow || !user) return;
    setSavingLocation(true);
    const { error: err } = await supabase
      .from("grow_instances")
      .update({ location: locationDraft.trim() || null })
      .eq("id", grow.id)
      .eq("user_id", user.id);
    setSavingLocation(false);
    if (!err) {
      setGrow((g) => g ? { ...g, location: locationDraft.trim() || null } : g);
      setEditingLocation(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Archive
  // ---------------------------------------------------------------------------
  async function handleArchive() {
    if (!grow || !user) return;
    setArchiveSaving(true);
    const now = new Date().toISOString();
    const { error: err } = await supabase
      .from("grow_instances")
      .update({ status: "archived", ended_at: now, end_reason: "archived" })
      .eq("id", grow.id)
      .eq("user_id", user.id);
    setArchiveSaving(false);
    if (!err) {
      showToast("Archived");
      setArchiveOpen(false);
      if (backHref) router.push(backHref);
      onClose();
    }
  }

  const handleQuickCare = useCallback(
    async (batch: BatchLogBatch, action: "water" | "fertilize" | "spray") => {
      if (!user?.id) return;
      const notes: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };
      const weather = await fetchWeatherSnapshot();
      const { error: err } = await insertWithOfflineQueue("journal_entries", {
        user_id: user.id,
        plant_profile_id: batch.plant_profile_id,
        grow_instance_id: batch.id,
        note: notes[action],
        entry_type: "quick",
        weather_snapshot: weather ?? undefined,
      });
      if (!err) {
        showToast(notes[action]);
        loadData();
      }
    },
    [user?.id, showToast, loadData]
  );

  const handleBatchLogSaved = useCallback(() => {
    showToast("Saved");
    loadData();
  }, [showToast, loadData]);

  const handleDeleteJournalEntry = useCallback(
    async (entryId: string) => {
      if (!user?.id) return;
      const now = new Date().toISOString();
      const { error: err } = await updateWithOfflineQueue("journal_entries", { deleted_at: now }, { id: entryId, user_id: user.id });
      if (!err) {
        setJournalEntries((prev) => prev.filter((x) => x.id !== entryId));
        showToast("Entry deleted");
      }
    },
    [user?.id, showToast]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string, taskUserId: string) => {
      if (!user?.id) return;
      const now = new Date().toISOString();
      const { error: err } = await updateWithOfflineQueue("tasks", { deleted_at: now }, { id: taskId, user_id: taskUserId });
      if (!err) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        showToast("Task deleted");
      }
    },
    [user?.id, showToast]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <>
        <div className="fixed inset-0 z-[80] bg-black/40" aria-hidden onClick={onClose} />
        <div className="fixed inset-0 z-[81] flex items-center justify-center bg-neutral-50">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (error || !grow) {
    return (
      <>
        <div className="fixed inset-0 z-[80] bg-black/40" aria-hidden onClick={onClose} />
        <div className="fixed inset-0 z-[81] overflow-auto bg-neutral-50 p-6 pb-24">
          <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 text-emerald-600 hover:underline mb-4 min-h-[44px]">
            <ICON_MAP.ChevronDown className="w-4 h-4 rotate-90" />
            Back
          </button>
          <p className="text-red-600">{error ?? "Plant not found."}</p>
        </div>
      </>
    );
  }

  const heroUrl = heroImageUrl();
  const milestone = nextMilestone();
  const fertInfo = lastFertilized();
  const lastWateredAt = lastWatered();
  const canEdit = grow.user_id === user?.id;
  const germinationLabel =
    grow.seeds_sown != null && grow.seeds_sown > 0
      ? grow.seeds_sprouted != null
        ? `${grow.seeds_sprouted}/${grow.seeds_sown} sprouted`
        : "0 sprouted"
      : grow.seeds_sprouted != null
        ? `${grow.seeds_sprouted} sprouted`
        : null;

  // Days to germinate (sprout_date - sown_date) when sprout_date exists
  const daysToGerminate =
    grow.sprout_date && grow.sown_date
      ? (() => {
          const sow = new Date(grow.sown_date + "T12:00:00").getTime();
          const sprout = new Date(grow.sprout_date + "T12:00:00").getTime();
          const days = Math.round((sprout - sow) / 86400000);
          return days >= 0 ? days : null;
        })()
      : null;

  const toBatchLogBatch = (): BatchLogBatch => ({
    id: grow.id,
    plant_profile_id: grow.plant_profile_id ?? "",
    profile_name: profile?.name ?? "Plant",
    profile_variety_name: profile?.variety_name ?? null,
    seeds_sown: grow.seeds_sown ?? null,
    seeds_sprouted: grow.seeds_sprouted ?? null,
    plant_count: grow.plant_count ?? null,
    location: grow.location ?? null,
    user_id: grow.user_id ?? null,
  });

  const displayTitle = profile
    ? (profile.variety_name?.trim() ? `${profile.name} (${profile.variety_name})` : profile.name)
    : "Plant";

  const sowBadge =
    grow.sow_method === "direct_sow" ? "Direct sow"
    : grow.sow_method === "seed_start" ? "Seed start"
    : null;

  // Journal entries with photos (for gallery, newest first)
  const photoEntries = journalEntries.filter((e) => e.image_file_path || e.photo_url);

  // Timeline: all journal entries + completed tasks merged, sorted newest first
  type TimelineItem =
    | { kind: "journal"; entry: JournalEntry }
    | { kind: "task"; task: Task & { plant_name?: string } };

  const toTime = (v: string | null | undefined) => {
    if (v == null || String(v).trim() === "") return 0;
    const t = new Date(v.includes("T") ? v : v + "T12:00:00").getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  const timelineItems: TimelineItem[] = [
    ...journalEntries.map((e) => ({ kind: "journal" as const, entry: e })),
    ...tasks.filter((t) => t.completed_at).map((t) => ({ kind: "task" as const, task: t })),
  ].sort((a, b) => {
    const aDate = a.kind === "journal" ? a.entry.created_at : (a.task.completed_at ?? a.task.due_date);
    const bDate = b.kind === "journal" ? b.entry.created_at : (b.task.completed_at ?? b.task.due_date);
    return toTime(bDate) - toTime(aDate);
  });

  return (
    <>
      {toast}
      <div className="fixed inset-0 z-[80] bg-black/40" aria-hidden onClick={onClose} />
      <div ref={trapRef} className="fixed inset-0 z-[81] flex flex-col overflow-hidden bg-neutral-50">
        <div className="flex-1 overflow-auto pb-28 min-h-0">
      {/* ------------------------------------------------------------------ */}
      {/* HERO — full-bleed from top; minimal controls overlay; serif name + age */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative w-full h-[240px] bg-neutral-100 overflow-hidden shrink-0">
        {heroUrl ? (
          <img src={heroUrl} alt={displayTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlantPlaceholderIcon size="lg" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        {/* Minimal header overlay: back, About variety, Log, Archive */}
        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-2 py-2 z-10">
          <button
            type="button"
            onClick={handleBack}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/95 hover:bg-white/20 -ml-1"
            aria-label="Back"
          >
            <ICON_MAP.ChevronDown className="w-5 h-5 rotate-90" />
          </button>
          <div className="flex-1 min-w-0" />
          {profile && (
            <Link
              href={`/vault/${profile.id}`}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/95 hover:bg-white/20 text-xs font-medium shrink-0"
              aria-label="View plant profile"
            >
              About
            </Link>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setBatchLogOpen(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/90 text-emerald-800 hover:bg-white font-medium text-sm px-3 shrink-0"
              aria-label="Log care, germination, or harvest"
            >
              Log
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setArchiveOpen(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/95 hover:bg-white/20"
              aria-label="Archive this plant"
            >
              <ICON_MAP.Trash className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-4">
          <h1 className="font-serif text-white text-xl leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
            {displayTitle}
          </h1>
          <p className="font-serif text-white/95 text-sm mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            {formatAge(grow.sown_date, grow.ended_at)}
          </p>
          {grow.location?.trim() ? (
            <p className="font-serif text-white/80 text-xs mt-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
              {grow.location.trim()}
            </p>
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* VITALITY BAR — horizontal scroll */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border-b border-neutral-100 overflow-x-auto">
        <div className="flex gap-0 divide-x divide-neutral-100 px-2 py-1 min-w-max">
          {/* Age */}
          <div className="flex flex-col items-center px-4 py-2 min-w-[80px]">
            <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wide">Age</span>
            <span className="text-sm font-semibold text-neutral-900 mt-0.5 text-center">{formatAge(grow.sown_date, grow.ended_at)}</span>
          </div>
          {/* Status */}
          <div className="flex flex-col items-center px-4 py-2 min-w-[80px]">
            <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wide">Status</span>
            <span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors(grow.status)}`}>
              {grow.status ?? "unknown"}
            </span>
          </div>
          {/* Germination */}
          {germinationLabel && (
            <div className="flex flex-col items-center px-4 py-2 min-w-[120px]">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wide">Germination</span>
              <span className="text-xs font-medium text-emerald-700 mt-0.5 text-center">{germinationLabel}</span>
            </div>
          )}
          {/* Days to germinate (when sprout_date exists) */}
          {daysToGerminate != null && (
            <div className="flex flex-col items-center px-4 py-2 min-w-[90px]">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wide">Germinated in</span>
              <span className="text-xs font-medium text-neutral-700 mt-0.5 text-center">{daysToGerminate} days</span>
            </div>
          )}
          {/* Next milestone */}
          {milestone && (
            <div className="flex flex-col items-center px-4 py-2 min-w-[120px] max-w-[200px]">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wide">Milestone</span>
              <span className="text-xs font-medium text-emerald-700 mt-0.5 text-center leading-tight">{milestone}</span>
            </div>
          )}
          {/* Last watered */}
          {lastWateredAt && (
            <div className="flex flex-col items-center px-4 py-2 min-w-[90px]">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wide">Last watered</span>
              <span className="text-xs font-medium text-neutral-700 mt-0.5 text-center">{formatShortDate(lastWateredAt)}</span>
            </div>
          )}
          {/* Location */}
          <div className="flex flex-col items-center px-4 py-2 min-w-[90px]">
            <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wide">Location</span>
            {canEdit && editingLocation ? (
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  ref={locationInputRef}
                  type="text"
                  value={locationDraft}
                  onChange={(e) => setLocationDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveLocation(); if (e.key === "Escape") setEditingLocation(false); }}
                  className="text-xs border border-emerald-400 rounded px-1 py-0.5 w-24 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. Back patio"
                  maxLength={60}
                />
                <button type="button" onClick={saveLocation} disabled={savingLocation} className="text-emerald-600 hover:text-emerald-800 min-w-[24px] min-h-[24px] flex items-center justify-center" aria-label="Save location">
                  {savingLocation ? <span className="w-3 h-3 border border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <span className="text-xs font-semibold">✓</span>}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={canEdit ? () => { setLocationDraft(grow.location ?? ""); setEditingLocation(true); } : undefined}
                className={`text-xs font-medium mt-0.5 text-center min-h-[24px] ${canEdit ? "text-emerald-700 hover:text-emerald-900 hover:underline" : "text-neutral-700"}`}
                aria-label={canEdit ? "Edit location" : undefined}
              >
                {grow.location?.trim() || (canEdit ? "Add location" : "—")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TABS                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border-b border-neutral-100 sticky top-0 z-10">
        <div className="flex">
          {(["overview", "history"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors min-h-[44px] border-b-2 ${activeTab === tab ? "border-emerald-600 text-emerald-700" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}
            >
              {tab === "history" ? "Task History" : "Overview"}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB CONTENT                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-4 pt-4 space-y-3">

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            {/* Key facts */}
            <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs font-semibold text-neutral-500 uppercase w-28 shrink-0">Date planted</span>
                <span className="text-sm text-neutral-900">{formatShortDate(grow.sown_date)}</span>
              </div>
              {grow.location?.trim() && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-semibold text-neutral-500 uppercase w-28 shrink-0">Location</span>
                  <span className="text-sm text-neutral-900">{grow.location.trim()}</span>
                </div>
              )}
              {sowBadge && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-semibold text-neutral-500 uppercase w-28 shrink-0">Sow method</span>
                  <span className="text-sm text-neutral-900">{sowBadge}</span>
                </div>
              )}
              {grow.plant_count != null && grow.plant_count > 0 && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-semibold text-neutral-500 uppercase w-28 shrink-0">Plant count</span>
                  <span className="text-sm text-neutral-900">{grow.plant_count}</span>
                </div>
              )}
              {grow.vendor?.trim() && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-semibold text-neutral-500 uppercase w-28 shrink-0">From</span>
                  <span className="text-sm text-neutral-900">{grow.vendor.trim()}</span>
                </div>
              )}
              {grow.expected_harvest_date && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-semibold text-neutral-500 uppercase w-28 shrink-0">Est. harvest</span>
                  <span className="text-sm text-neutral-900">{formatShortDate(grow.expected_harvest_date)}</span>
                </div>
              )}
              {fertInfo && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-semibold text-neutral-500 uppercase w-28 shrink-0">Last fertilized</span>
                  <span className="text-sm text-neutral-900">
                    {formatShortDate(fertInfo.date)}
                    {fertInfo.productName && <span className="text-neutral-500"> · {fertInfo.productName}</span>}
                  </span>
                </div>
              )}
            </div>

            {/* Photo gallery — vertical, this grow only */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <p className="text-xs font-semibold uppercase text-neutral-500 mb-3">Photos</p>
              {photoEntries.length > 0 ? (
                <div className="space-y-2">
                  {photoEntries.map((e) => {
                    const url = getJournalImageUrl(e);
                    if (!url) return null;
                    return (
                      <div key={e.id} className="rounded-lg overflow-hidden bg-neutral-100">
                        <img src={url} alt="" className="w-full object-cover max-h-64" />
                        <div className="px-2 py-1.5 flex items-center gap-2">
                          <span className="text-xs text-neutral-500">{formatShortDate(e.created_at)}</span>
                          {e.note?.trim() && <span className="text-xs text-neutral-600 truncate">{e.note.trim()}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-neutral-500">No photos yet.</p>
                  <p className="text-xs text-neutral-400 mt-1">Photos from journal entries linked to this plant will appear here.</p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setBatchLogOpen(true)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 min-h-[44px] min-w-[44px]"
                    >
                      Add photo
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* TASK HISTORY TAB */}
        {activeTab === "history" && (
          <>
            {/* Last fertilized card (if present) */}
            {fertInfo && (
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 flex items-start gap-3">
                <span className="text-xl shrink-0" aria-hidden>🌿</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-800 uppercase">Last fertilized</p>
                  <p className="text-sm text-emerald-900 font-medium mt-0.5">
                    {formatShortDate(fertInfo.date)}
                    {fertInfo.productName && <span className="font-normal text-emerald-700"> · {fertInfo.productName}</span>}
                  </p>
                </div>
              </div>
            )}

            {timelineItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                <p className="text-neutral-500 text-sm">No history yet.</p>
                <p className="text-neutral-400 text-xs mt-1">Journal entries and completed tasks will appear here.</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-emerald-900/20 rounded-full" aria-hidden />
                <ul className="space-y-3 relative">
                  {timelineItems.map((item, idx) => {
                    if (item.kind === "journal") {
                      const e = item.entry;
                      const imgUrl = getJournalImageUrl(e);
                      const supplyIdsForEntry = entrySupplyIds[e.id] ?? (e.supply_profile_id ? [e.supply_profile_id] : []);
                      const supplyNames = supplyIdsForEntry
                        .map((sid) => supplyMap[sid])
                        .filter(Boolean)
                        .map((s) => [s!.brand, s!.name].filter(Boolean).join(" ") || s!.name);
                      const supplyName = supplyNames.length > 0 ? supplyNames.join(", ") : null;
                      return (
                        <li key={`j-${e.id}`} className="flex gap-3 pl-1">
                          {/* dot */}
                          <div className="shrink-0 w-10 flex flex-col items-center pt-1">
                            <div className="w-4 h-4 rounded-full bg-emerald-900 border-2 border-white shadow-sm z-10 relative" />
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-neutral-200 p-3 mb-0.5 min-w-0 flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-semibold text-neutral-700">{ENTRY_TYPE_LABELS(e.entry_type)}</span>
                                <span className="text-xs text-neutral-400">{formatShortDate(e.created_at)}</span>
                                {supplyName && <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full">{supplyName}</span>}
                              </div>
                              {e.note?.trim() && <p className="text-sm text-neutral-700 break-words">{e.note.trim()}</p>}
                              {imgUrl && (
                                <img src={imgUrl} alt="" className="mt-2 rounded-lg w-full max-h-40 object-cover" />
                              )}
                            </div>
                            {canEdit && e.user_id === user?.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteJournalEntry(e.id)}
                                className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                aria-label="Delete entry"
                              >
                                <ICON_MAP.Trash className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    } else {
                      const t = item.task;
                      const label = (t.title ?? TASK_CATEGORY_LABELS(t.category)).trim() || TASK_CATEGORY_LABELS(t.category);
                      return (
                        <li key={`t-${t.id}-${idx}`} className="flex gap-3 pl-1">
                          <div className="shrink-0 w-10 flex flex-col items-center pt-1">
                            <div className="w-4 h-4 rounded-full bg-emerald-200 border-2 border-emerald-900/40 shadow-sm z-10 relative flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-900/60" aria-hidden />
                            </div>
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-neutral-200 p-3 mb-0.5 min-w-0 flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-neutral-700">{label}</span>
                                <span className="text-xs text-neutral-400">
                                  {t.completed_at ? formatShortDate(t.completed_at) : `Due ${formatShortDate(t.due_date)}`}
                                </span>
                                <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">completed</span>
                              </div>
                            </div>
                            {canEdit && (t as Task & { user_id?: string }).user_id === user?.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(t.id, (t as Task & { user_id?: string }).user_id ?? user!.id)}
                                className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                aria-label="Delete task"
                              >
                                <ICON_MAP.Trash className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    }
                  })}
                </ul>
              </div>
            )}
          </>
        )}

      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BOTTOM NAV: Navigate to Vault (plant profile) / Navigate to Garden    */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-4 pb-8 pt-4 border-t border-neutral-100 bg-white">
        <div className="flex gap-2">
          {profile && (
            <button
              type="button"
              onClick={handleGoToVault}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100"
            >
              <ICON_MAP.Seedling className="w-4 h-4 shrink-0" />
              To Vault
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50"
          >
            <ICON_MAP.Plant className="w-4 h-4 shrink-0" />
            To Garden
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ARCHIVE CONFIRM DIALOG                                              */}
      {/* ------------------------------------------------------------------ */}
      {archiveOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => setArchiveOpen(false)} />
          <div className="fixed left-4 right-4 bottom-4 z-[101] bg-white rounded-2xl shadow-xl p-5 mx-auto max-w-sm">
            <h2 className="font-semibold text-neutral-900 text-base mb-1">Archive this plant?</h2>
            <p className="text-sm text-neutral-500 mb-4">
              The plant will be marked as archived and will stay in your history. You can review it later in archived plantings.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setArchiveOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-neutral-300 text-neutral-700 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiveSaving}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {archiveSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
                Archive
              </button>
            </div>
          </div>
        </>
      )}

        </div>
      </div>

      {/* BatchLogSheet for Log button */}
      <BatchLogSheet
        open={batchLogOpen}
        batches={grow && profile ? [toBatchLogBatch()] : []}
        onClose={() => setBatchLogOpen(false)}
        onSaved={handleBatchLogSaved}
        onLogHarvest={(batch) => {
          setBatchLogOpen(false);
          onLogHarvest?.(batch);
        }}
        onQuickCare={(batch, action) => {
          handleQuickCare(batch, action);
          setBatchLogOpen(false);
        }}
        isPermanent={grow?.is_permanent_planting === true}
      />
    </>
  );
}
