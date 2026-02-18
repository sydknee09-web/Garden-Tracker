"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { fetchWeatherSnapshot, formatWeatherBadge } from "@/lib/weatherSnapshot";
import type { JournalEntry } from "@/types/garden";
import type { GrowInstance } from "@/types/garden";
import { compressImage } from "@/lib/compressImage";

type JournalEntryWithPlant = JournalEntry & {
  plant_name?: string;
  plant_display_name?: string; // e.g. "Tomato (Roma)"
  plant_profile_id?: string | null;
  weather_snapshot?: JournalEntry["weather_snapshot"];
};

const GENERAL_OPTION = { id: "", name: "General Garden Note (923 Capri Drive)", variety_name: null as string | null };

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

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mobileKeywords = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const narrowScreen = typeof window !== "undefined" && window.innerWidth < 768;
  return (hasTouch && mobileKeywords.test(ua)) || narrowScreen || (navigator as Navigator & { standalone?: boolean }).standalone === true;
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

/** Group entries by same plant + same day so one row per (date, plant). */
function groupEntriesForTable(entries: JournalEntryWithPlant[]): { date: string; note: string | null; action: ActionInfo; plantNames: string[]; entryIds: string[]; plant_profile_id: string | null }[] {
  const dateStr = (e: JournalEntryWithPlant) => e.created_at.slice(0, 10);
  const plantKey = (e: JournalEntryWithPlant) => e.plant_profile_id ?? e.plant_variety_id ?? "__general__";
  const key = (e: JournalEntryWithPlant) => `${dateStr(e)}|${plantKey(e)}`;
  const map = new Map<string, JournalEntryWithPlant[]>();
  for (const e of entries) {
    const k = key(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(e);
  }
  const rows = Array.from(map.values()).map((group) => {
    group.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const first = group[0];
    const plantNames = Array.from(new Set(group.map((e) => (e as JournalEntryWithPlant).plant_display_name ?? e.plant_name ?? "General")));
    const notes = group.map((e) => e.note);
    const note = combineNotes(notes);
    const action = getActionForGroup(group);
    const entryIds = group.map((e) => e.id);
    const plant_profile_id = first.plant_profile_id ?? null;
    return { date: first.created_at, note: note || null, action, plantNames, entryIds, plant_profile_id };
  });
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

/** Insert year/month section headers into table rows for glanceable timeline. */
function tableRowsWithSections(
  rows: { date: string; note: string | null; action: ReturnType<typeof getActionFromNote>; plantNames: string[]; entryIds: string[] }[]
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
    const key = e.plant_profile_id ?? e.plant_variety_id ?? "__general__";
    if (!map.has(key)) {
      map.set(key, { plantName: e.plant_display_name ?? e.plant_name ?? "General", profileId: (e.plant_profile_id ?? e.plant_variety_id) || null, entries: [] });
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
  const { user } = useAuth();
  const { setSyncing } = useSync();
  const [entries, setEntries] = useState<JournalEntryWithPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [openAsSnapshot, setOpenAsSnapshot] = useState(false);
  const [note, setNote] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [selectedSowingId, setSelectedSowingId] = useState<string>("");
  const [selectedPacketId, setSelectedPacketId] = useState<string>("");
  const [profiles, setProfiles] = useState<{ id: string; name: string; variety_name: string | null }[]>([]);
  const [packets, setPackets] = useState<{ id: string; vendor_name: string | null; purchase_date: string | null; qty_status: number }[]>([]);
  const [sowings, setSowings] = useState<GrowInstance[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const viewFromUrl = searchParams.get("view");
  const [viewMode, setViewMode] = useState<"table" | "grid" | "timeline">(
    viewFromUrl === "timeline" ? "timeline" : viewFromUrl === "grid" ? "grid" : "timeline"
  );
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [deleteConfirmEntryIds, setDeleteConfirmEntryIds] = useState<string[] | null>(null);
  const [selectionActionsOpen, setSelectionActionsOpen] = useState(false);
  const cameraMobileRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (viewFromUrl === "timeline") setViewMode("timeline");
    else if (viewFromUrl === "grid") setViewMode("grid");
    else if (viewFromUrl === "table") setViewMode("table");
  }, [viewFromUrl]);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  function stopWebcamStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setWebcamActive(false);
    setWebcamError(null);
  }

  async function startDesktopWebcam() {
    setWebcamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setWebcamActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setWebcamError("Camera access denied. Choose a file instead.");
      streamRef.current = null;
      fileInputRef.current?.click();
    }
  }

  function captureFromWebcam() {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `journal-${Date.now()}.jpg`, { type: "image/jpeg" });
        handleImageSelected(file);
        stopWebcamStream();
      },
      "image/jpeg",
      0.9
    );
  }

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchJournal() {
      if (!user) return;
      const { data: rows, error: e } = await supabase
        .from("journal_entries")
        .select("id, plant_profile_id, plant_variety_id, grow_instance_id, note, photo_url, image_file_path, weather_snapshot, entry_type, harvest_weight, harvest_unit, harvest_quantity, created_at, user_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (cancelled) return;
      if (e) {
        setError(e.message);
        setEntries([]);
        setLoading(false);
        return;
      }

      const profileIds = Array.from(new Set((rows ?? []).map((r: { plant_profile_id: string | null }) => r.plant_profile_id).filter(Boolean)));
      const varietyIds = Array.from(new Set((rows ?? []).map((r: { plant_variety_id: string | null }) => r.plant_variety_id).filter(Boolean)));
      const names: Record<string, string> = {};
      const displayNames: Record<string, string> = {};
      if (profileIds.length > 0) {
        const { data: profileRows } = await supabase.from("plant_profiles").select("id, name, variety_name").in("id", profileIds).is("deleted_at", null);
        (profileRows ?? []).forEach((p: { id: string; name: string; variety_name?: string | null }) => {
          names[p.id] = p.name;
          displayNames[p.id] = p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name;
        });
      }
      if (varietyIds.length > 0) {
        const { data: varietyRows } = await supabase.from("plant_varieties").select("id, name").in("id", varietyIds);
        (varietyRows ?? []).forEach((v: { id: string; name: string }) => {
          if (!names[v.id]) names[v.id] = v.name;
          if (!displayNames[v.id]) displayNames[v.id] = v.name;
        });
      }

      // Exclude orphaned entries: plant_profile or plant_variety was hard-deleted, so we have no name.
      // Per Law 2, profiles should use soft delete; this handles existing hard-deleted data.
      const withNames = (rows ?? [])
        .map((r: JournalEntry & { plant_profile_id?: string | null }) => {
          const id = r.plant_profile_id ?? r.plant_variety_id;
          const plant_name = id ? (names[id] ?? "Unknown") : "General";
          const plant_display_name = id ? (displayNames[id] ?? plant_name) : "General";
          return { ...r, plant_name, plant_display_name };
        })
        .filter((r: JournalEntryWithPlant) => {
          const id = r.plant_profile_id ?? r.plant_variety_id;
          if (!id) return true; // General entries always show
          return (names as Record<string, string>)[id] != null; // hide entries whose profile no longer exists
        });
      setEntries(withNames);
      setLoading(false);
    }

    fetchJournal();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name")
        .eq("user_id", user.id)
        .order("name");
      if (!cancelled && data) setProfiles(data);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedPlantId || !user) {
      setSowings([]);
      setSelectedSowingId("");
      setPackets([]);
      setSelectedPacketId("");
      return;
    }
    let cancelled = false;
    (async () => {
      const [sowRes, pktRes] = await Promise.all([
        supabase
          .from("grow_instances")
          .select("id, sown_date, expected_harvest_date, created_at")
          .eq("plant_profile_id", selectedPlantId)
          .eq("user_id", user.id)
          .order("sown_date", { ascending: false }),
        supabase
          .from("seed_packets")
          .select("id, vendor_name, purchase_date, qty_status")
          .eq("plant_profile_id", selectedPlantId)
          .eq("user_id", user.id)
          .or("is_archived.eq.false,is_archived.is.null")
          .order("created_at", { ascending: false }),
      ]);
      if (!cancelled) {
        if (sowRes.data) setSowings(sowRes.data as GrowInstance[]);
        if (pktRes.data) setPackets(pktRes.data as { id: string; vendor_name: string | null; purchase_date: string | null; qty_status: number }[]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedPlantId, user?.id]);

  async function handleSubmitEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setModalError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id ?? user.id;
    if (!sessionUserId) {
      setModalError("You must be signed in to save journal entries.");
      return;
    }

    const noteTrim = note.trim() || null;
    let imagePath: string | null = null;

    if (imageFile) {
      setUploadingPhoto(true);
      const { blob } = await compressImage(imageFile);
      const path = `${sessionUserId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("journal-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      setUploadingPhoto(false);
      if (uploadErr) {
        setModalError(uploadErr.message);
        return;
      }
      imagePath = path;
    }

    if (!noteTrim && !imagePath) {
      setModalError("Add a note or photo.");
      return;
    }

    setSaving(true);
    setSyncing(true);
    const weatherSnapshot = await fetchWeatherSnapshot();
    let insertErr: { message: string } | null = null;
    try {
      const result = await supabase.from("journal_entries").insert({
        user_id: sessionUserId,
        plant_profile_id: selectedPlantId || null,
        grow_instance_id: selectedSowingId || null,
        seed_packet_id: selectedPacketId || null,
        note: noteTrim,
        entry_type: "note",
        image_file_path: imagePath,
        weather_snapshot: weatherSnapshot ?? undefined,
      });
      insertErr = result.error;
      if (!insertErr && selectedPacketId && (noteTrim?.toLowerCase().includes("plant") || noteTrim?.toLowerCase().includes("sown") || noteTrim?.toLowerCase().includes("sow"))) {
        const pkt = packets.find((p) => p.id === selectedPacketId);
        if (pkt && pkt.qty_status > 0) {
          const newQty = Math.max(0, pkt.qty_status - 10);
          await supabase.from("seed_packets").update({ qty_status: newQty }).eq("id", selectedPacketId).eq("user_id", sessionUserId);
        }
      }
    } finally {
      setSyncing(false);
      setSaving(false);
    }
    if (insertErr) {
      setModalError(insertErr.message);
      return;
    }

    setAddModalOpen(false);
    setNote("");
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setSelectedPlantId("");
    setSelectedSowingId("");
    setSelectedPacketId("");

    const { data: rows } = await supabase
      .from("journal_entries")
      .select("id, plant_profile_id, plant_variety_id, grow_instance_id, note, photo_url, image_file_path, weather_snapshot, entry_type, harvest_weight, harvest_unit, harvest_quantity, created_at, user_id")
      .eq("user_id", user!.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    const profileIds = Array.from(new Set((rows ?? []).map((r: { plant_profile_id?: string | null }) => r.plant_profile_id).filter(Boolean)));
    const varietyIds = Array.from(new Set((rows ?? []).map((r: { plant_variety_id: string | null }) => r.plant_variety_id).filter(Boolean)));
    const names: Record<string, string> = {};
    const displayNames: Record<string, string> = {};
    if (profileIds.length > 0) {
      const { data: p } = await supabase.from("plant_profiles").select("id, name, variety_name").in("id", profileIds).is("deleted_at", null);
      (p ?? []).forEach((x: { id: string; name: string; variety_name?: string | null }) => {
        names[x.id] = x.name;
        displayNames[x.id] = x.variety_name?.trim() ? `${x.name} (${x.variety_name})` : x.name;
      });
    }
    if (varietyIds.length > 0) {
      const { data: v } = await supabase.from("plant_varieties").select("id, name").in("id", varietyIds);
      (v ?? []).forEach((x: { id: string; name: string }) => {
        if (!names[x.id]) names[x.id] = x.name;
        if (!displayNames[x.id]) displayNames[x.id] = x.name;
      });
    }
    setEntries((rows ?? [])
      .map((r: JournalEntry & { plant_profile_id?: string | null }) => {
        const id = (r as { plant_profile_id?: string | null; plant_variety_id?: string | null }).plant_profile_id ?? (r as { plant_variety_id?: string | null }).plant_variety_id;
        const plant_name = id ? (names[id] ?? "Unknown") : "General";
        const plant_display_name = id ? (displayNames[id] ?? plant_name) : "General";
        return { ...r, plant_name, plant_display_name };
      })
      .filter((r: JournalEntryWithPlant) => {
        const id = r.plant_profile_id ?? r.plant_variety_id;
        if (!id) return true;
        return (names as Record<string, string>)[id] != null;
      }));
  }

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
    (entryIds: string[], plantProfileId?: string | null) => {
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
            return;
          }
          if (plantProfileId) {
            router.push(`/vault/${plantProfileId}?tab=journal`);
          }
        },
      };
    },
    [clearLongPressTimer, toggleRowSelection, selectedEntryIds.length, router]
  );

  function requestBulkDelete(ids: string[]) {
    setDeleteConfirmEntryIds(ids);
  }

  async function requestBulkArchive(ids: string[]) {
    if (!user || ids.length === 0) return;
    setSelectionActionsOpen(false);
    setSelectedEntryIds((prev) => prev.filter((id) => !ids.includes(id)));
    for (const entryId of ids) {
      const { error: e } = await supabase.from("journal_entries").update({ deleted_at: new Date().toISOString() }).eq("id", entryId).eq("user_id", user.id);
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
    for (const entryId of ids) {
      const { error: e } = await supabase.from("journal_entries").update({ deleted_at: new Date().toISOString() }).eq("id", entryId).eq("user_id", user.id);
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

  function openAddModal(opts?: { asSnapshot?: boolean }) {
    setAddModalOpen(true);
    if (opts?.asSnapshot) setOpenAsSnapshot(true);
    setNote("");
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setModalError(null);
    setSelectedPlantId("");
    setSelectedSowingId("");
    setSelectedPacketId("");
    stopWebcamStream();
  }

  useEffect(() => {
    if (!webcamActive || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [webcamActive]);

  useEffect(() => {
    if (addModalOpen && openAsSnapshot) {
      setOpenAsSnapshot(false);
      if (isMobile) {
        cameraMobileRef.current?.click();
      } else {
        startDesktopWebcam();
      }
    }
  }, [addModalOpen, openAsSnapshot, isMobile]);

  useEffect(() => {
    if (!addModalOpen || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("grow_instances")
        .select("plant_profile_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("status", ["growing", "pending"])
        .order("sown_date", { ascending: false })
        .limit(10);
      if (cancelled || !data?.length) return;
      const profileIds = [...new Set((data as { plant_profile_id: string | null }[]).map((r) => r.plant_profile_id).filter(Boolean))];
      if (profileIds.length === 1) {
        setSelectedPlantId(profileIds[0] as string);
      }
    })();
    return () => { cancelled = true; };
  }, [addModalOpen, user?.id]);

  function handleImageSelected(f: File | null) {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setImageFile(f);
    if (f) setImagePreviewUrl(URL.createObjectURL(f));
  }

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
        <p className="text-muted text-sm mb-3">Notes and photos from your garden</p>
        <div className="flex justify-end">
          <div className="inline-flex rounded-xl p-1 bg-neutral-100 gap-0.5" role="tablist" aria-label="Journal view">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "table"}
              onClick={() => setViewMode("table")}
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
              onClick={() => setViewMode("grid")}
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
              onClick={() => setViewMode("timeline")}
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
              const lp = getLongPressHandlers(row.entryIds, row.plant_profile_id);
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
                    {row.plantNames.map((name) => (
                      <span key={name} className="inline-block px-2 py-0.5 rounded-full bg-emerald/10 text-emerald-800 text-xs font-medium">
                        {name}
                      </span>
                    ))}
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
                  const lp = getLongPressHandlers(row.entryIds, row.plant_profile_id);
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
                          {row.plantNames.map((name) => (
                            <span key={name} className="inline-block px-2 py-0.5 rounded-full bg-emerald/10 text-emerald-800 text-xs font-medium">
                              {name}
                            </span>
                          ))}
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
            const firstWithImage = group.entries.find((e) => e.image_file_path || e.photo_url);
            const thumbSrc = firstWithImage?.image_file_path
              ? supabase.storage.from("journal-photos").getPublicUrl(firstWithImage.image_file_path).data.publicUrl
              : firstWithImage?.photo_url ?? null;
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
            const groupEntries = entries.filter((e) => row.entryIds.includes(e.id));
            const imageUrls = groupEntries
              .map((e) => (e.image_file_path ? supabase.storage.from("journal-photos").getPublicUrl(e.image_file_path).data.publicUrl : e.photo_url))
              .filter((url): url is string => !!url);
            const hasImages = imageUrls.length > 0;
            const rowId = row.entryIds[0];
            const lp = getLongPressHandlers(row.entryIds, row.plant_profile_id);
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
                    <div className="flex flex-wrap gap-1.5">
                      {row.plantNames.map((name) => (
                        <span key={name} className="text-xs font-medium text-emerald-700 bg-emerald/10 px-2 py-0.5 rounded-full">
                          {name}
                        </span>
                      ))}
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

      {selectedEntryIds.length > 0 && !deleteConfirmEntryIds && (
        <div
          className="fixed left-4 right-4 z-30 flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-white border border-black/10 shadow-lg max-w-md mx-auto"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px) + 4rem)" }}
          role="status"
          aria-label={`${selectedEntryIds.length} selected`}
        >
          <span className="text-sm font-medium text-black/80">{selectedEntryIds.length} selected</span>
          <div className="flex items-center gap-2">
            {selectedEntryIds.length === 1 && (() => {
              const entry = entries.find((e) => e.id === selectedEntryIds[0]);
              if (entry?.plant_profile_id) {
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEntryIds([]);
                      router.push(`/vault/${entry.plant_profile_id}?tab=journal`);
                    }}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald/10"
                    aria-label="Edit selected entry"
                  >
                    <PencilEditIcon />
                  </button>
                );
              }
              return null;
            })()}
            <button
              type="button"
              onClick={() => requestBulkDelete(selectedEntryIds)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-citrus hover:bg-citrus/10"
              aria-label="Delete selected"
            >
              <TrashIcon />
            </button>
            <button
              type="button"
              onClick={() => setSelectedEntryIds([])}
              className="min-w-[44px] min-h-[44px] px-3 rounded-lg border border-black/10 text-sm font-medium text-black/80"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (selectedEntryIds.length > 0) {
            setSelectionActionsOpen(true);
          } else if (addChoiceOpen) {
            setAddChoiceOpen(false);
          } else {
            setAddChoiceOpen(true);
          }
        }}
        className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
          selectedEntryIds.length > 0 ? "bg-amber-500 text-white" : addChoiceOpen ? "bg-emerald-700 text-white" : "bg-emerald text-white"
        }`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={
          selectedEntryIds.length > 0 ? "Actions for selected" : addChoiceOpen ? "Close add menu" : "Add journal entry"
        }
      >
        {selectedEntryIds.length > 0 ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="6" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="18" r="1.5" />
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
            className={`transition-transform duration-200 ${addChoiceOpen ? "rotate-45" : "rotate-0"}`}
            aria-hidden
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>

      {addChoiceOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            aria-hidden
            onClick={() => setAddChoiceOpen(false)}
          />
          <div
            className="fixed left-4 right-4 bottom-20 z-50 rounded-3xl bg-white border border-neutral-200/80 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-journal-choice-title"
          >
            <h2 id="add-journal-choice-title" className="text-xl font-bold text-center text-neutral-900 mb-1">
              Quick log
            </h2>
            <p className="text-sm text-neutral-500 text-center mb-4">Choose how you want to add an entry.</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setAddChoiceOpen(false);
                  openAddModal({ asSnapshot: true });
                }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0">
                  <CameraIcon />
                </span>
                Snapshot — take a photo
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddChoiceOpen(false);
                  openAddModal();
                }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0">
                  <NoteIcon />
                </span>
                Quick Note — text only
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddChoiceOpen(false);
                  router.push("/journal/new");
                }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0">
                  <DocumentIcon />
                </span>
                Full entry (link plant, packet, sowing)
              </button>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setAddChoiceOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
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
                  const entry = entries.find((e) => e.id === firstId);
                  if (entry?.plant_profile_id) router.push(`/vault/${entry.plant_profile_id}?tab=journal`);
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

      {addModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            aria-hidden
            onClick={() => {
              stopWebcamStream();
              setAddModalOpen(false);
            }}
          />
          <div
            className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-card border border-black/5 max-w-md mx-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-entry-title"
          >
            <h2 id="add-entry-title" className="text-lg font-semibold text-black mb-4">
              Add Journal Entry
            </h2>
            <form onSubmit={handleSubmitEntry} className="space-y-4">
              <input
                ref={cameraMobileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-label="Take photo (mobile)"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageSelected(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Choose file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageSelected(f);
                  e.target.value = "";
                }}
              />
              <div>
                <span className="block text-sm font-medium text-black/80 mb-2">Photo (optional)</span>
                {webcamActive ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={captureFromWebcam}
                        className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl bg-emerald text-white text-sm font-medium"
                      >
                        <CameraIcon />
                        Capture
                      </button>
                      <button
                        type="button"
                        onClick={stopWebcamStream}
                        className="py-2.5 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : imageFile && imagePreviewUrl ? (
                  <div className="space-y-2">
                    <img
                      src={imagePreviewUrl}
                      alt="Preview"
                      className="w-full rounded-xl object-cover h-40 bg-black/5"
                    />
                    <button
                      type="button"
                      onClick={() => handleImageSelected(null)}
                      className="text-sm font-medium text-citrus hover:text-black/80"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isMobile) {
                          cameraMobileRef.current?.click();
                        } else {
                          startDesktopWebcam();
                        }
                      }}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80 hover:bg-black/5"
                    >
                      <CameraIcon />
                      Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80 hover:bg-black/5"
                    >
                      <UploadIcon />
                      Choose from Files
                    </button>
                  </div>
                )}
                {webcamError && (
                  <p className="text-xs text-citrus mt-1">{webcamError}</p>
                )}
              </div>
              <div>
                <label htmlFor="journal-note" className="block text-sm font-medium text-black/80 mb-1">
                  Note
                </label>
                <textarea
                  id="journal-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Transplants, slope progress, weather…"
                  rows={3}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                />
              </div>
              <div>
                <label htmlFor="journal-plant" className="block text-sm font-medium text-black/80 mb-1">
                  Link to (optional)
                </label>
                <select
                  id="journal-plant"
                  value={selectedPlantId}
                  onChange={(e) => {
                    setSelectedPlantId(e.target.value);
                    setSelectedSowingId("");
                    setSelectedPacketId("");
                  }}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                >
                  <option value={GENERAL_OPTION.id}>{GENERAL_OPTION.name}</option>
                  {profiles.length === 0 ? (
                    <option value="" disabled>No varieties in vault. Add seeds first.</option>
                  ) : (
                    profiles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.variety_name ? ` — ${v.variety_name}` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {selectedPlantId && packets.length > 0 && (
                <div>
                  <label htmlFor="journal-packet" className="block text-sm font-medium text-black/80 mb-1">
                    Which packet did you use? (optional — decrements that packet)
                  </label>
                  <select
                    id="journal-packet"
                    value={selectedPacketId}
                    onChange={(e) => setSelectedPacketId(e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                  >
                    <option value="">None</option>
                    {packets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.vendor_name?.trim() || "Packet"} — {p.qty_status}% left
                        {p.purchase_date ? ` (${new Date(p.purchase_date).getFullYear()})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedPlantId && sowings.length > 0 && (
                <div>
                  <label htmlFor="journal-sowing" className="block text-sm font-medium text-black/80 mb-1">
                    Active sowing (optional)
                  </label>
                  <select
                    id="journal-sowing"
                    value={selectedSowingId}
                    onChange={(e) => setSelectedSowingId(e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                  >
                    <option value="">None</option>
                    {sowings.map((s) => (
                      <option key={s.id} value={s.id}>
                        Sown {new Date(s.sown_date).toLocaleDateString()}
                        {s.expected_harvest_date ? ` → ${new Date(s.expected_harvest_date).toLocaleDateString()}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {modalError && <p className="text-sm text-citrus font-medium">{modalError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    stopWebcamStream();
                    setAddModalOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingPhoto}
                  className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-60"
                >
                  {uploadingPhoto ? "Uploading…" : saving ? "Saving…" : "Save entry"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
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
