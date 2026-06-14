"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/LoadingState";
import { useToast } from "@/hooks/useToast";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";

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
  sow_method?: "direct_sow" | "seed_start" | null;
  seeds_sown?: number | null;
  seeds_sprouted?: number | null;
  plant_count?: number | null;
};

export default function PlantingHistoryPage() {
  const { user } = useAuth();
  const [grows, setGrows] = useState<GrowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoreOpen, setRestoreOpen] = useState<GrowRow | null>(null);
  const [restoreSaving, setRestoreSaving] = useState(false);
  // Permanent-delete (relocated from the retired Settings → Developer → Archived Plantings
  // browser so there is ONE canonical archive surface — NORTH_STAR §1 no duplicate paths).
  // Guarded with a type-DELETE confirmation since it's irreversible.
  const [deleteOpen, setDeleteOpen] = useState<GrowRow | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const { toast, showToast, showErrorToast } = useToast();

  async function handleRestore(row: GrowRow) {
    if (!user) return;
    setRestoreSaving(true);
    const { error: err } = await supabase
      .from("grow_instances")
      .update({ status: "growing", ended_at: null, end_reason: null })
      .eq("id", row.id)
      .eq("user_id", user.id);
    setRestoreSaving(false);
    if (err) {
      console.error("PlantingHistoryPage.handleRestore: update failed", err);
      showErrorToast("Couldn't restore — please try again");
      return;
    }
    setGrows((prev) =>
      prev.map((g) =>
        g.id === row.id ? { ...g, status: "growing", ended_at: null, end_reason: null } : g
      )
    );
    showToast("Restored");
    setRestoreOpen(null);
  }

  async function handleDelete(row: GrowRow) {
    if (!user) return;
    setDeleteSaving(true);
    const now = new Date().toISOString();
    const { error: err } = await supabase
      .from("grow_instances")
      .update({ deleted_at: now })
      .eq("id", row.id)
      .eq("user_id", user.id);
    if (err) {
      setDeleteSaving(false);
      console.error("PlantingHistoryPage.handleDelete: update failed", err);
      showErrorToast("Couldn't delete — please try again");
      return;
    }
    // Cascade: soft-delete any care tasks tied to this planting (mirrors the retired
    // dev-page handler so behavior is identical, just relocated).
    await softDeleteTasksForGrowInstance(row.id, user.id);
    setDeleteSaving(false);
    setGrows((prev) => prev.filter((g) => g.id !== row.id));
    showToast("Planting deleted");
    setDeleteOpen(null);
    setDeleteConfirmText("");
  }

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
    growing: "bg-emerald-100 text-emerald-800",
    archived: "bg-neutral-100 text-neutral-600",
  };
  const statusLabel = (s: string | null | undefined): string =>
    s === "archived" ? "Archived" : "Growing";

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      {toast}
      <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">&larr; Back</Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Planting History</h1>
      <p className="text-sm text-neutral-500 mb-6">Every grow instance across all plants.</p>

      {loading ? (
        <LoadingState message="Loading…" />
      ) : grows.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <p className="text-neutral-500 text-sm font-medium">No plantings to look back on yet.</p>
          <p className="text-neutral-400 text-xs mt-1">Once you start a planting from a packet, it&rsquo;ll show up here — with how it grew, where it lived, and what you harvested.</p>
        </div>
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
                  <th className="px-4 py-3">Germ / Count</th>
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
                        <Link href={`/library/${g.plant_profile_id}`} className="font-medium text-neutral-800 hover:text-emerald-600 hover:underline">
                          {g.profile_name}{g.variety_name?.trim() ? ` (${g.variety_name})` : ""}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{sownDate.toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-neutral-500">{g.location || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[g.status ?? ""] ?? "bg-neutral-100 text-neutral-600"}`}>
                            {statusLabel(g.status)}
                          </span>
                          {g.status === "archived" && (
                            <span className="inline-flex min-h-[44px] items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setRestoreOpen(g)}
                                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline whitespace-nowrap px-2 py-1"
                                aria-label={`Restore ${g.profile_name} to Growing`}
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={() => { setDeleteOpen(g); setDeleteConfirmText(""); }}
                                className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline whitespace-nowrap px-2 py-1"
                                aria-label={`Permanently delete ${g.profile_name}`}
                              >
                                Delete
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 text-xs">
                        {[
                          g.sow_method === "direct_sow" ? "Direct" : g.sow_method === "seed_start" ? "Seed start" : null,
                          g.seeds_sprouted != null && g.seeds_sown != null && g.seeds_sown > 0 ? `${g.seeds_sprouted}/${g.seeds_sown}` : null,
                          g.plant_count != null ? `${g.plant_count} plants` : null,
                        ].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{g.harvest_count > 0 ? g.harvest_count : "—"}</td>
                      <td className="px-4 py-3 text-neutral-500">{durationDays != null ? `${durationDays}d` : "ongoing"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {restoreOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => setRestoreOpen(null)} />
          <div className="fixed left-4 right-4 bottom-4 z-[101] bg-white rounded-2xl shadow-xl p-5 mx-auto max-w-sm">
            <h2 className="font-semibold text-neutral-900 text-base mb-1">Restore to Growing?</h2>
            <p className="text-sm text-neutral-500 mb-4">
              This plant will be active in your garden again. You can archive it any time.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRestoreOpen(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-teal-gus/40 text-teal-gus font-medium text-sm hover:bg-teal-gus/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => restoreOpen && handleRestore(restoreOpen)}
                disabled={restoreSaving}
                className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {restoreSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
                Restore
              </button>
            </div>
          </div>
        </>
      )}

      {deleteOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => { setDeleteOpen(null); setDeleteConfirmText(""); }} />
          <div className="fixed left-4 right-4 bottom-4 z-[101] bg-white rounded-2xl shadow-xl p-5 mx-auto max-w-sm">
            <h2 className="font-semibold text-neutral-900 text-base mb-1">Permanently Delete Planting?</h2>
            <p className="text-sm text-neutral-500 mb-3">
              This will permanently delete this planting and its history. This cannot be undone. Type DELETE to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
              autoCapitalize="characters"
              autoComplete="off"
              className="w-full min-h-[44px] px-3 py-2 mb-4 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setDeleteOpen(null); setDeleteConfirmText(""); }}
                className="flex-1 min-h-[44px] rounded-xl border border-teal-gus/40 text-teal-gus font-medium text-sm hover:bg-teal-gus/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteOpen && handleDelete(deleteOpen)}
                disabled={deleteSaving || deleteConfirmText.trim() !== "DELETE"}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
