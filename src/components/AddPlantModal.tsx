"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingContextOptional } from "@/contexts/OnboardingContext";
import { compressImage } from "@/lib/compressImage";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { copyCareTemplatesToInstance } from "@/lib/generateCareTasks";
import { buildProfileInsertFromName } from "@/lib/buildProfileInsertFromName";
import { enrichProfileFromName } from "@/lib/enrichProfileFromName";
import { qtyStatusToLabel } from "@/lib/packetQtyLabels";
import { formatAddFlowError } from "@/lib/addFlowError";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useDesktopPhotoCapture } from "@/hooks/useDesktopPhotoCapture";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useUserPlantingZone } from "@/hooks/useUserPlantingZone";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";
import { FormError } from "@/components/FormError";
import { ICON_MAP } from "@/lib/styleDictionary";
import { logEvent } from "@/lib/debugLog";
import { assignInstanceToGroup, createGroup, fetchUserGroups } from "@/lib/groups";
import { CollapsibleSupplies } from "@/components/CollapsibleSupplies";
import type { Group } from "@/types/garden";

type ProfileOption = { id: string; name: string; variety_name: string | null; profile_type: string };
type PacketOption = { id: string; vendor_name: string | null; qty_status: number; is_archived?: boolean };

export function AddPlantModal({
  open,
  onClose,
  onSuccess,
  /** When set, pre-selects plant type and filters "Link to existing" by that type. */
  defaultPlantType = "seasonal",
  /** When true, do not redirect to vault after add (e.g. when opened from Garden). */
  stayInGarden = false,
  /** When set, add a plant to this existing profile. Skips mode toggle and profile selector; shows date, location, photo, quantity only. */
  profileId: profileIdProp,
  /** Optional display name for the profile (e.g. "Rose (Cecile Brunner)"). When profileIdProp is set, used for journal note if provided. */
  profileDisplayName,
  /** When provided, renders a back-arrow that returns to the FAB menu (instead of closing the flow). */
  onBackToMenu,
  /** When true, render the 3-section triplet directly without the standalone backdrop + panel wrappers. Menu owns focus trap + body scroll lock + outer chrome. */
  embedded = false,
  /** When true, render as Established Plant flow (pre-acquired nursery/gift/division plant). Forces permanent type semantically; relabels date as "Acquired date"; adjusts journal vault_add note + submit button. */
  establishedMode = false,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultPlantType?: "permanent" | "seasonal";
  stayInGarden?: boolean;
  profileId?: string;
  profileDisplayName?: string;
  onBackToMenu?: () => void;
  embedded?: boolean;
  establishedMode?: boolean;
}) {
  const addToExistingProfile = !!profileIdProp;
  const { user, session } = useAuth();
  const onboardingCtx = useOnboardingContextOptional();
  const router = useRouter();
  const { zone: userZone } = useUserPlantingZone();
  /** Mobile: opens camera (Law 5). Separate from gallery so users can pick existing photos. */
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useFocusTrap(open && !embedded);
  useEscapeKey(open && !embedded, onClose);

  const [plantType, setPlantType] = useState<"permanent" | "seasonal">(defaultPlantType);
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [plantName, setPlantName] = useState("");
  const [variety, setVariety] = useState("");
  const [vendorNursery, setVendorNursery] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [plantedDate, setPlantedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState<string>("1");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichmentFailed, setEnrichmentFailed] = useState(false);
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);

  // Packet selection for "link existing" seasonal
  const [packetsForProfile, setPacketsForProfile] = useState<PacketOption[]>([]);
  const [selectedPacketId, setSelectedPacketId] = useState<string>("");
  const [showAddPacketInline, setShowAddPacketInline] = useState(false);
  const [addPacketVendor, setAddPacketVendor] = useState("");
  const [addPacketSaving, setAddPacketSaving] = useState(false);

  // B3 Group autocomplete (multi-select + inline create)
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupQuery, setGroupQuery] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Supplies-used (Sprint 4 MUST #5 symmetry with PlantingForm — collapsible).
  const [selectedSupplyIds, setSelectedSupplyIds] = useState<Set<string>>(new Set());

  const profileTypeFilter = plantType === "permanent" ? "permanent" : "seed";

  const loadProfiles = useCallback(async (profileType?: "permanent" | "seed") => {
    if (!user?.id) return;
    const type = profileType ?? profileTypeFilter;
    // No user_id filter: RLS returns own + household members' profiles (household_profiles_select)
    // Show all profiles; user selects plant then packet or creates new (Law 10: permanent vs seasonal is instance-level only).
    const { data } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, profile_type")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    const list = (data ?? []) as ProfileOption[];
    setProfiles(list);
    setSelectedProfileId(list.length > 0 ? list[0].id : "");
  }, [user?.id, profileTypeFilter]);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && user?.id) {
      const justOpened = !prevOpenRef.current;
      prevOpenRef.current = true;
      if (addToExistingProfile && profileIdProp) {
        setPlantType(defaultPlantType ?? "seasonal");
        setMode("existing");
        setSelectedProfileId(profileIdProp);
      } else if (justOpened) {
        // Only set initial plant type when modal first opens; don't reset when user toggles
        setPlantType(defaultPlantType);
        loadProfiles(defaultPlantType === "seasonal" ? "seed" : "permanent");
      }
    } else {
      prevOpenRef.current = false;
    }
  }, [open, user?.id, defaultPlantType, loadProfiles, addToExistingProfile, profileIdProp]);

  useEffect(() => {
    if (open && user?.id && !addToExistingProfile) loadProfiles();
  }, [open, user?.id, addToExistingProfile, plantType, loadProfiles]);

  // B3 — load groups when modal opens
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    fetchUserGroups(supabase, user.id).then((rows) => {
      if (!cancelled) setAvailableGroups(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  const assignSelectedGroupsToInstance = useCallback(
    async (growInstanceId: string) => {
      if (!user?.id || selectedGroupIds.length === 0) return;
      for (const gid of selectedGroupIds) {
        try {
          await assignInstanceToGroup(supabase, growInstanceId, gid, user.id);
        } catch (e) {
          // Don't block on group-assign errors; the instance is created.
          // Surface in console for debugging.
          console.error("AddPlantModal: assignInstanceToGroup failed", { gid, error: e });
        }
      }
    },
    [user?.id, selectedGroupIds]
  );

  const handleCreateGroupInline = useCallback(async () => {
    const name = groupQuery.trim();
    if (!name || !user?.id) return;
    setCreatingGroup(true);
    try {
      const newGroup = await createGroup(supabase, user.id, name);
      if (newGroup) {
        setAvailableGroups((prev) => [...prev, newGroup]);
        setSelectedGroupIds((prev) => [...prev, newGroup.id]);
        setGroupQuery("");
      }
    } catch (e) {
      setError(formatAddFlowError(e));
    } finally {
      setCreatingGroup(false);
    }
  }, [groupQuery, user?.id]);

  const loadPacketsForProfile = useCallback(async (profileId: string) => {
    if (!user?.id || plantType !== "seasonal") return;
    const { data } = await supabase
      .from("seed_packets")
      .select("id, vendor_name, qty_status, is_archived")
      .eq("plant_profile_id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .or("is_archived.eq.false,is_archived.is.null")
      .order("created_at", { ascending: true });
    const list = (data ?? []) as PacketOption[];
    setPacketsForProfile(list);
    setSelectedPacketId(list.length > 0 ? list[0].id : "");
    setShowAddPacketInline(false);
  }, [user?.id, plantType]);

  useEffect(() => {
    if (selectedProfileId && plantType === "seasonal") loadPacketsForProfile(selectedProfileId);
    else { setPacketsForProfile([]); setSelectedPacketId(""); setShowAddPacketInline(false); }
  }, [selectedProfileId, plantType, loadPacketsForProfile]);

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const addPhoto = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;
    setPhotoFiles((prev) => [...prev, ...imageFiles]);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }, []);

  const addOnePhoto = useCallback((file: File) => {
    setPhotoFiles((prev) => [...prev, file]);
  }, []);

  const {
    isMobile: isMobileDevice,
    webcamActive,
    webcamError,
    videoRef: webcamVideoRef,
    startWebcam,
    stopWebcam,
    captureFromWebcam,
  } = useDesktopPhotoCapture(addOnePhoto);

  const removePhoto = useCallback((index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetForm = useCallback(() => {
    setMode("new");
    setSelectedProfileId("");
    setPacketsForProfile([]);
    setSelectedPacketId("");
    setShowAddPacketInline(false);
    setAddPacketVendor("");
    setPlantName("");
    setVariety("");
    setVendorNursery("");
    setPrice("");
    setNotes("");
    setPhotoFiles([]);
    setPlantedDate(new Date().toISOString().slice(0, 10));
    setQuantity("1");
    setLocation("");
    setError(null);
    setEnrichmentFailed(false);
    setCreatedProfileId(null);
    setSelectedGroupIds([]);
    setGroupQuery("");
    setSelectedSupplyIds(new Set());
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    resetForm();
  }, [onClose, resetForm]);

  const handleAddPacketInline = useCallback(async () => {
    if (!user?.id || !selectedProfileId) return;
    setAddPacketSaving(true);
    const vendor = addPacketVendor.trim() || null;
    const { data: newPkt, error } = await supabase
      .from("seed_packets")
      .insert({ user_id: user.id, plant_profile_id: selectedProfileId, qty_status: 100, vendor_name: vendor })
      .select("id, vendor_name, qty_status")
      .single();
    setAddPacketSaving(false);
    if (error) { setError(formatAddFlowError(error)); return; }
    const pkt = newPkt as PacketOption;
    setPacketsForProfile((prev) => [...prev, pkt]);
    setSelectedPacketId(pkt.id);
    setAddPacketVendor("");
    setShowAddPacketInline(false);
  }, [user?.id, selectedProfileId, addPacketVendor]);

  const handleSubmit = async () => {
    if (!user?.id) return;
    logEvent("form", "submit", { name: "add_plant", mode });
    setError(null);
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 0)); // Yield so overlay can render before heavy work

    try {
      let profileId: string;

      if (mode === "existing") {
        if (!selectedProfileId) {
          setError("Select a variety.");
          setSubmitting(false);
          hapticError();
          return;
        }
        profileId = selectedProfileId;
      } else {
        const name = plantName.trim();
        if (!name) {
          setError("Plant name is required.");
          setSubmitting(false);
          hapticError();
          return;
        }
        const basePayload = buildProfileInsertFromName(name, variety.trim(), user.id, {
          profileType: plantType === "permanent" ? "permanent" : "seed",
          status: "active",
        });
        const insertPayload = {
          ...basePayload,
          growing_notes: notes.trim() || null,
          purchase_date: plantedDate || null,
          purchase_vendor: plantType === "seasonal" ? (vendorNursery.trim() || null) : null,
        };
        const { data: insertRow, error: insertErr } = await supabase
          .from("plant_profiles")
          .insert(insertPayload)
          .select("id")
          .single();
        if (insertErr) {
          setError(formatAddFlowError(insertErr));
          setSubmitting(false);
          return;
        }
        profileId = (insertRow as { id: string }).id;
        setCreatedProfileId(profileId);

        const plantCountNum = quantity.trim() ? parseInt(quantity, 10) : null;
        const { data: growRow, error: growInsertErr } = await supabase
          .from("grow_instances")
          .insert({
            user_id: user.id,
            plant_profile_id: profileId,
            sown_date: plantedDate,
            expected_harvest_date: null,
            status: "growing",
            seed_packet_id: null,
            location: location.trim() || null,
            plant_count: plantCountNum ?? 1,
            is_permanent_planting: plantType === "permanent",
            ...(vendorNursery.trim() && { vendor: vendorNursery.trim() }),
            ...(price.trim() && { purchase_price: price.trim() }),
            ...(plantCountNum != null && { purchase_quantity: plantCountNum }),
          })
          .select("id")
          .single();
        if (growInsertErr) {
          setError(formatAddFlowError(growInsertErr));
          setSubmitting(false);
          return;
        }
        const growInstanceIdNew = (growRow as { id: string }).id;
        await assignSelectedGroupsToInstance(growInstanceIdNew);

        // Supplies-used journal entries (mirrors PlantingForm.tsx:402-411 — entry_type "care").
        for (const supplyId of selectedSupplyIds) {
          await supabase.from("journal_entries").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growInstanceIdNew,
            supply_profile_id: supplyId,
            note: "Used at planting",
            entry_type: "care",
          });
        }

        // Upload photos: first sets hero; all create journal entries (Law 7, no overwrite)
        let heroPath: string | null = null;
        let vaultAddCreated = false;
        for (let i = 0; i < photoFiles.length; i++) {
          const file = photoFiles[i];
          const { blob } = await compressImage(file);
          const path = `${user.id}/plant-${profileId}-${crypto.randomUUID().slice(0, 8)}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("journal-photos")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
          if (uploadErr) continue;
          if (i === 0) heroPath = path;
          await supabase.from("journal_entries").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growInstanceIdNew,
            seed_packet_id: null,
            note: i === 0 ? (establishedMode ? "Added to Garden (established plant)." : plantType === "permanent" ? "Added to Garden (permanent plant)." : "Added to Garden (store-bought).") : null,
            entry_type: i === 0 ? "vault_add" : "growth",
            image_file_path: path,
          });
          if (i === 0) vaultAddCreated = true;
        }
        if (heroPath) {
          await supabase.from("plant_profiles").update({ hero_image_path: heroPath, hero_image_url: null }).eq("id", profileId).eq("user_id", user.id);
        }
        // Guarantee one vault_add journal entry per growing_instance creation, even when
        // no photo was uploaded (or every photo upload failed). Matches the "existing" mode
        // fallback at line 469-479.
        if (!vaultAddCreated) {
          await supabase.from("journal_entries").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growInstanceIdNew,
            seed_packet_id: null,
            note: establishedMode ? "Added to Garden (established plant)." : plantType === "permanent" ? "Added to Garden (permanent plant)." : "Added to Garden (store-bought).",
            entry_type: "vault_add",
          });
        }

        // Enrichment before seasonal tasks so harvest_days is available for harvest task.
        // For permanent plants: run in background so modal closes immediately (enrichment can hang).
        // For seasonal: must await so harvest task gets harvest_days.
        const runEnrichment = async () => {
          try {
            const { enriched } = await enrichProfileFromName(
              supabase,
              profileId,
              user.id,
              name,
              variety.trim(),
              {
                vendor: vendorNursery.trim(),
                skipHero: photoFiles.length > 0,
                existingGrowingNotes: notes.trim() || null,
                accessToken: session?.access_token ?? undefined,
                userZone,
              }
            );
            if (!enriched) setEnrichmentFailed(true);
          } catch {
            setEnrichmentFailed(true);
          }
        };

        if (plantType === "permanent") {
          void runEnrichment();
        } else {
          await runEnrichment();
        }

        if (plantType === "seasonal") {
          await copyCareTemplatesToInstance(profileId, growInstanceIdNew, user.id, plantedDate);
          const { data: pRow } = await supabase.from("plant_profiles").select("harvest_days").eq("id", profileId).single();
          const hDays = (pRow as { harvest_days?: number | null })?.harvest_days;
          const expHarvest = hDays != null && hDays > 0 ? new Date(new Date(plantedDate).getTime() + hDays * 86400000).toISOString().slice(0, 10) : null;
          const displayNameNew = variety.trim() ? `${name} (${variety.trim()})` : name;
          if (expHarvest) {
            await supabase.from("tasks").insert({
              user_id: user.id,
              plant_profile_id: profileId,
              grow_instance_id: growInstanceIdNew,
              category: "harvest",
              due_date: expHarvest,
              title: `Harvest ${displayNameNew}`,
            });
          }
        }
      }

      if (mode === "existing") {
        const parsedQty = quantity.trim() ? parseInt(quantity, 10) : null;
        const plantCount = parsedQty != null && parsedQty >= 0 ? parsedQty : null;
        // Permanent plants: never create or link seed packets. Seasonal only.
        let primaryPacketId: string | null = null;

        if (plantType === "seasonal") {
          if (packetsForProfile.length > 0 && selectedPacketId) {
            primaryPacketId = selectedPacketId;
          }
          // When no packets exist: create grow with seed_packet_id: null (no packet created, per plan)
        }

        const { data: profileRow } = await supabase.from("plant_profiles").select("harvest_days, profile_type").eq("id", profileId).single();
        const typedProfileRow = profileRow as { harvest_days?: number | null; profile_type?: string | null } | null;
        const harvestDays = typedProfileRow?.harvest_days;
        // Derive permanence from the SELECTED profile's type, not the (now-removed) entry toggle.
        // Linking to a permanent profile must record a permanent planting regardless of default.
        const isPermanentExisting = typedProfileRow?.profile_type === "permanent";
        const expectedHarvestDate = harvestDays != null && harvestDays > 0
          ? new Date(new Date(plantedDate).getTime() + harvestDays * 86400000).toISOString().slice(0, 10)
          : null;

        const { data: growRow, error: growErr } = await supabase.from("grow_instances").insert({
          user_id: user.id,
          plant_profile_id: profileId,
          sown_date: plantedDate,
          expected_harvest_date: expectedHarvestDate,
          status: "growing",
          seed_packet_id: primaryPacketId,
          location: location.trim() || null,
          plant_count: plantCount,
          is_permanent_planting: isPermanentExisting,
          ...(vendorNursery.trim() && { vendor: vendorNursery.trim() }),
          ...(price.trim() && { purchase_price: price.trim() }),
          ...(plantCount != null && { purchase_quantity: plantCount }),
        }).select("id").single();
        if (growErr || !growRow) {
          setError(formatAddFlowError(growErr ?? new Error("Could not create planting.")));
          setSubmitting(false);
          return;
        }
        const growId = (growRow as { id: string }).id;
        await assignSelectedGroupsToInstance(growId);

        // Supplies-used journal entries (mirrors PlantingForm.tsx:402-411 — entry_type "care").
        for (const supplyId of selectedSupplyIds) {
          await supabase.from("journal_entries").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growId,
            supply_profile_id: supplyId,
            note: "Used at planting",
            entry_type: "care",
          });
        }

        if (primaryPacketId && plantType === "seasonal" && packetsForProfile.length > 0) {
          await supabase.from("seed_packets").update({ qty_status: 0, is_archived: true }).eq("id", primaryPacketId).eq("user_id", user.id);
        }

        const weather = await fetchWeatherSnapshot();
        let displayName: string;
        if (addToExistingProfile && profileDisplayName) {
          displayName = profileDisplayName;
        } else if (addToExistingProfile && profileId) {
          const { data: p } = await supabase.from("plant_profiles").select("name, variety_name").eq("id", profileId).single();
          const prof = p as { name?: string; variety_name?: string | null } | null;
          displayName = prof?.variety_name?.trim() ? `${prof.name} (${prof.variety_name})` : prof?.name ?? "Planted";
        } else {
          const profile = profiles.find((p) => p.id === profileId);
          displayName = profile?.variety_name?.trim() ? `${profile.name} (${profile.variety_name})` : profile?.name ?? "Planted";
        }

        if (photoFiles.length > 0) {
          let heroPath: string | null = null;
          for (let i = 0; i < photoFiles.length; i++) {
            const file = photoFiles[i];
            const { blob } = await compressImage(file);
            const path = `${user.id}/plant-${profileId}-${crypto.randomUUID().slice(0, 8)}.jpg`;
            const { error: uploadErr } = await supabase.storage
              .from("journal-photos")
              .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
            if (uploadErr) continue;
            if (i === 0) heroPath = path;
            const vaultAddNote = i === 0 && displayName
              ? (notes.trim() ? `Added ${displayName} to garden. ${notes.trim()}` : `Added ${displayName} to garden`)
              : null;
            await supabase.from("journal_entries").insert({
              user_id: user.id,
              plant_profile_id: profileId,
              grow_instance_id: growId,
              seed_packet_id: null,
              note: vaultAddNote,
              entry_type: i === 0 ? "vault_add" : "growth",
              image_file_path: path,
              weather_snapshot: i === 0 ? weather ?? undefined : undefined,
            });
          }
          if (heroPath) {
            await supabase.from("plant_profiles").update({ hero_image_path: heroPath, hero_image_url: null }).eq("id", profileId).eq("user_id", user.id);
          }
        } else {
          const vaultAddNote = notes.trim() ? `Added ${displayName} to garden. ${notes.trim()}` : `Added ${displayName} to garden`;
          await supabase.from("journal_entries").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growId,
            note: vaultAddNote,
            entry_type: "vault_add",
            weather_snapshot: weather ?? undefined,
          });
        }

        if (plantType === "seasonal") {
          await copyCareTemplatesToInstance(profileId, growId, user.id, plantedDate);
        }

        if (expectedHarvestDate) {
          await supabase.from("tasks").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growId,
            category: "harvest",
            due_date: expectedHarvestDate,
            title: `Harvest ${displayName}`,
          });
        }

        await supabase.from("plant_profiles").update({ status: "active" }).eq("id", profileId).eq("user_id", user.id);
      }

      logEvent("form", "success", { name: "add_plant", mode });
      hapticSuccess();
      onboardingCtx?.reportAction("seed_added");
      onSuccess?.();
      if (enrichmentFailed) {
        setSubmitting(false);
        return;
      }
      if (createdProfileId && !stayInGarden) {
        router.push(`/vault/${createdProfileId}`);
      }
      handleClose();
      router.refresh();
    } catch (e) {
      logEvent("form", "error", { name: "add_plant", message: e instanceof Error ? e.message : String(e) });
      setError(formatAddFlowError(e));
      hapticError();
    } finally {
      setSubmitting(false);
    }
  };

  useBodyScrollLock(open && !embedded);

  if (!open) return null;

  const content = (
    <>
          <div className="flex-shrink-0 px-6 pt-6 pb-4">
            <div className="flex items-center gap-2 mb-2">
              {onBackToMenu ? (
                <button
                  type="button"
                  onClick={onBackToMenu}
                  className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Back to add menu"
                >
                  <ICON_MAP.Back stroke="currentColor" className="w-5 h-5" />
                </button>
              ) : (
                <div className="w-11 shrink-0" aria-hidden />
              )}
              <h2 id="add-plant-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">{establishedMode ? "Add Established Plant" : "Add Plant"}</h2>
              <div className="w-11 shrink-0" aria-hidden />
            </div>
            <p className="text-sm text-neutral-500 text-center">{establishedMode ? "Add a plant you've already acquired (nursery, gift, division)." : "Link to an existing variety or add a new one."}</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-2.5">
            {!addToExistingProfile && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className={`flex-1 py-2 px-3 rounded-3xl text-sm font-medium border ${mode === "existing" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-teal-gus/40 text-teal-gus hover:bg-teal-gus/10"}`}
                >
                  Link to existing
                </button>
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={`flex-1 py-2 px-3 rounded-3xl text-sm font-medium border ${mode === "new" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-teal-gus/40 text-teal-gus hover:bg-teal-gus/10"}`}
                >
                  Add new
                </button>
              </div>
            )}

            {addToExistingProfile ? (
              <div className="space-y-2.5">
                {profileDisplayName?.trim() && (
                  <p className="text-sm text-neutral-700">
                    <span className="font-medium text-neutral-800">Plant: </span>
                    {profileDisplayName.trim()}
                  </p>
                )}
                {plantType === "permanent" && (
                  <div>
                    <label htmlFor="add-plant-vendor-existing" className="block text-sm font-medium text-neutral-700 mb-1">
                      Vendor / Nursery                    </label>
                    <input
                      id="add-plant-vendor-existing"
                      type="text"
                      value={vendorNursery}
                      onChange={(e) => setVendorNursery(e.target.value)}
                      placeholder="e.g. Briggs Tree Nursery, Home Depot"
                      className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                      aria-label="Vendor or nursery"
                    />
                  </div>
                )}
              </div>
            ) : mode === "existing" ? (
              <div className="space-y-2.5">
                <div>
                  <label htmlFor="add-plant-profile" className="block text-sm font-medium text-neutral-700 mb-1">
                    {plantType === "permanent" ? "Plant profile *" : "Variety *"}
                  </label>
                  <select
                    id="add-plant-profile"
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.variety_name?.trim() ? `${p.name} — ${p.variety_name}` : p.name}
                      </option>
                    ))}
                    {profiles.length === 0 && <option value="">No {plantType === "permanent" ? "profiles" : "seasonal plants"} in vault yet</option>}
                  </select>
                </div>
                {plantType === "seasonal" && selectedProfileId && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Seed packet</label>
                    {packetsForProfile.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={selectedPacketId}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSelectedPacketId(v);
                            if (v === "") {
                              setShowAddPacketInline(true);
                            } else {
                              setShowAddPacketInline(false);
                            }
                          }}
                          className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="">None — add new packet</option>
                          {packetsForProfile.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.vendor_name?.trim() || "Unnamed"} ({qtyStatusToLabel(p.qty_status)})
                            </option>
                          ))}
                        </select>
                        {!showAddPacketInline ? (
                          <button type="button" onClick={() => setShowAddPacketInline(true)} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                            + Add packet
                          </button>
                        ) : (
                          <div className="p-3 rounded-3xl border border-neutral-200 bg-neutral-50 space-y-2">
                            <input
                              type="text"
                              value={addPacketVendor}
                              onChange={(e) => setAddPacketVendor(e.target.value)}
                              placeholder="Vendor"
                              className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-sm"
                            />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setShowAddPacketInline(false); setAddPacketVendor(""); }} className="text-sm text-teal-gus hover:underline">Cancel</button>
                              <button type="button" onClick={handleAddPacketInline} disabled={addPacketSaving} className="text-sm font-medium text-emerald-600">{addPacketSaving ? "Adding…" : "Add"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-neutral-500">No packets. Add one to track this planting.</p>
                        {!showAddPacketInline ? (
                          <button type="button" onClick={() => setShowAddPacketInline(true)} className="min-h-[44px] px-3 py-2 rounded-3xl border border-emerald-300 text-emerald-700 font-medium text-sm hover:bg-emerald-50">
                            + Add packet
                          </button>
                        ) : (
                          <div className="p-3 rounded-3xl border border-neutral-200 bg-neutral-50 space-y-2">
                            <input
                              type="text"
                              value={addPacketVendor}
                              onChange={(e) => setAddPacketVendor(e.target.value)}
                              placeholder="Vendor"
                              className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-sm"
                            />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setShowAddPacketInline(false); setAddPacketVendor(""); }} className="text-sm text-teal-gus hover:underline">Cancel</button>
                              <button type="button" onClick={handleAddPacketInline} disabled={addPacketSaving} className="text-sm font-medium text-emerald-600">{addPacketSaving ? "Adding…" : "Add"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {plantType === "permanent" && (
                  <div>
                    <label htmlFor="add-plant-vendor-link-existing" className="block text-sm font-medium text-neutral-700 mb-1">
                      Vendor / Nursery                    </label>
                    <input
                      id="add-plant-vendor-link-existing"
                      type="text"
                      value={vendorNursery}
                      onChange={(e) => setVendorNursery(e.target.value)}
                      placeholder="e.g. Briggs Tree Nursery, Home Depot"
                      className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                      aria-label="Vendor or nursery"
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="add-plant-name" className="block text-sm font-medium text-neutral-700 mb-1">Plant name *</label>
                  <input
                    id="add-plant-name"
                    type="text"
                    value={plantName}
                    onChange={(e) => setPlantName(e.target.value)}
                    placeholder={plantType === "permanent" ? "e.g. Avocado Tree, Rose" : "e.g. Tomato, Basil"}
                    className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="add-plant-variety" className="block text-sm font-medium text-neutral-700 mb-1">Variety</label>
                  <input
                    id="add-plant-variety"
                    type="text"
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder={plantType === "permanent" ? "e.g. Hass, Cecile Brunner" : "e.g. Cherokee Purple, Genovese"}
                    className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="add-plant-vendor-nursery" className="block text-sm font-medium text-neutral-700 mb-1">Vendor / Nursery</label>
                  <input
                    id="add-plant-vendor-nursery"
                    type="text"
                    value={vendorNursery}
                    onChange={(e) => setVendorNursery(e.target.value)}
                    placeholder={plantType === "permanent" ? "e.g. Briggs Tree Nursery, Home Depot" : "e.g. Bonnie Plants, Home Depot"}
                    className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-teal-gus focus:border-teal-gus"
                  />
                  {plantType === "seasonal" && <p className="text-xs text-neutral-500 mt-1">For your records. We use plant + variety only to find details and a photo.</p>}
                </div>
                <div>
                  <label htmlFor="add-plant-price" className="block text-sm font-medium text-neutral-700 mb-1">Price</label>
                  <input
                    id="add-plant-price"
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. $12.99"
                    className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                    aria-label="Price paid for plant"
                  />
                </div>
                <div>
                  <label htmlFor="add-plant-qty-new" className="block text-sm font-medium text-neutral-700 mb-1">Quantity</label>
                  <input
                    id="add-plant-qty-new"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                    aria-label="Number of plants"
                  />
                </div>
                {!establishedMode && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Plant type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPlantType("seasonal")}
                        className={`flex-1 py-2 px-3 rounded-3xl text-sm font-medium border min-h-[44px] ${plantType === "seasonal" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-teal-gus/40 text-teal-gus hover:bg-teal-gus/10"}`}
                      >
                        Seasonal
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlantType("permanent")}
                        className={`flex-1 py-2 px-3 rounded-3xl text-sm font-medium border min-h-[44px] ${plantType === "permanent" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-teal-gus/40 text-teal-gus hover:bg-teal-gus/10"}`}
                      >
                        Permanent
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">Perennial, tree, or shrub = permanent. Annual or veg = seasonal.</p>
                  </div>
                )}
              </>
            )}

            <div>
              <label htmlFor="add-plant-date" className="block text-sm font-medium text-neutral-700 mb-1">{establishedMode ? "Acquired date *" : plantType === "seasonal" ? "Purchase date *" : "Date planted *"}</label>
              <input
                id="add-plant-date"
                type="date"
                value={plantedDate}
                onChange={(e) => setPlantedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              />
            </div>
            {(mode === "existing" || addToExistingProfile) && (
              <>
                <div>
                  <label htmlFor="add-plant-price-existing" className="block text-sm font-medium text-neutral-700 mb-1">Price</label>
                  <input
                    id="add-plant-price-existing"
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. $12.99"
                    className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                    aria-label="Price paid for plant"
                  />
                </div>
                <div>
                  <label htmlFor="add-plant-qty" className="block text-sm font-medium text-neutral-700 mb-1">Quantity</label>
                  <input
                    id="add-plant-qty"
                    type="number"
                    min={0}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                    aria-label="Number of plants"
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="add-plant-location" className="block text-sm font-medium text-neutral-700 mb-1">Location</label>
              <input
                id="add-plant-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bed 2, Patio"
                className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="add-plant-groups" className="block text-sm font-medium text-neutral-700 mb-1">Groups</label>
              {selectedGroupIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedGroupIds.map((gid) => {
                    const g = availableGroups.find((x) => x.id === gid);
                    if (!g) return null;
                    return (
                      <span
                        key={gid}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium"
                      >
                        {g.name}
                        <button
                          type="button"
                          onClick={() => setSelectedGroupIds((prev) => prev.filter((x) => x !== gid))}
                          className="text-emerald-700 hover:text-emerald-900 leading-none"
                          aria-label={`Remove ${g.name}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <input
                id="add-plant-groups"
                type="text"
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
                placeholder="Search or add a group"
                className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                aria-label="Search groups"
              />
              {(() => {
                const q = groupQuery.trim().toLowerCase();
                const unselected = availableGroups.filter((g) => !selectedGroupIds.includes(g.id));
                const matches = q
                  ? unselected.filter((g) => g.name.toLowerCase().includes(q))
                  : unselected;
                const exactMatch = availableGroups.some((g) => g.name.toLowerCase() === q);
                const showCreate = q.length > 0 && !exactMatch;
                if (matches.length === 0 && !showCreate) return null;
                return (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {matches.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroupIds((prev) => [...prev, g.id]);
                          setGroupQuery("");
                        }}
                        className="inline-flex items-center px-2 py-1 rounded-full border border-neutral-300 text-neutral-700 text-xs hover:bg-neutral-50"
                      >
                        + {g.name}
                      </button>
                    ))}
                    {showCreate && (
                      <button
                        type="button"
                        onClick={handleCreateGroupInline}
                        disabled={creatingGroup}
                        className="inline-flex items-center px-2 py-1 rounded-full border border-dashed border-emerald-400 text-emerald-700 text-xs hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {creatingGroup ? "Creating…" : `+ Create "${groupQuery.trim()}"`}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Photos</label>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  aria-label="Take photo with camera"
                  onChange={(e) => addPhoto(e.target.files)}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  aria-label="Choose photos from gallery"
                  onChange={(e) => addPhoto(e.target.files)}
                />
                {webcamActive ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-w-xs">
                      <video ref={webcamVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={captureFromWebcam} className="min-h-[44px] min-w-[44px] py-2.5 px-4 rounded-3xl bg-emerald-600 text-white text-sm font-medium">Capture</button>
                      <button type="button" onClick={stopWebcam} className="min-h-[44px] py-2.5 px-4 rounded-3xl border border-teal-gus/40 text-teal-gus text-sm font-medium hover:bg-teal-gus/10">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {photoPreviews.map((url, i) => (
                        <div key={i} className="relative">
                          <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute -top-1 -right-1 min-w-[44px] min-h-[44px] rounded-full bg-red-500 text-white text-xs flex items-center justify-center leading-none -m-2 p-2"
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isMobileDevice ? (
                        <>
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="min-h-[44px] px-4 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-teal-gus/10"
                            aria-label="Take photo with camera"
                          >
                            <ICON_MAP.Camera className="w-4 h-4 shrink-0" />
                            Take Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="min-h-[44px] px-4 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus text-sm font-medium hover:bg-teal-gus/10 inline-flex items-center justify-center gap-2"
                            aria-label="Choose photos from gallery"
                          >
                            <ICON_MAP.PhotoImport className="w-4 h-4 shrink-0" />
                            From Gallery
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={startWebcam}
                            className="min-h-[44px] px-4 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-teal-gus/10"
                            aria-label="Use webcam"
                          >
                            <ICON_MAP.Camera className="w-4 h-4 shrink-0" />
                            Use Camera
                          </button>
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="min-h-[44px] px-4 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus text-sm font-medium hover:bg-teal-gus/10 inline-flex items-center justify-center gap-2"
                            aria-label="Choose photos from gallery"
                          >
                            <ICON_MAP.PhotoImport className="w-4 h-4 shrink-0" />
                            From Gallery
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {webcamError && !webcamActive && <p className="text-xs text-amber-600 mt-1">{webcamError}</p>}
              <p className="text-xs text-neutral-500 mt-1">First photo becomes the profile hero. All appear in the journal.</p>
            </div>

            <CollapsibleSupplies
              selectedIds={selectedSupplyIds}
              onChange={setSelectedSupplyIds}
            />

            <div>
              <label htmlFor="add-plant-notes" className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
              <textarea
                id="add-plant-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Where it's planted, age, any notes..."
                className="w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              />
            </div>

            {error && <FormError>{error}</FormError>}
          </div>
          <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200 flex gap-2.5 justify-end">
            <button type="button" onClick={handleClose} disabled={submitting} className="min-h-[44px] px-4 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium hover:bg-teal-gus/10 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting || (mode === "new" && !plantName.trim())} className="min-h-[44px] px-4 py-2 rounded-3xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? "Adding…" : establishedMode ? "Add Established Plant" : plantType === "permanent" ? "Add Plant" : "Add Planting"}
            </button>
          </div>
          <SubmitLoadingOverlay show={submitting} message="Adding plant…" />
    </>
  );

  return (
    <>
      {embedded ? (
        content
      ) : (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 bg-black/20" role="dialog" aria-modal="true" aria-labelledby="add-plant-title">
          <div ref={modalRef} className="relative bg-white rounded-3xl border border-neutral-200/80 shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden" tabIndex={-1}>
            {content}
          </div>
        </div>
      )}

      {enrichmentFailed && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="enrichment-failed-title">
          <div className="bg-cream rounded-3xl shadow-lg max-w-sm w-full p-3.5">
            <h2 id="enrichment-failed-title" className="text-lg font-semibold text-neutral-900 mb-2">Details Couldn&apos;t Be Loaded</h2>
            <p className="text-sm text-neutral-600 mb-4">
              Couldn&apos;t find growing details for this plant. Add them now or edit the profile later.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEnrichmentFailed(false);
                  if (createdProfileId && !stayInGarden) router.push(`/vault/${createdProfileId}`);
                  handleClose();
                }}
                className="min-h-[44px] px-4 py-2 rounded-3xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
              >
                Add details now
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnrichmentFailed(false);
                  handleClose();
                  router.refresh();
                }}
                className="min-h-[44px] px-4 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium hover:bg-teal-gus/10"
              >
                I&apos;ll do it later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
