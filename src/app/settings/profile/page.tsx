"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useDeveloperUnlock } from "@/contexts/DeveloperUnlockContext";
import type { UserSettings } from "@/types/garden";

const APP_VERSION = "0.1.0";

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function formatFrostDate(d: string | null | undefined): string {
  if (!d) return "Not set";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SettingsProfilePage() {
  const { user, signOut } = useAuth();
  const { tapVersion } = useDeveloperUnlock();
  const router = useRouter();

  // Garden settings
  const [gardenSettings, setGardenSettings] = useState<Partial<UserSettings>>({});
  const [lastSavedSettings, setLastSavedSettings] = useState<Partial<UserSettings> | null>(null);
  const [gardenEditing, setGardenEditing] = useState(false);
  const gardenEditSnapshot = useRef<Partial<UserSettings> | null>(null);
  const [gardenSaving, setGardenSaving] = useState(false);
  const [gardenSaved, setGardenSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [showAdvancedCoords, setShowAdvancedCoords] = useState(false);
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const pendingNavigateRef = useRef<string | null>(null);

  // Garden settings load
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

  // ── Garden settings handlers ──────────────────────────────────────────────

  const handleStartEditGarden = useCallback(() => {
    gardenEditSnapshot.current = { ...gardenSettings };
    setGardenEditing(true);
  }, [gardenSettings]);

  const handleCancelEditGarden = useCallback(() => {
    if (gardenEditSnapshot.current) setGardenSettings(gardenEditSnapshot.current);
    setGardenEditing(false);
  }, []);

  const saveGardenSettings = useCallback(async () => {
    if (!user?.id) return;
    setGardenSaving(true);
    setGardenSaved(false);
    const toSave = {
      planting_zone: gardenSettings.planting_zone || null,
      last_frost_date: gardenSettings.last_frost_date || null,
      latitude: gardenSettings.latitude ?? null,
      longitude: gardenSettings.longitude ?? null,
      timezone: gardenSettings.timezone || "America/Los_Angeles",
      location_name: gardenSettings.location_name || null,
    };
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      ...toSave,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setGardenSaving(false);
    if (!error) {
      setLastSavedSettings((prev) => ({ ...prev, ...toSave }));
      setGardenSaved(true);
      setGardenEditing(false);
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
    const [profiles, packets, grows, journal, tasks, shopping, careScheds, settings, supplies] = await Promise.all([
      supabase.from("plant_profiles").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("seed_packets").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("grow_instances").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("journal_entries").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("tasks").select("*").eq("user_id", user.id).is("deleted_at", null),
      supabase.from("shopping_list").select("*").eq("user_id", user.id),
      supabase.from("care_schedules").select("*").eq("user_id", user.id),
      supabase.from("user_settings").select("*").eq("user_id", user.id),
      supabase.from("supply_profiles").select("*").eq("user_id", user.id).is("deleted_at", null),
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
      supply_profiles: supplies.data ?? [],
    };
  }, [user?.id]);

  const handleExportJSON = useCallback(async () => {
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

  const handleExportCSV = useCallback(async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const exportData = await fetchExportData();
      if (!exportData) return;
      const date = new Date().toISOString().slice(0, 10);
      const headers = ["name", "variety", "status", "packet_count", "vendor", "sun", "spacing", "germination", "maturity", "tags", "source_url"];
      const vendorByProfile = new Map<string, string>();
      for (const p of exportData.seed_packets as { plant_profile_id?: string; vendor_name?: string | null }[]) {
        const pid = p.plant_profile_id ?? "";
        const v = (p.vendor_name ?? "").trim();
        if (v) {
          const cur = vendorByProfile.get(pid) ?? "";
          vendorByProfile.set(pid, cur ? `${cur}, ${v}` : v);
        }
      }
      const countByProfile = new Map<string, number>();
      for (const p of exportData.seed_packets as { plant_profile_id?: string }[]) {
        const pid = p.plant_profile_id ?? "";
        countByProfile.set(pid, (countByProfile.get(pid) ?? 0) + 1);
      }
      const rows = (exportData.plant_profiles as { id?: string; name?: string | null; variety_name?: string | null; status?: string | null; sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null; tags?: string[] | null; source_url?: string | null }[]).map((pr) => {
        const count = countByProfile.get(pr.id ?? "") ?? 0;
        const vendor = vendorByProfile.get(pr.id ?? "") ?? "";
        const tags = Array.isArray(pr.tags) ? pr.tags.join("; ") : "";
        return [
          (pr.name ?? "").replace(/"/g, '""'),
          (pr.variety_name ?? "").replace(/"/g, '""'),
          (pr.status ?? "").replace(/"/g, '""'),
          String(count),
          vendor.replace(/"/g, '""'),
          (pr.sun ?? "").replace(/"/g, '""'),
          (pr.plant_spacing ?? "").replace(/"/g, '""'),
          (pr.days_to_germination ?? "").replace(/"/g, '""'),
          pr.harvest_days != null ? String(pr.harvest_days) : "",
          tags.replace(/"/g, '""'),
          (pr.source_url ?? "").replace(/"/g, '""'),
        ];
      });
      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vault-export-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [user?.id, fetchExportData]);

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

  const emailInitial = (user.email ?? "?")[0].toUpperCase();

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto pb-24">
      <Link href="/settings" onClick={(e) => handleNavClick(e, "/settings")} className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-emerald-600 font-medium hover:underline mb-4" aria-label="Back to Settings">
        &larr;
      </Link>

      {/* ── Identity card ─────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ backgroundColor: "#059669" }}>
                {emailInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900 truncate">{user.email}</p>
                <p className="text-xs text-neutral-400 mt-0.5">Signed in</p>
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="shrink-0 min-h-[44px] min-w-[44px] px-4 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors self-start sm:self-auto"
            >
              Sign out
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <Link
              href="/reset-password"
              onClick={(e) => handleNavClick(e, "/reset-password")}
              className="text-xs text-emerald-600 font-medium hover:underline"
            >
              Reset password
            </Link>
          </div>
        </div>
      </section>

      {/* ── My Garden ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">My Garden</h2>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          {!gardenEditing ? (
            /* View mode */
            <div>
              <div className="flex items-start justify-between gap-2 mb-4">
                <h3 className="text-sm font-semibold text-neutral-800">Garden Settings</h3>
                <button
                  type="button"
                  onClick={handleStartEditGarden}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-emerald-600 transition-colors min-h-[32px] px-1"
                  aria-label="Edit garden settings"
                >
                  <PencilIcon />
                  Edit
                </button>
              </div>
              <dl className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-xs text-neutral-500 shrink-0">Planting Zone</dt>
                  <dd className="text-sm font-medium text-neutral-800 text-right">
                    {gardenSettings.planting_zone ? `Zone ${gardenSettings.planting_zone}` : <span className="text-neutral-400 font-normal">Not set</span>}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-xs text-neutral-500 shrink-0">Last Frost</dt>
                  <dd className="text-sm font-medium text-neutral-800 text-right">
                    {gardenSettings.last_frost_date
                      ? <span>{formatFrostDate(gardenSettings.last_frost_date)}</span>
                      : <span className="text-neutral-400 font-normal">Not set</span>}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-xs text-neutral-500 shrink-0">Location</dt>
                  <dd className="text-sm font-medium text-neutral-800 text-right">
                    {gardenSettings.location_name
                      ? gardenSettings.location_name
                      : <span className="text-neutral-400 font-normal">Not set</span>}
                  </dd>
                </div>
                {(gardenSettings.latitude != null || gardenSettings.longitude != null) && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-xs text-neutral-500 shrink-0">Coordinates</dt>
                    <dd className="text-xs text-neutral-500 text-right font-mono">
                      {gardenSettings.latitude}, {gardenSettings.longitude}
                    </dd>
                  </div>
                )}
              </dl>
              {gardenSaved && (
                <p className="text-xs text-emerald-600 mt-3">Saved!</p>
              )}
            </div>
          ) : (
            /* Edit mode */
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-neutral-800">Edit Garden Settings</h3>
              </div>
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
              <div className="flex gap-3">
                <button type="button" onClick={handleUseMyLocation} className="min-h-[44px] flex-1 px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  Use My Location
                </button>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={saveGardenSettings} disabled={gardenSaving} className="flex-1 min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
                  {gardenSaving ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={handleCancelEditGarden} className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Data & Preferences ────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Data & preferences</h2>
        <div className="space-y-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Back up my data</h3>
            <p className="text-sm text-neutral-500 mb-3">Download or copy all your garden data for backups and migrations. Includes seeds, supplies, journal, tasks, and settings.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleExportJSON} disabled={exporting} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 border border-neutral-300 text-neutral-700 hover:bg-neutral-50">
                {exporting ? "…" : "Download JSON"}
              </button>
              <button type="button" onClick={handleExportCSV} disabled={exporting} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
                {exporting ? "…" : "Download CSV"}
              </button>
              <button type="button" onClick={handleCopyExport} disabled={exporting} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                {copySuccess ? "Copied!" : "Copy JSON"}
              </button>
            </div>
          </div>
          <Link href="/vault/tags" onClick={(e) => handleNavClick(e, "/vault/tags")} className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Tag Manager</h3>
            <p className="text-sm text-neutral-500 mb-2">Manage tag colors, blocked tags, and AI tagging behavior.</p>
            <span className="text-sm text-emerald-600 font-medium">Manage tags &rarr;</span>
          </Link>
        </div>
      </section>

      {/* ── Delete Account (danger zone) ──────────────────────────────── */}
      <section className="mb-8">
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
