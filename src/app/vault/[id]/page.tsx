"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import type { PlantProfile, PlantVarietyProfile, SeedPacket, GrowInstance, JournalEntry, CareSchedule, CareScheduleSuggestion, VendorSpecs } from "@/types/garden";
import { getZone10bScheduleForPlant } from "@/data/zone10b_schedule";
import { getEffectiveCare } from "@/lib/plantCareHierarchy";
import { isPlantableInMonthSimple } from "@/lib/plantingWindowSimple";
import { TagBadges } from "@/components/TagBadges";
import { CareScheduleManager } from "@/components/CareScheduleManager";
import { CareSuggestions, GetAiSuggestionsButton } from "@/components/CareSuggestions";
import { StarRating } from "@/components/StarRating";
import { BatchLogSheet } from "@/components/BatchLogSheet";
import { PacketQtyOptions } from "@/components/PacketQtyOptions";
import { HarvestModal } from "@/components/HarvestModal";
import { AddPlantManualModal } from "@/components/AddPlantManualModal";
import { stripHtmlForDisplay, looksLikeScientificName } from "@/lib/htmlEntities";
import { SEED_PACKET_PROFILE_SELECT } from "@/lib/seedPackets";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { useToast } from "@/hooks/useToast";
import { PROFILE_STATUS_OPTIONS, getProfileStatusLabel } from "@/lib/profileStatus";
import { generateCareTasks } from "@/lib/generateCareTasks";
import { PlantImage } from "@/components/PlantImage";
import { PlantPlaceholderIcon } from "@/components/PlantPlaceholderIcon";
import { ICON_MAP } from "@/lib/styleDictionary";
import { ImageCropModal } from "@/components/ImageCropModal";
import dynamic from "next/dynamic";

const AddPlantModal = dynamic(
  () => import("@/components/AddPlantModal").then((m) => ({ default: m.AddPlantModal })),
  { ssr: false }
);
const QuickAddSeed = dynamic(
  () => import("@/components/QuickAddSeed").then((m) => ({ default: m.QuickAddSeed })),
  { ssr: false }
);
const QuickLogModal = dynamic(
  () => import("@/components/QuickLogModal").then((m) => ({ default: m.QuickLogModal })),
  { ssr: false }
);
const QuickAddSupply = dynamic(
  () => import("@/components/QuickAddSupply").then((m) => ({ default: m.QuickAddSupply })),
  { ssr: false }
);
const GrowInstanceModal = dynamic(
  () => import("@/components/GrowInstanceModal").then((m) => ({ default: m.GrowInstanceModal })),
  { ssr: false }
);

import { VaultProfileAboutTab } from "./VaultProfileAboutTab";
import { VaultProfileCareTab } from "./VaultProfileCareTab";
import { VaultProfilePacketsTab } from "./VaultProfilePacketsTab";
import { VaultProfilePlantingsTab } from "./VaultProfilePlantingsTab";
import { VaultProfileJournalTab } from "./VaultProfileJournalTab";
import { formatDisplayDate, getPacketImageUrls } from "./vaultProfileUtils";
import { useVaultPlantingsHandlers } from "./useVaultPlantingsHandlers";
import { useVaultPacketHandlers } from "./useVaultPacketHandlers";
import { useVaultHeroHandlers } from "./useVaultHeroHandlers";
import { useVaultEditHandlers } from "./useVaultEditHandlers";
import { useDesktopPhotoCapture } from "@/hooks/useDesktopPhotoCapture";

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

/** Treat placeholder hero as "no hero" so we use packet/journal/sprout fallback (Law 7). */
function isPlaceholderHeroUrl(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return true;
  return u === "/seedling-icon.svg" || u.endsWith("/seedling-icon.svg");
}

const STATUS_COLORS: Record<string, string> = {
  in_stock: "bg-emerald-100 text-emerald-800",
  out_of_stock: "bg-red-100 text-red-800",
  planted: "bg-blue-100 text-blue-800",
  growing: "bg-emerald-100 text-emerald-800",
};

/** Allowed profile status values for Edit modal; users must pick one, not free-text. */

