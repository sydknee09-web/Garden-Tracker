"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export type OnboardingStep = 1 | 2 | 3;

type OnboardingState = {
  step: OnboardingStep;
  completed: boolean;
  isLoading: boolean;
};

/**
 * Tracks 3-step Quick Start: Personalize (zone) → Populate (seed) → Plan (task).
 * Completion persisted in user_settings.onboarding_completed_at for cross-device sync.
 */
export function useOnboarding(user: User | null) {
  const [state, setState] = useState<OnboardingState>({
    step: 1,
    completed: false,
    isLoading: true,
  });

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setState({ step: 1, completed: false, isLoading: false });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    const [settingsRes, packetsRes, profilesRes, tasksRes] = await Promise.all([
      supabase
        .from("user_settings")
        .select("onboarding_completed_at, planting_zone")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("seed_packets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null),
      supabase
        .from("plant_profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null),
    ]);

    const completedAt = settingsRes.data?.onboarding_completed_at;
    const zoneSet = !!(settingsRes.data?.planting_zone ?? "").trim();
    const hasPackets = (packetsRes.count ?? 0) > 0;
    const hasProfiles = (profilesRes.count ?? 0) > 0;
    const hasTasks = (tasksRes.count ?? 0) > 0;

    const vaultPopulated = hasPackets || hasProfiles;

    if (completedAt) {
      setState({ step: 3, completed: true, isLoading: false });
      return;
    }

    let step: OnboardingStep = 1;
    if (!zoneSet) step = 1;
    else if (!vaultPopulated) step = 2;
    else if (!hasTasks) step = 3;
    else step = 3; // All done but not yet marked — will mark on next reportAction

    setState({ step, completed: false, isLoading: false });
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reportAction = useCallback(
    async (_action: "zone_set" | "seed_added" | "task_added") => {
      if (!user?.id) return;
      setState((prev) => ({ ...prev, isLoading: true }));

      const [settingsRes, packetsRes, profilesRes, tasksRes] = await Promise.all([
        supabase.from("user_settings").select("onboarding_completed_at, planting_zone").eq("user_id", user.id).maybeSingle(),
        supabase.from("seed_packets").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("plant_profiles").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
      ]);

      const completedAt = settingsRes.data?.onboarding_completed_at;
      const zoneSet = !!(settingsRes.data?.planting_zone ?? "").trim();
      const vaultPopulated = (packetsRes.count ?? 0) > 0 || (profilesRes.count ?? 0) > 0;
      const hasTasks = (tasksRes.count ?? 0) > 0;
      const allDone = zoneSet && vaultPopulated && hasTasks;

      if (completedAt || allDone) {
        await supabase.from("user_settings").upsert(
          { user_id: user.id, onboarding_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        setState({ step: 3, completed: true, isLoading: false });
        return;
      }

      const step: OnboardingStep = !zoneSet ? 1 : !vaultPopulated ? 2 : 3;
      setState({ step, completed: false, isLoading: false });
    },
    [user?.id]
  );

  const dismiss = useCallback(async () => {
    if (!user?.id) return;
    await supabase.from("user_settings").upsert(
      { user_id: user.id, onboarding_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setState({ step: 3, completed: true, isLoading: false });
  }, [user?.id]);

  return {
    step: state.step,
    completed: state.completed,
    isLoading: state.isLoading,
    refresh,
    reportAction,
    dismiss,
  };
}
