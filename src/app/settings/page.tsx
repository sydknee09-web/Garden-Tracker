"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { UserSettings, Household, HouseholdMember } from "@/types/garden";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const { user, signOut } = useAuth();

  // ---- My Garden (user_settings) ----
  const [gardenSettings, setGardenSettings] = useState<Partial<UserSettings>>({});
  const [gardenSaving, setGardenSaving] = useState(false);
  const [gardenSaved, setGardenSaved] = useState(false);

  // ---- Archives ----
  const [archived, setArchived] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [archivedPlantings, setArchivedPlantings] = useState<ArchivedPlanting[]>([]);
  const [plantingsLoading, setPlantingsLoading] = useState(true);
  const [plantingsExpanded, setPlantingsExpanded] = useState(false);

  // ---- Repair Hero ----
  const [repairHeroRunning, setRepairHeroRunning] = useState(false);
  const [repairHeroProgress, setRepairHeroProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [repairHeroResult, setRepairHeroResult] = useState<{ updated: number; failed: number } | null>(null);

  // ---- Export ----
  const [exporting, setExporting] = useState(false);

  // ---- Trash ----
  const [trashProfiles, setTrashProfiles] = useState<{ id: string; name: string; variety_name: string | null; deleted_at: string }[]>([]);
  const [trashExpanded, setTrashExpanded] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // ---- Household ----
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<(HouseholdMember & { email?: string })[]>([]);
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joiningHousehold, setJoiningHousehold] = useState(false);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [householdError, setHouseholdError] = useState<string | null>(null);

  // =========================================================================
  // Load user_settings
  // =========================================================================
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setGardenSettings(data as UserSettings);
      });
  }, [user?.id]);

  // =========================================================================
  // Load trashed items
  // =========================================================================
  const loadTrash = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("plant_profiles")
      .select("id, name, variety_name, deleted_at")
      .eq("user_id", user.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    setTrashProfiles((data ?? []) as { id: string; name: string; variety_name: string | null; deleted_at: string }[]);
  }, [user?.id]);

  useEffect(() => { loadTrash(); }, [loadTrash]);

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

  // =========================================================================
  // Load household
  // =========================================================================
  const loadHousehold = useCallback(async () => {
    if (!user?.id) return;
    setHouseholdLoading(true);
    setHouseholdError(null);

    // Check if user is a member of any household
    const { data: memberRow } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberRow?.household_id) {
      const { data: hh } = await supabase.from("households").select("*").eq("id", memberRow.household_id).maybeSingle();
      if (hh) setHousehold(hh as Household);

      const { data: members } = await supabase.from("household_members").select("*").eq("household_id", memberRow.household_id);
      // Resolve emails from auth -- we'll just show user_ids for now (email resolution requires admin API)
      setHouseholdMembers((members ?? []) as (HouseholdMember & { email?: string })[]);
    } else {
      setHousehold(null);
      setHouseholdMembers([]);
    }
    setHouseholdLoading(false);
  }, [user?.id]);

  useEffect(() => { loadHousehold(); }, [loadHousehold]);

  const handleCreateHousehold = useCallback(async () => {
    if (!user?.id || !householdName.trim()) return;
    setCreatingHousehold(true);
    setHouseholdError(null);

    const { data: hh, error: e1 } = await supabase.from("households").insert({ name: householdName.trim(), owner_id: user.id }).select().single();
    if (e1 || !hh) { setHouseholdError(e1?.message ?? "Failed to create household"); setCreatingHousehold(false); return; }

    // Add self as owner member
    await supabase.from("household_members").insert({ household_id: hh.id, user_id: user.id, role: "owner" });

    setCreatingHousehold(false);
    setHouseholdName("");
    loadHousehold();
  }, [user?.id, householdName, loadHousehold]);

  const handleJoinHousehold = useCallback(async () => {
    if (!user?.id || !joinCode.trim()) return;
    setJoiningHousehold(true);
    setHouseholdError(null);

    const { data: hh } = await supabase.from("households").select("id").eq("invite_code", joinCode.trim()).maybeSingle();
    if (!hh) { setHouseholdError("Invalid invite code"); setJoiningHousehold(false); return; }

    const { error: e2 } = await supabase.from("household_members").insert({ household_id: hh.id, user_id: user.id, role: "member" });
    if (e2) { setHouseholdError(e2.message); setJoiningHousehold(false); return; }

    setJoiningHousehold(false);
    setJoinCode("");
    loadHousehold();
  }, [user?.id, joinCode, loadHousehold]);

  const handleLeaveHousehold = useCallback(async () => {
    if (!user?.id || !household) return;
    await supabase.from("household_members").delete().eq("household_id", household.id).eq("user_id", user.id);
    loadHousehold();
  }, [user?.id, household, loadHousehold]);

  const saveGardenSettings = useCallback(async () => {
    if (!user?.id) return;
    setGardenSaving(true);
    setGardenSaved(false);
    const payload = {
      user_id: user.id,
      planting_zone: gardenSettings.planting_zone || null,
      last_frost_date: gardenSettings.last_frost_date || null,
      latitude: gardenSettings.latitude ?? null,
      longitude: gardenSettings.longitude ?? null,
      timezone: gardenSettings.timezone || "America/Los_Angeles",
      location_name: gardenSettings.location_name || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("user_settings")
      .upsert(payload, { onConflict: "user_id" });
    setGardenSaving(false);
    if (!error) {
      setGardenSaved(true);
      setTimeout(() => setGardenSaved(false), 2500);
    }
  }, [user?.id, gardenSettings]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGardenSettings((prev) => ({
          ...prev,
          latitude: Math.round(pos.coords.latitude * 10000) / 10000,
          longitude: Math.round(pos.coords.longitude * 10000) / 10000,
        }));
      },
      () => { /* user denied or error – do nothing */ },
    );
  }, []);

  // =========================================================================
  // Load archives (same logic as before)
  // =========================================================================
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

  // =========================================================================
  // Repair hero photos
  // =========================================================================
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

  // =========================================================================
  // Unarchive
  // =========================================================================
  const handleUnarchive = useCallback(async (item: ArchivedItem) => {
    if (!user?.id) return;
    setUnarchivingId(item.id);
    await supabase.from("shopping_list").update({ is_purchased: false }).eq("id", item.id).eq("user_id", user.id);
    setArchived((prev) => prev.filter((i) => i.id !== item.id));
    setUnarchivingId(null);
  }, [user?.id]);

  // =========================================================================
  // Data export
  // =========================================================================
  const handleExportData = useCallback(async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const [profiles, packets, grows, journal, tasks, shopping, schedules, careScheds, settings] = await Promise.all([
        supabase.from("plant_profiles").select("*").eq("user_id", user.id),
        supabase.from("seed_packets").select("*").eq("user_id", user.id),
        supabase.from("grow_instances").select("*").eq("user_id", user.id),
        supabase.from("journal_entries").select("*").eq("user_id", user.id),
        supabase.from("tasks").select("*").eq("user_id", user.id),
        supabase.from("shopping_list").select("*").eq("user_id", user.id),
        supabase.from("schedule_defaults").select("*").eq("user_id", user.id),
        supabase.from("care_schedules").select("*").eq("user_id", user.id),
        supabase.from("user_settings").select("*").eq("user_id", user.id),
      ]);
      const exportData = {
        exported_at: new Date().toISOString(),
        plant_profiles: profiles.data ?? [],
        seed_packets: packets.data ?? [],
        grow_instances: grows.data ?? [],
        journal_entries: journal.data ?? [],
        tasks: tasks.data ?? [],
        shopping_list: shopping.data ?? [],
        schedule_defaults: schedules.data ?? [],
        care_schedules: careScheds.data ?? [],
        user_settings: settings.data ?? [],
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `garden-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [user?.id]);

  // =========================================================================
  // Planting zones dropdown values
  // =========================================================================
  const ZONES = [
    "1a","1b","2a","2b","3a","3b","4a","4b","5a","5b","6a","6b",
    "7a","7b","8a","8b","9a","9b","10a","10b","11a","11b","12a","12b","13a","13b",
  ];

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6">
        &larr; Back to Garden
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-8">Settings</h1>

      {/* ================================================================ */}
      {/* MY GARDEN                                                        */}
      {/* ================================================================ */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">My Garden</h2>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-5">
          {/* Planting Zone */}
          <div>
            <label htmlFor="planting-zone" className="block text-sm font-medium text-neutral-700 mb-1">Planting Zone</label>
            <select
              id="planting-zone"
              value={gardenSettings.planting_zone ?? ""}
              onChange={(e) => setGardenSettings((p) => ({ ...p, planting_zone: e.target.value || null }))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Select zone...</option>
              {ZONES.map((z) => <option key={z} value={z}>Zone {z}</option>)}
            </select>
          </div>
          {/* Last Frost Date */}
          <div>
            <label htmlFor="last-frost" className="block text-sm font-medium text-neutral-700 mb-1">Last Frost Date</label>
            <input
              id="last-frost"
              type="date"
              value={gardenSettings.last_frost_date ?? ""}
              onChange={(e) => setGardenSettings((p) => ({ ...p, last_frost_date: e.target.value || null }))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          {/* Location Name */}
          <div>
            <label htmlFor="location-name" className="block text-sm font-medium text-neutral-700 mb-1">Location Name</label>
            <input
              id="location-name"
              type="text"
              placeholder="e.g. Vista, CA"
              value={gardenSettings.location_name ?? ""}
              onChange={(e) => setGardenSettings((p) => ({ ...p, location_name: e.target.value || null }))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          {/* Lat/Lng */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lat" className="block text-sm font-medium text-neutral-700 mb-1">Latitude</label>
              <input
                id="lat"
                type="number"
                step="any"
                placeholder="33.2"
                value={gardenSettings.latitude ?? ""}
                onChange={(e) => setGardenSettings((p) => ({ ...p, latitude: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="lng" className="block text-sm font-medium text-neutral-700 mb-1">Longitude</label>
              <input
                id="lng"
                type="number"
                step="any"
                placeholder="-117.2"
                value={gardenSettings.longitude ?? ""}
                onChange={(e) => setGardenSettings((p) => ({ ...p, longitude: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Use My Location
            </button>
            <button
              type="button"
              onClick={saveGardenSettings}
              disabled={gardenSaving}
              className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: "#059669", color: "#ffffff" }}
            >
              {gardenSaving ? "Saving..." : gardenSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* DATA & TOOLS                                                     */}
      {/* ================================================================ */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">Data & Tools</h2>
        <div className="space-y-3">
          {/* Export */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Export My Data</h3>
            <p className="text-sm text-neutral-500 mb-3">Download all your garden data as a JSON file.</p>
            <button
              type="button"
              onClick={handleExportData}
              disabled={exporting}
              className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: "#059669", color: "#ffffff" }}
            >
              {exporting ? "Exporting..." : "Download JSON"}
            </button>
          </div>

          {/* Archived Purchases */}
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

          {/* Archived Plantings */}
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

          {/* Import History */}
          <Link
            href="/settings/import-logs"
            className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
          >
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Import History</h3>
            <p className="text-sm text-neutral-500 mb-2">Past link imports for troubleshooting.</p>
            <span className="text-sm text-emerald-600 font-medium">View logs &rarr;</span>
          </Link>

          {/* Plant Data Cache */}
          <Link
            href="/settings/extract-cache"
            className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
          >
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Plant Data Cache</h3>
            <p className="text-sm text-neutral-500 mb-2">Cached plant details and hero photos. Clear to force fresh extraction.</p>
            <span className="text-sm text-emerald-600 font-medium">Manage cache &rarr;</span>
          </Link>

          {/* Repair Hero Photos */}
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
        </div>
      </section>

      {/* ================================================================ */}
      {/* TRASH                                                            */}
      {/* ================================================================ */}
      {trashProfiles.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">Trash</h2>
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

      {/* ================================================================ */}
      {/* GARDEN BRAIN                                                     */}
      {/* ================================================================ */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">Garden Brain</h2>
        <div className="space-y-3">
          <Link
            href="/settings/brain"
            className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
          >
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Schedule Defaults</h3>
            <p className="text-sm text-neutral-500 mb-2">Set sow-by-month calendars and default care info for each plant type.</p>
            <span className="text-sm text-emerald-600 font-medium">Edit defaults &rarr;</span>
          </Link>

          <Link
            href="/vault/tags"
            className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
          >
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Tag Manager</h3>
            <p className="text-sm text-neutral-500 mb-2">Manage tag colors, blocked tags, and AI tagging behavior.</p>
            <span className="text-sm text-emerald-600 font-medium">Manage tags &rarr;</span>
          </Link>
        </div>
      </section>

      {/* ================================================================ */}
      {/* ACCOUNT                                                          */}
      {/* ================================================================ */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">Account</h2>
        <div className="space-y-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">My Household</h3>
            <p className="text-sm text-neutral-500 mb-3">Share your garden with family members.</p>

            {householdLoading ? (
              <p className="text-sm text-neutral-400">Loading...</p>
            ) : household ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{household.name}</p>
                    <p className="text-xs text-neutral-500">{householdMembers.length} member{householdMembers.length !== 1 ? "s" : ""}</p>
                  </div>
                  {household.owner_id !== user?.id && (
                    <button type="button" onClick={handleLeaveHousehold} className="text-xs text-red-600 font-medium hover:underline">Leave</button>
                  )}
                </div>

                {/* Invite code */}
                {household.invite_code && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                    <p className="text-xs font-medium text-emerald-800 mb-1">Invite Code</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-emerald-700 bg-white px-2 py-1 rounded border border-emerald-200 flex-1 text-center">{household.invite_code}</code>
                      <button type="button" onClick={() => navigator.clipboard.writeText(household.invite_code ?? "")} className="text-xs text-emerald-700 font-medium hover:underline shrink-0">Copy</button>
                    </div>
                    <p className="text-xs text-emerald-600 mt-1">Share this code with family members so they can join.</p>
                  </div>
                )}

                {/* Members list */}
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1.5">Members</p>
                  <ul className="space-y-1">
                    {householdMembers.map((m) => (
                      <li key={m.id} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-700">{m.user_id === user?.id ? "You" : m.user_id.slice(0, 8) + "..."}</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${m.role === "owner" ? "bg-amber-50 text-amber-700" : m.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}>{m.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Create household */}
                <div>
                  <p className="text-xs font-medium text-neutral-600 mb-1">Create a household</p>
                  <div className="flex gap-2">
                    <input type="text" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder="e.g. The Smith Garden" className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
                    <button type="button" onClick={handleCreateHousehold} disabled={creatingHousehold || !householdName.trim()} className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>{creatingHousehold ? "..." : "Create"}</button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <hr className="flex-1 border-neutral-200" />
                  <span className="text-xs text-neutral-400">or</span>
                  <hr className="flex-1 border-neutral-200" />
                </div>

                {/* Join household */}
                <div>
                  <p className="text-xs font-medium text-neutral-600 mb-1">Join with invite code</p>
                  <div className="flex gap-2">
                    <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Enter invite code" className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 text-sm font-mono" />
                    <button type="button" onClick={handleJoinHousehold} disabled={joiningHousehold || !joinCode.trim()} className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>{joiningHousehold ? "..." : "Join"}</button>
                  </div>
                </div>
              </div>
            )}

            {householdError && <p className="text-sm text-red-600 mt-2">{householdError}</p>}
          </div>

          <button
            type="button"
            onClick={signOut}
            className="w-full min-h-[44px] rounded-2xl border border-red-200 bg-white p-5 shadow-sm text-left hover:border-red-300 hover:bg-red-50/30 transition-colors"
          >
            <h3 className="text-base font-semibold text-red-600">Sign Out</h3>
            <p className="text-sm text-neutral-500">Sign out of your account on this device.</p>
          </button>
        </div>
      </section>
    </div>
  );
}
