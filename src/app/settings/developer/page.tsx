"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";
import { cascadeTasksAndShoppingForDeletedProfiles } from "@/lib/cascadeOnProfileDelete";
import { identityKeyFromVariety } from "@/lib/identityKey";

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
  const { user, session } = useAuth();
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
  const [reExtractConfirmOpen, setReExtractConfirmOpen] = useState(false);
  const [repairConfirmOpen, setRepairConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fillInBlanksRunning, setFillInBlanksRunning] = useState(false);
  const [fillInBlanksProgress, setFillInBlanksProgress] = useState<{
    current: number;
    total: number;
    fromCache: number;
    fromAi: number;
    failed: number;
    currentName?: string;
  } | null>(null);
  const [fillInBlanksResult, setFillInBlanksResult] = useState<{
    fromCache: number;
    fromAi: number;
    failed: number;
    skipped: number;
    message?: string;
  } | null>(null);
  const [backfillDescriptionsRunning, setBackfillDescriptionsRunning] = useState(false);
  const [backfillDescriptionsProgress, setBackfillDescriptionsProgress] = useState<{
    round: number;
    fromCache: number;
    fromAi: number;
    failed: number;
  } | null>(null);
  const [backfillDescriptionsResult, setBackfillDescriptionsResult] = useState<{
    fromCache: number;
    fromAi: number;
    failed: number;
    message?: string;
  } | null>(null);
  const [backfillCacheRunning, setBackfillCacheRunning] = useState(false);
  const [backfillCacheProgress, setBackfillCacheProgress] = useState<{
    round: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const [backfillCacheResult, setBackfillCacheResult] = useState<{
    updated: number;
    skipped: number;
    failed: number;
    message?: string;
  } | null>(null);

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
      .is("deleted_at", null)
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

  const [deletingPlantingId, setDeletingPlantingId] = useState<string | null>(null);
  const handleDeleteArchivedPlanting = useCallback(async (growInstanceId: string) => {
    if (!user?.id) return;
    setDeletingPlantingId(growInstanceId);
    const now = new Date().toISOString();
    await supabase.from("grow_instances").update({ deleted_at: now }).eq("id", growInstanceId).eq("user_id", user.id);
    await softDeleteTasksForGrowInstance(growInstanceId, user.id);
    setArchivedPlantings((prev) => prev.filter((p) => p.id !== growInstanceId));
    setDeletingPlantingId(null);
  }, [user?.id]);

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
    await cascadeTasksAndShoppingForDeletedProfiles(supabase, [profileId], user.id);
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
    setReExtractConfirmOpen(false);
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

  const reExtractUrlError = reExtractUrl.trim() && !reExtractUrl.trim().startsWith("http")
    ? "Enter a valid URL (http or https)"
    : null;

  /** Treat placeholder hero URL as missing so we only repair profiles with no real hero (never overwrite uploaded or packet-approved hero). */
  const isPlaceholderHeroUrl = (url: string | null | undefined): boolean => {
    if (!url || !String(url).trim()) return false;
    const u = String(url).trim().toLowerCase();
    return u === "/seedling-icon.svg" || u.endsWith("/seedling-icon.svg");
  };

  const runRepairMissingHeroPhotos = useCallback(async () => {
    if (!user?.id || repairHeroRunning) return;
    setRepairConfirmOpen(false);
    setRepairHeroRunning(true);
    setRepairHeroResult(null);
    const { data: profiles } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, scientific_name, hero_image_url, hero_image_path")
      .eq("user_id", user.id)
      .is("deleted_at", null);
    const withoutHero = (profiles ?? []).filter(
      (p: { hero_image_url?: string | null; hero_image_path?: string | null }) => {
        const path = (p.hero_image_path ?? "").trim();
        if (path) return false;
        const url = (p.hero_image_url ?? "").trim();
        if (!url) return true;
        return isPlaceholderHeroUrl(url);
      }
    ) as { id: string; name: string; variety_name: string | null; scientific_name: string | null }[];
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
        const identityKey = identityKeyFromVariety(p.name, p.variety_name ?? "") || undefined;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch("/api/seed/find-hero-photo", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: p.name,
            variety: p.variety_name ?? "",
            vendor: vendorByProfile[p.id] ?? "",
            identity_key: identityKey,
            scientific_name: p.scientific_name ?? "",
          }),
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
  }, [user?.id, session?.access_token, repairHeroRunning]);

  const runFillInBlanks = useCallback(async (useGemini: boolean) => {
    if (!user?.id || fillInBlanksRunning) return;
    setFillInBlanksRunning(true);
    setFillInBlanksResult(null);
    setFillInBlanksProgress(null);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    try {
      const res = await fetch("/api/settings/fill-in-blanks", {
        method: "POST",
        headers,
        body: JSON.stringify({ useGemini, stream: true }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setFillInBlanksResult({
          fromCache: 0,
          fromAi: 0,
          failed: 0,
          skipped: 0,
          message: data.error ?? "Request failed",
        });
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const obj = JSON.parse(trimmed) as { type?: string; current?: number; total?: number; fromCache?: number; fromAi?: number; failed?: number; currentName?: string; skipped?: number; message?: string };
              if (obj.type === "progress") {
                setFillInBlanksProgress({
                  current: obj.current ?? 0,
                  total: obj.total ?? 0,
                  fromCache: obj.fromCache ?? 0,
                  fromAi: obj.fromAi ?? 0,
                  failed: obj.failed ?? 0,
                  currentName: obj.currentName,
                });
              } else if (obj.type === "done") {
                setFillInBlanksResult({
                  fromCache: obj.fromCache ?? 0,
                  fromAi: obj.fromAi ?? 0,
                  failed: obj.failed ?? 0,
                  skipped: obj.skipped ?? 0,
                  message: obj.message,
                });
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
      } else {
        // no stream (e.g. API returned JSON)
        const data = (await res.json()) as { fromCache?: number; fromAi?: number; failed?: number; skipped?: number; message?: string };
        setFillInBlanksResult({
          fromCache: data.fromCache ?? 0,
          fromAi: data.fromAi ?? 0,
          failed: data.failed ?? 0,
          skipped: data.skipped ?? 0,
          message: data.message,
        });
      }
    } catch (e) {
      setFillInBlanksResult({
        fromCache: 0,
        fromAi: 0,
        failed: 0,
        skipped: 0,
        message: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setFillInBlanksRunning(false);
      setFillInBlanksProgress(null);
    }
  }, [user?.id, session?.access_token, fillInBlanksRunning]);

  const runBackfillPlantDescriptions = useCallback(async () => {
    if (!session?.access_token || backfillDescriptionsRunning) return;
    setBackfillDescriptionsRunning(true);
    setBackfillDescriptionsResult(null);
    setBackfillDescriptionsProgress(null);
    let round = 0;
    let totalFromCache = 0;
    let totalFromAi = 0;
    let totalFailed = 0;
    try {
      for (;;) {
        round++;
        const res = await fetch("/api/developer/backfill-plant-descriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ batchSize: 50 }),
        });
        const data = (await res.json()) as { fromCache?: number; fromAi?: number; failed?: number; hasMore?: boolean; message?: string };
        totalFromCache += data.fromCache ?? 0;
        totalFromAi += data.fromAi ?? 0;
        totalFailed += data.failed ?? 0;
        setBackfillDescriptionsProgress({ round, fromCache: totalFromCache, fromAi: totalFromAi, failed: totalFailed });
        if (!data.hasMore) {
          setBackfillDescriptionsResult({
            fromCache: totalFromCache,
            fromAi: totalFromAi,
            failed: totalFailed,
            message: data.message,
          });
          break;
        }
      }
    } catch (e) {
      setBackfillDescriptionsResult({
        fromCache: totalFromCache,
        fromAi: totalFromAi,
        failed: totalFailed,
        message: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setBackfillDescriptionsRunning(false);
      setBackfillDescriptionsProgress(null);
    }
  }, [session?.access_token, backfillDescriptionsRunning]);

  const runBackfillCache = useCallback(async () => {
    if (!session?.access_token || backfillCacheRunning) return;
    setBackfillCacheRunning(true);
    setBackfillCacheResult(null);
    setBackfillCacheProgress(null);
    let round = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let offset: number | undefined;
    try {
      for (;;) {
        round++;
        const res = await fetch("/api/developer/backfill-cache", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(offset !== undefined ? { offset } : {}),
        });
        const data = (await res.json()) as { updated?: number; skipped?: number; failed?: number; hasMore?: boolean; nextOffset?: number; message?: string };
        totalUpdated += data.updated ?? 0;
        totalSkipped += data.skipped ?? 0;
        totalFailed += data.failed ?? 0;
        if (data.nextOffset !== undefined) offset = data.nextOffset;
        setBackfillCacheProgress({ round, updated: totalUpdated, skipped: totalSkipped, failed: totalFailed });
        if (!data.hasMore) {
          setBackfillCacheResult({
            updated: totalUpdated,
            skipped: totalSkipped,
            failed: totalFailed,
            message: data.message,
          });
          break;
        }
      }
    } catch (e) {
      setBackfillCacheResult({
        updated: totalUpdated,
        skipped: totalSkipped,
        failed: totalFailed,
        message: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setBackfillCacheRunning(false);
      setBackfillCacheProgress(null);
    }
  }, [session?.access_token, backfillCacheRunning]);

  const q = searchQuery.trim().toLowerCase();
  const matchesSection = (s: { title: string; desc: string }) =>
    !q || s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);

  if (!user) return null;

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto pb-24">
      <Link href="/settings" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6 min-h-[44px] items-center">
        &larr; Settings
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Developer</h1>
      <p className="text-sm text-neutral-500 mb-4">Tools and data for troubleshooting, archives, and cache.</p>

      <div className="mb-6">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tools…"
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-neutral-100 border-0 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald/40"
          aria-label="Search developer tools"
        />
      </div>

      {/* Safe Tools */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">Safe tools</h2>
      <div className="space-y-6 mb-10">
      {matchesSection({ title: "Archived Plantings", desc: "Past growing batches" }) && (
      <section>
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
                    <li key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/vault/${item.plant_profile_id}`} className="text-neutral-800 font-medium hover:text-emerald-600 hover:underline">
                          {item.name}{item.variety_name?.trim() ? ` (${item.variety_name})` : ""}
                        </Link>
                        <p className="text-sm text-neutral-500 mt-1">
                          Planted {new Date(item.sown_date).toLocaleDateString()}
                          {" - Harvested "}{item.harvest_count} {item.harvest_count === 1 ? "time" : "times"}
                          {" - Ended "}{item.ended_at ? new Date(item.ended_at).toLocaleDateString() : "--"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteArchivedPlanting(item.id)}
                        disabled={deletingPlantingId === item.id}
                        className="shrink-0 min-w-[44px] min-h-[44px] px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingPlantingId === item.id ? "..." : "Delete"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
      )}

      {matchesSection({ title: "Import History", desc: "Past link imports" }) && (
      <section>
        <Link href="/settings/import-logs" className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors min-h-[44px]">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Import History</h3>
          <p className="text-sm text-neutral-500 mb-2">Past link imports for troubleshooting.</p>
          <span className="text-sm text-emerald-600 font-medium">View logs &rarr;</span>
        </Link>
      </section>
      )}

      {matchesSection({ title: "Archived Purchases", desc: "Items marked purchased" }) && (
      <section>
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
      )}

      {matchesSection({ title: "Repair Hero Photos", desc: "Find and set stock photos" }) && (
      <section>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Repair Hero Photos</h3>
          <p className="text-sm text-neutral-500 mb-3">Add cover photos to plant varieties that don’t have one, so your Vault and cards look complete.</p>
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
            onClick={() => setRepairConfirmOpen(true)}
            disabled={repairHeroRunning}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: "#059669", color: "#ffffff" }}
          >
            {repairHeroRunning ? "Repairing..." : "Repair Missing Photos"}
          </button>
        </div>
      </section>
      )}

      {matchesSection({ title: "Fill in blanks", desc: "Cache and hero" }) && (
      <section>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Fill in blanks</h3>
          <p className="text-sm text-neutral-500 mb-3">
            Add missing cover photos and basic details to your plant profiles. Uses a shared plant database first (no cost), then AI for anything not found. Your data stays private.
          </p>
          {fillInBlanksResult && !fillInBlanksRunning && (
            <div className="mb-3 p-3 rounded-xl border border-neutral-200 bg-neutral-50">
              <p className="text-sm text-neutral-700">From cache: {fillInBlanksResult.fromCache}. From AI: {fillInBlanksResult.fromAi}. No match: {fillInBlanksResult.failed}. Skipped (already had hero): {fillInBlanksResult.skipped}.</p>
              {fillInBlanksResult.message && <p className="text-xs text-neutral-500 mt-1">{fillInBlanksResult.message}</p>}
            </div>
          )}
          {fillInBlanksRunning && fillInBlanksProgress && fillInBlanksProgress.total > 0 && (
            <div className="mb-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
              <div className="flex justify-between text-sm text-neutral-700 mb-1">
                <span>Processing {fillInBlanksProgress.current} of {fillInBlanksProgress.total}</span>
                <span>Cache: {fillInBlanksProgress.fromCache} · AI: {fillInBlanksProgress.fromAi} · No match: {fillInBlanksProgress.failed}</span>
              </div>
              {fillInBlanksProgress.currentName && (
                <p className="text-xs text-neutral-600 truncate mb-2" title={fillInBlanksProgress.currentName}>{fillInBlanksProgress.currentName}</p>
              )}
              <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.round((fillInBlanksProgress.current / fillInBlanksProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runFillInBlanks(false)}
              disabled={fillInBlanksRunning}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 border border-neutral-300 bg-white text-neutral-800"
            >
              {fillInBlanksRunning ? "Running…" : "Cache only"}
            </button>
            <button
              type="button"
              onClick={() => runFillInBlanks(true)}
              disabled={fillInBlanksRunning}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: "#059669", color: "#ffffff" }}
            >
              {fillInBlanksRunning ? "Running…" : "Cache + AI hero"}
            </button>
          </div>
        </div>
      </section>
      )}

      {matchesSection({ title: "Complete plant details", desc: "Description backfill" }) && (
      <section>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Complete plant details</h3>
          <p className="text-sm text-neutral-500 mb-3">
            Add missing growing info to your plant profiles—sun needs, spacing, days to germination, harvest time, watering, how to sow, and a short description. Uses a shared database first, then AI. Runs in the background; you can leave this page open.
          </p>
          {backfillDescriptionsProgress && backfillDescriptionsRunning && (
            <div className="mb-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
              <p className="text-sm text-neutral-700">Batch {backfillDescriptionsProgress.round} — From cache: {backfillDescriptionsProgress.fromCache} · From AI: {backfillDescriptionsProgress.fromAi} · Failed: {backfillDescriptionsProgress.failed}</p>
            </div>
          )}
          {backfillDescriptionsResult && !backfillDescriptionsRunning && (
            <div className="mb-3 p-3 rounded-xl border border-neutral-200 bg-neutral-50">
              <p className="text-sm text-neutral-700">Done. From cache: {backfillDescriptionsResult.fromCache}. From AI: {backfillDescriptionsResult.fromAi}. Failed: {backfillDescriptionsResult.failed}.</p>
              {backfillDescriptionsResult.message && <p className="text-xs text-neutral-500 mt-1">{backfillDescriptionsResult.message}</p>}
            </div>
          )}
          <button
            type="button"
            onClick={runBackfillPlantDescriptions}
            disabled={backfillDescriptionsRunning}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: "#059669", color: "#ffffff" }}
          >
            {backfillDescriptionsRunning ? "Running…" : "Fill in missing details"}
          </button>
        </div>
      </section>
      )}

      {matchesSection({ title: "Backfill Cache", desc: "Global plant cache" }) && (
      <section>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-800 mb-1">Backfill Cache</h3>
          <p className="text-sm text-neutral-500 mb-3">
            Same as <code className="text-xs bg-neutral-100 px-1 rounded">npm run backfill-cache</code>. Fills empty or failed rows in the global plant cache using AI. Runs in batches until done; you can leave the page running.
          </p>
          {backfillCacheProgress && backfillCacheRunning && (
            <div className="mb-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
              <p className="text-sm text-neutral-700">Batch {backfillCacheProgress.round} — Updated: {backfillCacheProgress.updated} · Skipped: {backfillCacheProgress.skipped} · Failed: {backfillCacheProgress.failed}</p>
            </div>
          )}
          {backfillCacheResult && !backfillCacheRunning && (
            <div className="mb-3 p-3 rounded-xl border border-neutral-200 bg-neutral-50">
              <p className="text-sm text-neutral-700">Done. Updated: {backfillCacheResult.updated}. Skipped: {backfillCacheResult.skipped}. Failed: {backfillCacheResult.failed}.</p>
              {backfillCacheResult.message && <p className="text-xs text-neutral-500 mt-1">{backfillCacheResult.message}</p>}
            </div>
          )}
          <button
            type="button"
            onClick={runBackfillCache}
            disabled={backfillCacheRunning}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: "#059669", color: "#ffffff" }}
          >
            {backfillCacheRunning ? "Running…" : "Backfill Cache"}
          </button>
        </div>
      </section>
      )}
      </div>

      {/* Danger Zone */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-4">Danger zone</h2>
      <div className="space-y-6 rounded-2xl border border-red-200 bg-red-50/30 p-4">
      {matchesSection({ title: "Re-extract URL", desc: "Overwrite cache" }) && (
      <section>
        <div className="rounded-xl border border-red-200/50 bg-white p-5">
          <h3 className="text-base font-semibold text-red-700 mb-1">Re-extract this URL</h3>
          <p className="text-sm text-neutral-600 mb-3">Overwrite the global cache row for a single seed URL. Use when a cached entry is wrong or stale.</p>
          <input
            type="url"
            value={reExtractUrl}
            onChange={(e) => { setReExtractUrl(e.target.value); setReExtractResult(null); }}
            placeholder="https://..."
            className={`w-full min-h-[44px] px-4 py-2 rounded-xl border text-neutral-800 placeholder:text-neutral-400 mb-2 ${reExtractUrlError ? "border-red-400" : "border-neutral-200"}`}
            aria-invalid={!!reExtractUrlError}
            aria-describedby={reExtractUrlError ? "reextract-error" : undefined}
          />
          {reExtractUrlError && (
            <p id="reextract-error" className="text-sm text-red-600 mb-2">{reExtractUrlError}</p>
          )}
          {reExtractResult && !reExtractUrlError && (
            <p className={`text-sm mb-2 ${reExtractResult.ok ? "text-emerald-600" : "text-red-600"}`}>
              {reExtractResult.ok ? "Cache updated." : reExtractResult.error}
            </p>
          )}
          <button
            type="button"
            onClick={() => setReExtractConfirmOpen(true)}
            disabled={reExtractLoading || !reExtractUrl.trim().startsWith("http")}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 bg-red-600 text-white"
          >
            {reExtractLoading ? "Re-extracting…" : "Re-extract URL"}
          </button>
        </div>
      </section>
      )}

      {matchesSection({ title: "Plant Data Cache", desc: "Cached plant details" }) && (
      <section>
        <Link href="/settings/extract-cache" className="block rounded-xl border border-red-200/50 bg-white p-5 hover:border-red-300 transition-colors min-h-[44px]">
          <h3 className="text-base font-semibold text-red-700 mb-1">Plant Data Cache</h3>
          <p className="text-sm text-neutral-600 mb-2">Cached plant details and hero photos. Clear to force fresh extraction.</p>
          <span className="text-sm text-red-600 font-medium">Manage cache &rarr;</span>
        </Link>
      </section>
      )}

      {matchesSection({ title: "Deleted Items", desc: "Restore or permanently delete" }) && trashProfiles.length > 0 && (
        <section>
          <div className="rounded-xl border border-red-200/50 bg-white p-5">
            <h3 className="text-base font-semibold text-red-700 mb-1">Deleted Items</h3>
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

      {/* Confirmation modals */}
      {reExtractConfirmOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={() => setReExtractConfirmOpen(false)} />
          <div className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg max-w-sm mx-auto" role="dialog" aria-modal="true" aria-labelledby="reextract-confirm-title">
            <h2 id="reextract-confirm-title" className="text-lg font-semibold text-neutral-900 mb-2">Re-extract URL?</h2>
            <p className="text-sm text-neutral-600 mb-4">This will overwrite the cached data for this URL. Continue?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setReExtractConfirmOpen(false)} className="flex-1 min-h-[44px] rounded-xl border border-neutral-300 text-neutral-700 font-medium">Cancel</button>
              <button type="button" onClick={runReExtractUrl} disabled={reExtractLoading} className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white font-medium disabled:opacity-50">Re-extract</button>
            </div>
          </div>
        </>
      )}

      {repairConfirmOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={() => setRepairConfirmOpen(false)} />
          <div className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg max-w-sm mx-auto" role="dialog" aria-modal="true" aria-labelledby="repair-confirm-title">
            <h2 id="repair-confirm-title" className="text-lg font-semibold text-neutral-900 mb-2">Repair Hero Photos?</h2>
            <p className="text-sm text-neutral-600 mb-4">This will search for and set stock photos for varieties missing a hero image. It may take a few minutes.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setRepairConfirmOpen(false)} className="flex-1 min-h-[44px] rounded-xl border border-neutral-300 text-neutral-700 font-medium">Cancel</button>
              <button type="button" onClick={runRepairMissingHeroPhotos} disabled={repairHeroRunning} className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50">Repair</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
