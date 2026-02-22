"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useDeveloperUnlock } from "@/contexts/DeveloperUnlockContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import type { HouseholdEditGrant, UserSettings } from "@/types/garden";
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

/** Derive a 3-char shorthand from email (local part, alphanumeric only, uppercase). */
function shorthandFromEmail(email: string | null | undefined): string {
  if (!email?.trim()) return "???";
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned.slice(0, 3) || "???";
}

/** Pick a unique shorthand: start from email-derived, add suffix if taken. */
function pickUniqueShorthand(
  email: string | null | undefined,
  taken: Set<string>
): string {
  let base = shorthandFromEmail(email);
  if (base === "???") base = "USR";
  let candidate = base;
  let n = 1;
  while (taken.has(candidate) && n < 100) {
    candidate = base.slice(0, 2) + String(n);
    n++;
  }
  return candidate.slice(0, 4);
}

export default function SettingsProfilePage() {
  const { user, signOut } = useAuth();
  const { tapVersion } = useDeveloperUnlock();
  const { household, householdMembers, householdLoading, isInHousehold, reloadHousehold, editGrants, memberShorthands } = useHousehold();
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
  const [backfillingPlantingWindows, setBackfillingPlantingWindows] = useState(false);
  const [backfillToast, setBackfillToast] = useState<string | null>(null);
  const [showAdvancedCoords, setShowAdvancedCoords] = useState(false);
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const pendingNavigateRef = useRef<string | null>(null);

  // Household UI state (data comes from HouseholdContext)
  const [householdExpanded, setHouseholdExpanded] = useState(false);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [householdSuccess, setHouseholdSuccess] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joiningHousehold, setJoiningHousehold] = useState(false);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [householdRenameVal, setHouseholdRenameVal] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [disbandConfirm, setDisbandConfirm] = useState(false);
  const [disbanding, setDisbanding] = useState(false);
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const hasAutoExpanded = useRef(false);
  const [shorthandError, setShorthandError] = useState<string | null>(null);
  const [togglingGrantForUser, setTogglingGrantForUser] = useState<string | null>(null);

  // Auto-expand household section once loaded if in a household
  useEffect(() => {
    if (!householdLoading && isInHousehold && !hasAutoExpanded.current) {
      setHouseholdExpanded(true);
      hasAutoExpanded.current = true;
    }
  }, [householdLoading, isInHousehold]);

  // Fetch member emails via secure RPC whenever household changes
  useEffect(() => {
    if (!household || householdLoading) {
      setMemberEmails({});
      return;
    }
    supabase
      .rpc("get_household_member_emails", { p_household_id: household.id })
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          for (const row of data as { user_id: string; email: string }[]) {
            map[row.user_id] = row.email;
          }
          setMemberEmails(map);
        }
      });
  }, [household?.id, householdLoading]);

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

  // ── Household handlers ────────────────────────────────────────────────────

  const handleCreateHousehold = useCallback(async () => {
    if (!user?.id || !householdName.trim()) return;
    if (isInHousehold) {
      setHouseholdError("Family Already Exists — you're already in a family. Leave it first to create a new one.");
      return;
    }
    setCreatingHousehold(true);
    setHouseholdError(null);
    setHouseholdSuccess(null);
    const { error } = await supabase.rpc("create_household_with_owner", { p_name: householdName.trim() });
    setCreatingHousehold(false);
    if (error) {
      setHouseholdError(error.message ?? "Failed to create family.");
      return;
    }
    // Auto-assign shorthand from email if user doesn't have one
    const { data: existing } = await supabase.from("user_settings").select("display_shorthand").eq("user_id", user.id).maybeSingle();
    if (!existing?.display_shorthand?.trim()) {
      const shorthand = pickUniqueShorthand(user.email, new Set());
      await supabase.from("user_settings").upsert({
        user_id: user.id,
        display_shorthand: shorthand,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      setGardenSettings((prev) => ({ ...prev, display_shorthand: shorthand }));
      setLastSavedSettings((prev) => (prev ? { ...prev, display_shorthand: shorthand } : null));
    }
    setHouseholdName("");
    setHouseholdSuccess("Family created! Share the invite code below with family members.");
    setHouseholdExpanded(true);
    await reloadHousehold();
  }, [user?.id, user?.email, householdName, isInHousehold, reloadHousehold]);

  const handleJoinHousehold = useCallback(async () => {
    if (!user?.id || !joinCode.trim()) return;
    if (isInHousehold) {
      setHouseholdError("You're already in a family. Leave it first before joining another.");
      return;
    }
    setJoiningHousehold(true);
    setHouseholdError(null);
    setHouseholdSuccess(null);
    const { data: householdId } = await supabase.rpc("get_household_id_by_invite_code", { code: joinCode.trim() });
    if (!householdId) {
      setHouseholdError("Invalid invite code — double-check and try again.");
      setJoiningHousehold(false);
      return;
    }
    const { error } = await supabase.from("household_members").insert({ household_id: householdId, user_id: user.id, role: "member" });
    if (error) {
      setHouseholdError(error.message ?? "Failed to join family.");
      setJoiningHousehold(false);
      return;
    }
    // Auto-assign shorthand from email if user doesn't have one
    const { data: existing } = await supabase.from("user_settings").select("display_shorthand").eq("user_id", user.id).maybeSingle();
    if (!existing?.display_shorthand?.trim()) {
      const { data: members } = await supabase.from("household_members").select("user_id").eq("household_id", householdId);
      const memberIds = (members ?? []).map((r: { user_id: string }) => r.user_id);
      const { data: settings } = memberIds.length > 0
        ? await supabase.from("user_settings").select("user_id, display_shorthand").in("user_id", memberIds)
        : { data: [] };
      const taken = new Set<string>();
      for (const row of settings ?? []) {
        const sh = (row as { display_shorthand?: string }).display_shorthand?.trim().toUpperCase();
        if (sh) taken.add(sh);
      }
      const shorthand = pickUniqueShorthand(user.email, taken);
      await supabase.from("user_settings").upsert({
        user_id: user.id,
        display_shorthand: shorthand,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      setGardenSettings((prev) => ({ ...prev, display_shorthand: shorthand }));
      setLastSavedSettings((prev) => (prev ? { ...prev, display_shorthand: shorthand } : null));
    }
    setJoiningHousehold(false);
    setJoinCode("");
    setHouseholdSuccess("You joined the family! You can now switch to Family view in the header.");
    setHouseholdExpanded(true);
    await reloadHousehold();
  }, [user?.id, user?.email, joinCode, isInHousehold, reloadHousehold]);

  const handleLeaveHousehold = useCallback(async () => {
    if (!user?.id || !household) return;
    await supabase.from("household_members").delete().eq("household_id", household.id).eq("user_id", user.id);
    await reloadHousehold();
  }, [user?.id, household, reloadHousehold]);

  const handleKickMember = useCallback(async (memberId: string) => {
    if (!household) return;
    setKickingMemberId(memberId);
    await supabase.from("household_members").delete().eq("household_id", household.id).eq("user_id", memberId);
    setKickingMemberId(null);
    await reloadHousehold();
  }, [household, reloadHousehold]);

  const handleRenameHousehold = useCallback(async () => {
    if (!household || !householdRenameVal.trim()) return;
    setRenaming(true);
    const { error } = await supabase
      .from("households")
      .update({ name: householdRenameVal.trim(), updated_at: new Date().toISOString() })
      .eq("id", household.id);
    setRenaming(false);
    if (error) {
      setHouseholdError(error.message);
      return;
    }
    setShowRenameInput(false);
    setHouseholdRenameVal("");
    await reloadHousehold();
  }, [household, householdRenameVal, reloadHousehold]);

  const handleDisbandHousehold = useCallback(async () => {
    if (!household) return;
    setDisbanding(true);
    await supabase.from("households").delete().eq("id", household.id);
    setDisbanding(false);
    setDisbandConfirm(false);
    await reloadHousehold();
  }, [household, reloadHousehold]);

  // ── Garden settings handlers ──────────────────────────────────────────────

  const handleStartEditGarden = useCallback(() => {
    gardenEditSnapshot.current = { ...gardenSettings };
    setGardenEditing(true);
  }, [gardenSettings]);

  const handleCancelEditGarden = useCallback(() => {
    if (gardenEditSnapshot.current) setGardenSettings(gardenEditSnapshot.current);
    setGardenEditing(false);
  }, []);

  const saveShorthand = useCallback(async () => {
    if (!user?.id) return;
    setShorthandError(null);
    const newShorthand = gardenSettings.display_shorthand?.trim().toUpperCase() || null;
    if (newShorthand) {
      for (const [uid, sh] of memberShorthands.entries()) {
        if (uid !== user.id && sh.toUpperCase() === newShorthand) {
          setShorthandError(`"${newShorthand}" is already used by another family member. Choose a different shorthand.`);
          return;
        }
      }
    }
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      display_shorthand: newShorthand,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (!error) {
      setLastSavedSettings((prev) => prev ? { ...prev, display_shorthand: newShorthand } : null);
      await reloadHousehold();
    }
  }, [user?.id, gardenSettings.display_shorthand, memberShorthands, reloadHousehold]);

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
  }, [user?.id, gardenSettings, memberShorthands]);

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

  const handleToggleGrant = useCallback(async (granteeUserId: string, currentlyGranted: boolean) => {
    if (!user?.id || !household) return;
    setTogglingGrantForUser(granteeUserId);
    if (currentlyGranted) {
      await supabase
        .from("household_edit_grants")
        .delete()
        .eq("grantor_user_id", user.id)
        .eq("grantee_user_id", granteeUserId);
    } else {
      await supabase.from("household_edit_grants").insert({
        household_id: household.id,
        grantor_user_id: user.id,
        grantee_user_id: granteeUserId,
      });
    }
    setTogglingGrantForUser(null);
    await reloadHousehold();
  }, [user?.id, household, reloadHousehold]);

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

  const isOwner = household?.owner_id === user.id;
  const emailInitial = (user.email ?? "?")[0].toUpperCase();

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto pb-24">
      <Link href="/settings" onClick={(e) => handleNavClick(e, "/settings")} className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-emerald-600 font-medium hover:underline mb-4" aria-label="Back to Settings">
        &larr;
      </Link>

      {/* ── Identity card ─────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ backgroundColor: "#059669" }}>
                {emailInitial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900 truncate">{user.email}</p>
                <p className="text-xs text-neutral-400 mt-0.5">Signed in</p>
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="shrink-0 min-h-[36px] px-3 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
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
                {exporting ? "..." : "Download JSON"}
              </button>
              <button type="button" onClick={handleExportCSV} disabled={exporting} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
                {exporting ? "..." : "Download CSV"}
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
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">Fill planting windows</h3>
            <p className="text-sm text-neutral-500 mb-3">For profiles with no planting window, set from {gardenSettings.planting_zone ? `Zone ${gardenSettings.planting_zone}` : "your zone"} defaults by plant name.</p>
            <button type="button" onClick={handleFillPlantingWindows} disabled={backfillingPlantingWindows} className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
              {backfillingPlantingWindows ? "..." : `Fill from Zone ${gardenSettings.planting_zone ?? "10b"}`}
            </button>
            {backfillToast && <p className="text-sm text-emerald-600 mt-2">{backfillToast}</p>}
          </div>
        </div>
      </section>

      {/* ── Manage Family ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <button type="button" onClick={() => setHouseholdExpanded((e) => !e)} className="w-full flex items-center justify-between min-h-[44px] py-2 text-left" aria-expanded={householdExpanded}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Manage family</h2>
          <span className="text-neutral-400 text-lg leading-none" aria-hidden>{householdExpanded ? "−" : "+"}</span>
        </button>
        {householdExpanded && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm mt-2">
            <h3 className="text-base font-semibold text-neutral-800 mb-1">My Family</h3>
            <p className="text-sm text-neutral-500 mb-3">Share your garden with family members. Use the Personal / Family toggle in the header to switch views.</p>
            {household && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 mb-4">
                <p className="text-xs font-medium text-amber-800 mb-0.5">Conflict handling</p>
                <p className="text-xs text-amber-700">When multiple people edit the same item (e.g. a plant profile), the most recent save wins. No merge or conflict resolution is applied. Avoid editing the same item at the same time to prevent overwriting each other&apos;s changes.</p>
              </div>
            )}

            {/* Your badge — edit your own shorthand (1–4 letters shown to family) */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 mb-4">
              <label htmlFor="family-badge" className="block text-xs font-medium text-neutral-600 mb-1.5">
                Your badge <span className="font-normal text-neutral-400">(1–4 letters, shown next to your plants in Family view)</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id="family-badge"
                  type="text"
                  maxLength={4}
                  placeholder="e.g. MAR"
                  value={gardenSettings.display_shorthand ?? ""}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                    setGardenSettings((p) => ({ ...p, display_shorthand: val || null }));
                    setShorthandError(null);
                  }}
                  className="w-20 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm font-mono uppercase focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={saveShorthand}
                  className="min-h-[36px] px-3 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Save
                </button>
                {gardenSettings.display_shorthand && (
                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-emerald-100 text-emerald-800">
                    {gardenSettings.display_shorthand.toUpperCase()}
                  </span>
                )}
              </div>
              {shorthandError && <p className="text-xs text-red-600 mt-1.5">{shorthandError}</p>}
            </div>

            {householdSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 mb-3">
                <p className="text-sm text-emerald-700">{householdSuccess}</p>
              </div>
            )}

            {householdLoading ? (
              <p className="text-sm text-neutral-400">Loading...</p>
            ) : household ? (
              <div className="space-y-4">
                {/* Name + rename (owner only) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {showRenameInput && isOwner ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={householdRenameVal}
                          onChange={(e) => setHouseholdRenameVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRenameHousehold(); if (e.key === "Escape") { setShowRenameInput(false); setHouseholdRenameVal(""); } }}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-sm"
                          autoFocus
                        />
                        <button type="button" onClick={handleRenameHousehold} disabled={renaming || !householdRenameVal.trim()} className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
                          {renaming ? "..." : "Save"}
                        </button>
                        <button type="button" onClick={() => { setShowRenameInput(false); setHouseholdRenameVal(""); }} className="px-3 py-1.5 rounded-lg text-sm border border-neutral-300 text-neutral-600 hover:bg-neutral-50">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-800">{household.name}</p>
                        {isOwner && (
                          <button type="button" onClick={() => { setShowRenameInput(true); setHouseholdRenameVal(household.name); }} className="text-neutral-400 hover:text-emerald-600 text-xs min-h-[32px] px-1" aria-label="Rename family">
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-neutral-500 mt-0.5">{householdMembers.length} member{householdMembers.length !== 1 ? "s" : ""}</p>
                  </div>
                  {!isOwner && (
                    <button type="button" onClick={handleLeaveHousehold} className="shrink-0 text-xs text-red-600 font-medium hover:underline min-h-[44px] flex items-center">
                      Leave
                    </button>
                  )}
                </div>

                {/* Invite code */}
                {household.invite_code && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                    <p className="text-xs font-semibold text-emerald-800 mb-1.5">Invite Code</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-emerald-700 bg-white px-2 py-1.5 rounded border border-emerald-200 flex-1 text-center tracking-widest select-all">
                        {household.invite_code}
                      </code>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(household.invite_code ?? "");
                          setInviteCopied(true);
                          setTimeout(() => setInviteCopied(false), 2000);
                        }}
                        className="shrink-0 min-h-[44px] px-3 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                      >
                        {inviteCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-xs text-emerald-600 mt-1.5">Share this code with family so they can join from their Profile settings.</p>
                  </div>
                )}

                {/* Members list */}
                <div>
                  <p className="text-xs font-semibold text-neutral-500 mb-2">Members</p>
                  <ul className="space-y-3">
                    {householdMembers.map((m) => {
                      const email = memberEmails[m.user_id] ?? null;
                      const isYou = m.user_id === user.id;
                      const displayName = isYou
                        ? `You${email ? ` (${email})` : ""}`
                        : (email ?? m.user_id.slice(0, 8) + "…");
                      const memberShorthand = memberShorthands.get(m.user_id);
                      // Grant this member can edit MY data (I am the grantor)
                      const grantedToThisMember = editGrants.some(
                        (g: HouseholdEditGrant) => g.grantor_user_id === user.id && g.grantee_user_id === m.user_id,
                      );
                      return (
                        <li key={m.id} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {memberShorthand && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-emerald-100 text-emerald-800 shrink-0">
                                  {memberShorthand.toUpperCase()}
                                </span>
                              )}
                              <span className="text-neutral-700 truncate text-xs">{displayName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${m.role === "owner" ? "bg-amber-50 text-amber-700" : m.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}>
                                {m.role}
                              </span>
                              {isOwner && !isYou && (
                                <button
                                  type="button"
                                  onClick={() => handleKickMember(m.user_id)}
                                  disabled={kickingMemberId === m.user_id}
                                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 min-h-[32px] px-1"
                                  aria-label={`Remove ${displayName}`}
                                >
                                  {kickingMemberId === m.user_id ? "..." : "Remove"}
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Edit grant toggle — only shown for other members; I control who can edit MY stuff */}
                          {!isYou && (
                            <div className="flex items-center justify-between gap-2 pl-1 py-1 rounded-lg bg-neutral-50 px-2">
                              <span className="text-xs text-neutral-500">Can edit my plants &amp; tasks</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={grantedToThisMember}
                                disabled={togglingGrantForUser === m.user_id}
                                onClick={() => handleToggleGrant(m.user_id, grantedToThisMember)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:opacity-50 ${grantedToThisMember ? "bg-emerald-500" : "bg-neutral-300"}`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${grantedToThisMember ? "translate-x-4" : "translate-x-0"}`}
                                />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Disband (owner only) */}
                {isOwner && (
                  <div className="pt-3 border-t border-neutral-100">
                    {!disbandConfirm ? (
                      <button type="button" onClick={() => setDisbandConfirm(true)} className="text-xs text-red-500 hover:text-red-700 font-medium min-h-[44px] flex items-center">
                        Disband family
                      </button>
                    ) : (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
                        <p className="text-xs text-red-700 font-medium">This removes all members. Your individual garden data is kept. Sure?</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={handleDisbandHousehold} disabled={disbanding} className="min-h-[36px] px-3 rounded-lg text-xs font-medium bg-red-600 text-white disabled:opacity-50 hover:bg-red-700">
                            {disbanding ? "Disbanding..." : "Yes, disband"}
                          </button>
                          <button type="button" onClick={() => setDisbandConfirm(false)} className="min-h-[36px] px-3 rounded-lg text-xs font-medium border border-neutral-300 text-neutral-600 hover:bg-neutral-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-neutral-600 mb-1">Create a family</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateHousehold(); }}
                      placeholder="e.g. The Smith Garden"
                      className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 text-sm"
                    />
                    <button type="button" onClick={handleCreateHousehold} disabled={creatingHousehold || !householdName.trim()} className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
                      {creatingHousehold ? "..." : "Create"}
                    </button>
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
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleJoinHousehold(); }}
                      placeholder="Enter invite code"
                      className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 text-sm font-mono"
                    />
                    <button type="button" onClick={handleJoinHousehold} disabled={joiningHousehold || !joinCode.trim()} className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0 hover:opacity-90" style={{ backgroundColor: "#059669", color: "#ffffff" }}>
                      {joiningHousehold ? "..." : "Join"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {householdError && (
              <p className="text-sm text-red-600 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {householdError}
              </p>
            )}
          </div>
        )}
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
