"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type GrowRow = {
  id: string;
  plant_profile_id: string;
  sown_date: string;
  expected_harvest_date: string | null;
  status: string | null;
  ended_at: string | null;
  location: string | null;
  end_reason: string | null;
  seed_packet_id: string | null;
  profile_name: string;
  variety_name: string | null;
  harvest_count: number;
};

export default function PlantingHistoryPage() {
  const { user } = useAuth();
  const [grows, setGrows] = useState<GrowRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: growData } = await supabase
        .from("grow_instances")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("sown_date", { ascending: false });

      const profileIds = Array.from(new Set((growData ?? []).map((g: { plant_profile_id: string }) => g.plant_profile_id)));
      const growIds = (growData ?? []).map((g: { id: string }) => g.id);

      const [profilesRes, harvestRes] = await Promise.all([
        profileIds.length > 0 ? supabase.from("plant_profiles").select("id, name, variety_name").in("id", profileIds) : { data: [] },
        growIds.length > 0 ? supabase.from("journal_entries").select("grow_instance_id").in("grow_instance_id", growIds).eq("entry_type", "harvest").is("deleted_at", null) : { data: [] },
      ]);

      const nameMap: Record<string, { name: string; variety_name: string | null }> = {};
      (profilesRes.data ?? []).forEach((p: { id: string; name: string; variety_name: string | null }) => {
        nameMap[p.id] = { name: p.name, variety_name: p.variety_name };
      });

      const harvestCount: Record<string, number> = {};
      (harvestRes.data ?? []).forEach((h: { grow_instance_id: string | null }) => {
        if (h.grow_instance_id) harvestCount[h.grow_instance_id] = (harvestCount[h.grow_instance_id] ?? 0) + 1;
      });

      setGrows(
        (growData ?? []).map((g: { id: string; plant_profile_id: string; sown_date: string; expected_harvest_date: string | null; status: string | null; ended_at: string | null; location: string | null; end_reason: string | null; seed_packet_id: string | null }) => ({
          ...g,
          profile_name: nameMap[g.plant_profile_id]?.name ?? "Unknown",
          variety_name: nameMap[g.plant_profile_id]?.variety_name ?? null,
          harvest_count: harvestCount[g.id] ?? 0,
        }))
      );
      setLoading(false);
    })();
  }, [user?.id]);

  const statusColors: Record<string, string> = {
    growing: "bg-green-100 text-green-800",
    harvested: "bg-amber-100 text-amber-800",
    dead: "bg-red-100 text-red-800",
    archived: "bg-neutral-100 text-neutral-600",
    pending: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">&larr; Back to Vault</Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Planting History</h1>
      <p className="text-sm text-neutral-500 mb-6">Every grow instance across all plants.</p>

      {loading ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-neutral-400">Loading...</div>
      ) : grows.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-neutral-400">No planting history yet. Plant something from your vault!</div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Variety</th>
                  <th className="px-4 py-3">Sown</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Harvests</th>
                  <th className="px-4 py-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {grows.map((g) => {
                  const sownDate = new Date(g.sown_date);
                  const endDate = g.ended_at ? new Date(g.ended_at) : null;
                  const durationDays = endDate ? Math.round((endDate.getTime() - sownDate.getTime()) / (86400000)) : null;
                  return (
                    <tr key={g.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <Link href={`/vault/${g.plant_profile_id}`} className="font-medium text-neutral-800 hover:text-emerald-600 hover:underline">
                          {g.profile_name}{g.variety_name?.trim() ? ` (${g.variety_name})` : ""}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{sownDate.toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-neutral-500">{g.location || "--"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[g.status ?? ""] ?? "bg-neutral-100 text-neutral-600"}`}>
                          {g.status ?? "unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{g.harvest_count > 0 ? g.harvest_count : "--"}</td>
                      <td className="px-4 py-3 text-neutral-500">{durationDays != null ? `${durationDays}d` : "ongoing"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
