"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type ArchivedItem = {
  id: string;
  plant_profile_id: string;
  created_at: string;
  name: string;
  variety_name: string | null;
  vendor: string;
};

type ArchivedPlanting = {
  id: string;
  plant_profile_id: string;
  sown_date: string;
  ended_at: string | null;
  name: string;
  variety_name: string | null;
  harvest_count: number;
};

export default function SettingsDeveloperPage() {
  const { user } = useAuth();
  const [archived, setArchived] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [archivedPlantings, setArchivedPlantings] = useState<ArchivedPlanting[]>([]);
  const [plantingsLoading, setPlantingsLoading] = useState(true);
  const [plantingsExpanded, setPlantingsExpanded] = useState(false);
  const [repairHeroRunning, setRepairHeroRunning] = useState(false);
  const [repairHeroProgress, setRepairHeroProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [repairHeroResult, setRepairHeroResult] = useState<{ updated: number; failed: number } | null>(null);
  const [trashProfiles, setTrashProfiles] = useState<{ id: string; name: string; variety_name: string | null; deleted_at: string }[]>([]);
  const [trashExpanded, setTrashExpanded] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [reExtractUrl, setReExtractUrl] = useState("");
  const [reExtractLoading, setReExtractLoading] = useState(false);
  const [reExtractResult, setReExtractResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const loadTrash = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("plant_profiles")
      .select("id, name, variety_name, deleted_at")
      .eq("user_id", user.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    setTrashProfiles((data ?? []) as { id: string; name: string; variety_name: string | null; deleted_at: string }[]);
  }, [user?.id]);

  const loadArchived = useCallback(async () => {
    if (!user?.id) return;
    const { data: rows } = await supabase
      .from("shopping_list")
      .select("id, plant_profile_id, created_at")
      .eq("user_id", user.id)
      .eq("is_purchased", true)
      .order("created_at", { ascending: false });
    if (!rows?.length) { setArchived([]); setLoading(false); return; }
    const profileIds = Array.from(new Set(rows.map((r: { plant_profile_id: string }) => r.plant_profile_id)));
    const [profilesRes, packetsRes] = await Promise.all([
      supabase.from("plant_profiles").select("id, name, variety_name").in("id", profileIds),
      supabase.from("seed_packets").select("plant_profile_id, vendor_name").in("plant_profile_id", profileIds),
    ]);
    const nameMap: Record<string, { name: string; variety_name: string | null }> = {};
    (profilesRes.data ?? []).forEach((p: { id: string; name: string; variety_name: string | null }) => { nameMap[p.id] = { name: p.name, variety_name: p.variety_name }; });
    const vendorByProfile: Record<string, string> = {};
    (packetsRes.data ?? []).forEach((p: { plant_profile_id: string; vendor_name: string | null }) => {
      if (vendorByProfile[p.plant_profile_id] == null) vendorByProfile[p.plant_profile_id] = (p.vendor_name ?? "").trim() || "Unknown Vendor";
    });
    setArchived(
      (rows ?? []).map((r: { id: string; plant_profile_id: string; created_at: string }) => ({
        ...r,
        name: nameMap[r.plant_profile_id]?.name ?? "Unknown",
        variety_name: nameMap[r.plant_profile_id]?.variety_name ?? null,
        vendor: vendorByProfile[r.plant_profile_id] ?? "Unknown Vendor",
      }))
    );
    setLoading(false);
  }, [user?.id]);

  const loadArchivedPlantings = useCallback(async () => {
    if (!user?.id) return;
    const { data: rows } = await supabase
      .from("grow_instances")
      .select("id, plant_profile_id, sown_date, ended_at")
      .eq("user_id", user.id)
      .in("status", ["archived", "dead"])
      .order("ended_at", { ascending: false });
    if (!rows?.length) { setArchivedPlantings([]); setPlantingsLoading(false); return; }
    const profileIds = Array.from(new Set((rows as { plant_profile_id: string }[]).map((r) => r.plant_profile_id)));
    const growIds = (rows as { id: string }[]).map((r) => r.id);
    const [profilesRes, harvestRes] = await Promise.all([
      supabase.from("plant_profiles").select("id, name, variety_name").in("id", profileIds),
      supabase.from("journal_entries").select("grow_instance_id").in("grow_instance_id", growIds).ilike("note", "%harvest%"),
    ]);
    const nameMap: Record<string, { name: string; variety_name: string | null }> = {};
    (profilesRes.data ?? []).forEach((p: { id: string; name: string; variety_name: string | null }) => { nameMap[p.id] = { name: p.name, variety_name: p.variety_name }; });
    const harvestCountByGrow: Record<string, number> = {};
    (harvestRes.data ?? []).forEach((h: { grow_instance_id: string }) => {
      if (h.grow_instance_id) harvestCountByGrow[h.grow_instance_id] = (harvestCountByGrow[h.grow_instance_id] ?? 0) + 1;
    });
    setArchivedPlantings(
      (rows as { id: string; plant_profile_id: string; sown_date: string; ended_at: string | null }[]).map((r) => ({
        ...r,
        name: nameMap[r.plant_profile_id]?.name ?? "Unknown",
        variety_name: nameMap[r.plant_profile_id]?.variety_name ?? null,
        harvest_count: harvestCountByGrow[r.id] ?? 0,
      }))
    );
    setPlantingsLoading(false);
  }, [user?.id]);

  useEffect(() => { loadArchived(); }, [loadArchived]);
  useEffect(() => { loadArchivedPlantings(); }, [loadArchivedPlantings]);
  useEffect(() => { loadTrash(); }, [loadTrash]);

  const handleUnarchive = useCallback(async (item: ArchivedItem) => {
    if (!user?.id) return;
    setUnarchivingId(item.id);
    await supabase.from("shopping_list").update({ is_purchased: false }).eq("id", item.id).eq("user_id", user.id);
    setArchived((prev) => prev.filter((i) => i.id !== item.id));
    setUnarchivingId(null);
  }, [user?.id]);

  const restoreProfile = useCallback(async (profileId: string) => {
    if (!user?.id) return;
    setRestoringId(profileId);
    await supabase.from("plant_profiles").update({ deleted_at: null }).eq("id", profileId).eq("user_id", user.id);
    setRestoringId(null);
    loadTrash();
  }, [user?.id, loadTrash]);

  const permanentlyDeleteProfile = useCallback(async (profileId: string) => {
    if (!user?.id) return;
    setRestoringId(profileId);
    await supabase.from("plant_profiles").delete().eq("id", profileId).eq("user_id", user.id);
    setRestoringId(null);
    loadTrash();
  }, [user?.id, loadTrash]);

  const runReExtractUrl = useCallback(async () => {
    const url = reExtractUrl.trim();
    if (!url.startsWith("http")) {
      setReExtractResult({ error: "Enter a valid URL (http or https)" });
      return;
    }
    setReExtractLoading(true);
    setReExtractResult(null);
    try {
      const res = await fetch("/api/seed/re-extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; identity_key?: string };
      if (res.ok && data.ok) {
        setReExtractResult({ ok: true });
        setReExtractUrl("");
      } else {
        setReExtractResult({ error: data.error ?? "Re-extract failed" });
      }
    } catch (e) {
      setReExtractResult({ error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setReExtractLoading(false);
    }
  }, [reExtractUrl]);

  const runRepairMissingHeroPhotos = useCallback(async () => {
    if (!user?.id || repairHeroRunning) return;
    setRepairHeroRunning(true);
    setRepairHeroResult(null);
    const { data: profiles } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, hero_image_url, hero_image_path")
      .eq("user_id", user.id);
    const withoutHero = (profiles ?? []).filter(
      (p: { hero_image_url?: string | null; hero_image_path?: string | null }) =>
        !(p.hero_image_url ?? "").trim() && !(p.hero_image_path ?? "").trim()
    ) as { id: string; name: string; variety_name: string | null }[];
    if (withoutHero.length === 0) {
      setRepairHeroProgress(null);
      setRepairHeroResult({ updated: 0, failed: 0 });
      setRepairHeroRunning(false);
      return;
    }
    const { data: packets } = await supabase
      .from("seed_packets")
      .select("plant_profile_id, vendor_name")
      .eq("user_id", user.id)
      .in("plant_profile_id", withoutHero.map((p) => p.id));
    const vendorByProfile: Record<string, string> = {};
    (packets ?? []).forEach((row: { plant_profile_id: string; vendor_name: string | null }) => {
      if (vendorByProfile[row.plant_profile_id] == null) vendorByProfile[row.plant_profile_id] = (row.vendor_name ?? "").trim() || "";
    });
    let updated = 0;
    let failed = 0;
    for (let i = 0; i < withoutHero.length; i++) {
      const p = withoutHero[i];
      setRepairHeroProgress({ current: i + 1, total: withoutHero.length, label: `Finding photo for ${p.name}${p.variety_name?.trim() ? ` (${p.variety_name})` : ""}...` });
      try {
        const res = await fetch("/api/seed/find-hero-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: p.name, variety: p.variety_name ?? "", vendor: vendorByProfile[p.id] ?? "" }),
        });
        const data = (await res.json()) as { hero_image_url?: string; error?: string };
        const url = data.hero_image_url?.trim();
        if (url && res.ok) {
          await supabase.from("plant_profiles").update({ hero_image_url: url }).eq("id", p.id).eq("user_id", user.id);
          updated++;
        } else { failed++; }
      } catch { failed++; }
    }
    setRepairHeroProgress(null);
    setRepairHeroResult({ updated, failed });
    setRepairHeroRunning(false);
  }, [user?.id, repairHeroRunning]);

  if (!user) return null;

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto pb-24">
      <Link href="/settings" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6">
        &larr; Settings
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-8">Developer</h1>
      <p className="text-sm text-neutral-500 mb-6">Tools and data for troubleshooting, archives, and cache.</p>

      {/* Archived Plantings */}
      <section className="mb-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Archived Plantings</h3>
          <p className="text-sm text-neutral-500 mb-3">Past growing batches you ended or that died.</p>
          {plantingsLoading ? (
            <p className="text-neutral-400 text-sm">Loading...</p>
          ) : archivedPlantings.length === 0 ? (
            <p className="text-neutral-400 text-sm">No archived plantings.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPlantingsExpanded((e) => !e)}
                className="min-h-[44px] w-full flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-left font-medium text-neutral-800 hover:bg-neutral-100"
                aria-expanded={plantingsExpanded}
              >
                <span>{plantingsExpanded ? "Hide" : `View ${archivedPlantings.length} planting${archivedPlantings.length === 1 ? "" : "s"}`}</span>
                <span className="text-neutral-400 text-lg leading-none shrink-0" aria-hidden>{plantingsExpanded ? "-" : "+"}</span>
              </button>
              {plantingsExpanded && (
                <ul className="mt-2 border border-neutral-200 rounded-xl bg-white divide-y divide-neutral-100 overflow-hidden">
                  {archivedPlantings.map((item) => (
                    <li key={item.id} className="px-4 py-3">
                      <Link href={`/vault/${item.plant_profile_id}`} className="text-neutral-800 font-medium hover:text-emerald-600 hover:underline">
                        {item.name}{item.variety_name?.trim() ? ` (${item.variety_name})` : ""}
                      </Link>
                      <p className="text-sm text-neutral-500 mt-1">
                        Planted {new Date(item.sown_date).toLocaleDateString()}
                        {" - Harvested "}{item.harvest_count} {item.harvest_count === 1 ? "time" : "times"}
                        {" - Ended "}{item.ended_at ? new Date(item.ended_at).toLocaleDateString() : "--"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {/* Import History */}
      <section className="mb-10">
        <Link href="/settings/import-logs" className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Import History</h3>
          <p className="text-sm text-neutral-500 mb-2">Past link imports for troubleshooting.</p>
          <span className="text-sm text-emerald-600 font-medium">View logs &rarr;</span>
        </Link>
      </section>

      {/* Re-extract one URL */}
      <section className="mb-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Re-extract this URL</h3>
          <p className="text-sm text-neutral-500 mb-3">Overwrite the global cache row for a single seed URL. Use when a cached entry is wrong or stale.</p>
          <input
            type="url"
            value={reExtractUrl}
            onChange={(e) => setReExtractUrl(e.target.value)}
            placeholder="https://..."
            className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-neutral-200 text-neutral-800 placeholder:text-neutral-400 mb-2"
          />
          {reExtractResult && (
            <p className={`text-sm mb-2 ${reExtractResult.ok ? "text-emerald-600" : "text-red-600"}`}>
              {reExtractResult.ok ? "Cache updated." : reExtractResult.error}
            </p>
          )}
          <button
            type="button"
            onClick={runReExtractUrl}
            disabled={reExtractLoading}
            className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: "#059669", color: "#ffffff" }}
          >
            {reExtractLoading ? "Re-extracting…" : "Re-extract URL"}
          </button>
        </div>
      </section>

      {/* Plant Data Cache */}
      <section className="mb-10">
        <Link href="/settings/extract-cache" className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Plant Data Cache</h3>
          <p className="text-sm text-neutral-500 mb-2">Cached plant details and hero photos. Clear to force fresh extraction.</p>
          <span className="text-sm text-emerald-600 font-medium">Manage cache &rarr;</span>
        </Link>
      </section>

      {/* Archived Purchases */}
      <section className="mb-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Archived Purchases</h3>
          <p className="text-sm text-neutral-500 mb-3">Items marked as purchased. Un-archive to move back to your active shopping list.</p>
          {loading ? (
            <p className="text-neutral-400 text-sm">Loading...</p>
          ) : archived.length === 0 ? (
            <p className="text-neutral-400 text-sm">No archived items.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setArchiveExpanded((e) => !e)}
                className="min-h-[44px] w-full flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-left font-medium text-neutral-800 hover:bg-neutral-100"
                aria-expanded={archiveExpanded}
              >
                <span>{archiveExpanded ? "Hide" : `View ${archived.length} item${archived.length === 1 ? "" : "s"}`}</span>
                <span className="text-neutral-400 text-lg leading-none shrink-0" aria-hidden>{archiveExpanded ? "-" : "+"}</span>
              </button>
              {archiveExpanded && (
                <ul className="mt-2 border border-neutral-200 rounded-xl bg-white divide-y divide-neutral-100 overflow-hidden">
                  {archived.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <Link href={`/vault/${item.plant_profile_id}`} className="text-neutral-800 font-medium hover:text-emerald-600 hover:underline truncate min-w-0 flex-1">
                        {item.vendor} - {item.name}{item.variety_name?.trim() ? ` (${item.variety_name})` : ""}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleUnarchive(item)}
                        disabled={unarchivingId === item.id}
                        className="shrink-0 min-h-[44px] px-3 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {unarchivingId === item.id ? "..." : "Un-archive"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {/* Repair Hero Photos */}
      <section className="mb-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Repair Hero Photos</h3>
          <p className="text-sm text-neutral-500 mb-3">Find and set stock plant photos for varieties missing a hero image.</p>
          {repairHeroProgress && (
            <div className="mb-3 p-3 rounded-xl border border-neutral-200 bg-neutral-50">
              <p className="text-sm font-medium text-neutral-700">{repairHeroProgress.label}</p>
              <p className="text-xs text-neutral-400 mt-1">{repairHeroProgress.current} of {repairHeroProgress.total}</p>
              <div className="mt-2 h-2 rounded-full bg-neutral-200 overflow-hidden">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${(repairHeroProgress.current / repairHeroProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {repairHeroResult && !repairHeroRunning && (
            <p className="mb-3 text-sm text-neutral-600">Done. Updated: {repairHeroResult.updated}, no photo found: {repairHeroResult.failed}.</p>
          )}
          <button
            type="button"
            onClick={runRepairMissingHeroPhotos}
            disabled={repairHeroRunning}
            className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: "#059669", color: "#ffffff" }}
          >
            {repairHeroRunning ? "Repairing..." : "Repair Missing Photos"}
          </button>
        </div>
      </section>

      {/* Trash */}
      {trashProfiles.length > 0 && (
        <section className="mb-10">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Deleted Items</h3>
            <p className="text-sm text-neutral-500 mb-3">{trashProfiles.length} deleted profile{trashProfiles.length !== 1 ? "s" : ""}. Restore or permanently delete.</p>
            <button type="button" onClick={() => setTrashExpanded((p) => !p)} className="text-sm text-emerald-600 font-medium hover:underline mb-3 flex items-center gap-1">
              {trashExpanded ? "Hide" : "Show items"} <span className="text-neutral-400" aria-hidden>{trashExpanded ? "-" : "+"}</span>
            </button>
            {trashExpanded && (
              <ul className="space-y-2">
                {trashProfiles.map((p) => {
                  const daysAgo = Math.floor((Date.now() - new Date(p.deleted_at).getTime()) / 86400000);
                  const daysLeft = Math.max(0, 30 - daysAgo);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 border-b border-neutral-100 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800 truncate">{p.name}{p.variety_name ? ` (${p.variety_name})` : ""}</p>
                        <p className="text-xs text-neutral-400">{daysLeft > 0 ? `Auto-deletes in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}` : "Eligible for permanent deletion"}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => restoreProfile(p.id)} disabled={restoringId === p.id} className="px-2 py-1 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50">Restore</button>
                        <button type="button" onClick={() => permanentlyDeleteProfile(p.id)} disabled={restoringId === p.id} className="px-2 py-1 rounded-lg text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50">Delete</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
