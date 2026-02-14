"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useDeveloperUnlock } from "@/contexts/DeveloperUnlockContext";
import type { UserSettings, Household, HouseholdMember } from "@/types/garden";
import { getZone10bScheduleForPlant } from "@/data/zone10b_schedule";

const APP_VERSION = "0.1.0";

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function SettingsProfilePage() {
  const { user, signOut } = useAuth();
  const { tapVersion } = useDeveloperUnlock();
  const router = useRouter();
  const [gardenSettings, setGardenSettings] = useState<Partial<UserSettings>>({});
  const [lastSavedSettings, setLastSavedSettings] = useState<Partial<UserSettings> | null>(null);
  const [gardenSaving, setGardenSaving] = useState(false);
  const [gardenSaved, setGardenSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<(HouseholdMember & { email?: string })[]>([]);
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [householdExpanded, setHouseholdExpanded] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joiningHousehold, setJoiningHousehold] = useState(false);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [backfillingPlantingWindows, setBackfillingPlantingWindows] = useState(false);
  const [backfillToast, setBackfillToast] = useState<string | null>(null);
  const [showAdvancedCoords, setShowAdvancedCoords] = useState(false);
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const pendingNavigateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const s = data as UserSettings;
          setGardenSettings(s);
          setLastSavedSettings(s);
          if (s.latitude != null || s.longitude != null) setShowAdvancedCoords(true);
        }
      });
  }, [user?.id]);

  const isDirty = useCallback(() => {
    if (!lastSavedSettings) return false;
    const a = { ...gardenSettings };
    const b = { ...lastSavedSettings };
    return JSON.stringify({ planting_zone: a.planting_zone, last_frost_date: a.last_frost_date, latitude: a.latitude, longitude: a.longitude, location_name: a.location_name }) !==
      JSON.stringify({ planting_zone: b.planting_zone, last_frost_date: b.last_frost_date, latitude: b.latitude, longitude: b.longitude, location_name: b.location_name });
  }, [gardenSettings, lastSavedSettings]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty()) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const loadHousehold = useCallback(async () => {
    if (!user?.id) return;
    setHouseholdLoading(true);
    setHouseholdError(null);
    const { data: memberRow } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberRow?.household_id) {
      const { data: hh } = await supabase.from("households").select("*").eq("id", memberRow.household_id).maybeSingle();
      if (hh) setHousehold(hh as Household);
      const { data: members } = await supabase.from("household_members").select("*").eq("household_id", memberRow.household_id);
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
    const toSave = { planting_zone: gardenSettings.planting_zone || null, last_frost_date: gardenSettings.last_frost_date || null, latitude: gardenSettings.latitude ?? null, longitude: gardenSettings.longitude ?? null, timezone: gardenSettings.timezone || "America/Los_Angeles", location_name: gardenSettings.location_name || null };
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      ...toSave,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setGardenSaving(false);
    if (!error) {
      setLastSavedSettings((prev) => ({ ...prev, ...toSave }));
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
        setShowAdvancedCoords(true);
      },
      () => {},
    );
  }, []);

  const fetchExportData = useCallback(async () => {
    if (!user?.id) return null;
    const [profiles, packets, grows, journal, tasks, shopping, careScheds, settings] = await Promise.all([
      supabase.from("plant_profiles").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("seed_packets").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("grow_instances").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("journal_entries").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("tasks").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("shopping_list").select("*").eq("user_id", user.id),
      supabase.from("care_schedules").select("*").eq("user_id", user.id),
      supabase.from("user_settings").select("*").eq("user_id", user.id),
    ]);
    return {
      exported_at: new Date().toISOString(),
      plant_profiles: profiles.data ?? [],
      seed_packets: packets.data ?? [],
      grow_instances: grows.data ?? [],
      journal_entries: journal.data ?? [],
      tasks: tasks.data ?? [],
      shopping_list: shopping.data ?? [],
      care_schedules: careScheds.data ?? [],
      user_settings: settings.data ?? [],
    };
  }, [user?.id]);

  const handleExportData = useCallback(async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const exportData = await fetchExportData();
      if (!exportData) return;
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
  }, [user?.id, fetchExportData]);

  const handleFillPlantingWindows = useCallback(async () => {
    if (!user?.id) return;
    setBackfillingPlantingWindows(true);
    setBackfillToast(null);
    try {
      const { data: profiles } = await supabase
        .from("plant_profiles")
        .select("id, name, planting_window")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      const toUpdate = (profiles ?? []).filter(
        (p: { planting_window?: string | null }) => !(p.planting_window ?? "").trim()
      );
      let updated = 0;
      for (const p of toUpdate) {
        const firstWord = (p.name ?? "").trim().split(/\s+/)[0]?.trim() || p.name?.trim();
        const zone10b = getZone10bScheduleForPlant(firstWord ?? "");
        if (zone10b?.planting_window?.trim()) {
          await supabase
            .from("plant_profiles")
            .update({ planting_window: zone10b.planting_window.trim(), updated_at: new Date().toISOString() })
            .eq("id", p.id)
            .eq("user_id", user.id);
          updated++;
        }
      }
      setBackfillToast(`Updated ${updated} profile${updated !== 1 ? "s" : ""} with planting windows.`);
      setTimeout(() => setBackfillToast(null), 4000);
    } finally {
      setBackfillingPlantingWindows(false);
    }
  }, [user?.id]);

  const handleCopyExport = useCallback(async () => {
    if (!user?.id) return;
    setExporting(true);
    setCopySuccess(false);
    try {
      const exportData = await fetchExportData();
      if (!exportData) return;
      const json = JSON.stringify(exportData, null, 2);
      await navigator.clipboard.writeText(json);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } finally {
      setExporting(false);
    }
  }, [user?.id, fetchExportData]);

  const ZONES = ["1a","1b","2a","2b","3a","3b","4a","4b","5a","5b","6a","6b","7a","7b","8a","8b","9a","9b","10a","10b","11a","11b","12a","12b","13a","13b"];

  const handleNavClick = useCallback((e: React.MouseEvent, href: string) => {
    if (isDirty()) {
      e.preventDefault();
      pendingNavigateRef.current = href;
      setUnsavedModalOpen(true);
    }
  }, [isDirty]);

  const handleLeaveAnyway = useCallback(() => {
    const to = pendingNavigateRef.current;
    setUnsavedModalOpen(false);
    pendingNavigateRef.current = null;
    if (to) router.push(to);
  }, []);

  if (!user) return null;

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto pb-24">
      <Link href="/settings" onClick={(e) => handleNavClick(e, "/settings")} className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-emerald-600 font-medium hover:underline mb-6" aria-label="Back to Settings">
        &larr;
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Profile</h1>
      <p className="text-sm text-neutral-500 mb-6">Zone, export, tags, schedule, household, account.</p>

      {/* My Garden */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">My Garden</h2>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-5">
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
          <div>
            <label htmlFor="last-frost" className="block text-sm font-medium text-neutral-700 mb-1">Last Frost Date</label>
            <input id="last-frost" type="date" value={gardenSettings.last_frost_date ?? ""} onChange={(e) => setGardenSettings((p) => ({ ...p, last_frost_date: e.target.value || null }))} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div>
            <label htmlFor="location-name" className="block text-sm font-medium text-neutral-700 mb-1">Location Name</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                <MapPinIcon className="w-4 h-4" />
              </span>
              <input id="location-name" type="text" placeholder="e.g. Vista, CA" value={gardenSettings.location_name ?? ""} onChange={(e) => setGardenSettings((p) => ({ ...p, location_name: e.target.value || null }))} className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
          </div>
          {showAdvancedCoords && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lat" className="block text-sm font-medium text-neutral-700 mb-1">Latitude</label>
                <input id="lat" type="number" step="any" value={gardenSettings.latitude ?? ""} onChange={(e) => setGardenSettings((p) => ({ ...p, latitude: e.target.value ? Number(e.target.value) : null }))} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label htmlFor="lng" className="block text-sm font-medium text-neutral-700 mb-1">Longitude</label>
                <input id="lng" type="number" step="any" value={gardenSettings.longitude ?? ""} onChange={(e) => setGardenSettings((p) => ({ ...p, longitude: e.target.value ? Number(e.target.value) : null }))} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
            </div>
          )}
          <button type="button" onClick={() => setShowAdvancedCoords((v) => !v)} className="text-xs text-neutral-500 hover:text-neutral-700">
            {showAdvancedCoords ? "Hide coordinates" : "Show latitude & longitude"}
          </button>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={handleUseMyLocation} className="min-h-[44px] w-full px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Use My Location</button>
            <button type="button" onClick={saveGardenSettings} disabled={gardenSaving} className="min-h-[44px] w-full px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
              {gardenSaving ? "Saving..." : gardenSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
      </section>

      {/* Export, Tag Manager, Schedule Defaults */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Data & preferences</h2>
        <div className="space-y-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Back up my data</h3>
            <p className="text-sm text-neutral-500 mb-3">Download or copy all your garden data for safekeeping.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleExportData} disabled={exporting} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
                {exporting ? "..." : "Download"}
              </button>
              <button type="button" onClick={handleCopyExport} disabled={exporting} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                {copySuccess ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          </div>
          <Link href="/vault/tags" onClick={(e) => handleNavClick(e, "/vault/tags")} className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Tag Manager</h3>
            <p className="text-sm text-neutral-500 mb-2">Manage tag colors, blocked tags, and AI tagging behavior.</p>
            <span className="text-sm text-emerald-600 font-medium">Manage tags &rarr;</span>
          </Link>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Fill planting windows</h3>
            <p className="text-sm text-neutral-500 mb-3">For profiles with no planting window, set from Zone 10b defaults by plant name.</p>
            <button type="button" onClick={handleFillPlantingWindows} disabled={backfillingPlantingWindows} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
              {backfillingPlantingWindows ? "..." : "Fill from Zone 10b"}
            </button>
            {backfillToast && <p className="text-sm text-emerald-600 mt-2">{backfillToast}</p>}
          </div>
        </div>
      </section>

      {/* Manage household */}
      <section className="mb-8">
        <button type="button" onClick={() => setHouseholdExpanded((e) => !e)} className="w-full flex items-center justify-between min-h-[44px] py-2 text-left" aria-expanded={householdExpanded}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Manage household</h2>
          <span className="text-neutral-400 text-lg leading-none" aria-hidden>{householdExpanded ? "−" : "+"}</span>
        </button>
        {householdExpanded && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm mt-2">
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
        )}
      </section>

      {/* Account */}
      <section className="mb-8">
        <button type="button" onClick={() => setAccountExpanded((e) => !e)} className="w-full flex items-center justify-between min-h-[44px] py-2 text-left" aria-expanded={accountExpanded}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Account</h2>
          <span className="text-neutral-400 text-lg leading-none" aria-hidden>{accountExpanded ? "−" : "+"}</span>
        </button>
        {accountExpanded && (
        <div className="space-y-3 mt-2">
          <Link href="/reset-password" onClick={(e) => handleNavClick(e, "/reset-password")} className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Reset Password</h3>
            <p className="text-sm text-neutral-500">Receive an email link to set a new password.</p>
          </Link>
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm">
            <h3 className="text-base font-semibold text-red-700 mb-1">Delete Account</h3>
            <p className="text-sm text-neutral-600 mb-3">Permanently delete your account and all garden data. This cannot be undone.</p>
            {!deleteAccountConfirm ? (
              <button type="button" onClick={() => setDeleteAccountConfirm(true)} className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 border border-red-200 hover:bg-red-200/80">
                Delete my account
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-neutral-600">Contact support to complete account deletion.</span>
                <button type="button" onClick={() => setDeleteAccountConfirm(false)} className="text-sm text-neutral-500 hover:underline">Cancel</button>
              </div>
            )}
          </div>
          <button type="button" onClick={signOut} className="w-full min-h-[44px] rounded-2xl border border-red-200 bg-white p-5 shadow-sm text-left hover:border-red-300 hover:bg-red-50/30 transition-colors">
            <h3 className="text-base font-semibold text-red-600">Sign Out</h3>
            <p className="text-sm text-neutral-500">Sign out of your account on this device.</p>
          </button>
        </div>
        )}
      </section>

      <p className="text-center text-xs text-neutral-400 mt-8">
        <button
          type="button"
          onClick={tapVersion}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 py-1 -m-1 rounded"
          aria-label="App version"
        >
          Version {APP_VERSION}
        </button>
      </p>

      {unsavedModalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={() => setUnsavedModalOpen(false)} />
          <div className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg max-w-sm mx-auto" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
            <h2 id="unsaved-title" className="text-lg font-semibold text-neutral-900 mb-2">Unsaved changes</h2>
            <p className="text-sm text-neutral-600 mb-4">You have unsaved changes. Leave anyway?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setUnsavedModalOpen(false)} className="flex-1 min-h-[44px] rounded-xl border border-neutral-300 text-neutral-700 font-medium">Stay</button>
              <button type="button" onClick={handleLeaveAnyway} className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white font-medium">Leave</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
