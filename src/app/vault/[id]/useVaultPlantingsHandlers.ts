"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { GrowInstance } from "@/types/garden";
import type { BatchLogBatch } from "@/components/BatchLogSheet";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";

interface UseVaultPlantingsHandlersArgs {
  userId: string | undefined;
  loadProfile: () => Promise<void>;
}

/**
 * Plantings-tab handler state. Slimmed 2026-06-11: the Edit Plant field state +
 * archive/delete flows moved into the shared EditGrowModal component (the same
 * menu the instance page's pencil opens — NORTH_STAR "No duplicate paths").
 */
export function useVaultPlantingsHandlers({
  userId,
  loadProfile,
}: UseVaultPlantingsHandlersArgs) {
  const [batchLogOpen, setBatchLogOpen] = useState(false);
  const [batchLogTarget, setBatchLogTarget] = useState<BatchLogBatch | null>(null);
  const [harvestTarget, setHarvestTarget] = useState<{ profileId: string; growId: string; displayName: string } | null>(null);
  const [editGrowTarget, setEditGrowTarget] = useState<GrowInstance | null>(null);

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

  const handleEditGrowOpen = useCallback((gi: GrowInstance) => {
    setEditGrowTarget(gi);
  }, []);

  return {
    batchLogOpen, setBatchLogOpen,
    batchLogTarget, setBatchLogTarget,
    harvestTarget, setHarvestTarget,
    editGrowTarget, setEditGrowTarget,
    handlePlantingsQuickCare,
    handleEditGrowOpen,
  };
}
