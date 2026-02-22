"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import type { PlantProfile, PlantVarietyProfile, SeedPacket, GrowInstance, JournalEntry, CareSchedule, VendorSpecs } from "@/types/garden";
import { getZone10bScheduleForPlant } from "@/data/zone10b_schedule";
import { getEffectiveCare } from "@/lib/plantCareHierarchy";
import { isPlantableInMonth } from "@/lib/plantingWindow";
import { TagBadges } from "@/components/TagBadges";
import { CareScheduleManager } from "@/components/CareScheduleManager";
import { StarRating } from "@/components/StarRating";
import { BatchLogSheet, type BatchLogBatch } from "@/components/BatchLogSheet";
import { PacketQtyOptions } from "@/components/PacketQtyOptions";
import { HarvestModal } from "@/components/HarvestModal";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";
import { cascadeTasksAndShoppingForDeletedProfiles } from "@/lib/cascadeOnProfileDelete";
import { compressImage } from "@/lib/compressImage";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { parseFindHeroPhotoGalleryResponse } from "@/lib/parseFindHeroPhotoResponse";
import { stripHtmlForDisplay, looksLikeScientificName } from "@/lib/htmlEntities";
import { SEED_PACKET_PROFILE_SELECT } from "@/lib/seedPackets";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { PROFILE_STATUS_OPTIONS, getProfileStatusLabel } from "@/lib/profileStatus";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Use proxy for external image URLs so they load in the app (avoids hotlink/referrer blocking). */
function externalImageSrc(url: string): string {
  if (!url?.startsWith("http")) return url;
  if (url.includes("supabase.co")) return url;
  return `/api/seed/proxy-image?url=${encodeURIComponent(url)}`;
}

type JournalPhoto = { id: string; image_file_path: string; created_at: string };

function formatVendorDetails(plantDescription: string | null, growingInfo: string | null): { title: string; body: string }[] {
  const combined = [plantDescription, growingInfo].filter(Boolean).join("\n\n").trim();
  if (!combined) return [];
  const sections: { title: string; body: string }[] = [];
  const headings = ["Harvesting","Vase Life","How to Grow","How to Harvest","Detailed Specs","Planting Instructions","Growing Info","Sunlight","Watering","Soil","Care Tips","From Seed","Direct Sowing"];
  const parts = combined.split(/\n\s*\n/);
  let currentBody: string[] = [];
  let currentTitle = "Details";
  for (const p of parts) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const isHeading = headings.some((h) => trimmed.startsWith(h) || new RegExp(`^${h}\\s*[:–-]`, "i").test(trimmed));
    if (isHeading && trimmed.length < 120) {
      if (currentBody.length > 0) { sections.push({ title: currentTitle, body: currentBody.join("\n\n").trim() }); currentBody = []; }
      currentTitle = trimmed.replace(/\s*[:–-]\s*$/, "").trim();
    } else { currentBody.push(trimmed); }
  }
  if (currentBody.length > 0) sections.push({ title: currentTitle, body: currentBody.join("\n\n").trim() });
  if (sections.length === 0) sections.push({ title: "Details", body: combined });
  return sections;
}

function toDateInputValue(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Treat placeholder hero as "no hero" so we use packet/journal/sprout fallback (Law 7). */
function isPlaceholderHeroUrl(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return true;
  return u === "/seedling-icon.svg" || u.endsWith("/seedling-icon.svg");
}

function formatDisplayDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Collect all packet image URLs (primary, packet_photo, packet_images) in display order. */
function getPacketImageUrls(
  pkt: { primary_image_path?: string | null; packet_photo_path?: string | null },
  extraImages: { image_path: string }[]
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (path: string | null | undefined) => {
    const p = path?.trim();
    if (p && !seen.has(p)) {
      seen.add(p);
      urls.push(supabase.storage.from("seed-packets").getPublicUrl(p).data.publicUrl);
    }
  };
  add(pkt.primary_image_path);
  add(pkt.packet_photo_path);
  for (const { image_path } of extraImages) add(image_path);
  return urls;
}

function buildIdentityKey(type: string, variety: string): string {
  return identityKeyFromVariety(type, variety);
}

function syncExtractCache(userId: string, identityKey: string, updates: { extractDataPatch?: Record<string, unknown>; heroStoragePath?: string | null; originalHeroUrl?: string | null }, oldIdentityKey?: string): void {
  (async () => {
    try {
      const lookupKey = oldIdentityKey || identityKey;
      const { data: rows } = await supabase.from("plant_extract_cache").select("id, extract_data, hero_storage_path, original_hero_url").eq("user_id", userId).eq("identity_key", lookupKey);
      if (!rows?.length) return;
      for (const row of rows) {
        const merged = { ...(row.extract_data as Record<string, unknown>), ...(updates.extractDataPatch ?? {}) };
        await supabase.from("plant_extract_cache").update({
          ...(oldIdentityKey ? { identity_key: identityKey } : {}),
          extract_data: merged,
          ...(updates.heroStoragePath !== undefined ? { hero_storage_path: updates.heroStoragePath } : {}),
          ...(updates.originalHeroUrl !== undefined ? { original_hero_url: updates.originalHeroUrl } : {}),
          updated_at: new Date().toISOString(),
        }).eq("id", row.id).eq("user_id", userId);
      }
    } catch (e) { console.error("[syncExtractCache] failed:", e instanceof Error ? e.message : String(e)); }
  })();
}

const STATUS_COLORS: Record<string, string> = {
  in_stock: "bg-emerald-100 text-emerald-800",
  out_of_stock: "bg-red-100 text-red-800",
  planted: "bg-blue-100 text-blue-800",
  growing: "bg-green-100 text-green-800",
};

/** Allowed profile status values for Edit modal; users must pick one, not free-text. */

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function PencilIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>; }
function TrashIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>; }
function ChevronDownIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>; }
function ChevronRightIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>; }

type ProfileData = PlantProfile | PlantVarietyProfile;

