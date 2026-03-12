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
import { LoadingState } from "@/components/LoadingState";

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

type AccessTier = "view_only" | "full" | "custom";

type PendingAccess = { tier: AccessTier; pages?: Partial<Record<PageKey, PageAccessLevel>> };

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
  const [kebabOpenForUser, setKebabOpenForUser] = useState<string | null>(null);
  const [pendingAccess, setPendingAccess] = useState<Record<string, PendingAccess>>({});
  const [savingAccess, setSavingAccess] = useState(false);

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

  const setPendingTier = useCallback(
    (granteeUserId: string, tier: AccessTier) => {
      setKebabOpenForUser(null);
      setPendingAccess((prev) => {
        const next = { ...prev };
        if (tier === "custom") {
          const current = prev[granteeUserId];
          const granted = editGrants.some(
            (g: HouseholdEditGrant) => g.grantor_user_id === user?.id && g.grantee_user_id === granteeUserId,
          );
          const currentPages: Partial<Record<PageKey, PageAccessLevel>> = { ...current?.pages };
          for (const page of PAGE_KEYS) {
            if (currentPages[page] == null) {
              if (granted) {
                currentPages[page] = "edit";
              } else {
                const perm = pagePermissions.find(
                  (p) =>
                    p.grantor_user_id === user?.id &&
                    p.grantee_user_id === granteeUserId &&
                    p.page === page,
                );
                currentPages[page] = (perm?.access_level ?? "block") as PageAccessLevel;
              }
            }
          }
          next[granteeUserId] = { tier, pages: currentPages };
        } else {
          next[granteeUserId] = { tier };
        }
        return next;
      });
    },
    [editGrants, pagePermissions, user?.id],
  );

  const setPendingPage = useCallback((granteeUserId: string, page: PageKey, level: PageAccessLevel) => {
    setPendingAccess((prev) => {
      const current = prev[granteeUserId];
      const pages = { ...(current?.pages ?? {}), [page]: level };
      return { ...prev, [granteeUserId]: { tier: "custom", pages } };
    });
  }, []);

  const handleSaveAccess = useCallback(async () => {
    if (!user?.id || !household) return;
    const memberIds = Object.keys(pendingAccess);
    if (memberIds.length === 0) return;
    setSavingAccess(true);
    for (const granteeUserId of memberIds) {
      const pending = pendingAccess[granteeUserId];
      if (!pending) continue;
      const hasEditGrant = editGrants.some(
        (g: HouseholdEditGrant) => g.grantor_user_id === user.id && g.grantee_user_id === granteeUserId,
      );
      if (pending.tier === "full") {
        if (!hasEditGrant) {
          await supabase.from("household_edit_grants").insert({
            household_id: household.id,
            grantor_user_id: user.id,
            grantee_user_id: granteeUserId,
          });
        }
      } else {
        if (hasEditGrant) {
          await supabase
            .from("household_edit_grants")
            .delete()
            .eq("grantor_user_id", user.id)
            .eq("grantee_user_id", granteeUserId);
        }
        if (pending.tier === "view_only") {
          for (const page of PAGE_KEYS) {
            const existing = pagePermissions.find(
              (p: HouseholdPagePermission) =>
                p.grantor_user_id === user.id && p.grantee_user_id === granteeUserId && p.page === page,
            );
            if (existing) {
              await supabase
                .from("household_page_permissions")
                .update({ access_level: "view" })
                .eq("id", existing.id);
            } else {
              await supabase.from("household_page_permissions").insert({
                household_id: household.id,
                grantor_user_id: user.id,
                grantee_user_id: granteeUserId,
                page,
                access_level: "view",
              });
            }
          }
        } else if (pending.tier === "custom" && pending.pages) {
          for (const page of PAGE_KEYS) {
            const level = pending.pages[page] ?? "block";
            const existing = pagePermissions.find(
              (p: HouseholdPagePermission) =>
                p.grantor_user_id === user.id && p.grantee_user_id === granteeUserId && p.page === page,
            );
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
        }
      }
    }
    setPendingAccess({});
    setSavingAccess(false);
    await reloadHousehold();
  }, [user?.id, household, pendingAccess, editGrants, pagePermissions, reloadHousehold]);

  const handleCancelAccess = useCallback(() => {
    setPendingAccess({});
  }, []);

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
          <LoadingState message="Loading…" className="py-4" />
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
                    <button type="button" onClick={handleRenameHousehold} disabled={renaming || !householdRenameVal.trim()} className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 bg-emerald-600 text-white">
                      {renaming ? "…" : "Save"}
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
                <button type="button" onClick={handleLeaveHousehold} className="shrink-0 text-xs text-neutral-600 font-medium hover:underline min-h-[44px] flex items-center">
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

            {/* Members & access — card layout, three-tier access, icon toggles */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-xs font-semibold text-neutral-500">Members & access</p>
                {Object.keys(pendingAccess).length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancelAccess}
                      disabled={savingAccess}
                      className="text-xs font-medium text-neutral-600 hover:text-neutral-800 disabled:opacity-50 min-h-[36px] px-2 rounded-lg border border-neutral-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAccess}
                      disabled={savingAccess}
                      className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 min-h-[36px] px-3 rounded-lg"
                    >
                      {savingAccess ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>
              <ul className="space-y-4">
                {householdMembers.map((m) => {
                  const email = memberEmails[m.user_id] ?? null;
                  const isYou = m.user_id === user.id;
                  const displayName = isYou
                    ? `You${email ? ` (${email})` : ""}`
                    : (email ?? m.user_id.slice(0, 8) + "…");
                  const memberShorthand = memberShorthands.get(m.user_id);
                  const pending = pendingAccess[m.user_id];
                  const grantedToThisMember = editGrants.some(
                    (g: HouseholdEditGrant) => g.grantor_user_id === user.id && g.grantee_user_id === m.user_id,
                  );
                  const hasAllView = PAGE_KEYS.every((page) => {
                    const perm = pagePermissions.find(
                      (p) =>
                        p.grantor_user_id === user.id && p.grantee_user_id === m.user_id && p.page === page,
                    );
                    return perm?.access_level === "view";
                  });
                  const hasAnyCustom = PAGE_KEYS.some((page) => {
                    const perm = pagePermissions.find(
                      (p) =>
                        p.grantor_user_id === user.id && p.grantee_user_id === m.user_id && p.page === page,
                    );
                    return perm && perm.access_level !== "view";
                  });
                  const accessTier: AccessTier = pending?.tier ??
                    (grantedToThisMember ? "full" : hasAllView && !hasAnyCustom ? "view_only" : "custom");
                  const kebabOpen = kebabOpenForUser === m.user_id;

                  return (
                    <li key={m.id}>
                      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {memberShorthand && (
                                <span
                                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none shrink-0 ${m.role === "owner" ? "bg-emerald-100 text-emerald-800" : "bg-blue-50 text-blue-700"}`}
                                >
                                  {memberShorthand.toUpperCase()}
                                </span>
                              )}
                              <span className="text-sm font-medium text-neutral-800 truncate">{displayName}</span>
                              <span
                                className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${m.role === "owner" ? "bg-emerald-50 text-emerald-700" : m.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}
                              >
                                {m.role}
                              </span>
                            </div>
                            {email && !isYou && (
                              <p className="text-xs text-neutral-400 mt-0.5 truncate">{email}</p>
                            )}
                          </div>
                          {isOwner && !isYou && (
                            <div className="relative shrink-0">
                              <button
                                type="button"
                                onClick={() => setKebabOpenForUser(kebabOpen ? null : m.user_id)}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                                aria-label="Member options"
                                aria-expanded={kebabOpen}
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                              {kebabOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    aria-hidden
                                    onClick={() => setKebabOpenForUser(null)}
                                  />
                                  <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg min-w-[120px]">
                                    <button
                                      type="button"
                                      onClick={() => handleKickMember(m.user_id)}
                                      disabled={kickingMemberId === m.user_id}
                                      className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 min-h-[44px] flex items-center"
                                    >
                                      {kickingMemberId === m.user_id ? "Removing…" : "Remove from family"}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {!isYou && (
                          <div className="mt-4 space-y-3">
                            <div>
                              <p className="text-[11px] text-neutral-400 mb-2">Access level</p>
                              <div className="flex gap-1 p-0.5 rounded-lg bg-neutral-100">
                                <button
                                  type="button"
                                  onClick={() => setPendingTier(m.user_id, "view_only")}
                                  disabled={savingAccess}
                                  className={`flex-1 min-h-[36px] rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${accessTier === "view_only" ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-600 hover:text-neutral-800"}`}
                                >
                                  View only
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingTier(m.user_id, "full")}
                                  disabled={savingAccess}
                                  className={`flex-1 min-h-[36px] rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${accessTier === "full" ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-600 hover:text-neutral-800"}`}
                                >
                                  Edit access
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingTier(m.user_id, "custom")}
                                  disabled={savingAccess}
                                  className={`flex-1 min-h-[36px] rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${accessTier === "custom" ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-600 hover:text-neutral-800"}`}
                                >
                                  Custom
                                </button>
                              </div>
                            </div>

                            <div
                              className={`pt-2 border-t border-neutral-100 ${accessTier !== "custom" ? "opacity-60 pointer-events-none" : ""}`}
                            >
                              <p className="text-[11px] text-neutral-400 mb-2">Per-page access</p>
                              <div className="space-y-2">
                                {PAGE_KEYS.map((page) => {
                                  const perm = pagePermissions.find(
                                    (p) =>
                                      p.grantor_user_id === user.id &&
                                      p.grantee_user_id === m.user_id &&
                                      p.page === page,
                                  );
                                  const effectiveLevel: PageAccessLevel =
                                    accessTier === "view_only"
                                      ? "view"
                                      : accessTier === "full"
                                        ? "edit"
                                        : (pending?.pages?.[page] ?? perm?.access_level ?? "block") as PageAccessLevel;
                                  const isDisabled = accessTier !== "custom" || savingAccess;
                                  return (
                                    <div
                                      key={page}
                                      className="flex items-center justify-between gap-2 py-1"
                                    >
                                      <span className="text-xs text-neutral-600">{PAGE_LABELS[page]}</span>
                                      <div className="flex rounded-lg bg-neutral-100 p-0.5">
                                        {(["block", "view", "edit"] as const).map((level) => {
                                          const isActive = effectiveLevel === level;
                                          return (
                                            <button
                                              key={level}
                                              type="button"
                                              onClick={() =>
                                                !isDisabled && setPendingPage(m.user_id, page, level)
                                              }
                                              disabled={isDisabled}
                                              className={`min-h-[32px] min-w-[36px] flex items-center justify-center rounded-md transition-colors disabled:opacity-50 ${isActive ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
                                                title={
                                                  level === "block"
                                                    ? "No access"
                                                    : level === "view"
                                                      ? "View only"
                                                      : "Edit"
                                                }
                                                aria-label={
                                                  level === "block"
                                                    ? "No access"
                                                    : level === "view"
                                                      ? "View only"
                                                      : "Edit"
                                                }
                                              >
                                                {level === "block" ? (
                                                  <svg
                                                    className="w-4 h-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                                    />
                                                  </svg>
                                                ) : level === "view" ? (
                                                  <svg
                                                    className="w-4 h-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                    />
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                    />
                                                  </svg>
                                                ) : (
                                                  <svg
                                                    className="w-4 h-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                                    />
                                                  </svg>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {isOwner && (
              <div className="pt-3 border-t border-neutral-100">
                {!disbandConfirm ? (
                  <button type="button" onClick={() => setDisbandConfirm(true)} className="text-xs text-red-600 hover:text-red-700 font-medium min-h-[44px] flex items-center">
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
                <button type="button" onClick={handleCreateHousehold} disabled={creatingHousehold || !householdName.trim()} className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0 hover:opacity-90 bg-emerald-600 text-white">
                  {creatingHousehold ? "…" : "Create"}
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
                <button type="button" onClick={handleJoinHousehold} disabled={joiningHousehold || !joinCode.trim()} className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0 hover:opacity-90 bg-emerald-600 text-white">
                  {joiningHousehold ? "…" : "Join"}
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
