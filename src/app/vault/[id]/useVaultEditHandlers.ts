"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/useToast";
import { useAiFillJobs } from "@/contexts/AiFillJobsContext";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { upsertWithOfflineQueue } from "@/lib/supabaseWithOffline";
import type { PlantProfile, PlantVarietyProfile } from "@/types/garden";
import { cascadeAllForDeletedProfiles } from "@/lib/cascadeOnProfileDelete";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { syncExtractCache, toDateInputValue } from "./vaultProfileUtils";
import { useModalBackClose } from "@/hooks/useModalBackClose";

type SessionLike = { access_token: string } | null;

// AI Fill completion toasts moved to the global AiFillJobsContext (backgrounding ship
// 2026-06-11): jobs survive navigation, so the provider fires the subject-named toast
// (src/lib/aiFillToast.ts) wherever the user is. This hook only enqueues + mirrors
// completion into page-local state (aiNotFound / attempted / profile refetch).

export type VaultEditForm = {
  plantType: string;
  /** Botanical lifecycle: 'Annual' | 'Biennial' | 'Perennial' | '' (Sprint 4 three-tag, Q1). Replaces the Seasonal|Permanent toggle; profile_type is DERIVED from this on save (B6). */
  lifecycle: string;
  varietyName: string;
  sun: string;
  water: string;
  spacing: string;
  germination: string;
  maturity: string;
  sowingMethod: string;
  plantingWindow: string;
  purchaseDate: string;
  purchaseVendor: string;
  growingNotes: string;
  status: string;
  companionPlants: string;
  avoidPlants: string;
  propagationNotes: string;
  seedSavingNotes: string;
};

const EDIT_FORM_DEFAULTS: VaultEditForm = {
  plantType: "", lifecycle: "", varietyName: "", sun: "", water: "", spacing: "",
  germination: "", maturity: "", sowingMethod: "", plantingWindow: "",
  purchaseDate: "", purchaseVendor: "", growingNotes: "", status: "",
  companionPlants: "", avoidPlants: "",
  propagationNotes: "", seedSavingNotes: "",
};

interface UseVaultEditHandlersArgs {
  userId: string | undefined;
  profileId: string;
  profile: PlantProfile | null;
  profileOwnerId: string;
  session: SessionLike;
  loadProfile: () => Promise<void>;
  setError: (msg: string | null) => void;
}