// ===========================================================================
// Main component
// ===========================================================================
export default function VaultSeedPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session } = useAuth();
  const { canEditUser } = useHousehold();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [packets, setPackets] = useState<SeedPacket[]>([]);
  const [growInstances, setGrowInstances] = useState<(GrowInstance & { journal_count?: number })[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [careSchedules, setCareSchedules] = useState<CareSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const [vendorDetailsOpen, setVendorDetailsOpen] = useState(false);
  const [openPacketDetails, setOpenPacketDetails] = useState<Set<string>>(new Set());
  const [batchLogOpen, setBatchLogOpen] = useState(false);
  const [batchLogTarget, setBatchLogTarget] = useState<BatchLogBatch | null>(null);
  const [harvestTarget, setHarvestTarget] = useState<{ profileId: string; growId: string; displayName: string } | null>(null);
  const [endBatchTarget, setEndBatchTarget] = useState<BatchLogBatch | null>(null);
  const [endReason, setEndReason] = useState("season_ended");
  const [endNote, setEndNote] = useState("");
  const [endSaving, setEndSaving] = useState(false);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<BatchLogBatch | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [addPlantDate, setAddPlantDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addPlantLocation, setAddPlantLocation] = useState("");
  const [addPlantSaving, setAddPlantSaving] = useState(false);
  const [addPlantError, setAddPlantError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    plantType: "", varietyName: "", sun: "", water: "", spacing: "",
    germination: "", maturity: "", sowingMethod: "", plantingWindow: "",
    purchaseDate: "", growingNotes: "", status: "",
    companionPlants: "", avoidPlants: "",
  });
  const [journalPhotos, setJournalPhotos] = useState<JournalPhoto[]>([]);
  const tabFromUrl = searchParams.get("tab");
  const fromParam = searchParams.get("from");
  const validTab = ["about", "packets", "plantings", "journal"].includes(tabFromUrl ?? "") ? tabFromUrl as "about" | "packets" | "plantings" | "journal" : "about";
  const [activeTab, setActiveTab] = useState<"about" | "packets" | "plantings" | "journal">(validTab);

  useEffect(() => {
    setActiveTab(validTab);
  }, [id, validTab]);
  const [showSetPhotoModal, setShowSetPhotoModal] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [findingStockPhoto, setFindingStockPhoto] = useState(false);
  const [findHeroError, setFindHeroError] = useState<string | null>(null);
  const [searchWebLoading, setSearchWebLoading] = useState(false);
  const [searchWebGalleryUrls, setSearchWebGalleryUrls] = useState<string[]>([]);
  const [searchWebError, setSearchWebError] = useState<string | null>(null);
  const [galleryImageFailed, setGalleryImageFailed] = useState<Set<string>>(new Set());
  const [stockPhotoCurrentFailed, setStockPhotoCurrentFailed] = useState(false);
  const [savingWebHero, setSavingWebHero] = useState(false);
  const [saveHeroError, setSaveHeroError] = useState<string | null>(null);
  const searchWebAbortRef = useRef<AbortController | null>(null);
  const photoGalleryLoadedRef = useRef(false);
  const [journalByPacketId, setJournalByPacketId] = useState<Record<string, { id: string; note: string | null; created_at: string; grow_instance_id?: string | null }[]>>({});
  const [loadingJournalForPacket, setLoadingJournalForPacket] = useState<Set<string>>(new Set());
  const [packetImagesByPacketId, setPacketImagesByPacketId] = useState<Map<string, { image_path: string }[]>>(new Map());
  const [imageLightbox, setImageLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  // Ordered profile IDs for swipe prev/next (name A–Z); only plant_profiles
  const [orderedProfileIds, setOrderedProfileIds] = useState<string[]>([]);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  // About tab: which sections are collapsed (default all open)
  const [aboutCollapsed, setAboutCollapsed] = useState<Record<string, boolean>>({});
  const isAboutOpen = (key: string) => !aboutCollapsed[key];
  const toggleAboutSection = (key: string) => setAboutCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // Harvest modal

  // Plantable now
  const [isPlantableNow, setIsPlantableNow] = useState(false);

  // True when the profile belongs to the current user; false when viewing a household member's profile
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  // The user_id of the profile owner (may differ from user.id when viewing family profiles)
  const [profileOwnerId, setProfileOwnerId] = useState<string>("");

  // Add packet modal (when profile has 0 packets or user wants to add another)
  const [showAddPacketModal, setShowAddPacketModal] = useState(false);
  const [addPacketVendor, setAddPacketVendor] = useState("");
  const [addPacketPurchaseDate, setAddPacketPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addPacketUrl, setAddPacketUrl] = useState("");
  const [addPacketSaving, setAddPacketSaving] = useState(false);
  const [addPacketError, setAddPacketError] = useState<string | null>(null);

  useModalBackClose(!!imageLightbox, () => setImageLightbox(null));
  useModalBackClose(showAddPacketModal, () => setShowAddPacketModal(false));
  useModalBackClose(showAddPlantModal, () => { setShowAddPlantModal(false); setAddPlantError(null); });
  useModalBackClose(showDeleteConfirm, () => { if (!deletingProfile) setShowDeleteConfirm(false); });

  useEffect(() => {
    if (!showSetPhotoModal) {
      photoGalleryLoadedRef.current = false;
      return;
    }
    setSearchWebGalleryUrls([]);
    setSearchWebError(null);
    setGalleryImageFailed(new Set());
    setStockPhotoCurrentFailed(false);
    setSaveHeroError(null);
  }, [showSetPhotoModal]);

  // =========================================================================
  // Load data
  // =========================================================================
  const loadProfile = useCallback(async () => {
    if (!id || !user?.id) return;
    setError(null);
    // No user_id filter on the profile query — RLS handles authorization.
    // Household peers can read each other's profiles via household_profiles_select policy.
    const { data: profileData, error: e1 } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, user_id, sun, water, harvest_days, days_to_germination, plant_spacing, primary_image_path, hero_image_path, hero_image_url, hero_image_pending, height, tags, status, sowing_method, planting_window, purchase_date, created_at, botanical_care_notes, profile_type, companion_plants, avoid_plants, plant_description, growing_notes, description_source, scientific_name, sowing_depth")
      .eq("id", id).is("deleted_at", null).maybeSingle();

    if (e1) {
      setError(e1.message);
      setProfile(null);
      setLoading(false);
      return;
    }
    if (profileData) {
      setProfile(profileData as ProfileData);
      // Use the profile's actual owner for all child read queries so household
      // members viewing someone else's profile get the right data.
      const ownerIdFromData = profileData.user_id as string;
      setProfileOwnerId(ownerIdFromData);
      setIsOwnProfile(ownerIdFromData === user.id);

      const isPermanentProfile = (profileData as { profile_type?: string })?.profile_type === "permanent";
      const careQuery = supabase.from("care_schedules")
        .select("*")
        .eq("plant_profile_id", id).eq("user_id", ownerIdFromData)
        .order("title", { ascending: true });
      const careQueryFinal = !isPermanentProfile ? careQuery.eq("is_template", true) : careQuery;

      // Batch 2: Fetch packets, grows, journals, care, journal photos in parallel
      const [packetsRes, growsRes, journalsRes, careRes, journalPhotosRes] = await Promise.all([
        supabase.from("seed_packets").select(SEED_PACKET_PROFILE_SELECT).eq("plant_profile_id", id).eq("user_id", ownerIdFromData).is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("grow_instances").select("*").eq("plant_profile_id", id).eq("user_id", ownerIdFromData).is("deleted_at", null).order("sown_date", { ascending: false }),
        supabase.from("journal_entries").select("id, plant_profile_id, grow_instance_id, seed_packet_id, note, photo_url, image_file_path, weather_snapshot, entry_type, harvest_weight, harvest_unit, harvest_quantity, created_at, user_id").eq("plant_profile_id", id).eq("user_id", ownerIdFromData).is("deleted_at", null).order("created_at", { ascending: false }),
        careQueryFinal,
        supabase.from("journal_entries").select("id, image_file_path, created_at").eq("plant_profile_id", id).eq("user_id", ownerIdFromData).is("deleted_at", null).not("image_file_path", "is", null).order("created_at", { ascending: false }),
      ]);

      const packetRows = packetsRes.error ? [] : ((packetsRes.data ?? []) as SeedPacket[]);
      if (packetsRes.error) setError(packetsRes.error.message);
      setPackets(packetRows);

      let allGrows = (growsRes.data ?? []) as GrowInstance[];
      // Fallback: catch grow instances linked via seed_packet_id but missing plant_profile_id
      if (allGrows.length === 0 && packetRows.length > 0) {
        const pktIds = packetRows.map((p) => p.id);
        const { data: growsByPacket } = await supabase.from("grow_instances")
          .select("*")
          .in("seed_packet_id", pktIds).eq("user_id", ownerIdFromData).is("deleted_at", null).order("sown_date", { ascending: false });
        if (growsByPacket?.length) {
          allGrows = growsByPacket as GrowInstance[];
          // Silently repair orphaned rows — only safe to write when viewing own profile
          if (ownerIdFromData === user.id) {
            const orphans = (growsByPacket as GrowInstance[]).filter((g) => !g.plant_profile_id);
            if (orphans.length > 0) {
              await supabase.from("grow_instances")
                .update({ plant_profile_id: id })
                .in("id", orphans.map((g) => g.id))
                .eq("user_id", user.id);
            }
          }
        }
      }
      setGrowInstances(allGrows);

      // Repair: if plant is in garden but profile status was overwritten (e.g. by packet qty update),
      // restore status to "active" so the green rim shows in Vault.
      const hasActiveGrow = allGrows.some((g) => g.status === "pending" || g.status === "growing");
      const currentStatus = (profileData.status as string) ?? "";
      if (hasActiveGrow && !currentStatus.toLowerCase().includes("active")) {
        await supabase.from("plant_profiles").update({ status: "active" }).eq("id", id).eq("user_id", ownerIdFromData);
      }

      setJournalEntries((journalsRes.data ?? []) as JournalEntry[]);
      setCareSchedules((careRes.data ?? []) as CareSchedule[]);
      setJournalPhotos((journalPhotosRes.data ?? []) as JournalPhoto[]);

      // Batch 3: packet_images (depends on packetIds)
      const packetIds = packetRows.map((p) => p.id);
      if (packetIds.length > 0) {
        const { data: extraImages } = await supabase
          .from("packet_images")
          .select("seed_packet_id, image_path, sort_order")
          .in("seed_packet_id", packetIds)
          .order("sort_order", { ascending: true });
        const byPacket = new Map<string, { image_path: string }[]>();
        for (const row of extraImages ?? []) {
          const r = row as { seed_packet_id: string; image_path: string };
          const list = byPacket.get(r.seed_packet_id) ?? [];
          list.push({ image_path: r.image_path });
          byPacket.set(r.seed_packet_id, list);
        }
        setPacketImagesByPacketId(byPacket);
      } else {
        setPacketImagesByPacketId(new Map());
      }

      // Plantable now check (from profile.planting_window or zone10b fallback)
      setIsPlantableNow(isPlantableInMonth(profileData as { name: string; planting_window?: string | null }, new Date().getMonth()));

      setLoading(false);
      return;
    }
    // Legacy fallback — no user_id filter, RLS handles authorization
    const { data: legacy, error: e2 } = await supabase.from("plant_varieties")
      .select("id, name, variety_name, user_id, sun, water, harvest_days, days_to_germination, plant_spacing, primary_image_path, source_url, vendor, growing_notes, growing_info_from_source, plant_description")
      .eq("id", id).maybeSingle();
    if (e2) { setError(e2.message); setProfile(null); }
    else if (!legacy) { setError("Plant not found."); setProfile(null); }
    else {
      const legacyOwner = ((legacy as { user_id?: string }).user_id) ?? user.id;
      setIsOwnProfile(legacyOwner === user.id);
      setProfileOwnerId(legacyOwner);
      setProfile(legacy as PlantVarietyProfile); setPackets([]); setJournalPhotos([]); setPacketImagesByPacketId(new Map());
    }
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Plantings tab: quick care, end batch, delete batch
  const handlePlantingsQuickCare = useCallback(async (batch: BatchLogBatch, action: "water" | "fertilize" | "spray") => {
    if (!user?.id) return;
    const notes: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };
    const weather = await fetchWeatherSnapshot();
    await supabase.from("journal_entries").insert({
      user_id: user.id,
      plant_profile_id: batch.plant_profile_id,
      grow_instance_id: batch.id,
      note: notes[action],
      entry_type: "quick",
      weather_snapshot: weather ?? undefined,
    });
    loadProfile();
  }, [user?.id, loadProfile]);

  const handlePlantingsEndBatch = useCallback(async () => {
    if (!user?.id || !endBatchTarget) return;
    setEndSaving(true);
    const batchId = endBatchTarget.id;
    const now = new Date().toISOString();
    const isDead = endReason === "plant_died";
    const status = isDead ? "dead" : "archived";
    await supabase.from("grow_instances").update({ status, ended_at: now, end_reason: endReason }).eq("id", batchId);
    await softDeleteTasksForGrowInstance(batchId, endBatchTarget.user_id ?? user.id);
    if (endNote.trim() || isDead) {
      const weather = await fetchWeatherSnapshot();
      await supabase.from("journal_entries").insert({
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
    loadProfile();
  }, [user?.id, endBatchTarget, endReason, endNote, loadProfile]);

  const handlePlantingsDeleteBatch = useCallback(async () => {
    if (!user?.id || !deleteBatchTarget) return;
    setDeleteSaving(true);
    const batchId = deleteBatchTarget.id;
    const now = new Date().toISOString();
    const { error } = await supabase.from("grow_instances").update({ deleted_at: now }).eq("id", batchId);
    if (!error) await softDeleteTasksForGrowInstance(batchId, deleteBatchTarget.user_id ?? user.id);
    setDeleteSaving(false);
    setDeleteBatchTarget(null);
    if (error) return;
    loadProfile();
  }, [user?.id, deleteBatchTarget, loadProfile]);

  const handleAddPlant = useCallback(async () => {
    if (!user?.id || !id) return;
    setAddPlantSaving(true);
    setAddPlantError(null);
    const { error } = await supabase.from("grow_instances").insert({
      user_id: user.id,
      plant_profile_id: id,
      sown_date: addPlantDate,
      expected_harvest_date: null,
      status: "growing",
      seed_packet_id: null,
      location: addPlantLocation.trim() || null,
      plant_count: 1,
    });
    setAddPlantSaving(false);
    if (error) {
      setAddPlantError("Failed to add plant. Try again.");
      return;
    }
    setShowAddPlantModal(false);
    setAddPlantDate(new Date().toISOString().slice(0, 10));
    setAddPlantLocation("");
    loadProfile();
  }, [user?.id, id, addPlantDate, addPlantLocation, loadProfile]);

  // Fetch ordered profile IDs for swipe prev/next (name A–Z; plant_profiles only)
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("plant_profiles")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("name", { ascending: true });
      if (!cancelled && data) setOrderedProfileIds((data as { id: string }[]).map((r) => r.id));
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // =========================================================================
  // Derived
  // =========================================================================
  const prevNext = useMemo(() => {
    if (!id || orderedProfileIds.length === 0) return { prevId: null, nextId: null };
    const idx = orderedProfileIds.indexOf(id);
    if (idx < 0) return { prevId: null, nextId: null };
    return {
      prevId: idx > 0 ? orderedProfileIds[idx - 1]! : null,
      nextId: idx < orderedProfileIds.length - 1 ? orderedProfileIds[idx + 1]! : null,
    };
  }, [id, orderedProfileIds]);
  const { prevId, nextId } = prevNext;

  // =========================================================================
  // Derived (continued)
  // =========================================================================
  const displayName = profile?.variety_name?.trim()
    ? `${stripHtmlForDisplay(profile.name)} – ${stripHtmlForDisplay(profile.variety_name)}`
    : stripHtmlForDisplay(profile?.name) ?? "";
  const isLegacy = profile ? "vendor" in profile && (profile as PlantVarietyProfile).vendor != null : false;
  const isPermanent = (profile as PlantProfile | null)?.profile_type === "permanent";
  const profileStatus = (profile?.status ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const profileStatusLabel = getProfileStatusLabel(profileStatus);

  const profileWithHero = profile as (typeof profile) & { hero_image_path?: string | null; hero_image_url?: string | null; hero_image_pending?: boolean | null };
  const heroPath = profileWithHero?.hero_image_path?.trim();
  const heroUrl = profileWithHero?.hero_image_url?.trim();
  const heroPending = Boolean(profileWithHero?.hero_image_pending);
  const firstJournalPath = journalPhotos.length > 0 ? journalPhotos[0].image_file_path : null;
  const packetPath = typeof profile?.primary_image_path === "string" && profile.primary_image_path.trim() ? profile.primary_image_path : null;
  const effectiveHeroPath = heroPath || firstJournalPath || packetPath;
  const heroBucket = heroPath || firstJournalPath ? "journal-photos" : "seed-packets";
  // Skip placeholder URL so we use packet/journal/sprout per Law 7; avoids showing old icon when DB has placeholder.
  const useHeroUrl = heroUrl && !isPlaceholderHeroUrl(heroUrl);
  const fallbackStorageUrl = effectiveHeroPath ? supabase.storage.from(heroBucket).getPublicUrl(effectiveHeroPath).data.publicUrl : null;
  const resolvedHeroUrl = useHeroUrl ? heroUrl! : (fallbackStorageUrl || "/seedling-icon.svg");
  // Never show placeholder icon as image — show cute sprout fallback (Law 7) instead.
  const isPlaceholderResolved = !resolvedHeroUrl || isPlaceholderHeroUrl(resolvedHeroUrl);
  const hasHeroImage = (resolvedHeroUrl?.trim() !== "") && !imageError && !isPlaceholderResolved;
  const heroImageUrl = hasHeroImage ? resolvedHeroUrl : null;
  const showHeroResearching = !heroImageUrl && (findingStockPhoto || heroPending);

  // Quick stats
  const packetCount = packets.length;
  const plantingsCount = growInstances.length;
  const totalYield = useMemo(() => {
    const byUnit: Record<string, number> = {};
    journalEntries.forEach((j) => {
      if (j.entry_type === "harvest" && j.harvest_weight != null) {
        const unit = j.harvest_unit || "units";
        byUnit[unit] = (byUnit[unit] ?? 0) + (j.harvest_weight ?? 0);
      }
      if (j.entry_type === "harvest" && j.harvest_quantity != null && j.harvest_weight == null) {
        byUnit["count"] = (byUnit["count"] ?? 0) + (j.harvest_quantity ?? 0);
      }
    });
    return byUnit;
  }, [journalEntries]);
  const yieldLabel = Object.entries(totalYield).map(([unit, val]) => `${Math.round(val * 10) / 10} ${unit}`).join(", ") || "--";

  // Care info
  const profileWithBotanical = profile as PlantProfile & { botanical_care_notes?: Record<string, unknown> | null };
  const profileWater = profile ? ("water" in profile ? (profile as { water?: string | null }).water : null) : null;
  const zone10bSchedule = getZone10bScheduleForPlant(profile?.name ?? "");
  const scheduleForCare = zone10bSchedule ? { ...zone10bSchedule, plant_spacing: zone10bSchedule.spacing, days_to_germination: zone10bSchedule.germination_time } : undefined;
  const profileSowingDepth = (profile as PlantProfile & { sowing_depth?: string | null })?.sowing_depth?.trim() || null;
  const effectiveCare = !isLegacy && profileWithBotanical ? getEffectiveCare(
    { sun: profile?.sun ?? null, water: profileWater ?? null, plant_spacing: profile?.plant_spacing ?? null, days_to_germination: profile?.days_to_germination ?? null, harvest_days: profile?.harvest_days ?? null, botanical_care_notes: profileWithBotanical.botanical_care_notes ?? null, sowing_depth: profileSowingDepth },
    scheduleForCare,
  ) : null;
  const profileWithSchedule = profile as PlantProfile & { sowing_method?: string | null; planting_window?: string | null; growing_notes?: string | null };
  const displaySowing = profileWithSchedule?.sowing_method?.trim() || zone10bSchedule?.sowing_method?.trim() || null;
  const displayWindow = profileWithSchedule?.planting_window?.trim() || zone10bSchedule?.planting_window?.trim() || null;

  const legacyVendor = isLegacy ? (profile as PlantVarietyProfile).vendor : null;
  const legacySourceUrl = isLegacy ? (profile as PlantVarietyProfile).source_url : null;
  const legacyNotes = isLegacy ? [(profile as PlantVarietyProfile).growing_notes, (profile as PlantVarietyProfile).growing_info_from_source].filter(Boolean).join("\n\n") : "";
  const legacyPlantDesc = isLegacy ? (profile as PlantVarietyProfile).plant_description : null;
  const legacyGrowingInfo = isLegacy ? (profile as PlantVarietyProfile).growing_info_from_source : null;

  // Swipe to prev/next profile (mobile); only when no modal is open
  const modalOpen = showSetPhotoModal || showEditModal || !!imageLightbox || showAddPacketModal || showAddPlantModal;
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartRef.current = { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 };
  }, []);
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (start == null || modalOpen) return;
    const end = e.changedTouches[0];
    if (!end) return;
    const deltaX = end.clientX - start.x;
    const deltaY = end.clientY - start.y;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    const tab = validTab !== "about" ? `?tab=${validTab}` : "";
    const from = fromParam === "garden" ? (tab ? `&from=garden` : `?from=garden`) : "";
    if (deltaX < -50 && nextId) router.push(`/vault/${nextId}${tab}${from}`);
    else if (deltaX > 50 && prevId) router.push(`/vault/${prevId}${tab}${from}`);
  }, [modalOpen, nextId, prevId, router, validTab, fromParam]);

  // =========================================================================
  // Handlers
  // =========================================================================
  const updatePacketQty = useCallback(async (packetId: string, qty: number) => {
    if (!user?.id) return;
    const owner = profileOwnerId || user.id;
    const clamped = Math.max(0, Math.min(100, qty));
    const updates: Record<string, unknown> = { qty_status: clamped };
    // Auto-archive when qty reaches 0, un-archive when raised above 0
    if (clamped <= 0) updates.is_archived = true;
    else updates.is_archived = false;
    await supabase.from("seed_packets").update(updates).eq("id", packetId).eq("user_id", owner);
    setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, qty_status: clamped, is_archived: clamped <= 0 } : p)));
    // Profile: archive when all packets 0%; unarchive when any packet has inventory.
    // If the plant is in the garden (has active grow_instances), keep status "active" so the green rim shows in Vault.
    if (id) {
      const { data: activeGrows } = await supabase
        .from("grow_instances")
        .select("id")
        .eq("plant_profile_id", id)
        .eq("user_id", owner)
        .is("deleted_at", null)
        .in("status", ["pending", "growing"]);
      const inGarden = (activeGrows?.length ?? 0) > 0;

      if (inGarden) {
        await supabase.from("plant_profiles").update({ status: "active" }).eq("id", id).eq("user_id", owner);
      } else if (clamped > 0) {
        await supabase.from("plant_profiles").update({ status: "in_stock" }).eq("id", id).eq("user_id", owner);
      } else {
        const { data: remaining } = await supabase
          .from("seed_packets")
          .select("id")
          .eq("plant_profile_id", id)
          .eq("user_id", owner)
          .or("is_archived.is.null,is_archived.eq.false")
          .gt("qty_status", 0);
        if (!remaining?.length) {
          await supabase.from("plant_profiles").update({ status: "out_of_stock" }).eq("id", id).eq("user_id", owner);
          await supabase.from("shopping_list").upsert(
            { user_id: owner, plant_profile_id: id, is_purchased: false },
            { onConflict: "user_id,plant_profile_id", ignoreDuplicates: false }
          );
        }
      }
    }
  }, [user?.id, id, profileOwnerId]);

  const updatePacketPurchaseDate = useCallback(async (packetId: string, date: string) => {
    if (!user?.id) return;
    const owner = profileOwnerId || user.id;
    const value = date.trim() || null;
    await supabase.from("seed_packets").update({ purchase_date: value }).eq("id", packetId).eq("user_id", owner);
    setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, purchase_date: value ?? undefined } : p)));
  }, [user?.id, profileOwnerId]);

  const updatePacketNotes = useCallback(
    async (packetId: string, notes: string, options?: { persist?: boolean }) => {
      const value = notes.trim() || null;
      setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, user_notes: value ?? undefined } : p)));
      if (options?.persist !== false && user?.id) {
        const owner = profileOwnerId || user.id;
        await supabase.from("seed_packets").update({ user_notes: value }).eq("id", packetId).eq("user_id", owner);
      }
    },
    [user?.id, profileOwnerId]
  );

  const updatePacketStorageLocation = useCallback(
    async (packetId: string, location: string, options?: { persist?: boolean }) => {
      const value = location.trim() || null;
      setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, storage_location: value ?? undefined } : p)));
      if (options?.persist !== false && user?.id) {
        const owner = profileOwnerId || user.id;
        await supabase.from("seed_packets").update({ storage_location: value }).eq("id", packetId).eq("user_id", owner);
      }
    },
    [user?.id, profileOwnerId]
  );

  const updatePacketRating = useCallback(
    async (packetId: string, rating: number | null) => {
      if (!user?.id) return;
      const owner = profileOwnerId || user.id;
      setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, packet_rating: rating } : p)));
      await supabase.from("seed_packets").update({ packet_rating: rating }).eq("id", packetId).eq("user_id", owner);
    },
    [user?.id, profileOwnerId]
  );

  const deletePacket = useCallback(async (packetId: string) => {
    if (!user?.id) return;
    const owner = profileOwnerId || user.id;
    const { error: e } = await supabase.from("seed_packets").update({ deleted_at: new Date().toISOString() }).eq("id", packetId).eq("user_id", owner);
    if (!e) setPackets((prev) => prev.filter((p) => p.id !== packetId));
  }, [user?.id, profileOwnerId]);

  const handleAddPacketSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !id) return;
    setAddPacketError(null);
    setAddPacketSaving(true);
    const purchaseDate = addPacketPurchaseDate.trim() || new Date().toISOString().slice(0, 10);
    const purchaseUrl = addPacketUrl.trim() || null;
    const vendorName = addPacketVendor.trim() || null;
    const { error: packetErr } = await supabase.from("seed_packets").insert({
      plant_profile_id: id,
      user_id: user.id,
      vendor_name: vendorName,
      purchase_url: purchaseUrl,
      purchase_date: purchaseDate,
      qty_status: 100,
    });
    setAddPacketSaving(false);
    if (packetErr) {
      setAddPacketError(packetErr.message);
      return;
    }
    const owner = profileOwnerId || user.id;
    const { data: activeGrows } = await supabase
      .from("grow_instances")
      .select("id")
      .eq("plant_profile_id", id)
      .eq("user_id", owner)
      .is("deleted_at", null)
      .in("status", ["pending", "growing"]);
    const status = (activeGrows?.length ?? 0) > 0 ? "active" : "in_stock";
    await supabase.from("plant_profiles").update({ status }).eq("id", id).eq("user_id", owner);
    setShowAddPacketModal(false);
    setAddPacketVendor("");
    setAddPacketPurchaseDate(new Date().toISOString().slice(0, 10));
    setAddPacketUrl("");
    await loadProfile();
  }, [user?.id, id, profileOwnerId, addPacketVendor, addPacketPurchaseDate, addPacketUrl, loadProfile]);

  const fetchJournalForPacket = useCallback(async (packetId: string) => {
    if (!user?.id) return;
    setLoadingJournalForPacket((prev) => new Set(prev).add(packetId));
    const { data } = await supabase.from("journal_entries").select("id, note, created_at, grow_instance_id").eq("seed_packet_id", packetId).eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false });
    setJournalByPacketId((prev) => ({ ...prev, [packetId]: (data ?? []) as { id: string; note: string | null; created_at: string; grow_instance_id?: string | null }[] }));
    setLoadingJournalForPacket((prev) => { const next = new Set(prev); next.delete(packetId); return next; });
  }, [user?.id]);

  const togglePacketDetails = useCallback((packetId: string) => {
    setOpenPacketDetails((prev) => { const next = new Set(prev); if (next.has(packetId)) next.delete(packetId); else next.add(packetId); return next; });
  }, []);

  useEffect(() => {
    openPacketDetails.forEach((packetId) => {
      if (journalByPacketId[packetId] === undefined && !loadingJournalForPacket.has(packetId)) fetchJournalForPacket(packetId);
    });
  }, [openPacketDetails, journalByPacketId, loadingJournalForPacket, fetchJournalForPacket]);

  // Hero image handlers
  const setHeroFromPath = useCallback(async (storagePath: string) => {
    if (!user?.id || !id) return;
    const { error } = await supabase.from("plant_profiles").update({ hero_image_path: storagePath, hero_image_url: null }).eq("id", id).eq("user_id", user.id);
    if (!error) {
      if (profile) { const key = buildIdentityKey(profile.name ?? "", profile.variety_name ?? ""); if (key) syncExtractCache(user.id, key, { heroStoragePath: storagePath, originalHeroUrl: null }); }
      await loadProfile();
    }
  }, [user?.id, id, profile, loadProfile]);

  const setHeroFromUrl = useCallback(async (url: string) => {
    if (!user?.id || !id || !url?.trim()) return;
    const { error } = await supabase.from("plant_profiles").update({ hero_image_url: url.trim(), hero_image_path: null }).eq("id", id).eq("user_id", user.id);
    if (!error) {
      if (profile) { const key = buildIdentityKey(profile.name ?? "", profile.variety_name ?? ""); if (key) syncExtractCache(user.id, key, { originalHeroUrl: url.trim(), heroStoragePath: null }); }
      await loadProfile();
    }
  }, [user?.id, id, profile, loadProfile]);

  const removeHeroImage = useCallback(async () => {
    if (!user?.id || !id) return;
    const { error } = await supabase.from("plant_profiles").update({ hero_image_url: null, hero_image_path: null }).eq("id", id).eq("user_id", user.id);
    if (!error) {
      if (profile) { const key = buildIdentityKey(profile.name ?? "", profile.variety_name ?? ""); if (key) syncExtractCache(user.id, key, { originalHeroUrl: null, heroStoragePath: null }); }
      await loadProfile();
    }
  }, [user?.id, id, profile, loadProfile]);

  const findAndSetStockPhoto = useCallback(async () => {
    if (!profile || findingStockPhoto) return;
    setFindingStockPhoto(true);
    setFindHeroError(null);
    const name = (profile.name ?? "").trim() || "Imported seed";
    const variety = (profile.variety_name ?? "").trim();
    const vendor = packets.length > 0 ? (packets[0].vendor_name ?? "").trim() : "";
    const identityKey = identityKeyFromVariety(name, variety);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    try {
      const res = await fetch("/api/seed/find-hero-photo", {
        method: "POST",
        headers,
        body: JSON.stringify({ name, variety, vendor, identity_key: identityKey ?? undefined, profile_id: id }),
      });
      const data = (await res.json()) as { hero_image_url?: string; hero_image_path?: string; error?: string };
      const storagePath = data.hero_image_path?.trim();
      const url = data.hero_image_url?.trim();
      if (storagePath) {
        // Auto-downloaded to our storage — use path so it never breaks
        await setHeroFromPath(storagePath);
      } else if (url) {
        await setHeroFromUrl(url);
      }
      if (storagePath || url) router.refresh();
      if (data.error) setFindHeroError(data.error);
      await loadProfile();
    } finally {
      setFindingStockPhoto(false);
    }
  }, [profile, packets, findingStockPhoto, session?.access_token, setHeroFromUrl, loadProfile, router]);

  const setHeroFromJournal = useCallback((entry: JournalPhoto) => { setHeroFromPath(entry.image_file_path); setShowSetPhotoModal(false); }, [setHeroFromPath]);

  /** Load photo gallery for Set Profile Photo modal: search variety + plant, show multiple images for user to pick. */
  const loadPhotoGallery = useCallback(async () => {
    if (!profile || searchWebLoading) return;
    setSearchWebLoading(true);
    setSearchWebGalleryUrls([]);
    setSearchWebError(null);
    const name = (profile.name ?? "").trim() || "Imported seed";
    const variety = (profile.variety_name ?? "").trim();
    const vendor = packets.length > 0 ? (packets[0].vendor_name ?? "").trim() : "";
    const identityKey = identityKeyFromVariety(name, variety);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const controller = new AbortController();
    searchWebAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch("/api/seed/find-hero-photo", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          variety,
          vendor,
          identity_key: identityKey ?? undefined,
          gallery: true,
          scientific_name: (profile as { scientific_name?: string | null })?.scientific_name?.trim() || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      const result = parseFindHeroPhotoGalleryResponse(text, res.ok);
      if (result.success) {
        setSearchWebGalleryUrls(result.urls);
      } else {
        setSearchWebError(result.error);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === "AbortError") {
        setSearchWebError("Search timed out. Please try again.");
      } else {
        setSearchWebError(e instanceof Error ? e.message : "Search failed.");
      }
    } finally {
      clearTimeout(timeoutId);
      searchWebAbortRef.current = null;
      setSearchWebLoading(false);
    }
  }, [profile, packets, searchWebLoading, session?.access_token]);

  const cancelSearchWeb = useCallback(() => {
    searchWebAbortRef.current?.abort();
  }, []);

  // Auto-load photo gallery when Set Profile Photo modal opens (once per open).
  useEffect(() => {
    if (!showSetPhotoModal || !profile || photoGalleryLoadedRef.current || searchWebLoading) return;
    photoGalleryLoadedRef.current = true;
    loadPhotoGallery();
  }, [showSetPhotoModal, profile, searchWebLoading, loadPhotoGallery]);

  /** Copy packet image from seed-packets to journal-photos, then set as hero. Packet photos live in seed-packets but hero_image_path expects journal-photos. */
  const setHeroFromPacket = useCallback(async (packetStoragePath: string) => {
    if (!user?.id || !id) return;
    setHeroUploading(true);
    try {
      const { data: blob, error: downloadErr } = await supabase.storage.from("seed-packets").download(packetStoragePath);
      if (downloadErr || !blob) {
        setError(downloadErr?.message ?? "Could not load packet photo");
        return;
      }
      const destPath = `${profileOwnerId || user.id}/hero-${id}-from-packet-${crypto.randomUUID().slice(0, 8)}.jpg`;
      const { error: uploadErr } = await supabase.storage.from("journal-photos").upload(destPath, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (uploadErr) {
        setError(uploadErr.message);
        return;
      }
      await setHeroFromPath(destPath);
      setShowSetPhotoModal(false);
      setImageError(false);
    } finally {
      setHeroUploading(false);
    }
  }, [user?.id, id, setHeroFromPath]);

  const setHeroFromUpload = useCallback(async (file: File) => {
    if (!user?.id || !id) return;
    setHeroUploading(true);
    const { blob } = await compressImage(file);
    // Unique path per upload so we always INSERT (RLS allows INSERT). Avoids UPDATE which can fail depending on policy.
    const path = `${profileOwnerId || user.id}/hero-${id}-${crypto.randomUUID().slice(0, 8)}.jpg`;
    const { error: uploadErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    setHeroUploading(false);
    if (uploadErr) { setError(uploadErr.message); return; }
    await setHeroFromPath(path);
    setShowSetPhotoModal(false);
  }, [user?.id, id, setHeroFromPath]);

  // Edit modal
  const openEditModal = useCallback(() => {
    if (!profile) return;
    const pp = profile as PlantProfile & { purchase_date?: string | null; created_at?: string | null; growing_notes?: string | null };
    const dateForInput = pp.purchase_date?.trim() || pp.created_at;
    const companions = pp.companion_plants ?? [];
    const avoid = pp.avoid_plants ?? [];
    setEditForm({
      plantType: profile.name ?? "",
      varietyName: profile.variety_name ?? "",
      sun: profile.sun ?? "",
      water: ("water" in profile ? (profile as { water?: string | null }).water : null) ?? "",
      spacing: profile.plant_spacing ?? "",
      germination: profile.days_to_germination ?? "",
      maturity: profile.harvest_days != null ? String(profile.harvest_days) : "",
      sowingMethod: "sowing_method" in pp && pp.sowing_method != null ? pp.sowing_method : "",
      plantingWindow: "planting_window" in pp && pp.planting_window != null ? pp.planting_window : "",
      purchaseDate: dateForInput ? toDateInputValue(dateForInput) : "",
      growingNotes: pp.growing_notes ?? "",
      status: profile.status ?? "",
      companionPlants: Array.isArray(companions) ? companions.join(", ") : "",
      avoidPlants: Array.isArray(avoid) ? avoid.join(", ") : "",
    });
    setShowEditModal(true);
  }, [profile]);

  const handleSaveEdit = useCallback(async () => {
    if (!user?.id || !profile) return;
    setSavingEdit(true);
    const harvestDays = editForm.maturity.trim() === "" ? null : parseInt(editForm.maturity.trim(), 10);
    const isLeg = profile && "vendor" in profile && (profile as PlantVarietyProfile).vendor != null;
    const table = isLeg ? "plant_varieties" : "plant_profiles";
    const parseCommaList = (s: string): string[] | null => {
      const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
      return arr.length > 0 ? arr : null;
    };
    const updates: Record<string, unknown> = {
      name: editForm.plantType.trim() || null,
      variety_name: editForm.varietyName.trim() || null,
      sun: editForm.sun.trim() || null,
      water: editForm.water.trim() || null,
      plant_spacing: editForm.spacing.trim() || null,
      days_to_germination: editForm.germination.trim() || null,
      harvest_days: harvestDays != null && !Number.isNaN(harvestDays) ? harvestDays : null,
      status: editForm.status.trim() || null,
      ...(isLeg ? { growing_notes: editForm.growingNotes.trim() || null } : {}),
      ...(!isLeg ? {
        sowing_method: editForm.sowingMethod.trim() || null,
        planting_window: editForm.plantingWindow.trim() || null,
        companion_plants: parseCommaList(editForm.companionPlants),
        avoid_plants: parseCommaList(editForm.avoidPlants),
        growing_notes: editForm.growingNotes.trim() || null,
        ...(editForm.growingNotes.trim() && { description_source: "user" }),
      } : {}),
    };
    const { error } = await supabase.from(table).update(updates).eq("id", id).eq("user_id", user.id);
    setSavingEdit(false);
    if (error) { setError(error.message); return; }
    if (user?.id && profile) {
      const oldKey = buildIdentityKey(profile.name ?? "", profile.variety_name ?? "");
      const newKey = buildIdentityKey(editForm.plantType.trim(), editForm.varietyName.trim());
      if (newKey) syncExtractCache(user.id, newKey, { extractDataPatch: { type: editForm.plantType.trim(), variety: editForm.varietyName.trim() } }, oldKey !== newKey ? oldKey : undefined);
    }
    setShowEditModal(false);
    await loadProfile();
  }, [user?.id, profile, id, editForm, loadProfile]);

  const handleDeleteProfile = useCallback(async () => {
    if (!user?.id || !id || !profile) return;
    const isLeg = profile && "vendor" in profile && (profile as PlantVarietyProfile).vendor != null;
    if (isLeg) return; // Legacy plant_varieties not supported
    setDeletingProfile(true);
    setError(null);
    const now = new Date().toISOString();
    const ownerId = profileOwnerId || user.id;
    try {
      // 1. Soft-delete tasks (by plant_profile_id and by grow_instance_id)
      await cascadeTasksAndShoppingForDeletedProfiles(supabase, [id], ownerId);
      for (const g of growInstances) {
        await softDeleteTasksForGrowInstance(g.id, g.user_id ?? ownerId);
      }
      // 2. Soft-delete journal entries
      await supabase.from("journal_entries").update({ deleted_at: now }).eq("plant_profile_id", id).eq("user_id", ownerId);
      // 3. Soft-delete grow instances
      await supabase.from("grow_instances").update({ deleted_at: now }).eq("plant_profile_id", id).eq("user_id", ownerId);
      // 4. Soft-delete seed packets
      await supabase.from("seed_packets").update({ deleted_at: now }).eq("plant_profile_id", id).eq("user_id", ownerId);
      // 5. Soft-delete care schedules
      await supabase.from("care_schedules").update({ deleted_at: now }).eq("plant_profile_id", id).eq("user_id", ownerId);
      // 6. Soft-delete plant profile
      const { error: profileErr } = await supabase.from("plant_profiles").update({ deleted_at: now }).eq("id", id).eq("user_id", ownerId);
      if (profileErr) throw profileErr;
      setShowDeleteConfirm(false);
      setShowEditModal(false);
      router.push("/vault");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete profile");
    } finally {
      setDeletingProfile(false);
    }
  }, [user?.id, id, profile, profileOwnerId, growInstances, router]);

  // Packets with inventory first, then 0% (archived) at bottom; within each group, newest first
  const sortedPackets = useMemo(() => {
    return [...packets].sort((a, b) => {
      const aHas = (a.qty_status ?? 0) > 0 ? 1 : 0;
      const bHas = (b.qty_status ?? 0) > 0 ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas; // has inventory first, then 0% at bottom
      const aAt = a.created_at ?? "";
      const bAt = b.created_at ?? "";
      return bAt.localeCompare(aAt);
    });
  }, [packets]);

  // =========================================================================
  // Loading / error states
  // =========================================================================
  if (loading) return <div className="min-h-screen bg-neutral-50 p-6"><div className="animate-pulse space-y-4 max-w-2xl mx-auto"><div className="h-6 bg-neutral-200 rounded w-1/3" /><div className="h-64 bg-neutral-200 rounded-2xl" /><div className="h-4 bg-neutral-200 rounded w-2/3" /></div></div>;
  if (error || !profile) return <div className="min-h-screen bg-neutral-50 p-6">{fromParam === "garden" ? <Link href="/garden?tab=plants" className="inline-flex items-center gap-2 text-emerald-600 hover:underline mb-4">&larr; Back to My Plants</Link> : <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 hover:underline mb-4">&larr; Back to Vault</Link>}<p className="text-red-600" role="alert">{error ?? "Plant not found."}</p></div>;

  const careList = [
    { label: "Sowing Method", value: displaySowing || "--" },
    { label: "Planting Window", value: displayWindow || "--" },
    { label: "Spacing", value: ((effectiveCare?.plant_spacing ?? profile.plant_spacing?.trim()) || "--") },
    { label: "Sowing Depth", value: ((effectiveCare?.sowing_depth ?? (profile as { sowing_depth?: string | null }).sowing_depth?.trim()) || "--") },
  ];
  const growingList = [
    { label: "Sun", value: ((effectiveCare?.sun ?? profile.sun?.trim()) || "--") },
    { label: "Water", value: ((effectiveCare?.water ?? profileWater?.trim()) || "--") },
    { label: "Germination", value: ((effectiveCare?.days_to_germination ?? profile.days_to_germination?.trim()) || "--") },
  ];
  const harvestList = [
    { label: "Days to Maturity", value: (effectiveCare?.harvest_days != null ? `${effectiveCare.harvest_days} days` : (profile.harvest_days != null ? `${profile.harvest_days} days` : "--")) },
  ];

  const growingNotes = profileWithSchedule?.growing_notes?.trim() || "";
  // canEdit = true when it's the user's own profile OR they have an edit grant from the owner
  const canEdit = isOwnProfile || canEditUser(profileOwnerId);

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Modals */}
      {showSetPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-4 border-b border-neutral-200 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-neutral-900">Set Profile Photo</h2>
                <p className="text-sm text-neutral-500 mt-0.5">Take a photo, choose from files, or pick from web images.</p>
              </div>
              <button type="button" onClick={() => setShowSetPhotoModal(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 flex-shrink-0" aria-label="Close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              {heroImageUrl && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">Current profile photo</p>
                  <div className="relative inline-block w-20 h-20 rounded-lg overflow-hidden border-2 border-neutral-300 bg-neutral-100">
                    <img src={heroImageUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { removeHeroImage(); setShowSetPhotoModal(false); }}
                      className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 focus:ring-2 focus:ring-red-400"
                      aria-label="Remove current photo"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*" capture="environment" className="hidden" id="hero-camera-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) setHeroFromUpload(file); e.target.value = ""; }} />
                <input type="file" accept="image/*" className="hidden" id="hero-files-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) setHeroFromUpload(file); e.target.value = ""; }} />
                <label htmlFor={heroUploading ? undefined : "hero-camera-input"} className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 min-h-[44px] ${heroUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
                  Take photo
                </label>
                <label htmlFor={heroUploading ? undefined : "hero-files-input"} className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-600 hover:border-emerald-500 hover:text-emerald-700 min-h-[44px] ${heroUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
                  {heroUploading ? "Uploading..." : "Choose from files"}
                </label>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Choose from web images</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={loadPhotoGallery}
                      disabled={searchWebLoading || !profile}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100 min-h-[44px] disabled:opacity-50 disabled:pointer-events-none`}
                    >
                      {searchWebLoading ? "Loading web images…" : "Refresh photos"}
                    </button>
                    {searchWebLoading && (
                      <button
                        type="button"
                        onClick={cancelSearchWeb}
                        className="px-4 py-3 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-700 font-medium hover:bg-neutral-100 min-h-[44px]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {searchWebError && (
                <div className="space-y-1">
                  <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">{searchWebError}</p>
                  <p className="text-xs text-neutral-500">Click Refresh photos to try again.</p>
                </div>
              )}
              {saveHeroError && (
                <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">{saveHeroError}</p>
              )}
              {searchWebGalleryUrls.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
                    {savingWebHero ? "Saving…" : "Pick a photo"}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {searchWebGalleryUrls.map((url, idx) => (
                      <button
                        key={`${url}-${idx}`}
                        type="button"
                        onClick={async () => {
                          if (galleryImageFailed.has(url) || savingWebHero || !user?.id || !id || !session?.access_token) return;
                          setSaveHeroError(null);
                          setSavingWebHero(true);
                          try {
                            const res = await fetch("/api/seed/save-hero-from-url", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                              body: JSON.stringify({ url, profile_id: id }),
                            });
                            const data = (await res.json()) as { path?: string; error?: string };
                            if (res.ok && data.path) {
                              await setHeroFromPath(data.path);
                              setShowSetPhotoModal(false);
                              const name = (profile?.name ?? "").trim() || "Imported seed";
                              const variety = (profile?.variety_name ?? "").trim() ?? "";
                              const vendor = packets.length > 0 ? (packets[0].vendor_name ?? "").trim() : "";
                              const identityKey = identityKeyFromVariety(name, variety);
                              if (identityKey) {
                                fetch("/api/seed/save-hero-to-cache", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                                  body: JSON.stringify({ identity_key: identityKey, hero_image_url: url, name, variety, vendor }),
                                }).catch((err) => console.error("[save-hero-to-cache]", err));
                              }
                            } else {
                              setSaveHeroError(data.error ?? "Couldn't save image. Try another tile or Refresh photos.");
                            }
                          } finally {
                            setSavingWebHero(false);
                          }
                        }}
                        disabled={galleryImageFailed.has(url) || savingWebHero}
                        className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-emerald-500 bg-neutral-100 min-h-[44px] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-60 disabled:pointer-events-none"
                      >
                        {galleryImageFailed.has(url) ? (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-neutral-500 text-xs text-center p-2">This image couldn&apos;t be loaded. Try another tile or Refresh photos.</div>
                        ) : (
                          <img
                            src={externalImageSrc(url)}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={() => setGalleryImageFailed((prev) => new Set(prev).add(url))}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {heroUrl && !stockPhotoCurrentFailed && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">Stock photo (current)</p>
                  <button type="button" onClick={() => { setHeroFromUrl(heroUrl); setShowSetPhotoModal(false); }} className="inline-block w-20 h-20 rounded-lg overflow-hidden border-2 border-emerald-500 bg-neutral-100">
                    <img src={externalImageSrc(heroUrl)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={() => setStockPhotoCurrentFailed(true)} />
                  </button>
                </div>
              )}
              {packets.filter((p) => p.primary_image_path?.trim()).length > 0 && (
                <div><p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">Packet photos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {packets.filter((p) => p.primary_image_path?.trim()).map((pkt) => { const src = supabase.storage.from("seed-packets").getPublicUrl(pkt.primary_image_path!).data.publicUrl; return (
                      <button key={pkt.id} type="button" onClick={() => setHeroFromPacket(pkt.primary_image_path!)} disabled={heroUploading} className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-emerald-500 disabled:opacity-50"><img src={src} alt="" className="w-full h-full object-cover" /></button>
                    ); })}
                  </div>
                </div>
              )}
              {journalPhotos.length > 0 && (
                <div><p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">Growth Gallery</p>
                  <div className="grid grid-cols-3 gap-2">
                    {journalPhotos.map((photo) => { const src = supabase.storage.from("journal-photos").getPublicUrl(photo.image_file_path).data.publicUrl; return (
                      <button key={photo.id} type="button" onClick={() => setHeroFromJournal(photo)} className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-emerald-500"><img src={src} alt="" className="w-full h-full object-cover" /></button>
                    ); })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 p-4 border-t border-neutral-200">
              <button type="button" onClick={() => setShowSetPhotoModal(false)} className="w-full py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 min-h-[44px]">Done</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-lg max-w-md w-full max-h-[calc(100dvh-6rem)] sm:max-h-[90vh] flex flex-col overflow-hidden border-t border-neutral-200 sm:border-t-0">
            <div className="flex-shrink-0 p-4 pb-2 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">Edit Plant Profile</h2>
              <button type="button" onClick={() => setShowEditModal(false)} disabled={savingEdit} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-50" aria-label="Close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 border-t border-neutral-100 space-y-4">
              {[
                { id: "edit-status", label: "Status", key: "status" as const },
                { id: "edit-plant-type", label: "Plant Type", key: "plantType" as const },
                { id: "edit-variety-name", label: "Variety Name", key: "varietyName" as const },
                { id: "edit-sun", label: "Sun", key: "sun" as const },
                { id: "edit-water", label: "Water", key: "water" as const },
                { id: "edit-spacing", label: "Spacing", key: "spacing" as const },
                { id: "edit-germination", label: "Germination", key: "germination" as const },
                { id: "edit-maturity", label: "Days to Maturity", key: "maturity" as const, placeholder: "e.g. 75" },
                { id: "edit-sowing-method", label: "Sowing Method", key: "sowingMethod" as const, placeholder: "e.g. Direct Sow or Start Indoors" },
                { id: "edit-planting-window", label: "Planting Window", key: "plantingWindow" as const, placeholder: "e.g. Spring: Feb-May" },
              ].map((f) => (
                <div key={f.id}>
                  <label htmlFor={f.id} className="block text-sm font-medium text-neutral-700 mb-1">{f.label}</label>
                  {f.key === "status" ? (
                    <select
                      id={f.id}
                      value={editForm.status.trim() || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      aria-label="Status"
                    >
                      {!editForm.status.trim() && <option value="">—</option>}
                      {PROFILE_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                      {editForm.status.trim() && !PROFILE_STATUS_OPTIONS.some((o) => o.value === editForm.status.trim()) && (
                        <option value={editForm.status.trim()}>{editForm.status}</option>
                      )}
                    </select>
                  ) : (
                    <input id={f.id} type="text" value={editForm[f.key]} onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))} placeholder={(f as { placeholder?: string }).placeholder} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                  )}
                  {f.key === "plantingWindow" && !editForm.plantingWindow.trim() && (
                    <p className="text-xs text-amber-600 mt-1">
                      Set planting window for better recommendations.
                      {zone10bSchedule?.planting_window && (
                        <button type="button" onClick={() => setEditForm((prev) => ({ ...prev, plantingWindow: zone10bSchedule!.planting_window }))} className="ml-2 underline hover:text-amber-800">
                          Use: {zone10bSchedule.planting_window}
                        </button>
                      )}
                    </p>
                  )}
                </div>
              ))}
              <div>
                <label htmlFor="edit-purchase-date" className="block text-sm font-medium text-neutral-700 mb-1">Purchase Date</label>
                <input id="edit-purchase-date" type="date" value={editForm.purchaseDate} onChange={(e) => setEditForm((f) => ({ ...f, purchaseDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label htmlFor="edit-growing-notes" className="block text-sm font-medium text-neutral-700 mb-1">Growing Notes</label>
                <textarea id="edit-growing-notes" rows={3} value={editForm.growingNotes} onChange={(e) => setEditForm((f) => ({ ...f, growingNotes: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label htmlFor="edit-companion-plants" className="block text-sm font-medium text-neutral-700 mb-1">Companion plants</label>
                <input id="edit-companion-plants" type="text" value={editForm.companionPlants} onChange={(e) => setEditForm((f) => ({ ...f, companionPlants: e.target.value }))} placeholder="e.g. Basil, Carrot" className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" aria-label="Companion plants" />
              </div>
              <div>
                <label htmlFor="edit-avoid-plants" className="block text-sm font-medium text-neutral-700 mb-1">Avoid plants</label>
                <input id="edit-avoid-plants" type="text" value={editForm.avoidPlants} onChange={(e) => setEditForm((f) => ({ ...f, avoidPlants: e.target.value }))} placeholder="e.g. Fennel, Potato" className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" aria-label="Avoid plants" />
              </div>
            </div>
            <div className="flex-shrink-0 p-4 pb-4 border-t border-neutral-200 bg-white space-y-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              <button type="button" onClick={handleSaveEdit} disabled={savingEdit} className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">{savingEdit ? "Saving..." : "Save Changes"}</button>
              {!(profile && "vendor" in profile && (profile as PlantVarietyProfile).vendor != null) && (
                <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={savingEdit} className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-red-200 text-red-700 font-medium hover:bg-red-50 disabled:opacity-50">Delete Plant Profile</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="alertdialog" aria-modal="true" aria-labelledby="delete-profile-title">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 id="delete-profile-title" className="text-lg font-semibold text-neutral-900 mb-2">Delete Plant Profile?</h2>
            <p className="text-sm text-neutral-600 mb-4">
              This will remove this plant profile and all associated data: seed packets, growing instances, journal entries, and care schedules. This cannot be undone.
            </p>
            {error && <p className="text-sm text-red-600 mb-4" role="alert">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowDeleteConfirm(false); setError(null); }} disabled={deletingProfile} className="flex-1 min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleDeleteProfile} disabled={deletingProfile} className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50">{deletingProfile ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Main Content (swipe left/right on mobile to change profile)       */}
      {/* ================================================================ */}
      <div
        className="mx-auto max-w-2xl px-6 pt-6 relative touch-pan-y"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        {/* Prev/next profile arrows (mobile-friendly tap targets) */}
        {(prevId ?? nextId) && (
          <>
            {prevId ? (
              <Link
                href={validTab !== "about" ? `/vault/${prevId}?tab=${validTab}${fromParam === "garden" ? "&from=garden" : ""}` : `/vault/${prevId}${fromParam === "garden" ? "?from=garden" : ""}`}
                className="absolute left-0 top-[40%] z-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
                aria-label="Previous plant profile"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
              </Link>
            ) : null}
            {nextId ? (
              <Link
                href={validTab !== "about" ? `/vault/${nextId}?tab=${validTab}${fromParam === "garden" ? "&from=garden" : ""}` : `/vault/${nextId}${fromParam === "garden" ? "?from=garden" : ""}`}
                className="absolute right-0 top-[40%] z-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
                aria-label="Next plant profile"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
              </Link>
            ) : null}
          </>
        )}
        {validTab === "journal" ? (
          <Link href="/journal?view=timeline" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">&larr; Back to Journal</Link>
        ) : fromParam === "garden" ? (
          <Link href="/garden?tab=plants" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">&larr; Back to My Plants</Link>
        ) : (
          <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">&larr; Back to Vault</Link>
        )}

        {/* Read-only banner for household members viewing someone else's profile */}
        {!isOwnProfile && !canEditUser(profileOwnerId) && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
            Viewing {profile?.name ?? "this"}&apos;s garden — read only
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900 break-words">{displayName}</h1>
                {looksLikeScientificName((profile as PlantProfile)?.scientific_name) && (
                  <p className="mt-0.5 text-sm text-neutral-500 italic" aria-label="Scientific name">
                    {stripHtmlForDisplay((profile as PlantProfile).scientific_name)}
                  </p>
                )}
              </div>
              {profileStatus && STATUS_COLORS[profileStatus] && (
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[profileStatus]}`}>{profileStatusLabel}</span>
              )}
              {isPlantableNow && (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Plant now</span>
              )}
            </div>
          </div>
          {isOwnProfile && (
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={openEditModal} className="p-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Edit profile"><PencilIcon /></button>
            </div>
          )}
        </div>

        {/* Hero */}
        <div className="mb-4 rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 relative aspect-[16/10] max-h-[300px] w-full">
          {heroImageUrl ? (
            <>
              <img src={heroImageUrl} alt="" className="w-full h-full object-cover" onError={() => setImageError(true)} />
              {canEdit && (
                <div className="absolute bottom-3 right-3">
                  <button type="button" onClick={() => setShowSetPhotoModal(true)} className="px-3 py-1.5 rounded-xl bg-white/90 border border-neutral-200 text-xs font-medium text-neutral-700 shadow hover:bg-white min-w-[44px] min-h-[44px] flex items-center justify-center">Change photo</button>
                </div>
              )}
            </>
          ) : showHeroResearching ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 relative">
              <div className="absolute inset-0 bg-neutral-200/80 animate-pulse" aria-hidden />
              <span className="text-5xl text-neutral-400 opacity-80 z-10" aria-hidden>🌱</span>
              <p className="z-10 text-sm text-neutral-600 font-medium">Finding a photo...</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6">
              <span className="text-5xl text-neutral-300" aria-hidden>🌱</span>
              {canEdit && (
                <button type="button" onClick={() => setShowSetPhotoModal(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow hover:bg-emerald-700 min-w-[44px] min-h-[44px]">Add Photo</button>
              )}
              {findHeroError && <p className="text-sm text-amber-700 text-center max-w-xs" role="alert">{findHeroError}</p>}
            </div>
          )}
        </div>

        {/* Tabs — unified for all profile types: About, Packets, Plantings, Journal. Care is in About. */}
        <div className="flex flex-wrap border-b border-neutral-200 gap-0 mb-4 overflow-visible">
          {(["about","packets","plantings","journal"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-0 min-h-[44px] px-2 py-2 text-[11px] sm:text-sm font-medium border-b-2 -mb-px transition-colors text-center truncate ${activeTab === tab ? "border-emerald-600 text-emerald-700" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
              {tab === "about" ? "About" : tab === "packets" ? `Pkts (${packetCount})` : tab === "plantings" ? `Plants (${plantingsCount})` : `Journal (${journalEntries.length})`}
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* ABOUT TAB                                                     */}
        {/* ============================================================ */}
        {activeTab === "about" && (
          <>
            {/* Description (profile-level: vendor or AI) */}
            {!isLegacy && (profile as PlantProfile)?.plant_description?.trim() && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("description")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("description")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Description</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("description") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("description") && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{(profile as PlantProfile).plant_description}</p>
                    {(profile as PlantProfile).description_source && (
                      <p className="text-xs text-neutral-500 mt-2">
                        Source: {(profile as PlantProfile).description_source === "vendor" ? "Vendor" : (profile as PlantProfile).description_source === "ai" ? "AI research" : "You"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Growing Notes — moved up so it’s visible; under Description, above How to Grow */}
            {growingNotes && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("growingNotes")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("growingNotes")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Growing Notes</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("growingNotes") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("growingNotes") && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{growingNotes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl border border-neutral-200 mb-4">
              <button type="button" onClick={() => toggleAboutSection("howToGrow")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("howToGrow")}>
                <h3 className="text-sm font-semibold text-neutral-700">How to Grow</h3>
                <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("howToGrow") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
              </button>
              {isAboutOpen("howToGrow") && (
              <div className="px-4 pb-4 pt-0 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-2">Planting</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {careList.map(({ label, value }) => (
                      <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="text-sm text-neutral-900 font-medium">{value}</dd></div>
                    ))}
                  </dl>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-2">Growing</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {growingList.map(({ label, value }) => (
                      <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="text-sm text-neutral-900 font-medium">{value}</dd></div>
                    ))}
                  </dl>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-2">Harvest</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {harvestList.map(({ label, value }) => (
                      <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="text-sm text-neutral-900 font-medium">{value}</dd></div>
                    ))}
                  </dl>
                </div>
              </div>
              )}
            </div>

            {/* Companion planting */}
            {(() => {
              const pp = profile as PlantProfile | null;
              const companions = pp?.companion_plants ?? [];
              const avoid = pp?.avoid_plants ?? [];
              const hasCompanions = Array.isArray(companions) && companions.length > 0;
              const hasAvoid = Array.isArray(avoid) && avoid.length > 0;
              const hasAny = hasCompanions || hasAvoid;
              return (
                <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                  <button type="button" onClick={() => toggleAboutSection("companion")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("companion")}>
                    <h3 className="text-sm font-semibold text-neutral-700">Companion planting</h3>
                    <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("companion") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                  </button>
                  {isAboutOpen("companion") && (
                  <div className="px-4 pb-4 pt-0">
                  {hasAny ? (
                    <div className="space-y-3">
                      {hasCompanions && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1.5">Plant with</p>
                          <TagBadges tags={companions} />
                        </div>
                      )}
                      {hasAvoid && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-700 mb-1.5">Don&apos;t plant with</p>
                          <div className="flex flex-wrap gap-1.5">
                            {avoid.map((name) => {
                              const key = name.trim();
                              if (!key) return null;
                              return (
                                <span key={key} className="inline-block text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                                  {key}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">None known</p>
                  )}
                  </div>
                  )}
                </div>
              );
            })()}

            {/* Vendor recommendations (by packet) */}
            {packets.some((p) => p.vendor_specs && Object.keys(p.vendor_specs).length > 0) && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("vendorRecs")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("vendorRecs")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Vendor recommendations</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("vendorRecs") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("vendorRecs") && (
                <div className="px-4 pb-4 pt-0">
                <p className="text-xs text-neutral-500 mb-3">What each packet or vendor says about growing this variety.</p>
                <ul className="space-y-4">
                  {packets
                    .filter((p) => p.vendor_specs && Object.keys(p.vendor_specs).length > 0)
                    .map((pkt) => {
                      const vs = pkt.vendor_specs as VendorSpecs | undefined;
                      const vendorLabel = (pkt.vendor_name ?? "").trim() || "Unknown vendor";
                      const parts: string[] = [];
                      if (vs?.sowing_depth) parts.push(`Sow: ${vs.sowing_depth}`);
                      if (vs?.spacing) parts.push(`Spacing: ${vs.spacing}`);
                      if (vs?.sun_requirement) parts.push(`Sun: ${vs.sun_requirement}`);
                      if (vs?.days_to_germination) parts.push(`Germ: ${vs.days_to_germination}`);
                      if (vs?.days_to_maturity) parts.push(`Maturity: ${vs.days_to_maturity}`);
                      return (
                        <li key={pkt.id} className="border border-neutral-100 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-sm font-medium text-neutral-800">{vendorLabel}</span>
                            {pkt.purchase_url?.trim() && (
                              <a href={pkt.purchase_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline truncate max-w-[140px]">Link</a>
                            )}
                          </div>
                          <p className="text-sm text-neutral-600">{parts.join(" · ") || "—"}</p>
                          {vs?.plant_description?.trim() && (
                            <p className="text-xs text-neutral-500 mt-2 line-clamp-2">{vs.plant_description}</p>
                          )}
                        </li>
                      );
                    })}
                </ul>
                </div>
                )}
              </div>
            )}

            {/* Tags */}
            {profile?.tags && profile.tags.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("tags")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("tags")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Tags</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("tags") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("tags") && (
                <div className="px-4 pb-4 pt-0">
                  <TagBadges tags={profile.tags} />
                </div>
                )}
              </div>
            )}

            {/* Care Templates (seed profiles -- auto-copy to plantings) */}
            {!isPermanent && !isLegacy && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("careTemplates")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("careTemplates")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Care Templates</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("careTemplates") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("careTemplates") && (
                <div className="px-4 pb-4 pt-0">
                  <p className="text-xs text-neutral-500 mb-3">Recurring care that auto-copies when you plant this variety.</p>
                  <CareScheduleManager profileId={id} userId={user?.id ?? ""} schedules={careSchedules} onChanged={loadProfile} readOnly={!canEdit} />
                </div>
                )}
              </div>
            )}

            {/* Care Schedules (permanent profiles -- instance-level) */}
            {isPermanent && !isLegacy && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("careSchedules")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("careSchedules")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Care Schedules</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("careSchedules") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("careSchedules") && (
                <div className="px-4 pb-4 pt-0">
                  <CareScheduleManager profileId={id} userId={user?.id ?? ""} schedules={careSchedules} onChanged={loadProfile} isTemplate={false} readOnly={!canEdit} growInstances={growInstances} isPermanent={isPermanent} />
                </div>
                )}
              </div>
            )}

            {/* Source URL */}
            {packets.length > 0 && packets[0].purchase_url?.trim() && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("source")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("source")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Source</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("source") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("source") && (
                <div className="px-4 pb-4 pt-0">
                  <a href={packets[0].purchase_url} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline break-all">{packets[0].purchase_url}</a>
                </div>
                )}
              </div>
            )}

            {/* Growth Gallery */}
            {journalPhotos.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("growthGallery")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("growthGallery")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Growth Gallery</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("growthGallery") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("growthGallery") && (
                <div className="px-4 pb-4 pt-0">
                  <div className="overflow-x-auto flex gap-2 pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
                    {journalPhotos.map((photo) => {
                      const src = supabase.storage.from("journal-photos").getPublicUrl(photo.image_file_path).data.publicUrl;
                      return <div key={photo.id} className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-neutral-100 snap-center"><Image src={src} alt="" width={96} height={96} className="w-full h-full object-cover" sizes="96px" unoptimized={src.startsWith("data:") || !src.includes("supabase.co")} /></div>;
                    })}
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Legacy content */}
            {isLegacy && legacyNotes.trim() && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("legacyNotes")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("legacyNotes")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Notes</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("legacyNotes") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("legacyNotes") && (
                <div className="px-4 pb-4 pt-0">
                  <p className="text-neutral-700 whitespace-pre-wrap text-sm">{legacyNotes}</p>
                </div>
                )}
              </div>
            )}
            {(legacyPlantDesc?.trim() || legacyGrowingInfo?.trim()) && (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-4">
                <button type="button" onClick={() => setVendorDetailsOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left font-medium text-neutral-800 bg-neutral-50 hover:bg-neutral-100 border-b border-neutral-200" aria-expanded={vendorDetailsOpen}>
                  <span>Vendor Details</span><span className="text-neutral-500 text-lg" aria-hidden>{vendorDetailsOpen ? "-" : "+"}</span>
                </button>
                {vendorDetailsOpen && (
                  <div className="p-4 space-y-4">
                    {formatVendorDetails(legacyPlantDesc ?? null, legacyGrowingInfo ?? null).map(({ title, body }) => (
                      <div key={title}><h4 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-1">{title}</h4><p className="text-neutral-800 whitespace-pre-wrap text-sm">{body}</p></div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isLegacy && legacySourceUrl?.trim() && (
              <div className="bg-white rounded-xl border border-neutral-200 mb-4">
                <button type="button" onClick={() => toggleAboutSection("legacyImport")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("legacyImport")}>
                  <h3 className="text-sm font-semibold text-neutral-700">Import link</h3>
                  <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("legacyImport") ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                </button>
                {isAboutOpen("legacyImport") && (
                <div className="px-4 pb-4 pt-0">
                  <a href={legacySourceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline break-all text-sm">{legacySourceUrl}</a>
                </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* PACKETS TAB                                                   */}
        {/* ============================================================ */}
        {activeTab === "packets" && (
          <>
            {packets.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                <p className="text-neutral-500 text-sm">No seed packets yet.</p>
                {canEdit && !isPermanent && (
                  <>
                    <p className="text-neutral-400 text-xs mt-1 mb-4">Add a packet here or from the Vault import.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddPacketModal(true)}
                      className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      Add seed packet
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <ul className="divide-y divide-neutral-100">
                  {sortedPackets.map((pkt) => {
                    const year = pkt.purchase_date ? new Date(pkt.purchase_date).getFullYear() : null;
                    const open = openPacketDetails.has(pkt.id);
                    const extraImgs = packetImagesByPacketId.get(pkt.id) ?? [];
                    const pktImageUrls = getPacketImageUrls(pkt, extraImgs);
                    const pktImageUrl = pktImageUrls[0] ?? null;
                    const isArchived = (pkt.qty_status ?? 0) <= 0;
                    return (
                      <li key={pkt.id} className={`p-4 ${isArchived ? "bg-neutral-50 text-neutral-500" : ""}`}>
                        {/* Row 1: image | vendor+stars+chevron */}
                        <div className="flex items-center gap-3">
                          {pktImageUrl && (
                            <button
                              type="button"
                              onClick={() => pktImageUrls.length > 0 && setImageLightbox({ urls: pktImageUrls, index: 0 })}
                              className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 min-w-[56px] min-h-[56px] ${isArchived ? "bg-neutral-200 opacity-80" : "bg-neutral-100"} hover:ring-2 hover:ring-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                              aria-label="View packet photos"
                            >
                              <img src={pktImageUrl} alt="" className="w-full h-full object-cover" />
                            </button>
                          )}
                          {/* Header: [vendor name] [stars] [chevron] */}
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {/* Vendor name — tapping this expands */}
                            <button
                              type="button"
                              onClick={() => togglePacketDetails(pkt.id)}
                              className={`flex items-center gap-1 font-medium text-left min-h-[44px] -m-2 p-2 flex-1 min-w-0 ${isArchived ? "text-neutral-500 hover:text-neutral-700" : "text-neutral-900 hover:text-emerald-600"}`}
                              aria-expanded={open}
                              aria-label={`${pkt.vendor_name?.trim() || "Packet"} — tap to ${open ? "collapse" : "expand"}`}
                            >
                              <span className="truncate">{pkt.vendor_name?.trim() || "--"}</span>
                              {year != null && <span className="text-neutral-500 text-sm shrink-0">{year}</span>}
                            </button>
                            {/* Stars — separate interactive element, only active when expanded */}
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              <StarRating
                                value={pkt.packet_rating ?? null}
                                interactive={canEdit && open}
                                onChange={canEdit && open ? (rating) => updatePacketRating(pkt.id, rating) : undefined}
                                size="sm"
                                label="Packet rating"
                              />
                            </div>
                            {/* Chevron — dedicated expand toggle, far right */}
                            <button
                              type="button"
                              onClick={() => togglePacketDetails(pkt.id)}
                              className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-emerald-600"
                              aria-label={open ? "Collapse packet details" : "Expand packet details"}
                            >
                              <span className={`inline-flex transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
                                <ChevronDownIcon />
                              </span>
                            </button>
                          </div>
                        </div>
                        {/* Row 2: date + qty controls */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <input type="date" aria-label="Purchase date" value={pkt.purchase_date ? toDateInputValue(pkt.purchase_date) : ""} onChange={(e) => updatePacketPurchaseDate(pkt.id, e.target.value)} className="w-[8.5rem] px-2 py-1 text-sm rounded border border-neutral-300 focus:ring-emerald-500" disabled={!canEdit} />
                          <PacketQtyOptions
                            value={pkt.qty_status}
                            onChange={(v) => updatePacketQty(pkt.id, v)}
                            variant="remaining"
                            disabled={!canEdit}
                          />
                        </div>
                        {open && (
                          <div className="mt-3 pt-3 border-t border-neutral-100 space-y-3">
                            {pktImageUrls.length > 0 && (
                              <div>
                                <p className="text-xs font-medium uppercase text-neutral-500 mb-2">Packet photos</p>
                                <div className="flex flex-wrap gap-2">
                                  {pktImageUrls.map((url, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setImageLightbox({ urls: pktImageUrls, index: idx })}
                                      className="w-16 h-16 rounded-lg overflow-hidden shrink-0 min-w-[64px] min-h-[64px] border-2 border-transparent hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-neutral-100"
                                      aria-label={`View photo ${idx + 1} of ${pktImageUrls.length}`}
                                    >
                                      <img src={url} alt="" className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {pkt.scraped_details?.trim() && (<><p className="text-xs font-medium uppercase text-neutral-500 mb-1">Original Details</p><p className="text-neutral-800 whitespace-pre-wrap text-sm">{pkt.scraped_details}</p></>)}
                            {pkt.purchase_url?.trim() && <a href={pkt.purchase_url} target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 underline hover:text-neutral-700 inline-block">View purchase link</a>}
                            {canEdit && (
                              <>
                                <div>
                                  <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Your notes</p>
                                  <textarea
                                    value={pkt.user_notes ?? ""}
                                    onChange={(e) => updatePacketNotes(pkt.id, e.target.value, { persist: false })}
                                    onBlur={(e) => updatePacketNotes(pkt.id, e.target.value, { persist: true })}
                                    placeholder="Optional notes for this packet"
                                    rows={2}
                                    className="w-full px-2 py-1.5 text-sm rounded border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                                    aria-label="Packet notes"
                                  />
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Storage location</p>
                                  <input
                                    type="text"
                                    value={pkt.storage_location ?? ""}
                                    onChange={(e) => updatePacketStorageLocation(pkt.id, e.target.value, { persist: false })}
                                    onBlur={(e) => updatePacketStorageLocation(pkt.id, e.target.value, { persist: true })}
                                    placeholder="e.g. Green box, drawer"
                                    className="w-full px-2 py-1.5 text-sm rounded border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                                    aria-label="Storage location"
                                  />
                                </div>
                              </>
                            )}
                            {!canEdit && pkt.user_notes?.trim() && (
                              <div>
                                <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Notes</p>
                                <p className="text-sm text-neutral-700">{pkt.user_notes}</p>
                              </div>
                            )}
                            {!canEdit && pkt.storage_location?.trim() && (
                              <div>
                                <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Storage location</p>
                                <p className="text-sm text-neutral-700">{pkt.storage_location}</p>
                              </div>
                            )}
                            {(() => {
                              const plantingsForPacket = growInstances.filter((gi) => (gi as { seed_packet_id?: string }).seed_packet_id === pkt.id);
                              const withGermination = plantingsForPacket.filter((gi) => (gi as GrowInstance).seeds_sown != null && (gi as GrowInstance).seeds_sprouted != null && (gi as GrowInstance).seeds_sown! > 0);
                              const avgGerm = withGermination.length >= 2
                                ? Math.round(withGermination.reduce((sum, gi) => sum + (100 * (gi as GrowInstance).seeds_sprouted! / (gi as GrowInstance).seeds_sown!), 0) / withGermination.length)
                                : null;
                              return (
                                <div>
                                  <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Germination</p>
                                  {plantingsForPacket.length === 0 ? (
                                    <p className="text-sm text-neutral-400">No plantings used this packet yet.</p>
                                  ) : (
                                    <ul className="space-y-1">
                                      {plantingsForPacket.map((gi) => {
                                        const g = gi as GrowInstance;
                                        const germ = g.seeds_sown != null && g.seeds_sprouted != null && g.seeds_sown > 0
                                          ? `${g.seeds_sprouted} of ${g.seeds_sown} sprouted`
                                          : null;
                                        return (
                                          <li key={gi.id} className="text-sm">
                                            <span className="text-neutral-500">{formatDisplayDate(gi.sown_date)}</span>
                                            {gi.location && <span className="text-neutral-500"> · {gi.location}</span>}
                                            {germ && <span className="text-emerald-600 font-medium ml-1"> · {germ}</span>}
                                          </li>
                                        );
                                      })}
                                      {avgGerm != null && (
                                        <li className="text-sm font-medium text-emerald-700 pt-1">Avg germination: {avgGerm}%</li>
                                      )}
                                    </ul>
                                  )}
                                </div>
                              );
                            })()}
                            <div>
                              <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Used in journal</p>
                              {loadingJournalForPacket.has(pkt.id) ? <p className="text-sm text-neutral-400">Loading...</p> : (journalByPacketId[pkt.id]?.length ?? 0) > 0 ? (
                                <ul className="space-y-1.5">{journalByPacketId[pkt.id].map((entry) => (<li key={entry.id} className="text-sm"><span className="text-neutral-500">{formatDisplayDate(entry.created_at)}</span>{entry.note?.trim() && <span className="text-neutral-800"> - {entry.note.trim()}</span>}</li>))}</ul>
                              ) : <p className="text-sm text-neutral-400">No journal entries linked to this packet yet.</p>}
                            </div>
                            {canEdit && (
                              <div className="pt-2 border-t border-neutral-100 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => deletePacket(pkt.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[36px]"
                                  aria-label="Remove packet"
                                >
                                  <TrashIcon />
                                  Remove packet
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {canEdit && !isPermanent && (
                  <div className="p-4 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setShowAddPacketModal(true)}
                      className="min-h-[44px] min-w-[44px] px-3 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      + Add another packet
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* PLANTINGS TAB                                                 */}
        {/* ============================================================ */}
        {activeTab === "plantings" && (
          <>
            {growInstances.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                <p className="text-neutral-500 text-sm">{isPermanent ? "No plants yet." : "No plantings yet."}</p>
                <p className="text-neutral-400 text-xs mt-1 mb-4">
                  {isPermanent ? "Add your trees or perennials here." : "Start a new planting from your seed packets."}
                </p>
                {isPermanent && canEdit && (
                  <button
                    type="button"
                    onClick={() => { setAddPlantError(null); setShowAddPlantModal(true); }}
                    className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    aria-label="Add plant"
                  >
                    Add your first plant
                  </button>
                )}
                {!isPermanent && canEdit && (
                  <Link
                    href={`/vault/plant?ids=${encodeURIComponent(id)}`}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    aria-label="Add planting"
                  >
                    Add planting
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {canEdit && (
                  <div className="flex justify-end">
                    {isPermanent ? (
                      <button
                        type="button"
                        onClick={() => { setAddPlantError(null); setShowAddPlantModal(true); }}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        aria-label="Add plant"
                      >
                        + Add plant
                      </button>
                    ) : (
                      <Link
                        href={`/vault/plant?ids=${encodeURIComponent(id)}`}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        aria-label="Add planting"
                      >
                        + Add plant
                      </Link>
                    )}
                  </div>
                )}
                {growInstances.map((gi, giIdx) => {
                  const giJournals = journalEntries.filter((j) => j.grow_instance_id === gi.id);
                  const harvests = giJournals.filter((j) => j.entry_type === "harvest");
                  const statusColor = gi.status === "growing" ? "bg-green-100 text-green-800" : gi.status === "harvested" ? "bg-amber-100 text-amber-800" : gi.status === "dead" ? "bg-red-100 text-red-800" : "bg-neutral-100 text-neutral-700";
                  const isActive = gi.status === "growing" || gi.status === "pending";
                  const giCanEdit = canEditUser((gi as { user_id?: string }).user_id ?? profileOwnerId);
                  const sowBadge = !isPermanent && ((gi as GrowInstance).sow_method === "direct_sow" ? "Direct sow" : (gi as GrowInstance).sow_method === "seed_start" ? "Seed start" : null);
                  const plantLabel = isPermanent ? (gi.location?.trim() || `Plant ${giIdx + 1}`) : null;
                  const cardContent = (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isPermanent && plantLabel && <span className="text-sm font-medium text-neutral-900">{plantLabel}</span>}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{gi.status ?? "unknown"}</span>
                          {sowBadge && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{sowBadge}</span>}
                          {!isPermanent && gi.location && <span className="text-xs text-neutral-500">{gi.location}</span>}
                        </div>
                        <span className="text-xs text-neutral-500">{formatDisplayDate(gi.sown_date)}</span>
                      </div>
                      <div className="text-sm text-neutral-700 space-y-1">
                        {(gi as GrowInstance).seeds_sown != null && <span className="text-xs text-neutral-600">{(gi as GrowInstance).seeds_sown} sown</span>}
                        {(gi as GrowInstance).seeds_sprouted != null && (gi as GrowInstance).seeds_sown != null && (
                          <span className="text-xs text-neutral-600"> · {(gi as GrowInstance).seeds_sprouted} of {(gi as GrowInstance).seeds_sown} sprouted</span>
                        )}
                        {(gi as GrowInstance).plant_count != null && (
                          <span className="text-xs font-medium text-emerald-600 ml-1"> · {(gi as GrowInstance).plant_count} plants</span>
                        )}
                        {gi.end_reason && <p className="text-xs text-neutral-500">Ended: {gi.end_reason}</p>}
                        {harvests.length > 0 && <p className="text-xs text-emerald-600 font-medium">Harvested {harvests.length} time{harvests.length !== 1 ? "s" : ""}</p>}
                      </div>
                      {giJournals.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-neutral-100">
                          <p className="text-xs font-medium text-neutral-500 mb-2">Journal ({giJournals.length})</p>
                          <ul className="space-y-2 max-h-48 overflow-y-auto">
                            {giJournals.slice(0, 5).map((j) => (
                              <li key={j.id} className="text-sm">
                                <span className="text-neutral-400">{formatDisplayDate(j.created_at)}</span>
                                {j.entry_type && <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium ${j.entry_type === "harvest" ? "bg-amber-50 text-amber-700" : j.entry_type === "care" ? "bg-blue-50 text-blue-700" : j.entry_type === "pest" ? "bg-red-50 text-red-700" : "bg-neutral-50 text-neutral-600"}`}>{j.entry_type}</span>}
                                {j.note?.trim() && <span className="text-neutral-700 ml-1">- {j.note.trim().slice(0, 120)}</span>}
                              </li>
                            ))}
                            {giJournals.length > 5 && <li className="text-xs text-neutral-400">+{giJournals.length - 5} more entries</li>}
                          </ul>
                        </div>
                      )}
                    </>
                  );
                  const batchForLog: BatchLogBatch = {
                    id: gi.id,
                    plant_profile_id: gi.plant_profile_id ?? id,
                    profile_name: profile?.name ?? "",
                    profile_variety_name: profile?.variety_name ?? null,
                    seeds_sown: (gi as GrowInstance).seeds_sown ?? null,
                    seeds_sprouted: (gi as GrowInstance).seeds_sprouted ?? null,
                    plant_count: (gi as GrowInstance).plant_count ?? null,
                    location: gi.location ?? null,
                    user_id: (gi as { user_id?: string }).user_id ?? null,
                  };
                  return (
                    <div key={gi.id} className="bg-white rounded-xl border border-neutral-200 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isActive && !isPermanent ? (
                            <Link href={`/garden?tab=active&grow=${gi.id}`} className="block -m-2 p-2 rounded-xl hover:bg-neutral-50/80 transition-colors min-h-[44px]" aria-label={`View ${gi.status} planting in Active Garden`}>
                              {cardContent}
                            </Link>
                          ) : (
                            cardContent
                          )}
                        </div>
                        {giCanEdit && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setBatchLogTarget(batchForLog); setBatchLogOpen(true); }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 bg-white text-emerald-600 hover:bg-emerald/10 shrink-0"
                            aria-label="Log care or journal entry"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M5 19c0-3 2-6 5-7 1.5-.5 3 0 4 1" /><path d="M19 19c0-3-2-6-5-7-1.5-.5-3 0-4 1" />
                              <path d="M12 8.5C10.5 7 8 7.5 8 9.5c0 2 4 4 4 4s4-2 4-4c0-2-2.5-2.5-4-1z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* JOURNAL TAB                                                   */}
        {/* ============================================================ */}
        {activeTab === "journal" && (
          <>
            {journalEntries.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                <p className="text-neutral-500 text-sm">No journal entries yet.</p>
                <p className="text-neutral-400 text-xs mt-1">Entries appear here as you plant, care for, and harvest this variety.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {journalEntries.map((j) => {
                  const photoUrl = j.image_file_path ? supabase.storage.from("journal-photos").getPublicUrl(j.image_file_path).data.publicUrl : null;
                  return (
                    <div key={j.id} className="bg-white rounded-xl border border-neutral-200 p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500">{formatDisplayDate(j.created_at)}</span>
                          {j.entry_type && <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${j.entry_type === "harvest" ? "bg-amber-50 text-amber-700" : j.entry_type === "care" ? "bg-blue-50 text-blue-700" : j.entry_type === "pest" ? "bg-red-50 text-red-700" : j.entry_type === "death" ? "bg-red-100 text-red-800" : "bg-neutral-50 text-neutral-600"}`}>{j.entry_type}</span>}
                        </div>
                        {j.weather_snapshot && typeof j.weather_snapshot === "object" && "temp" in j.weather_snapshot && (
                          <span className="text-xs text-neutral-400">{j.weather_snapshot.icon} {Math.round(j.weather_snapshot.temp as number)}°F</span>
                        )}
                      </div>
                      {j.note?.trim() && <p className="text-sm text-neutral-700 whitespace-pre-wrap mb-2">{j.note}</p>}
                      {j.entry_type === "harvest" && (j.harvest_weight != null || j.harvest_quantity != null) && (
                        <p className="text-sm text-emerald-700 font-medium mb-2">
                          Harvested: {j.harvest_weight != null ? `${j.harvest_weight} ${j.harvest_unit || "units"}` : ""}{j.harvest_quantity != null ? `${j.harvest_weight != null ? ", " : ""}${j.harvest_quantity} count` : ""}
                        </p>
                      )}
                      {photoUrl && (
                        <div className="w-full max-w-xs rounded-lg overflow-hidden bg-neutral-100 mt-2">
                          <img src={photoUrl} alt="" className="w-full h-auto object-cover" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* CARE TAB (permanent plants)                                   */}
        {/* ============================================================ */}
      </div>

      {/* Add seed packet modal (when profile has 0 packets or adding another) */}
      {showAddPacketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" role="dialog" aria-modal="true" aria-labelledby="add-packet-title">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 max-w-md w-full max-h-[85vh] overflow-y-auto p-6">
            <h2 id="add-packet-title" className="text-lg font-bold text-neutral-900 mb-4">Add seed packet</h2>
            <form onSubmit={handleAddPacketSubmit} className="space-y-4">
              <div>
                <label htmlFor="add-packet-vendor" className="block text-sm font-medium text-neutral-700 mb-1">Vendor (optional)</label>
                <input
                  id="add-packet-vendor"
                  type="text"
                  value={addPacketVendor}
                  onChange={(e) => setAddPacketVendor(e.target.value)}
                  placeholder="e.g. Johnny's, Baker Creek"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Vendor name"
                />
              </div>
              <div>
                <label htmlFor="add-packet-date" className="block text-sm font-medium text-neutral-700 mb-1">Purchase date</label>
                <input
                  id="add-packet-date"
                  type="date"
                  value={addPacketPurchaseDate}
                  onChange={(e) => setAddPacketPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Purchase date"
                />
              </div>
              <div>
                <label htmlFor="add-packet-url" className="block text-sm font-medium text-neutral-700 mb-1">Purchase URL (optional)</label>
                <input
                  id="add-packet-url"
                  type="url"
                  value={addPacketUrl}
                  onChange={(e) => setAddPacketUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Purchase URL"
                />
              </div>
              {addPacketError && <p className="text-sm text-red-600" role="alert">{addPacketError}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowAddPacketModal(false)} disabled={addPacketSaving} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={addPacketSaving} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">{addPacketSaving ? "Adding…" : "Add packet"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Plant modal (permanent profiles) */}
      {showAddPlantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" role="dialog" aria-modal="true" aria-labelledby="add-plant-title">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 max-w-md w-full max-h-[85vh] overflow-y-auto p-6">
            <h2 id="add-plant-title" className="text-lg font-bold text-neutral-900 mb-4">Add plant</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleAddPlant(); }} className="space-y-4">
              <div>
                <label htmlFor="add-plant-date" className="block text-sm font-medium text-neutral-700 mb-1">Date planted</label>
                <input
                  id="add-plant-date"
                  type="date"
                  value={addPlantDate}
                  onChange={(e) => setAddPlantDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Date planted"
                />
              </div>
              <div>
                <label htmlFor="add-plant-location" className="block text-sm font-medium text-neutral-700 mb-1">Location (optional)</label>
                <input
                  id="add-plant-location"
                  type="text"
                  value={addPlantLocation}
                  onChange={(e) => setAddPlantLocation(e.target.value)}
                  placeholder="e.g. North fence, Backyard"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Location"
                />
              </div>
              {addPlantError && <p className="text-sm text-red-600" role="alert">{addPlantError}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowAddPlantModal(false); setAddPlantError(null); }} disabled={addPlantSaving} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={addPlantSaving} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">{addPlantSaving ? "Adding…" : "Add plant"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BatchLogSheet for Plantings tab */}
      <BatchLogSheet
        open={batchLogOpen}
        batches={batchLogTarget ? [batchLogTarget] : []}
        onClose={() => { setBatchLogOpen(false); setBatchLogTarget(null); }}
        onSaved={loadProfile}
        isPermanent={isPermanent}
        onLogHarvest={(b) => {
          setHarvestTarget({ profileId: b.plant_profile_id, growId: b.id, displayName: b.profile_variety_name?.trim() ? `${b.profile_name} (${b.profile_variety_name})` : b.profile_name });
          setBatchLogOpen(false);
          setBatchLogTarget(null);
        }}
        onEndBatch={(b) => { setEndBatchTarget(b); setBatchLogOpen(false); setBatchLogTarget(null); }}
        onDeleteBatch={(b) => { setDeleteBatchTarget(b); setBatchLogOpen(false); setBatchLogTarget(null); }}
        onQuickCare={handlePlantingsQuickCare}
      />

      <HarvestModal
        open={!!harvestTarget}
        onClose={() => setHarvestTarget(null)}
        onSaved={() => { loadProfile(); setHarvestTarget(null); }}
        profileId={harvestTarget?.profileId ?? ""}
        growInstanceId={harvestTarget?.growId ?? ""}
        displayName={harvestTarget?.displayName ?? ""}
      />

      {endBatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">End Batch</h2>
            <p className="text-sm text-neutral-600 mb-4">{endBatchTarget.profile_variety_name?.trim() ? `${endBatchTarget.profile_name} (${endBatchTarget.profile_variety_name})` : endBatchTarget.profile_name}</p>
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
            <textarea placeholder="Optional note..." value={endNote} onChange={(e) => setEndNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm mb-4 focus:ring-emerald-500" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEndBatchTarget(null)} className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Cancel</button>
              <button type="button" onClick={handlePlantingsEndBatch} disabled={endSaving} className={`px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 ${endReason === "plant_died" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}>
                {endSaving ? "Saving..." : endReason === "plant_died" ? "Mark as Dead" : "End Batch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteBatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Delete Batch</h2>
            <p className="text-sm text-neutral-600 mb-4">
              Permanently remove {deleteBatchTarget.profile_variety_name?.trim() ? `${deleteBatchTarget.profile_name} (${deleteBatchTarget.profile_variety_name})` : deleteBatchTarget.profile_name}? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteBatchTarget(null)} className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Cancel</button>
              <button type="button" onClick={handlePlantingsDeleteBatch} disabled={deleteSaving} className="px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {deleteSaving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Packet photo lightbox (tap thumbnail or gallery image to view full-size, swipe/arrows for multiple) */}
      {imageLightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Packet photo"
        >
          <button
            type="button"
            onClick={() => setImageLightbox(null)}
            className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/90 text-neutral-700 flex items-center justify-center hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[44px] min-h-[44px]"
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          {imageLightbox.urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setImageLightbox((prev) => prev && prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 text-neutral-700 flex items-center justify-center hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[44px] min-h-[44px]"
                aria-label="Previous photo"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button
                type="button"
                onClick={() => setImageLightbox((prev) => prev && prev.index < prev.urls.length - 1 ? { ...prev, index: prev.index + 1 } : prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 text-neutral-700 flex items-center justify-center hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[44px] min-h-[44px]"
                aria-label="Next photo"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-sm text-white/90 bg-black/40 px-3 py-1 rounded-full">
                {imageLightbox.index + 1} / {imageLightbox.urls.length}
              </span>
            </>
          )}
          <img
            src={imageLightbox.urls[imageLightbox.index]}
            alt=""
            className="max-w-full max-h-[85vh] object-contain rounded-lg relative z-0"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
