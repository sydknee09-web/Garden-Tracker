"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Household, HouseholdEditGrant, HouseholdMember } from "@/types/garden";

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
  /** Edit grants where the current user is the grantee (can edit these owners' data) */
  editGrants: HouseholdEditGrant[];
  /** Map of userId → display shorthand (e.g. "MAR") */
  memberShorthands: Map<string, string>;
  /** Returns the display shorthand for the given userId (fallback: first 3 chars of uid) */
  getShorthandForUser: (userId: string) => string;
  /** Returns true if the current user can edit data owned by ownerUserId */
  canEditUser: (ownerUserId: string) => boolean;
};

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [household, setHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [editGrants, setEditGrants] = useState<HouseholdEditGrant[]>([]);
  const [memberShorthands, setMemberShorthands] = useState<Map<string, string>>(new Map());

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
      setEditGrants([]);
      setMemberShorthands(new Map());
      return;
    }
    setHouseholdLoading(true);
    const { data: memberRow } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberRow?.household_id) {
      const [{ data: hh }, { data: members }, { data: grants }] = await Promise.all([
        supabase.from("households").select("*").eq("id", memberRow.household_id).maybeSingle(),
        supabase.from("household_members").select("*").eq("household_id", memberRow.household_id),
        supabase
          .from("household_edit_grants")
          .select("*")
          .eq("household_id", memberRow.household_id),
      ]);

      const memberList = (members ?? []) as HouseholdMember[];
      setHousehold((hh as Household) ?? null);
      setHouseholdMembers(memberList);
      setEditGrants((grants ?? []) as HouseholdEditGrant[]);

      // Load user_settings shorthands for all members in parallel with the above
      const memberUserIds = memberList.map((m) => m.user_id);
      if (memberUserIds.length > 0) {
        const { data: settings } = await supabase
          .from("user_settings")
          .select("user_id, display_shorthand")
          .in("user_id", memberUserIds);

        const map = new Map<string, string>();
        for (const row of settings ?? []) {
          if (row.display_shorthand) {
            map.set(row.user_id, row.display_shorthand);
          }
        }
        setMemberShorthands(map);
      }
    } else {
      setHousehold(null);
      setHouseholdMembers([]);
      setEditGrants([]);
      setMemberShorthands(new Map());
      setViewMode("personal");
    }
    setHouseholdLoading(false);
  }, [user?.id, setViewMode]);

  useEffect(() => {
    loadHousehold();
  }, [loadHousehold]);

  const isInHousehold = household !== null;
  const householdMemberUserIds = householdMembers.map((m) => m.user_id);

  const getShorthandForUser = useCallback(
    (userId: string): string => {
      return memberShorthands.get(userId) ?? userId.slice(0, 3).toUpperCase();
    },
    [memberShorthands],
  );

  const canEditUser = useCallback(
    (ownerUserId: string): boolean => {
      if (!user?.id) return false;
      if (ownerUserId === user.id) return true;
      return editGrants.some(
        (g) => g.grantor_user_id === ownerUserId && g.grantee_user_id === user.id,
      );
    },
    [user?.id, editGrants],
  );

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
        editGrants,
        memberShorthands,
        getShorthandForUser,
        canEditUser,
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
