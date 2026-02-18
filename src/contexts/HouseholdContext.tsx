"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Household, HouseholdMember } from "@/types/garden";

export type ViewMode = "personal" | "family";

const VIEW_MODE_KEY = "seedvault_view_mode";

type HouseholdContextType = {
  household: Household | null;
  householdMembers: HouseholdMember[];
  /** All user_ids that share the household (includes the current user) */
  householdMemberUserIds: string[];
  isInHousehold: boolean;
  householdLoading: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  reloadHousehold: () => void;
};

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [household, setHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [householdLoading, setHouseholdLoading] = useState(false);

  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "personal";
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    return stored === "family" ? "family" : "personal";
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    }
  }, []);

  const loadHousehold = useCallback(async () => {
    if (!user?.id) {
      setHousehold(null);
      setHouseholdMembers([]);
      return;
    }
    setHouseholdLoading(true);
    const { data: memberRow } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberRow?.household_id) {
      const [{ data: hh }, { data: members }] = await Promise.all([
        supabase.from("households").select("*").eq("id", memberRow.household_id).maybeSingle(),
        supabase.from("household_members").select("*").eq("household_id", memberRow.household_id),
      ]);
      setHousehold((hh as Household) ?? null);
      setHouseholdMembers((members ?? []) as HouseholdMember[]);
    } else {
      setHousehold(null);
      setHouseholdMembers([]);
      // Drop back to personal if no longer in a household
      setViewMode("personal");
    }
    setHouseholdLoading(false);
  }, [user?.id, setViewMode]);

  useEffect(() => {
    loadHousehold();
  }, [loadHousehold]);

  const isInHousehold = household !== null;
  const householdMemberUserIds = householdMembers.map((m) => m.user_id);

  return (
    <HouseholdContext.Provider
      value={{
        household,
        householdMembers,
        householdMemberUserIds,
        isInHousehold,
        householdLoading,
        viewMode,
        setViewMode,
        reloadHousehold: loadHousehold,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (ctx === undefined) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}
