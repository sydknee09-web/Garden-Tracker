"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import type {
  HouseholdEditGrant,
  HouseholdPagePermission,
  PageAccessLevel,
  PageKey,
  UserSettings,
} from "@/types/garden";
import { PAGE_LABELS } from "@/types/garden";

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

const PAGE_KEYS: PageKey[] = ["seed_vault", "plant_vault", "garden", "journal", "shed", "shopping_list"];

export default function SettingsFamilyPage() {
  const { user } = useAuth();
  const {
    household,
    householdMembers,
    householdLoading,
    isInHousehold,
    reloadHousehold,
    editGrants,
    pagePermissions,
    memberShorthands,
  } = useHousehold();

  const [displayShorthand, setDisplayShorthand] = useState<string | null>(null);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [householdSuccess, setHouseholdSuccess] = useState<string | null>(null);
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [joinCode, setJoinCode] = useState("");
  const [joiningHousehold, setJoiningHousehold] = useState(false);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [householdRenameVal, setHouseholdRenameVal] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [disbandConfirm, setDisbandConfirm] = useState(false);
  const [disbanding, setDisbanding] = useState(false);
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [shorthandError, setShorthandError] = useState<string | null>(null);
  const [togglingGrantForUser, setTogglingGrantForUser] = useState<string | null>(null);
  const [expandedPageAccessFor, setExpandedPageAccessFor] = useState<string | null>(null);
  const [togglingPagePerm, setTogglingPagePerm] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_settings")
      .select("display_shorthand")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDisplayShorthand((data as UserSettings).display_shorthand ?? null);
      });
  }, [user?.id]);

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
    const { data: existing } = await supabase.from("user_settings").select("display_shorthand").eq("user_id", user.id).maybeSingle();
    if (!existing?.display_shorthand?.trim()) {
      const shorthand = pickUniqueShorthand(user.email, new Set());
      await supabase.from("user_settings").upsert({
        user_id: user.id,
        display_shorthand: shorthand,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      setDisplayShorthand(shorthand);
    }
    setHouseholdName("");
    setHouseholdSuccess("Family created! Share the invite code below with family members.");
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
      setDisplayShorthand(shorthand);
    }
    setJoiningHousehold(false);
    setJoinCode("");
    setHouseholdSuccess("You joined the family! You can now switch to Family view in the header.");
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

  const handleSetPagePermission = useCallback(
    async (granteeUserId: string, page: PageKey, level: PageAccessLevel | null) => {
      if (!user?.id || !household) return;
      const key = `${granteeUserId}:${page}`;
      setTogglingPagePerm(key);
      const existing = pagePermissions.find(
        (p: HouseholdPagePermission) =>
          p.grantor_user_id === user.id && p.grantee_user_id === granteeUserId && p.page === page,
      );
      if (level === null) {
        if (existing) {
          await supabase.from("household_page_permissions").delete().eq("id", existing.id);
        }
      } else {
        if (existing) {
          await supabase
            .from("household_page_permissions")
            .update({ access_level: level })
            .eq("id", existing.id);
        } else {
          await supabase.from("household_page_permissions").insert({
            household_id: household.id,
            grantor_user_id: user.id,
            grantee_user_id: granteeUserId,
            page,
            access_level: level,
          });
        }
      }
      setTogglingPagePerm(null);
      await reloadHousehold();
    },
    [user?.id, household, pagePermissions, reloadHousehold],
  );

  const saveShorthand = useCallback(async () => {
    if (!user?.id) return;
    setShorthandError(null);
    const newShorthand = displayShorthand?.trim().toUpperCase() || null;
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
    if (!error) await reloadHousehold();
  }, [user?.id, displayShorthand, memberShorthands, reloadHousehold]);

  if (!user) return null;

  const isOwner = household?.owner_id === user.id;

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto pb-24">
      <Link href="/settings" className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-emerald-600 font-medium hover:underline mb-4" aria-label="Back to Settings">
        &larr;
      </Link>

      <h1 className="text-xl font-bold text-neutral-900 mb-1">Family</h1>
      <p className="text-sm text-neutral-500 mb-6">Manage family members, approval, and view/edit access to pages.</p>

      {/* Your badge */}
      <section className="mb-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-800 mb-3">Your badge</h2>
          <p className="text-sm text-neutral-500 mb-3">1–4 letters shown next to your plants in Family view.</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              maxLength={4}
              placeholder="e.g. MAR"
              value={displayShorthand ?? ""}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                setDisplayShorthand(val || null);
                setShorthandError(null);
              }}
              className="w-20 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm font-mono uppercase focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={saveShorthand}
              className="min-h-[44px] px-3 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Save
            </button>
            {displayShorthand && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-emerald-100 text-emerald-800">
                {displayShorthand.toUpperCase()}
              </span>
            )}
          </div>
          {shorthandError && <p className="text-xs text-red-600 mt-1.5">{shorthandError}</p>}
        </div>
      </section>

      {/* Family management */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-neutral-800 mb-3">My Family</h2>
        <p className="text-sm text-neutral-500 mb-4">Share your garden with family members. Use the Personal / Family toggle in the header to switch views.</p>

        {household && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 mb-4">
            <p className="text-xs font-medium text-amber-800 mb-0.5">Conflict handling</p>
            <p className="text-xs text-amber-700">When multiple people edit the same item, the most recent save wins. Avoid editing the same item at the same time.</p>
          </div>
        )}

        {householdSuccess && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 mb-3">
            <p className="text-sm text-emerald-700">{householdSuccess}</p>
          </div>
        )}

        {householdLoading ? (
          <p className="text-sm text-neutral-400">Loading...</p>
        ) : household ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
            {/* Name + rename */}
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
                <p className="text-xs text-emerald-600 mt-1.5">Share this code with family so they can join from Family settings.</p>
              </div>
            )}

            {/* Members list with approval/view/edit */}
            <div>
              <p className="text-xs font-semibold text-neutral-500 mb-2">Members & access</p>
              <ul className="space-y-3">
                {householdMembers.map((m) => {
                  const email = memberEmails[m.user_id] ?? null;
                  const isYou = m.user_id === user.id;
                  const displayName = isYou
                    ? `You${email ? ` (${email})` : ""}`
                    : (email ?? m.user_id.slice(0, 8) + "…");
                  const memberShorthand = memberShorthands.get(m.user_id);
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
                      {!isYou && (
                        <>
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
                          {isOwner && (
                            <div className="mt-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedPageAccessFor((prev) => (prev === m.user_id ? null : m.user_id))
                                }
                                className="text-xs text-neutral-500 hover:text-emerald-600 min-h-[32px] flex items-center gap-1"
                              >
                                {expandedPageAccessFor === m.user_id ? "−" : "+"} Page access (view/edit)
                              </button>
                              {expandedPageAccessFor === m.user_id && (
                                <div className="mt-2 pl-2 border-l-2 border-neutral-200 space-y-2">
                                  {grantedToThisMember && (
                                    <p className="text-[11px] text-amber-700">
                                      Full edit above. Per-page overrides when you revoke full edit.
                                    </p>
                                  )}
                                  {PAGE_KEYS.map((page) => {
                                    const perm = pagePermissions.find(
                                      (p) =>
                                        p.grantor_user_id === user.id &&
                                        p.grantee_user_id === m.user_id &&
                                        p.page === page,
                                    );
                                    const currentLevel = perm?.access_level ?? null;
                                    const key = `${m.user_id}:${page}`;
                                    const busy = togglingPagePerm === key;
                                    return (
                                      <div key={page} className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-neutral-600">{PAGE_LABELS[page]}</span>
                                        <select
                                          value={currentLevel ?? "none"}
                                          disabled={busy}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            handleSetPagePermission(
                                              m.user_id,
                                              page,
                                              v === "none" ? null : (v as PageAccessLevel),
                                            );
                                          }}
                                          className="text-xs rounded border border-neutral-300 px-2 py-1 min-h-[32px] bg-white disabled:opacity-50"
                                        >
                                          <option value="none">—</option>
                                          <option value="view">View</option>
                                          <option value="edit">Edit</option>
                                        </select>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

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
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
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
      </section>
    </div>
  );
}
