"use client";

import { useState, useCallback } from "react";
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

export type VaultEditForm = {
  plantType: string;
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
  plantType: "", varietyName: "", sun: "", water: "", spacing: "",
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
  const [fillBlanksRunning, setFillBlanksRunning] = useState(false);
  const [fillBlanksError, setFillBlanksError] = useState<string | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);
  const [editForm, setEditForm] = useState<VaultEditForm>(EDIT_FORM_DEFAULTS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        sowing_method: editForm.sowingMethod.trim() || null,
        planting_window: editForm.plantingWindow.trim() || null,
        companion_plants: parseCommaList(editForm.companionPlants),
        avoid_plants: parseCommaList(editForm.avoidPlants),
        growing_notes: editForm.growingNotes.trim() || null,
        propagation_notes: editForm.propagationNotes.trim() || null,
        seed_saving_notes: editForm.seedSavingNotes.trim() || null,
        purchase_vendor: editForm.purchaseVendor.trim() || null,
        ...(editForm.growingNotes.trim() && { description_source: "user" }),
      } : {}),
    };
    const { error } = await supabase.from(table).update(updates).eq("id", profileId).eq("user_id", userId);
    setSavingEdit(false);
    if (error) { setError(error.message); hapticError(); return; }
    hapticSuccess();
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
    setFillBlanksRunning(true);
    setFillBlanksError(null);
    try {
      const res = await fetch("/api/seed/fill-blanks-for-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ profileId, useGemini: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Fill failed");
      await loadProfile();
    } catch (e) {
      setFillBlanksError(e instanceof Error ? e.message : "Could not fill blanks");
    } finally {
      setFillBlanksRunning(false);
    }
  }, [profileId, session?.access_token, profile, fillBlanksRunning, loadProfile]);

  const handleOverwriteWithAi = useCallback(async () => {
    if (!profileId || !session?.access_token || fillBlanksRunning) return;
    setOverwriteConfirmOpen(false);
    setFillBlanksRunning(true);
    setFillBlanksError(null);
    try {
      const res = await fetch("/api/seed/fill-blanks-for-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ profileId, useGemini: true, overwrite: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Overwrite failed");
      await loadProfile();
    } catch (e) {
      setFillBlanksError(e instanceof Error ? e.message : "Could not overwrite with AI");
    } finally {
      setFillBlanksRunning(false);
    }
  }, [profileId, session?.access_token, fillBlanksRunning, loadProfile]);

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
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }
    hapticSuccess();
    setToastMessage("Added to shopping list");
    setTimeout(() => setToastMessage(null), 2500);
  }, [userId, profileId]);

  return {
    showEditModal, setShowEditModal,
    savingEdit,
    showDeleteConfirm, setShowDeleteConfirm,
    deletingProfile,
    fillBlanksRunning,
    fillBlanksError, setFillBlanksError,
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