export function useVaultEditHandlers({
  userId,
  profileId,
  profile,
  profileOwnerId,
  session,
  loadProfile,
  setError,
}: UseVaultEditHandlersArgs) {
  const router = useRouter();

  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const { activeJobs, lastCompleted, enqueue: enqueueAiFill } = useAiFillJobs();
  // Bridges the click→enqueue-response gap so the button can't double-fire before
  // the job lands in activeJobs (the DB partial unique index backs this anyway).
  const [enqueueInFlight, setEnqueueInFlight] = useState(false);
  const fillBlanksRunning = enqueueInFlight || Boolean(activeJobs[profileId]);
  const [fillBlanksError, setFillBlanksError] = useState<string | null>(null);
  const [fillBlanksAttempted, setFillBlanksAttempted] = useState(false);
  // B5 variety-not-found: true when the last AI run reported it couldn't find this exact plant.
  // Drives the inline notice + Try Again on the About tab. Session-local by design — clears on
  // a successful fill, on profile edit-save (name/variety may have changed), or on dismiss.
  const [aiNotFound, setAiNotFound] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);
  const [editForm, setEditForm] = useState<VaultEditForm>(EDIT_FORM_DEFAULTS);
  const { toast: toastMessage, showToast: setToastMessage } = useToast();

  useModalBackClose(showDeleteConfirm, () => { if (!deletingProfile) setShowDeleteConfirm(false); });

  const openEditModal = useCallback(() => {
    if (!profile) return;
    setError(null);
    const pp = profile as PlantProfile & {
      purchase_date?: string | null;
      created_at?: string | null;
      growing_notes?: string | null;
      propagation_notes?: string | null;
      seed_saving_notes?: string | null;
      purchase_vendor?: string | null;
    };
    const dateForInput = pp.purchase_date?.trim() || pp.created_at;
    const companions = pp.companion_plants ?? [];
    const avoid = pp.avoid_plants ?? [];
    setEditForm({
      plantType: profile.name ?? "",
      lifecycle: ((profile as { lifecycle?: string | null }).lifecycle ?? "").trim(),
      varietyName: profile.variety_name ?? "",
      sun: profile.sun ?? "",
      water: ("water" in profile ? (profile as { water?: string | null }).water : null) ?? "",
      spacing: profile.plant_spacing ?? "",
      germination: profile.days_to_germination ?? "",
      maturity: profile.harvest_days != null ? String(profile.harvest_days) : "",
      sowingMethod: "sowing_method" in pp && pp.sowing_method != null ? (pp as { sowing_method?: string }).sowing_method! : "",
      plantingWindow: "planting_window" in pp && pp.planting_window != null ? (pp as { planting_window?: string }).planting_window! : "",
      purchaseDate: dateForInput ? toDateInputValue(dateForInput) : "",
      purchaseVendor: (pp.purchase_vendor ?? "").trim(),
      growingNotes: pp.growing_notes ?? "",
      status: profile.status ?? "",
      companionPlants: Array.isArray(companions) ? companions.join(", ") : "",
      avoidPlants: Array.isArray(avoid) ? avoid.join(", ") : "",
      propagationNotes: pp.propagation_notes ?? "",
      seedSavingNotes: pp.seed_saving_notes ?? "",
    });
    setShowEditModal(true);
  }, [profile, setError]);

  const handleSaveEdit = useCallback(async () => {
    if (!userId || !profile) return;
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
        lifecycle: editForm.lifecycle.trim() || null,
        // profile_type stays as derived back-compat (Q1 lock): Annual→seed, Biennial/Perennial→permanent.
        // Only derived when lifecycle is set — an empty lifecycle must NOT clobber the existing value.
        ...(editForm.lifecycle.trim()
          ? { profile_type: editForm.lifecycle.trim() === "Annual" ? "seed" : "permanent" }
          : {}),
        sowing_method: editForm.sowingMethod.trim() || null,
        planting_window: editForm.plantingWindow.trim() || null,
        companion_plants: parseCommaList(editForm.companionPlants),
        avoid_plants: parseCommaList(editForm.avoidPlants),
        growing_notes: editForm.growingNotes.trim() || null,
        propagation_notes: editForm.propagationNotes.trim() || null,
        seed_saving_notes: editForm.seedSavingNotes.trim() || null,
        purchase_vendor: editForm.purchaseVendor.trim() || null,
        purchase_date: editForm.purchaseDate.trim() || null,
        ...(editForm.growingNotes.trim() && { description_source: "user" }),
      } : {}),
    };
    const { error } = await supabase.from(table).update(updates).eq("id", profileId).eq("user_id", userId);
    setSavingEdit(false);
    if (error) { setError(error.message); hapticError(); return; }
    hapticSuccess();
    // Name/variety may have changed — the stale not-found notice no longer applies (B5 auto-clear).
    setAiNotFound(false);
    if (userId && profile) {
      const oldKey = identityKeyFromVariety(profile.name ?? "", profile.variety_name ?? "");
      const newKey = identityKeyFromVariety(editForm.plantType.trim(), editForm.varietyName.trim());
      if (newKey) {
        syncExtractCache(
          userId,
          newKey,
          { extractDataPatch: { type: editForm.plantType.trim(), variety: editForm.varietyName.trim() } },
          oldKey !== newKey ? oldKey : undefined,
        );
      }
    }
    setShowEditModal(false);
    await loadProfile();
  }, [userId, profile, profileId, editForm, loadProfile, setError]);

  const handleDeleteProfile = useCallback(async () => {
    if (!userId || !profileId || !profile) return;
    const isLeg = profile && "vendor" in profile && (profile as PlantVarietyProfile).vendor != null;
    if (isLeg) return;
    setDeletingProfile(true);
    setError(null);
    const now = new Date().toISOString();
    const ownerId = profileOwnerId || userId;
    try {
      await cascadeAllForDeletedProfiles(supabase, [profileId], ownerId);
      const { error: profileErr } = await supabase
        .from("plant_profiles")
        .update({ deleted_at: now })
        .eq("id", profileId)
        .eq("user_id", ownerId);
      if (profileErr) throw profileErr;
      setShowDeleteConfirm(false);
      setShowEditModal(false);
      router.replace("/vault");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete profile");
    } finally {
      setDeletingProfile(false);
    }
  }, [userId, profileId, profile, profileOwnerId, router, setError]);

  const handleFillBlanks = useCallback(async () => {
    if (!profileId || !session?.access_token || fillBlanksRunning) return;
    const isLeg = profile && "vendor" in profile && (profile as PlantVarietyProfile).vendor != null;
    if (isLeg) return;
    setEnqueueInFlight(true);
    setFillBlanksError(null);
    const result = await enqueueAiFill(profileId, false);
    setEnqueueInFlight(false);
    // Completion (toast + profile refetch + notFound state) arrives via the jobs
    // context — only the enqueue handshake can fail here.
    if (!result.ok) setToastMessage("AI unavailable, try again later");
  }, [profileId, session?.access_token, profile, fillBlanksRunning, enqueueAiFill, setToastMessage]);

  const handleOverwriteWithAi = useCallback(async () => {
    if (!profileId || !session?.access_token || fillBlanksRunning) return;
    setOverwriteConfirmOpen(false);
    setEnqueueInFlight(true);
    setFillBlanksError(null);
    const result = await enqueueAiFill(profileId, true);
    setEnqueueInFlight(false);
    if (!result.ok) setToastMessage("AI unavailable, try again later");
  }, [profileId, session?.access_token, fillBlanksRunning, enqueueAiFill, setToastMessage]);

  // Mirror background-job completion for THIS profile into page-local state: refetch
  // the profile (new values + provenance), update the B5 not-found notice, mark the
  // attempt. jobId guard: lastCompleted survives re-renders; handle each job once.
  const handledCompletionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastCompleted || lastCompleted.profileId !== profileId) return;
    if (handledCompletionRef.current === lastCompleted.jobId) return;
    handledCompletionRef.current = lastCompleted.jobId;
    setAiNotFound(Boolean(lastCompleted.summary.notFound));
    setFillBlanksAttempted(true);
    void loadProfile();
  }, [lastCompleted, profileId, loadProfile]);

  const handleAddToShoppingList = useCallback(async () => {
    if (!userId || !profileId) return;
    const { error } = await upsertWithOfflineQueue(
      "shopping_list",
      { user_id: userId, plant_profile_id: profileId, is_purchased: false },
      { onConflict: "user_id,plant_profile_id" }
    );
    if (error) {
      hapticError();
      setToastMessage("Failed to add to shopping list");
      return;
    }
    hapticSuccess();
    setToastMessage("Added to shopping list");
  }, [userId, profileId]);

  return {
    showEditModal, setShowEditModal,
    savingEdit,
    showDeleteConfirm, setShowDeleteConfirm,
    deletingProfile,
    fillBlanksRunning,
    fillBlanksError, setFillBlanksError,
    fillBlanksAttempted,
    aiNotFound, setAiNotFound,
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
  };
}
