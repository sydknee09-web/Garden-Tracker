"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { PlantProfile, GrowInstance } from "@/types/garden";
import type { BatchLogBatch } from "@/components/BatchLogSheet";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useModalBackClose } from "@/hooks/useModalBackClose";

interface UseVaultPlantingsHandlersArgs {
  userId: string | undefined;
  profileId: string;
  profile: PlantProfile | null;
  loadProfile: () => Promise<void>;
}

export function useVaultPlantingsHandlers({
  userId,
  profileId,
  profile,
  loadProfile,
}: UseVaultPlantingsHandlersArgs) {
  const [batchLogOpen, setBatchLogOpen] = useState(false);
  const [batchLogTarget, setBatchLogTarget] = useState<BatchLogBatch | null>(null);
  const [harvestTarget, setHarvestTarget] = useState<{ profileId: string; growId: string; displayName: string } | null>(null);
  const [endBatchTarget, setEndBatchTarget] = useState<BatchLogBatch | null>(null);
  const [endReason, setEndReason] = useState("season_ended");
  const [endNote, setEndNote] = useState("");
  const [endSaving, setEndSaving] = useState(false);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<BatchLogBatch | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [editGrowTarget, setEditGrowTarget] = useState<GrowInstance | null>(null);
  const [editGrowLocation, setEditGrowLocation] = useState("");
  const [editGrowVendor, setEditGrowVendor] = useState("");
  const [editGrowPrice, setEditGrowPrice] = useState("");
  const [editGrowPlantCount, setEditGrowPlantCount] = useState(1);
  const [editGrowSownDate, setEditGrowSownDate] = useState("");
  const [editGrowSaving, setEditGrowSaving] = useState(false);
  const [editGrowError, setEditGrowError] = useState<string | null>(null);

  useModalBackClose(!!editGrowTarget, () => { if (!editGrowSaving) setEditGrowTarget(null); });

  const handlePlantingsQuickCare = useCallback(async (batch: BatchLogBatch, action: "water" | "fertilize" | "spray") => {
    if (!userId) return;
    const notes: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };
    const weather = await fetchWeatherSnapshot();
    const { data: entry } = await supabase.from("journal_entries").insert({
      user_id: userId,
      plant_profile_id: batch.plant_profile_id,
      grow_instance_id: batch.id,
      note: notes[action],
      entry_type: "quick",
      weather_snapshot: weather ?? undefined,
    }).select("id").single();
    if (entry) {
      await supabase.from("journal_entry_plants").insert({
        journal_entry_id: (entry as { id: string }).id,
        plant_profile_id: batch.plant_profile_id,
        user_id: userId,
      });
    }
    loadProfile();
  }, [userId, loadProfile]);

  const handlePlantingsEndBatch = useCallback(async () => {
    if (!userId || !endBatchTarget) return;
    setEndSaving(true);
    const batchId = endBatchTarget.id;
    const now = new Date().toISOString();
    const isDead = endReason === "plant_died";
    const status = isDead ? "dead" : "archived";
    await supabase.from("grow_instances").update({ status, ended_at: now, end_reason: endReason }).eq("id", batchId);
    await softDeleteTasksForGrowInstance(batchId, endBatchTarget.user_id ?? userId);
    if (endNote.trim() || isDead) {
      const weather = await fetchWeatherSnapshot();
      const { data: entry } = await supabase.from("journal_entries").insert({
        user_id: userId,
        plant_profile_id: endBatchTarget.plant_profile_id,
        grow_instance_id: batchId,
        note: endNote.trim() || (isDead ? "Plant died" : "Batch ended"),
        entry_type: isDead ? "death" : "note",
        weather_snapshot: weather ?? undefined,
      }).select("id").single();
      if (entry) {
        await supabase.from("journal_entry_plants").insert({
          journal_entry_id: (entry as { id: string }).id,
          plant_profile_id: endBatchTarget.plant_profile_id,
          user_id: userId,
        });
      }
    }
    setEndSaving(false);
    setEndBatchTarget(null);
    setEndReason("season_ended");
    setEndNote("");
    loadProfile();
  }, [userId, endBatchTarget, endReason, endNote, loadProfile]);

  const handlePlantingsDeleteBatch = useCallback(async () => {
    if (!userId || !deleteBatchTarget) return;
    setDeleteSaving(true);
    const batchId = deleteBatchTarget.id;
    const now = new Date().toISOString();
    const { error } = await supabase.from("grow_instances").update({ deleted_at: now }).eq("id", batchId);
    if (!error) await softDeleteTasksForGrowInstance(batchId, deleteBatchTarget.user_id ?? userId);
    setDeleteSaving(false);
    setDeleteBatchTarget(null);
    if (error) return;
    loadProfile();
  }, [userId, deleteBatchTarget, loadProfile]);

  const handleEditGrowOpen = useCallback((gi: GrowInstance) => {
    setEditGrowTarget(gi);
    setEditGrowError(null);
    setEditGrowLocation(gi.location ?? "");
    setEditGrowVendor((gi.vendor ?? "").trim());
    setEditGrowPrice((gi.purchase_price ?? "").trim());
    setEditGrowPlantCount(Math.max(1, (gi as GrowInstance).plant_count ?? 1));
    setEditGrowSownDate(gi.sown_date ? gi.sown_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  }, []);

  const handleEditGrowSave = useCallback(async () => {
    if (!userId || !editGrowTarget) return;
    setEditGrowSaving(true);
    const ownerId = (editGrowTarget as { user_id?: string }).user_id ?? userId;
    const { error } = await supabase.from("grow_instances")
      .update({
        location: editGrowLocation.trim() || null,
        vendor: editGrowVendor.trim() || null,
        purchase_price: editGrowPrice.trim() || null,
        plant_count: Math.max(1, editGrowPlantCount),
        sown_date: editGrowSownDate || editGrowTarget.sown_date,
      })
      .eq("id", editGrowTarget.id)
      .eq("user_id", ownerId);
    setEditGrowSaving(false);
    if (error) { setEditGrowError(error.message); hapticError(); return; }
    hapticSuccess();
    setEditGrowError(null);
    setEditGrowTarget(null);
    loadProfile();
  }, [userId, editGrowTarget, editGrowLocation, editGrowVendor, editGrowPrice, editGrowPlantCount, editGrowSownDate, loadProfile]);

  // Build a BatchLogBatch from the current editGrowTarget (used for end/delete from within edit modal)
  const buildBatchFromEditTarget = useCallback((): BatchLogBatch | null => {
    if (!editGrowTarget || !profile) return null;
    return {
      id: editGrowTarget.id,
      plant_profile_id: editGrowTarget.plant_profile_id ?? profileId,
      profile_name: profile.name ?? "",
      profile_variety_name: profile.variety_name ?? null,
      seeds_sown: (editGrowTarget as GrowInstance).seeds_sown ?? null,
      seeds_sprouted: (editGrowTarget as GrowInstance).seeds_sprouted ?? null,
      plant_count: (editGrowTarget as GrowInstance).plant_count ?? null,
      location: editGrowTarget.location ?? null,
      user_id: (editGrowTarget as { user_id?: string }).user_id ?? null,
    };
  }, [editGrowTarget, profile, profileId]);

  return {
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
  };
}
