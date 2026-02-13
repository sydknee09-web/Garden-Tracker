"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { UserSettings, Household, HouseholdMember } from "@/types/garden";

export default function SettingsProfilePage() {
  const { user, signOut } = useAuth();
  const [gardenSettings, setGardenSettings] = useState<Partial<UserSettings>>({});
  const [gardenSaving, setGardenSaving] = useState(false);
  const [gardenSaved, setGardenSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<(HouseholdMember & { email?: string })[]>([]);
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joiningHousehold, setJoiningHousehold] = useState(false);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);

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
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      planting_zone: gardenSettings.planting_zone || null,
      last_frost_date: gardenSettings.last_frost_date || null,
      latitude: gardenSettings.latitude ?? null,
      longitude: gardenSettings.longitude ?? null,
      timezone: gardenSettings.timezone || "America/Los_Angeles",
      location_name: gardenSettings.location_name || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setGardenSaving(false);
    if (!error) {
      setGardenSaved(true);
      setTimeout(() => setGardenSaved(false), 2500);
    }
  }, [user?.id, gardenSettings]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGardenSettings((prev) => ({
        ...prev,
        latitude: Math.round(pos.coords.latitude * 10000) / 10000,
        longitude: Math.round(pos.coords.longitude * 10000) / 10000,
      })),
      () => {},
    );
  }, []);

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

  const ZONES = ["1a","1b","2a","2b","3a","3b","4a","4b","5a","5b","6a","6b","7a","7b","8a","8b","9a","9b","10a","10b","11a","11b","12a","12b","13a","13b"];

  if (!user) return null;

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto pb-24">
      <Link href="/settings" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6">
        &larr; Settings
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-8">Profile</h1>

      {/* My Garden */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">My Garden</h2>
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
            <input id="location-name" type="text" placeholder="e.g. Vista, CA" value={gardenSettings.location_name ?? ""} onChange={(e) => setGardenSettings((p) => ({ ...p, location_name: e.target.value || null }))} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
          </div>
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
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleUseMyLocation} className="min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Use My Location</button>
            <button type="button" onClick={saveGardenSettings} disabled={gardenSaving} className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
              {gardenSaving ? "Saving..." : gardenSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
      </section>

      {/* Export, Tag Manager, Schedule Defaults */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">Data & preferences</h2>
        <div className="space-y-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Export My Data</h3>
            <p className="text-sm text-neutral-500 mb-3">Download all your garden data as a JSON file.</p>
            <button type="button" onClick={handleExportData} disabled={exporting} className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
              {exporting ? "Exporting..." : "Download JSON"}
            </button>
          </div>
          <Link href="/vault/tags" className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Tag Manager</h3>
            <p className="text-sm text-neutral-500 mb-2">Manage tag colors, blocked tags, and AI tagging behavior.</p>
            <span className="text-sm text-emerald-600 font-medium">Manage tags &rarr;</span>
          </Link>
          <Link href="/settings/brain" className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Schedule Defaults</h3>
            <p className="text-sm text-neutral-500 mb-2">Set sow-by-month calendars and default care info for each plant type.</p>
            <span className="text-sm text-emerald-600 font-medium">Edit defaults &rarr;</span>
          </Link>
        </div>
      </section>

      {/* Manage household */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">Manage household</h2>
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
      </section>

      {/* Account */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">Account</h2>
        <div className="space-y-3">
          <Link href="/reset-password" className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Reset Password</h3>
            <p className="text-sm text-neutral-500">Receive an email link to set a new password.</p>
          </Link>
          <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-red-600 mb-1">Delete Account</h3>
            <p className="text-sm text-neutral-500 mb-3">Permanently delete your account and all garden data. This cannot be undone.</p>
            {!deleteAccountConfirm ? (
              <button type="button" onClick={() => setDeleteAccountConfirm(true)} className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50">
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
      </section>
    </div>
  );
}
