"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export type UserPlantingZone = {
  zone: string | null;
  loaded: boolean;
};

/**
 * Reads user_settings.planting_zone for the signed-in user.
 * Used by Schedule + Calendar surfaces to acknowledge the Zone 10b hardcoded
 * scheduling data when the user's zone differs (BUGS.md Post-Launch #1).
 */
export function useUserPlantingZone(): UserPlantingZone {
  const { user } = useAuth();
  const [zone, setZone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setZone(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("planting_zone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const raw = (data?.planting_zone ?? "").trim();
      setZone(raw || null);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { zone, loaded };
}

/**
 * True when the zone matches the hardcoded reference zone (10b) OR is unset.
 * Unset zones return true so we don't surface a mismatch advisory we can't substantiate.
 */
export function isReferenceZone(zone: string | null): boolean {
  if (!zone) return true;
  const normalized = zone.trim().toLowerCase().replace(/^zone\s+/, "");
  return normalized === "10b";
}