// ===========================================================================
// Main component
// ===========================================================================
export default function VaultSeedPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session } = useAuth();
  const { canEditPage } = useHousehold();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<PlantProfile | null>(null);
  const [packets, setPackets] = useState<SeedPacket[]>([]);
  const [growInstances, setGrowInstances] = useState<(GrowInstance & { journal_count?: number })[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [careSchedules, setCareSchedules] = useState<CareSchedule[]>([]);
  const [standaloneTasks, setStandaloneTasks] = useState<{ id: string; title: string | null; category: string; due_date: string; completed_at: string | null; grow_instance_id: string | null }[]>([]);
  const [careSuggestions, setCareSuggestions] = useState<CareScheduleSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  const [vendorDetailsOpen, setVendorDetailsOpen] = useState(false);
  const [journalPhotos, setJournalPhotos] = useState<JournalPhoto[]>([]);
  const [entryIdToPhotoPaths, setEntryIdToPhotoPaths] = useState<Record<string, string[]>>({});
  const tabFromUrl = searchParams.get("tab");
  const fromParam = searchParams.get("from");
  const validTab = ["about", "care", "packets", "plantings", "journal"].includes(tabFromUrl ?? "") ? tabFromUrl as "about" | "care" | "packets" | "plantings" | "journal" : "about";
  const [activeTab, setActiveTab] = useState<"about" | "care" | "packets" | "plantings" | "journal">(validTab);

  useEffect(() => {
    setActiveTab(validTab);
  }, [id, validTab]);
  const [packetImagesByPacketId, setPacketImagesByPacketId] = useState<Map<string, { image_path: string }[]>>(new Map());
  const [imageLightbox, setImageLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [plantAgainAddPlantOpen, setPlantAgainAddPlantOpen] = useState(false);
  const [plantAgainQuickAddOpen, setPlantAgainQuickAddOpen] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [addFromQuickLogOpen, setAddFromQuickLogOpen] = useState(false);
  const [addFromQuickLogInitialName, setAddFromQuickLogInitialName] = useState("");
  const [suppliesRefreshKey, setSuppliesRefreshKey] = useState(0);
  const [quickLogGrowInstanceId, setQuickLogGrowInstanceId] = useState<string | null>(null);
  /** Read-only planting detail overlay from Plantings tab (replaces navigating away to Garden). */
  const [growViewId, setGrowViewId] = useState<string | null>(null);
  const skipGrowViewHistoryPopRef = useRef(false);

  // Ordered profile IDs for swipe prev/next (name A–Z); only plant_profiles
  const [orderedProfileIds, setOrderedProfileIds] = useState<string[]>([]);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const journalTabRef = useRef<HTMLDivElement | null>(null);

  // About tab: which sections are collapsed (default all open)
  const [aboutCollapsed, setAboutCollapsed] = useState<Record<string, boolean>>({});
  const isAboutOpen = (key: string) => !aboutCollapsed[key];
  const toggleAboutSection = (key: string) => setAboutCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // Plantable now
  const [isPlantableNow, setIsPlantableNow] = useState(false);

  // E2: First-time "Added to Vault" celebration (one-time per device)
  const [addedToVaultCelebration, setAddedToVaultCelebration] = useState(false);
  useEffect(() => {
    if (searchParams.get("added") !== "1") return;
    try {
      if (localStorage.getItem("first-added-to-vault-celebration-shown") === "1") return;
      localStorage.setItem("first-added-to-vault-celebration-shown", "1");
      setAddedToVaultCelebration(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("added");
      const newUrl = params.toString() ? `/vault/${id}?${params.toString()}` : `/vault/${id}`;
      router.replace(newUrl, { scroll: false });
      const t = setTimeout(() => setAddedToVaultCelebration(false), 1200);
      return () => clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, [id, router, searchParams]);

  // True when the profile belongs to the current user; false when viewing a household member's profile
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  // The user_id of the profile owner (may differ from user.id when viewing family profiles)
  const [profileOwnerId, setProfileOwnerId] = useState<string>("");

  // Add packet modal (single entry point: Plant Again with 0 packets or Packets tab "Add seed packet")
  const [addPlantManualOpen, setAddPlantManualOpen] = useState(false);

  useModalBackClose(!!imageLightbox, () => setImageLightbox(null));
  useModalBackClose(addPlantManualOpen, () => setAddPlantManualOpen(false));
  useModalBackClose(!!growViewId, () => setGrowViewId(null), skipGrowViewHistoryPopRef);

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
      .select("id, name, variety_name, user_id, sun, water, harvest_days, days_to_germination, plant_spacing, primary_image_path, hero_image_path, hero_image_url, hero_image_pending, height, tags, status, sowing_method, planting_window, purchase_date, created_at, botanical_care_notes, profile_type, companion_plants, avoid_plants, plant_description, growing_notes, description_source, scientific_name, sowing_depth, propagation_notes, seed_saving_notes")
      .eq("id", id).is("deleted_at", null).maybeSingle();

    if (e1) {
      setError(e1.message);
      setProfile(null);
      setLoading(false);
      return;
    }
    if (profileData) {
      setProfile(profileData as PlantProfile);
      // Use the profile's actual owner for all child read queries so household
      // members viewing someone else's profile get the right data.
      const ownerIdFromData = profileData.user_id as string;
      setProfileOwnerId(ownerIdFromData);
      setIsOwnProfile(ownerIdFromData === user.id);

      const isPermanentProfile = (profileData as { profile_type?: string })?.profile_type === "permanent";
      const careQuery = supabase.from("care_schedules")
        .select("*")
        .eq("plant_profile_id", id).eq("user_id", ownerIdFromData)
        .is("deleted_at", null)
        .order("title", { ascending: true });
      // Include both templates and instance schedules so users can manage/delete instance schedules from Care tab
      const careQueryFinal = careQuery;

      // Batch 2: Fetch packets, grows, journals, care, suggestions, journal photos in parallel
      // grow_instances: run both queries and merge — primary (no user filter) + explicit user_id
      // to handle RLS/visibility edge cases for permanent plants.
      const [packetsRes, growsRes, growsByUserRes, journalsRes, careRes, suggestionsRes, tasksRes] = await Promise.all([
        supabase.from("seed_packets").select(SEED_PACKET_PROFILE_SELECT).eq("plant_profile_id", id).eq("user_id", ownerIdFromData).is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("grow_instances").select("*").eq("plant_profile_id", id).is("deleted_at", null).order("sown_date", { ascending: false }),
        supabase.from("grow_instances").select("*").eq("plant_profile_id", id).eq("user_id", user.id).is("deleted_at", null).order("sown_date", { ascending: false }),
        (async () => {
          const [byProfile, jepRes] = await Promise.all([
            supabase.from("journal_entries").select("id, plant_profile_id, grow_instance_id, seed_packet_id, note, photo_url, image_file_path, weather_snapshot, entry_type, harvest_weight, harvest_unit, harvest_quantity, created_at, user_id").eq("plant_profile_id", id).eq("user_id", ownerIdFromData).is("deleted_at", null).order("created_at", { ascending: false }),
            supabase.from("journal_entry_plants").select("journal_entry_id").eq("plant_profile_id", id).eq("user_id", ownerIdFromData),
          ]);
          const byProfileRows = byProfile.data ?? [];
          const jepEntryIds = [...new Set((jepRes.data ?? []).map((r: { journal_entry_id: string }) => r.journal_entry_id))];
          if (jepEntryIds.length === 0) return byProfile;
          const { data: byJep } = await supabase.from("journal_entries").select("id, plant_profile_id, grow_instance_id, seed_packet_id, note, photo_url, image_file_path, weather_snapshot, entry_type, harvest_weight, harvest_unit, harvest_quantity, created_at, user_id").in("id", jepEntryIds).eq("user_id", ownerIdFromData).is("deleted_at", null).order("created_at", { ascending: false });
          const seen = new Set(byProfileRows.map((r: { id: string }) => r.id));
          const merged = [...byProfileRows];
          for (const r of byJep ?? []) {
            if (!seen.has((r as { id: string }).id)) {
              seen.add((r as { id: string }).id);
              merged.push(r);
            }
          }
          merged.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
          return { data: merged, error: byProfile.error ?? jepRes.error };
        })(),
        careQueryFinal,
        supabase.from("care_schedule_suggestions").select("*").eq("plant_profile_id", id).eq("user_id", ownerIdFromData).order("created_at", { ascending: true }),
        supabase.from("tasks").select("id, title, category, due_date, completed_at, grow_instance_id").eq("plant_profile_id", id).eq("user_id", ownerIdFromData).is("care_schedule_id", null).is("deleted_at", null).order("due_date", { ascending: false }).limit(20),
      ]);

      const packetRows = packetsRes.error ? [] : ((packetsRes.data ?? []) as SeedPacket[]);
      if (packetsRes.error) setError(packetsRes.error.message);
      setPackets(packetRows);

      // Merge both grow queries — use whichever returns data (handles RLS edge cases)
      const growsA = (growsRes.data ?? []) as GrowInstance[];
      const growsB = (growsByUserRes.data ?? []) as GrowInstance[];
      const seenIds = new Set<string>();
      let allGrows: GrowInstance[] = [];
      for (const g of [...growsA, ...growsB]) {
        if (g?.id && !seenIds.has(g.id)) {
          seenIds.add(g.id);
          allGrows.push(g);
        }
      }
      allGrows.sort((a, b) => (b.sown_date ?? "").localeCompare(a.sown_date ?? ""));
      // Fallback for permanent: find grows via journal_entries (handles orphaned plant_profile_id)
      if (allGrows.length === 0 && isPermanentProfile) {
        const { data: journalsWithGrow } = await supabase
          .from("journal_entries")
          .select("grow_instance_id")
          .eq("plant_profile_id", id)
          .not("grow_instance_id", "is", null)
          .is("deleted_at", null);
        const growIds = [...new Set((journalsWithGrow ?? []).map((j: { grow_instance_id: string }) => j.grow_instance_id).filter(Boolean))];
        if (growIds.length > 0) {
          const { data: growsById } = await supabase
            .from("grow_instances")
            .select("*")
            .in("id", growIds)
            .is("deleted_at", null)
            .order("sown_date", { ascending: false });
          if (growsById?.length) {
            allGrows = growsById as GrowInstance[];
            // Repair: set plant_profile_id on any that are missing
            const toRepair = allGrows.filter((g) => !g.plant_profile_id || g.plant_profile_id !== id);
            if (toRepair.length > 0 && ownerIdFromData === user.id) {
              await supabase.from("grow_instances")
                .update({ plant_profile_id: id })
                .in("id", toRepair.map((g) => g.id))
                .eq("user_id", user.id);
            }
          }
        }
      }
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
      setCareSuggestions((suggestionsRes.data ?? []) as CareScheduleSuggestion[]);
      setStandaloneTasks((tasksRes.data ?? []) as { id: string; title: string | null; category: string; due_date: string; completed_at: string | null; grow_instance_id: string | null }[]);
      const journalRows = (journalsRes as { data?: { id: string; image_file_path?: string | null; created_at?: string }[] }).data ?? [];
      const entryIds = journalRows.map((r) => r.id);
      const withPhotos = journalRows.filter((j) => j.image_file_path);
      const photos: JournalPhoto[] = [];
      if (entryIds.length > 0) {
        const { data: jepRows } = await supabase
          .from("journal_entry_photos")
          .select("id, journal_entry_id, image_file_path, created_at, sort_order")
          .in("journal_entry_id", entryIds)
          .order("created_at", { ascending: false });
        const entryIdsWithJep = new Set((jepRows ?? []).map((r: { journal_entry_id: string }) => r.journal_entry_id));
        const byEntry: Record<string, { path: string; sort_order: number }[]> = {};
        for (const row of jepRows ?? []) {
          const r = row as { id: string; journal_entry_id: string; image_file_path: string; created_at: string; sort_order: number };
          photos.push({ id: r.id, image_file_path: r.image_file_path, created_at: r.created_at });
          const arr = byEntry[r.journal_entry_id] ?? [];
          arr.push({ path: r.image_file_path, sort_order: r.sort_order });
          byEntry[r.journal_entry_id] = arr;
        }
        for (const row of withPhotos) {
          if (!entryIdsWithJep.has(row.id)) {
            photos.push({ id: row.id, image_file_path: row.image_file_path!, created_at: row.created_at ?? "" });
            byEntry[row.id] = [{ path: row.image_file_path!, sort_order: 0 }];
          }
        }
        const pathsByEntry: Record<string, string[]> = {};
        for (const [eid, list] of Object.entries(byEntry)) {
          list.sort((a, b) => a.sort_order - b.sort_order);
          pathsByEntry[eid] = list.map((x) => x.path);
        }
        setEntryIdToPhotoPaths(pathsByEntry);
        photos.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      } else {
        setEntryIdToPhotoPaths({});
      }
      setJournalPhotos(photos);

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
      setIsPlantableNow(isPlantableInMonthSimple(profileData?.planting_window, new Date().getMonth()));
    } else {
      setError("Plant not found.");
      setProfile(null);
    }
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Auto-redirect to vault when profile not found (e.g. after delete or stale link)
  useEffect(() => {
    if (!loading && !profile && id) {
      router.replace("/vault");
    }
  }, [loading, profile, id, router]);

  // ── Handlers extracted to focused hooks ─────────────────────────────────
  const plantings = useVaultPlantingsHandlers({
    userId: user?.id,
    profileId: id,
    profile: profile as PlantProfile | null,
    loadProfile,
  });

  const packetHandlers = useVaultPacketHandlers({
    userId: user?.id,
    profileId: id,
    profileOwnerId,
    packets,
    setPackets,
  });

  const hero = useVaultHeroHandlers({
    userId: user?.id,
    profileId: id,
    profile: profile as PlantProfile | null,
    packets,
    session,
    loadProfile,
    profileOwnerId,
    onRouterRefresh: () => router.refresh(),
    setError,
  });

  const edit = useVaultEditHandlers({
    userId: user?.id,
    profileId: id,
    profile: profile as PlantProfile | null,
    profileOwnerId,
    session,
    loadProfile,
    setError,
  });

  // Destructure hook returns into local scope so JSX remains unchanged
  const {
    batchLogOpen, setBatchLogOpen,
    batchLogTarget, setBatchLogTarget,
    harvestTarget, setHarvestTarget,
    endBatchTarget, setEndBatchTarget,
    endReason, setEndReason,
    endNote, setEndNote,
    endSaving,
    deleteBatchTarget, setDeleteBatchTarget,
    deleteSaving,
    editGrowTarget, setEditGrowTarget,
    editGrowLocation, setEditGrowLocation,
    editGrowVendor, setEditGrowVendor,
    editGrowPrice, setEditGrowPrice,
    editGrowPlantCount, setEditGrowPlantCount,
    editGrowSownDate, setEditGrowSownDate,
    editGrowSaving,
    editGrowError,
    handlePlantingsQuickCare,
    handlePlantingsEndBatch,
    handlePlantingsDeleteBatch,
    handleEditGrowOpen,
    handleEditGrowSave,
    buildBatchFromEditTarget,
  } = plantings;

  const {
    openPacketDetails,
    journalByPacketId,
    loadingJournalForPacket,
    togglePacketDetails,
    updatePacketQty,
    updatePacketPurchaseDate,
    updatePacketNotes,
    updatePacketStorageLocation,
    updatePacketRating,
    deletePacket,
  } = packetHandlers;

  const {
    showSetPhotoModal, setShowSetPhotoModal,
    heroUploading,
    heroCropOpen, setHeroCropOpen,
    heroCropPreviewUrl, setHeroCropPreviewUrl,
    findingStockPhoto,
    findHeroError,
    searchWebLoading,
    searchWebGalleryUrls,
    searchWebError,
    galleryImageFailed, setGalleryImageFailed,
    stockPhotoCurrentFailed, setStockPhotoCurrentFailed,
    savingWebHero,
    saveHeroError,
    setHeroFromPath,
    setHeroFromUrl,
    removeHeroImage,
    loadPhotoGallery,
    cancelSearchWeb,
    setHeroFromPacket,
    setHeroFromUpload,
    setHeroFromJournal,
    saveHeroFromUrl,
  } = hero;

  const heroPhotoOnCapture = useCallback(
    (file: File) => {
      setHeroCropPreviewUrl(URL.createObjectURL(file));
      setHeroCropOpen(true);
    },
    [setHeroCropPreviewUrl, setHeroCropOpen]
  );
  const {
    isMobile: isMobileHero,
    webcamActive: heroWebcamActive,
    webcamError: heroWebcamError,
    videoRef: heroWebcamVideoRef,
    startWebcam: startHeroWebcam,
    stopWebcam: stopHeroWebcam,
    captureFromWebcam: captureHeroFromWebcam,
  } = useDesktopPhotoCapture(heroPhotoOnCapture);

  const {
    showEditModal, setShowEditModal,
    savingEdit,
    showDeleteConfirm, setShowDeleteConfirm,
    deletingProfile,
    fillBlanksRunning,
    fillBlanksError, setFillBlanksError,
    fillBlanksAttempted,
    aiMenuOpen, setAiMenuOpen,
    overwriteConfirmOpen, setOverwriteConfirmOpen,
    editForm, setEditForm,
    toastMessage,
    openEditModal,
    handleSaveEdit,
    handleDeleteProfile,
    handleFillBlanks,
    handleOverwriteWithAi,
    handleAddToShoppingList,
  } = edit;
  // ────────────────────────────────────────────────────────────────────────

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
  // Derive from instances: profile can have both seasonal and permanent plants (Law 10).
  const isPermanent = growInstances.some((g) => g.is_permanent_planting === true);
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
  const showHeroResearching = !heroImageUrl && (hero.findingStockPhoto || heroPending);

  useEffect(() => {
    setHeroImageLoaded(false);
  }, [heroImageUrl]);

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
  const modalOpen = showSetPhotoModal || showEditModal || !!imageLightbox || addPlantManualOpen || !!editGrowTarget || !!growViewId;
  const nonEmptyPackets = useMemo(() => packets.filter((p) => (p.qty_status ?? 0) > 0 && !p.is_archived), [packets]);

  const handlePlantAgain = useCallback(() => {
    if (nonEmptyPackets.length === 0) {
      setAddPlantManualOpen(true);
      return;
    }
    setPlantAgainAddPlantOpen(true);
  }, [nonEmptyPackets.length]);
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
    const gardenTab = searchParams.get("gardenTab");
    const dateParam = searchParams.get("date");
    let from = "";
    if (fromParam === "garden") from = (tab ? `&from=garden` : `?from=garden`) + (gardenTab ? `&gardenTab=${gardenTab}` : "");
    else if (fromParam === "calendar") from = (tab ? `&from=calendar` : `?from=calendar`) + (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? `&date=${dateParam}` : "");
    if (deltaX < -50 && nextId) router.push(`/vault/${nextId}${tab}${from}`);
    else if (deltaX > 50 && prevId) router.push(`/vault/${prevId}${tab}${from}`);
  }, [modalOpen, nextId, prevId, router, validTab, fromParam, searchParams]);

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
  if (error || !profile) return <div className="min-h-screen bg-neutral-50 p-6">{fromParam === "garden" ? <Link href={searchParams.get("gardenTab") === "active" ? "/garden?tab=active" : "/garden?tab=plants"} className="inline-flex items-center gap-2 text-emerald-600 hover:underline mb-4">&larr; Back to {searchParams.get("gardenTab") === "active" ? "Active Garden" : "My Plants"}</Link> : fromParam === "calendar" ? <Link href={searchParams.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date")!) ? `/calendar?date=${searchParams.get("date")}` : "/calendar"} className="inline-flex items-center gap-2 text-emerald-600 hover:underline mb-4">&larr; Back to Calendar</Link> : <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 hover:underline mb-4">&larr; Back to Vault</Link>}<p className="text-red-600" role="alert">{error ?? "Plant not found."}</p></div>;

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
  const canEdit = isOwnProfile || canEditPage(profileOwnerId, "plant_vault");

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Modals */}
      {showSetPhotoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-4 border-b border-neutral-200 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-neutral-900">Set Profile Photo</h2>
                <p className="text-sm text-neutral-500 mt-0.5">Take a photo, choose from files, or pick from web images.</p>
              </div>
              <button type="button" onClick={() => setShowSetPhotoModal(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 flex-shrink-0" aria-label="Close">
                <ICON_MAP.Close className="w-6 h-6" />
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
                      <ICON_MAP.Close className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*" capture="environment" className="hidden" id="hero-camera-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setHeroCropPreviewUrl(URL.createObjectURL(file)); setHeroCropOpen(true); } e.target.value = ""; }} />
                <input type="file" accept="image/*" className="hidden" id="hero-files-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setHeroCropPreviewUrl(URL.createObjectURL(file)); setHeroCropOpen(true); } e.target.value = ""; }} />
                {heroWebcamActive ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video ref={heroWebcamVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={captureHeroFromWebcam} className="min-h-[44px] min-w-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium">Capture</button>
                      <button type="button" onClick={stopHeroWebcam} className="min-h-[44px] py-2.5 px-4 rounded-xl border border-neutral-300 text-neutral-700 text-sm font-medium">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {isMobileHero ? (
                      <label htmlFor={heroUploading || heroCropOpen ? undefined : "hero-camera-input"} className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 min-h-[44px] ${heroUploading || heroCropOpen ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
                        Take photo
                      </label>
                    ) : (
                      <button type="button" onClick={startHeroWebcam} disabled={heroUploading || heroCropOpen} className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 min-h-[44px] disabled:opacity-50 disabled:pointer-events-none`}>
                        Take photo
                      </button>
                    )}
                    {heroWebcamError && <p className="text-sm text-amber-600">{heroWebcamError}</p>}
                  </>
                )}
                <label htmlFor={heroUploading || heroCropOpen ? undefined : "hero-files-input"} className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-600 hover:border-emerald-500 hover:text-emerald-700 min-h-[44px] ${heroUploading || heroCropOpen ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
                  {heroUploading ? "Uploading..." : heroCropOpen ? "Crop photo..." : "Choose from files"}
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
                        onClick={() => saveHeroFromUrl(url)}
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
              {heroUrl && !isPlaceholderHeroUrl(heroUrl) && !stockPhotoCurrentFailed && (
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
                      <button key={pkt.id} type="button" onClick={() => setHeroFromPacket(pkt.primary_image_path!)} disabled={heroUploading} className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-emerald-500 disabled:opacity-50"><img src={src} alt="" className="w-full h-full object-cover" loading="lazy" /></button>
                    ); })}
                  </div>
                </div>
              )}
              {journalPhotos.length > 0 && (
                <div><p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">Growth Gallery</p>
                  <div className="grid grid-cols-3 gap-2">
                    {journalPhotos.map((photo) => { const src = supabase.storage.from("journal-photos").getPublicUrl(photo.image_file_path).data.publicUrl; return (
                      <button key={photo.id} type="button" onClick={() => setHeroFromJournal(photo)} className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-emerald-500"><img src={src} alt="" className="w-full h-full object-cover" loading="lazy" /></button>
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

      {heroCropOpen && heroCropPreviewUrl && (
        <ImageCropModal
          open={heroCropOpen}
          imageSrc={heroCropPreviewUrl}
          aspectRatio={16 / 10}
          onConfirm={(blob) => {
            const file = new File([blob], "hero.jpg", { type: "image/jpeg" });
            setHeroFromUpload(file);
            if (heroCropPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(heroCropPreviewUrl);
            setHeroCropOpen(false);
            setHeroCropPreviewUrl("");
          }}
          onClose={() => {
            if (heroCropPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(heroCropPreviewUrl);
            setHeroCropOpen(false);
            setHeroCropPreviewUrl("");
          }}
        />
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-lg max-w-md w-full max-h-[min(85vh,100dvh-5rem)] sm:max-h-[85vh] flex flex-col overflow-hidden border-t border-neutral-200 sm:border-t-0">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
            <div className="flex-shrink-0 p-4 pb-2 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">Edit Plant Profile</h2>
              <button type="button" onClick={() => setShowEditModal(false)} disabled={savingEdit} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-50" aria-label="Close">
                <ICON_MAP.Close className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 space-y-4">
              {canEdit && (
                <div>
                  <p className="text-sm font-medium text-neutral-700 mb-2">Photo</p>
                  <button type="button" onClick={() => setShowSetPhotoModal(true)} className="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50" aria-label="Add or change photo">
                    <ICON_MAP.Camera className="w-4 h-4" />
                    {profile?.hero_image_path || profile?.hero_image_url ? "Change Photo" : "Add Photo"}
                  </button>
                </div>
              )}
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
                <input id="edit-purchase-date" type="date" value={editForm.purchaseDate} onChange={(e) => setEditForm((f) => ({ ...f, purchaseDate: e.target.value }))} className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label htmlFor="edit-purchase-vendor" className="block text-sm font-medium text-neutral-700 mb-1">Vendor / Nursery (optional)</label>
                <input id="edit-purchase-vendor" type="text" value={editForm.purchaseVendor} onChange={(e) => setEditForm((f) => ({ ...f, purchaseVendor: e.target.value }))} placeholder="e.g. Briggs Tree Nursery, Home Depot" className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" aria-label="Vendor or nursery" />
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
              {!(profile && "vendor" in profile && (profile as PlantVarietyProfile).vendor != null) && (
                <>
                  <div>
                    <label htmlFor="edit-propagation" className="block text-sm font-medium text-neutral-700 mb-1">Propagation (optional)</label>
                    <textarea id="edit-propagation" rows={2} value={editForm.propagationNotes} onChange={(e) => setEditForm((f) => ({ ...f, propagationNotes: e.target.value }))} placeholder="e.g. Cuttings, division, layering" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" aria-label="How to propagate" />
                  </div>
                  <div>
                    <label htmlFor="edit-seed-saving" className="block text-sm font-medium text-neutral-700 mb-1">Harvest / Save seeds (optional)</label>
                    <textarea id="edit-seed-saving" rows={2} value={editForm.seedSavingNotes} onChange={(e) => setEditForm((f) => ({ ...f, seedSavingNotes: e.target.value }))} placeholder="e.g. When to harvest, drying, storage" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" aria-label="How to harvest and save seeds" />
                  </div>
                </>
              )}
            </div>
            <div className="p-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-neutral-200 bg-white space-y-3 mt-auto">
              {error && <p className="text-sm text-red-600 mb-4" role="alert">{error}</p>}
              <button type="button" onClick={handleSaveEdit} disabled={savingEdit} className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                <ICON_MAP.Save className="w-4 h-4" />
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
              {!(profile && "vendor" in profile && (profile as PlantVarietyProfile).vendor != null) && (
                <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={savingEdit} className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-red-200 text-red-700 font-medium hover:bg-red-50 disabled:opacity-50">Delete Plant Profile</button>
              )}
            </div>
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
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              If you want to keep the variety for reference, consider archiving seed packets instead of deleting.
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
        {/* Prev/next profile arrows (hidden on mobile; swipe still works) */}
        {(prevId ?? nextId) && (
          <>
            {prevId ? (
              <Link
                href={validTab !== "about" ? `/vault/${prevId}?tab=${validTab}${fromParam === "garden" ? "&from=garden" : fromParam === "calendar" ? `&from=calendar${searchParams.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date")!) ? `&date=${searchParams.get("date")}` : ""}` : ""}` : `/vault/${prevId}${fromParam === "garden" ? "?from=garden" : fromParam === "calendar" ? `?from=calendar${searchParams.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date")!) ? `&date=${searchParams.get("date")}` : ""}` : ""}`}
                className="absolute left-0 top-[40%] z-10 min-w-[44px] min-h-[44px] hidden md:flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
                aria-label="Previous plant profile"
              >
                <ICON_MAP.Back className="w-6 h-6" />
              </Link>
            ) : null}
            {nextId ? (
              <Link
                href={validTab !== "about" ? `/vault/${nextId}?tab=${validTab}${fromParam === "garden" ? `&from=garden${searchParams.get("gardenTab") ? `&gardenTab=${searchParams.get("gardenTab")}` : ""}` : fromParam === "calendar" ? `&from=calendar${searchParams.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date")!) ? `&date=${searchParams.get("date")}` : ""}` : ""}` : `/vault/${nextId}${fromParam === "garden" ? `?from=garden${searchParams.get("gardenTab") ? `&gardenTab=${searchParams.get("gardenTab")}` : ""}` : fromParam === "calendar" ? `?from=calendar${searchParams.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date")!) ? `&date=${searchParams.get("date")}` : ""}` : ""}`}
                className="absolute right-0 top-[40%] z-10 min-w-[44px] min-h-[44px] hidden md:flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
                aria-label="Next plant profile"
              >
                <ICON_MAP.ChevronRight className="w-6 h-6" />
              </Link>
            ) : null}
          </>
        )}
        {/* N1: fromParam always wins — back destination reflects where user came from, never the active tab */}
        {fromParam === "garden" ? (
          (() => {
            const gardenTab = searchParams.get("gardenTab");
            const isActive = gardenTab === "active";
            return (
              <Link href={isActive ? "/garden?tab=active" : "/garden?tab=plants"} className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">
                &larr; Back to {isActive ? "Active Garden" : "My Plants"}
              </Link>
            );
          })()
        ) : fromParam === "calendar" ? (
          (() => {
            const dateParam = searchParams.get("date");
            const href = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? `/calendar?date=${dateParam}` : "/calendar";
            return (
              <Link href={href} className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">
                &larr; Back to Calendar
              </Link>
            );
          })()
        ) : fromParam === "journal" ? (
          <Link href="/journal?view=timeline" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">&larr; Back to Journal</Link>
        ) : (
          <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">&larr; Back to Vault</Link>
        )}

        {/* Read-only banner for household members viewing someone else's profile */}
        {!isOwnProfile && !canEditPage(profileOwnerId, "plant_vault") && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
            Viewing {profile?.name ?? "this"}&apos;s garden — read only
          </div>
        )}

        {toastMessage}

        {addedToVaultCelebration && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-500/90"
            role="status"
            aria-live="polite"
            aria-label="Added to vault"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <span className="absolute text-4xl seedling-celebration-seed" aria-hidden>🌰</span>
                <span className="text-5xl seedling-celebration-sprout" aria-hidden>🌱</span>
              </div>
              <p className="text-white font-semibold text-lg">Added to Vault!</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 break-words">{displayName}</h2>
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
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Plant now</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEditPage(user?.id ?? "", "shopping_list") && (
              <button
                type="button"
                onClick={handleAddToShoppingList}
                className="p-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Add to shopping list"
                title="Add to shopping list"
              >
                <ICON_MAP.Shopping className="w-4 h-4" />
              </button>
            )}
            {isOwnProfile && (
              <>
                {!(profile && "vendor" in profile && (profile as PlantVarietyProfile).vendor != null) && (
                  <button
                    type="button"
                    onClick={() => (fillBlanksRunning ? undefined : setAiMenuOpen(true))}
                    disabled={fillBlanksRunning}
                    className="p-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
                    aria-label={fillBlanksRunning ? "Filling blanks…" : "AI fill options"}
                    title="Fill or overwrite with AI"
                    aria-expanded={aiMenuOpen}
                    aria-haspopup="true"
                  >
                    {fillBlanksRunning ? (
                      <span className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" aria-hidden />
                    ) : (
                      <ICON_MAP.Sparkle className="w-4 h-4" />
                    )}
                  </button>
                )}
                <button type="button" onClick={openEditModal} className="p-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Edit profile"><ICON_MAP.Edit className="w-4 h-4" /></button>
              </>
            )}
          </div>
        </div>

        {/* AI fill menu: Fill blanks | Overwrite existing and fill all */}
        {aiMenuOpen && (
          <>
            <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => setAiMenuOpen(false)} />
            <div
              className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-xl p-5 max-w-sm mx-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-menu-title"
            >
              <h2 id="ai-menu-title" className="font-semibold text-neutral-900 text-base mb-3">AI fill</h2>
              <p className="text-sm text-neutral-500 mb-4">Fill empty fields from cache or AI, or replace all AI-filled details.</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => { setAiMenuOpen(false); handleFillBlanks(); }}
                  disabled={fillBlanksRunning}
                  className="w-full min-h-[44px] rounded-xl border border-neutral-300 text-neutral-700 font-medium text-sm hover:bg-neutral-50 disabled:opacity-50 text-left px-4"
                >
                  Fill blanks
                </button>
                <button
                  type="button"
                  onClick={() => { setAiMenuOpen(false); setOverwriteConfirmOpen(true); }}
                  disabled={fillBlanksRunning}
                  className="w-full min-h-[44px] rounded-xl border border-amber-200 text-amber-700 font-medium text-sm hover:bg-amber-50 disabled:opacity-50 text-left px-4"
                >
                  Overwrite existing and fill all
                </button>
                <button
                  type="button"
                  onClick={() => setAiMenuOpen(false)}
                  className="w-full min-h-[44px] rounded-xl border border-neutral-200 text-neutral-500 font-medium text-sm hover:bg-neutral-50 mt-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {fillBlanksError && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center justify-between gap-2">
            <span>{fillBlanksError}</span>
            <button type="button" onClick={() => setFillBlanksError(null)} className="shrink-0 text-amber-600 hover:text-amber-800" aria-label="Dismiss">×</button>
          </div>
        )}

        {/* Overwrite with AI confirmation */}
        {overwriteConfirmOpen && (
          <>
            <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => setOverwriteConfirmOpen(false)} />
            <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-xl p-5 max-w-sm mx-auto" role="dialog" aria-modal="true" aria-labelledby="overwrite-dialog-title">
              <h2 id="overwrite-dialog-title" className="font-semibold text-neutral-900 text-base mb-1">Overwrite with AI?</h2>
              <p className="text-sm text-neutral-500 mb-4">
                This will replace description, growing notes, propagation, and other AI-filled details. Continue?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOverwriteConfirmOpen(false)}
                  className="flex-1 min-h-[44px] rounded-xl border border-neutral-300 text-neutral-700 font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOverwriteWithAi}
                  disabled={fillBlanksRunning}
                  className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {fillBlanksRunning ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden /> : null}
                  Continue
                </button>
              </div>
            </div>
          </>
        )}

        {/* Hero */}
        <div className="mb-4 rounded-2xl overflow-hidden bg-white border border-neutral-200 relative aspect-[16/10] max-h-[300px] w-full">
          {heroImageUrl ? (
            <>
              <PlantImage
                imageUrl={heroImageUrl}
                alt=""
                fill
                size="2xl"
                variant="neutral"
                className="!rounded-none"
                onLoad={() => setHeroImageLoaded(true)}
              />
              {!heroImageLoaded && (
                <div className="absolute inset-0 bg-neutral-100/80 animate-pulse" aria-hidden />
              )}
              {canEdit && heroImageLoaded && (
                <div className="absolute bottom-3 right-3">
                  <button type="button" onClick={() => setShowSetPhotoModal(true)} className="px-3 py-1.5 rounded-xl bg-white/90 border border-neutral-200 text-neutral-700 shadow hover:bg-white min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Change photo"><ICON_MAP.Camera className="w-4 h-4" /></button>
                </div>
              )}
            </>
          ) : showHeroResearching ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 relative bg-white">
              <div className="absolute inset-0 bg-neutral-100/80 animate-pulse" aria-hidden />
              <PlantPlaceholderIcon size="2xl" className="opacity-80 z-10 object-contain" />
              <p className="z-10 text-sm text-neutral-600 font-medium">Finding a photo...</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 bg-white">
              <PlantPlaceholderIcon size="2xl" className="opacity-90 object-contain" />
              {canEdit && (
                <button type="button" onClick={() => setShowSetPhotoModal(true)} className="px-4 py-2 rounded-xl bg-emerald-900 text-white text-sm font-medium shadow hover:opacity-90 min-w-[44px] min-h-[44px]">Add Photo</button>
              )}
              {findHeroError && <p className="text-sm text-amber-700 text-center max-w-xs" role="alert">{findHeroError}</p>}
            </div>
          )}
        </div>

        {/* Tabs — same for all profiles (About, Care, Packets, Plantings, Journal) per Law 10 */}
        <div className="flex flex-nowrap items-stretch border-b border-neutral-200 gap-x-2 sm:gap-x-3 mb-4">
          {(["about","care","packets","plantings","journal"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                const params = new URLSearchParams(searchParams.toString());
                params.set("tab", tab);
                router.replace(`/vault/${id}?${params.toString()}`, { scroll: false });
              }}
              className={`shrink-0 min-h-[44px] px-1.5 sm:px-2 py-2 text-[11px] sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${activeTab === tab ? "border-emerald-600 text-emerald-700" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}
            >
              {tab === "about" ? "About" : tab === "care" ? "Care" : tab === "packets" ? `Packets (${packetCount})` : tab === "plantings" ? `Plants (${plantingsCount})` : "Journal"}
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* ABOUT TAB                                                     */}
        {/* ============================================================ */}
        {activeTab === "about" && (
          <VaultProfileAboutTab
            profile={profile as PlantProfile | null}
            packets={packets}
            journalPhotos={journalPhotos}
            isLegacy={isLegacy}
            legacyNotes={legacyNotes}
            legacyPlantDesc={legacyPlantDesc ?? null}
            legacyGrowingInfo={legacyGrowingInfo ?? null}
            legacySourceUrl={legacySourceUrl ?? null}
            careList={careList}
            growingList={growingList}
            harvestList={harvestList}
            growingNotes={growingNotes}
            aboutCollapsed={aboutCollapsed}
            toggleAboutSection={toggleAboutSection}
            isAboutOpen={isAboutOpen}
            vendorDetailsOpen={vendorDetailsOpen}
            setVendorDetailsOpen={setVendorDetailsOpen}
            setImageLightbox={setImageLightbox}
            fillBlanksAttempted={fillBlanksAttempted}
          />
        )}

        {/* ============================================================ */}
        {/* CARE TAB                                                      */}
        {/* ============================================================ */}
        {activeTab === "care" && (
          <VaultProfileCareTab
            profileId={id}
            profile={profile as PlantProfile | null}
            userId={user?.id ?? ""}
            careSchedules={careSchedules}
            careSuggestions={careSuggestions}
            growInstances={growInstances}
            standaloneTasks={standaloneTasks}
            isLegacy={isLegacy}
            isPermanent={isPermanent}
            canEdit={canEdit}
            onChanged={loadProfile}
            aboutCollapsed={aboutCollapsed}
            toggleAboutSection={toggleAboutSection}
            isAboutOpen={isAboutOpen}
          />
        )}

        {/* ============================================================ */}
        {/* PACKETS TAB                                                   */}
        {/* ============================================================ */}
        {activeTab === "packets" && (
          <VaultProfilePacketsTab
            sortedPackets={sortedPackets}
            packetImagesByPacketId={packetImagesByPacketId}
            journalByPacketId={journalByPacketId}
            loadingJournalForPacket={loadingJournalForPacket}
            growInstances={growInstances}
            canEdit={canEdit}
            isPermanent={isPermanent}
            openPacketDetails={openPacketDetails}
            togglePacketDetails={togglePacketDetails}
            updatePacketRating={updatePacketRating}
            updatePacketPurchaseDate={updatePacketPurchaseDate}
            updatePacketQty={updatePacketQty}
            updatePacketNotes={updatePacketNotes}
            updatePacketStorageLocation={updatePacketStorageLocation}
            deletePacket={deletePacket}
            setAddPlantManualOpen={setAddPlantManualOpen}
            setImageLightbox={setImageLightbox}
          />
        )}

        {/* ============================================================ */}
        {/* PLANTINGS TAB                                                 */}
        {/* ============================================================ */}
        {activeTab === "plantings" && (
          <VaultProfilePlantingsTab
            profile={profile as PlantProfile | null}
            profileOwnerId={profileOwnerId}
            growInstances={growInstances}
            isPermanent={isPermanent}
            nonEmptyPacketsCount={nonEmptyPackets.length}
            canEditPage={canEditPage}
            onPlantAgain={handlePlantAgain}
            onEditGrow={handleEditGrowOpen}
            onOpenJournal={(gi) => {
              setQuickLogGrowInstanceId(gi.id);
              setQuickLogOpen(true);
            }}
            onViewGrow={(gi) => setGrowViewId(gi.id)}
          />
        )}

        {/* ============================================================ */}
        {/* JOURNAL TAB                                                   */}
        {/* ============================================================ */}
        {activeTab === "journal" && (
          <VaultProfileJournalTab
            ref={journalTabRef}
            journalEntries={journalEntries}
            entryIdToPhotoPaths={entryIdToPhotoPaths}
            onAddJournal={() => {
              setQuickLogGrowInstanceId(null);
              setQuickLogOpen(true);
            }}
            canEdit={canEdit}
          />
        )}

        {/* ============================================================ */}
        {/* CARE TAB (permanent plants)                                   */}
        {/* ============================================================ */}
      </div>

      <AddPlantManualModal
        open={addPlantManualOpen}
        onClose={() => setAddPlantManualOpen(false)}
        onSuccess={loadProfile}
        profileId={id}
        profileOwnerId={profileOwnerId || undefined}
      />

      <QuickAddSupply
        open={addFromQuickLogOpen}
        onClose={() => setAddFromQuickLogOpen(false)}
        onSuccess={() => {
          setAddFromQuickLogOpen(false);
          setSuppliesRefreshKey((k) => k + 1);
        }}
        initialName={addFromQuickLogInitialName}
      />
      {growViewId && (
        <GrowInstanceModal
          key={growViewId}
          growId={growViewId}
          readOnly
          initialTab="history"
          onClose={() => setGrowViewId(null)}
          onOpenInGarden={() => {
            skipGrowViewHistoryPopRef.current = true;
            const gid = growViewId;
            setGrowViewId(null);
            router.push(`/garden?grow=${gid}&from=profile&profile=${id}`);
          }}
        />
      )}

      <QuickLogModal
        open={quickLogOpen}
        onClose={() => { setQuickLogOpen(false); setQuickLogGrowInstanceId(null); }}
        preSelectedGrowInstanceId={quickLogGrowInstanceId ?? undefined}
        preSelectedProfileId={quickLogOpen ? id : undefined}
        onJournalAdded={loadProfile}
        onAddSupplyFromEmptyState={(searchString) => {
          setQuickLogOpen(false);
          setAddFromQuickLogInitialName(searchString ?? "");
          setAddFromQuickLogOpen(true);
        }}
        suppliesRefreshKey={suppliesRefreshKey}
      />

      {/* Edit grow instance modal — full-screen on mobile, centered on desktop */}
      {editGrowTarget && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/30" role="dialog" aria-modal="true" aria-labelledby="edit-grow-title">
          <div className="bg-white w-full max-w-md md:rounded-2xl shadow-xl border border-neutral-200 min-h-[100dvh] md:min-h-0 max-h-[100dvh] md:max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-6">
            <h2 id="edit-grow-title" className="text-lg font-bold text-neutral-900 mb-4">Edit plant</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-grow-date" className="block text-sm font-medium text-neutral-700 mb-1">Date planted</label>
                <input
                  id="edit-grow-date"
                  type="date"
                  value={editGrowSownDate}
                  onChange={(e) => setEditGrowSownDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="edit-grow-vendor" className="block text-sm font-medium text-neutral-700 mb-1">Vendor / Nursery (optional)</label>
                <input
                  id="edit-grow-vendor"
                  type="text"
                  value={editGrowVendor}
                  onChange={(e) => setEditGrowVendor(e.target.value)}
                  placeholder="e.g. Home Depot, Briggs Tree Nursery"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Vendor or nursery"
                />
              </div>
              <div>
                <label htmlFor="edit-grow-price" className="block text-sm font-medium text-neutral-700 mb-1">Price (optional)</label>
                <input
                  id="edit-grow-price"
                  type="text"
                  value={editGrowPrice}
                  onChange={(e) => setEditGrowPrice(e.target.value)}
                  placeholder="e.g. $12.99"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Price paid"
                />
              </div>
              <div>
                <label htmlFor="edit-grow-location" className="block text-sm font-medium text-neutral-700 mb-1">Location (optional)</label>
                <input
                  id="edit-grow-location"
                  type="text"
                  value={editGrowLocation}
                  onChange={(e) => setEditGrowLocation(e.target.value)}
                  placeholder="e.g. North fence, Backyard"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                />
              </div>
              {isPermanent && (
                <div>
                  <label htmlFor="edit-grow-count" className="block text-sm font-medium text-neutral-700 mb-1">Number of plants</label>
                  <input
                    id="edit-grow-count"
                    type="number"
                    min={1}
                    value={editGrowPlantCount}
                    onChange={(e) => setEditGrowPlantCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  />
                </div>
              )}
            </div>
            <div className="pt-4 mt-4 border-t border-neutral-200 space-y-2">
              <p className="text-xs font-medium text-neutral-500 mb-1">Or</p>
              <button
                type="button"
                onClick={() => {
                  const b = buildBatchFromEditTarget();
                  if (!b) return;
                  setEndBatchTarget(b);
                  setEditGrowTarget(null);
                }}
                className="w-full min-h-[44px] py-2.5 rounded-lg border border-amber-200/80 text-amber-700 font-medium hover:bg-amber-50"
              >
                End batch
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = buildBatchFromEditTarget();
                  if (!b) return;
                  setDeleteBatchTarget(b);
                  setEditGrowTarget(null);
                }}
                className="w-full min-h-[44px] py-2.5 rounded-lg border border-red-200 text-red-700 font-medium hover:bg-red-50"
              >
                Delete batch
              </button>
            </div>
            <div className="pt-4 mt-4 border-t border-neutral-200">
              {editGrowError && <p className="text-sm text-red-600 mb-3" role="alert">{editGrowError}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setEditGrowTarget(null)} disabled={editGrowSaving} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50">
                  <ICON_MAP.Cancel className="w-4 h-4" />
                  Cancel
                </button>
                <button type="button" onClick={handleEditGrowSave} disabled={editGrowSaving} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-900 text-white font-medium hover:opacity-90 disabled:opacity-50">
                  <ICON_MAP.Save className="w-4 h-4" />
                  {editGrowSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BatchLogSheet for Plantings tab */}
      <BatchLogSheet
        open={batchLogOpen}
        batches={batchLogTarget ? [batchLogTarget] : []}
        onClose={() => { setBatchLogOpen(false); setBatchLogTarget(null); }}
        onSaved={() => { loadProfile(); showToast("Saved"); }}
        isPermanent={isPermanent}
        onLogHarvest={(b) => {
          setHarvestTarget({ profileId: b.plant_profile_id, growId: b.id, displayName: b.profile_variety_name?.trim() ? `${b.profile_name} (${b.profile_variety_name})` : b.profile_name });
          setBatchLogOpen(false);
          setBatchLogTarget(null);
        }}
        onQuickCare={handlePlantingsQuickCare}
      />

      <HarvestModal
        open={!!harvestTarget}
        onClose={() => setHarvestTarget(null)}
        onSaved={() => { loadProfile(); setHarvestTarget(null); showToast("Harvest logged"); }}
        profileId={harvestTarget?.profileId ?? ""}
        growInstanceId={harvestTarget?.growId ?? ""}
        displayName={harvestTarget?.displayName ?? ""}
      />

      {plantAgainAddPlantOpen && (
        <AddPlantModal
          open={plantAgainAddPlantOpen}
          onClose={() => setPlantAgainAddPlantOpen(false)}
          onSuccess={() => { loadProfile(); setPlantAgainAddPlantOpen(false); }}
          profileId={id}
          profileDisplayName={profile?.variety_name?.trim() ? `${profile?.name ?? ""} (${profile.variety_name})` : profile?.name ?? ""}
          defaultPlantType={isPermanent ? "permanent" : "seasonal"}
        />
      )}
      {plantAgainQuickAddOpen && (
        <QuickAddSeed
          open={plantAgainQuickAddOpen}
          onClose={() => setPlantAgainQuickAddOpen(false)}
          onSuccess={() => { loadProfile(); setPlantAgainQuickAddOpen(false); }}
          preSelectedProfileId={id}
          profileDisplayName={profile?.variety_name?.trim() ? `${profile?.name ?? ""} (${profile.variety_name})` : (profile?.name ?? "")}
          initialPrefill={{ name: profile?.name ?? "", variety: profile?.variety_name ?? "" }}
        />
      )}

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
            <ICON_MAP.Close className="w-6 h-6" />
          </button>
          {imageLightbox.urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setImageLightbox((prev) => prev && prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 text-neutral-700 flex items-center justify-center hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[44px] min-h-[44px]"
                aria-label="Previous photo"
              >
                <ICON_MAP.ChevronLeft stroke="currentColor" className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => setImageLightbox((prev) => prev && prev.index < prev.urls.length - 1 ? { ...prev, index: prev.index + 1 } : prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 text-neutral-700 flex items-center justify-center hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[44px] min-h-[44px]"
                aria-label="Next photo"
              >
                <ICON_MAP.ChevronRight stroke="currentColor" className="w-6 h-6" />
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
