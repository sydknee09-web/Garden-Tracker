"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingContextOptional } from "@/contexts/OnboardingContext";
import { parseVarietyWithModifiers, normalizeForMatch } from "@/lib/varietyModifiers";
import { buildProfileInsertFromName } from "@/lib/buildProfileInsertFromName";
import { enrichProfileFromName } from "@/lib/enrichProfileFromName";
import type { Volume } from "@/types/vault";
import type { SeedQRPrefill } from "@/lib/parseSeedFromQR";
import { Combobox } from "@/components/Combobox";
import { setPendingManualAdd } from "@/lib/reviewImportStorage";
import { dedupeVendorsForSuggestions, toCanonicalDisplay } from "@/lib/vendorNormalize";
import { filterValidPlantTypes } from "@/lib/plantTypeSuggestions";
import { formatAddFlowError } from "@/lib/addFlowError";
import { hapticSuccess } from "@/lib/haptics";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";

const VOLUMES: Volume[] = ["full", "partial", "low", "empty"];
const VOLUME_LABELS: Record<Volume, string> = {
  full: "Full",
  partial: "Partial",
  low: "Low",
  empty: "Empty",
};

type QuickAddScreen = "choose" | "manual";

export interface QuickAddSuccessOpts {
  /** True when seed was saved but product photo upload was blocked or failed */
  photoBlocked?: boolean;
  /** When a new plant profile was created (manual new variety), redirect to this profile's detail page. */
  newProfileId?: string;
}

interface QuickAddSeedProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (opts?: QuickAddSuccessOpts) => void;
  /** When opening with prefill (e.g. from vault toolbar scan), go straight to manual with form filled */
  initialPrefill?: SeedQRPrefill | null;
  /** When set (e.g. Plant Again from vault profile), lock to this profile: hide variety search, show read-only chip, only add packet to this profile */
  preSelectedProfileId?: string | null;
  /** Display name for the locked chip shown immediately before the profile list loads (e.g. "Tomato (Brandywine)"). Parent should pass this when it already has the profile name. */
  profileDisplayName?: string | null;
  /** Open the Photo Import (group photo) flow; parent should close this modal and open BatchAddSeed */
  onOpenBatch?: () => void;
  /** Open Link Import (paste URL) flow; parent should close this modal and navigate to /vault/import */
  onOpenLinkImport?: () => void;
  /** Open Purchase Order import (screenshot of cart/order); parent should close this modal and open PurchaseOrderImport */
  onOpenPurchaseOrder?: () => void;
  /** When manual add has no matching profile; parent should navigate to /vault/import/manual */
  onStartManualImport?: () => void;
  /** When provided, show back arrow on choose screen to return to FAB menu (parent closes this and re-opens Universal Add Menu) */
  onBackToMenu?: () => void;
}

function applyPrefillToForm(
  prefill: SeedQRPrefill,
  setters: {
    setPlantName: (v: string) => void;
    setVarietyCultivar: (v: string) => void;
    setVendor: (v: string) => void;
  }
) {
  if (prefill.name) setters.setPlantName(prefill.name);
  if (prefill.variety) setters.setVarietyCultivar(prefill.variety);
  if (prefill.vendor) setters.setVendor(prefill.vendor);
}

export function QuickAddSeed({ open, onClose, onSuccess, initialPrefill, preSelectedProfileId, profileDisplayName, onOpenBatch, onOpenLinkImport, onOpenPurchaseOrder, onStartManualImport, onBackToMenu }: QuickAddSeedProps) {
  const { user, session } = useAuth();
  const onboardingCtx = useOnboardingContextOptional();
  const [screen, setScreen] = useState<QuickAddScreen>("choose");
  const [plantName, setPlantName] = useState("");
  const [varietyCultivar, setVarietyCultivar] = useState("");
  const [vendor, setVendor] = useState("");
  const [volume, setVolume] = useState<Volume>("full");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string>("Adding to vault…");
  const [addedToVault, setAddedToVault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsToSave, setTagsToSave] = useState<string[]>([]);
  const [sourceUrlToSave, setSourceUrlToSave] = useState<string>("");
  const [notesToSave, setNotesToSave] = useState<string>("");
  const [priceToSave, setPriceToSave] = useState<string>("");
  const [profiles, setProfiles] = useState<{ id: string; name: string; variety_name: string | null; profile_type?: string }[]>([]);
  const [manualMode, setManualMode] = useState<"new" | "link">("new");
  const [selectedProfileIdForLink, setSelectedProfileIdForLink] = useState<string>("");
  /** When "Link to existing": either add a new packet or use an existing in-stock packet. */
  const [linkSubChoice, setLinkSubChoice] = useState<"new_packet" | "use_existing">("new_packet");
  /** In-stock packets for selectedProfileIdForLink (for "Use existing packet"). */
  const [packetsForProfile, setPacketsForProfile] = useState<{ id: string; vendor_name: string | null; purchase_date: string | null }[]>([]);
  const [packetsLoading, setPacketsLoading] = useState(false);
  /** Selected packet when linkSubChoice === "use_existing". Cleared when profile changes to prevent linking wrong variety. */
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [plantSuggestions, setPlantSuggestions] = useState<string[]>([]);
  const [varietySuggestions, setVarietySuggestions] = useState<string[]>([]);

  // Reset screen when modal opens/closes; apply initial prefill and/or preSelectedProfileId from parent
  useEffect(() => {
    if (open) {
      setAddedToVault(false);
      const hasPrefill = initialPrefill && Object.keys(initialPrefill).length > 0;
      const hasPreSelected = !!preSelectedProfileId;
      setScreen(hasPrefill || hasPreSelected ? "manual" : "choose");
      if (hasPreSelected && preSelectedProfileId) {
        setManualMode("link");
        setSelectedProfileIdForLink(preSelectedProfileId);
      }
      if (hasPrefill && initialPrefill) {
        applyPrefillToForm(initialPrefill, {
          setPlantName,
          setVarietyCultivar,
          setVendor,
        });
      }
    } else {
      setScreen("choose");
      setPlantName("");
      setVarietyCultivar("");
      setVendor("");
      setVolume("full");
      setError(null);
      setTagsToSave([]);
      setSourceUrlToSave("");
      setNotesToSave("");
      setPriceToSave("");
      setManualMode("new");
      setSelectedProfileIdForLink("");
      setLinkSubChoice("new_packet");
      setPacketsForProfile([]);
      setSelectedPacketId(null);
    }
  }, [open, initialPrefill, preSelectedProfileId]);

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase
      .from("plant_profiles")
      .select("id, name, variety_name, profile_type")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .then(({ data }) => setProfiles((data ?? []) as { id: string; name: string; variety_name: string | null; profile_type?: string }[]));
  }, [open, user?.id]);

  // When variety (profile) for "Link to existing" changes, clear selected packet and re-fetch in-stock packets.
  // Prevent linking a packet from the previous variety (e.g. Tomato packet for African Daisy).
  useEffect(() => {
    if (!open || !user?.id || !selectedProfileIdForLink?.trim()) {
      setPacketsForProfile([]);
      setSelectedPacketId(null);
      setPacketsLoading(false);
      return;
    }
    setSelectedPacketId(null);
    setPacketsLoading(true);
    const profileId = selectedProfileIdForLink;
    supabase
      .from("seed_packets")
      .select("id, vendor_name, purchase_date")
      .eq("plant_profile_id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gt("qty_status", 0)
      .eq("is_archived", false)
      .then(
        ({ data }) => {
          const rows = (data ?? []) as { id: string; vendor_name: string | null; purchase_date: string | null }[];
          setPacketsForProfile(rows);
          setPacketsLoading(false);
          if (rows.length === 1) setSelectedPacketId(rows[0].id);
        },
        () => {
          setPacketsForProfile([]);
          setPacketsLoading(false);
        }
      );
  }, [open, user?.id, selectedProfileIdForLink]);

  const seedProfiles = profiles.filter((p) => (p.profile_type ?? "seed") === "seed");
  const preSelectedProfile = preSelectedProfileId ? seedProfiles.find((p) => p.id === preSelectedProfileId) : null;
  const lockedInVarietyLabel = preSelectedProfile
    ? (preSelectedProfile.variety_name?.trim() ? `${preSelectedProfile.name} (${preSelectedProfile.variety_name})` : preSelectedProfile.name)
    : (profileDisplayName ?? null);

  // Plant suggestions from global_plant_cache (standardized, excludes bad rows)
  useEffect(() => {
    if (!open) return;
    supabase.rpc("get_global_plant_cache_plant_types").then(({ data }) => {
      const raw = ((data ?? []) as { plant_type: string | null }[]).map((r) => (r.plant_type ?? "").trim()).filter(Boolean);
      setPlantSuggestions(filterValidPlantTypes(raw));
    });
  }, [open]);

  // Variety suggestions from global_plant_cache when plant is selected (debounced)
  useEffect(() => {
    if (!open || !plantName.trim()) {
      setVarietySuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      supabase.rpc("get_global_plant_cache_varieties", { p_plant_type: plantName.trim() }).then(({ data }) => {
        if (cancelled) return;
        const varieties = ((data ?? []) as { variety: string | null }[]).map((r) => (r.variety ?? "").trim()).filter(Boolean);
        setVarietySuggestions(varieties);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, plantName]);

  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      const { data: profileRows } = await supabase.from("plant_profiles").select("id").eq("user_id", user.id).is("deleted_at", null);
      const ids = (profileRows ?? []).map((r: { id: string }) => r.id);
      if (ids.length === 0) {
        setVendorSuggestions([]);
        return;
      }
      const { data: packetRows } = await supabase.from("seed_packets").select("vendor_name").in("plant_profile_id", ids).is("deleted_at", null);
      const raw = (packetRows ?? []).map((r: { vendor_name: string | null }) => (r.vendor_name ?? "").trim()).filter(Boolean);
      setVendorSuggestions(dedupeVendorsForSuggestions(raw));
    })();
  }, [open, user?.id]);

  function goBack() {
    setError(null);
    setScreen("choose");
  }

  /** Link to existing: either add a new packet (new_packet) or confirm use of an existing packet (use_existing; no insert, just close and refresh). */
  async function handleLinkToExisting(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedProfileIdForLink?.trim()) {
      setError("Select a variety.");
      return;
    }
    if (!user?.id) {
      setError("You must be signed in to add a seed.");
      return;
    }
    if (linkSubChoice === "use_existing" && selectedPacketId) {
      hapticSuccess();
      setAddedToVault(true);
      setTimeout(() => {
        setSelectedProfileIdForLink("");
        setLinkSubChoice("new_packet");
        setPacketsForProfile([]);
        setSelectedPacketId(null);
        setAddedToVault(false);
        onboardingCtx?.reportAction("seed_added");
        onSuccess();
        onClose();
      }, 400);
      return;
    }
    if (linkSubChoice === "use_existing") {
      setError("Select a packet or add a new packet instead.");
      return;
    }
    setSubmitMessage("Adding to vault…");
    setSubmitting(true);
    const userId = user.id;
    const vendorVal = vendor.trim() ? (toCanonicalDisplay(vendor.trim()) || vendor.trim()) : null;
    const sourceUrlVal = sourceUrlToSave.trim() || null;
    const volumeForDb = (typeof volume === "string" ? volume.toLowerCase() : "full") as Volume;
    const volToQty: Record<string, number> = { full: 100, partial: 50, low: 25, empty: 0 };
    const qtyStatus = volToQty[volumeForDb] ?? 100;
    const notesVal = notesToSave.trim() || null;
    const priceVal = priceToSave.trim() || null;
    const { error: packetErr } = await supabase.from("seed_packets").insert({
      plant_profile_id: selectedProfileIdForLink,
      user_id: userId,
      vendor_name: vendorVal,
      purchase_url: sourceUrlVal,
      purchase_date: new Date().toISOString().slice(0, 10),
      qty_status: qtyStatus,
      ...(notesVal && { user_notes: notesVal }),
      ...(priceVal && { price: priceVal }),
    });
    if (packetErr) {
      setError(formatAddFlowError(packetErr));
      setSubmitting(false);
      return;
    }
    await supabase.from("plant_profiles").update({ status: "in_stock" }).eq("id", selectedProfileIdForLink).eq("user_id", userId);
    setSubmitting(false);
    hapticSuccess();
    setAddedToVault(true);
    setTimeout(() => {
      setPlantName("");
      setVarietyCultivar("");
      setVendor("");
      setVolume("full");
      setTagsToSave([]);
      setSourceUrlToSave("");
      setNotesToSave("");
      setPriceToSave("");
      setSelectedProfileIdForLink("");
      setAddedToVault(false);
      onboardingCtx?.reportAction("seed_added");
      onSuccess();
      onClose();
    }, 1500);
  }

  /** Save profile to vault without a packet (reference/wishlist). Shows in vault as out of stock. */
  async function handleSaveForLater(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = plantName.trim();
    if (!name) {
      setError("Plant name is required.");
      return;
    }
    if (!user?.id) {
      setError("You must be signed in to save for later.");
      return;
    }
    setSubmitMessage("Saving…");
    setSubmitting(true);
    const userId = user.id;
    const { coreVariety } = parseVarietyWithModifiers(varietyCultivar);
    const varietyName = coreVariety || varietyCultivar.trim() || null;
    const sourceUrlVal = sourceUrlToSave.trim() || null;
    const nameNorm = normalizeForMatch(name);
    const varietyNorm = normalizeForMatch(varietyName);

    const { data: profilesWithNames } = await supabase.from("plant_profiles").select("id, name, variety_name").eq("user_id", userId).is("deleted_at", null).eq("profile_type", "seed");
    const match = (profilesWithNames ?? []).find(
      (p: { name: string; variety_name: string | null }) =>
        normalizeForMatch(p.name) === nameNorm && normalizeForMatch(p.variety_name) === varietyNorm
    );

    let createdProfileId: string | undefined;
    if (match) {
      await supabase.from("plant_profiles").update({ status: "out_of_stock", updated_at: new Date().toISOString() }).eq("id", match.id).eq("user_id", userId);
    } else {
      const basePayload = buildProfileInsertFromName(name, varietyCultivar.trim(), userId, {
        profileType: "seed",
        status: "out_of_stock",
      });
      const allTags = [...new Set([...(basePayload.tags ?? []), ...tagsToSave])];
      const careNotes: Record<string, unknown> = {};
      if (sourceUrlVal) careNotes.source_url = sourceUrlVal;
      const insertPayload = {
        ...basePayload,
        tags: allTags.length > 0 ? allTags : undefined,
        ...(Object.keys(careNotes).length > 0 && { botanical_care_notes: careNotes }),
      };
      const { data: newProfile, error: profileErr } = await supabase
        .from("plant_profiles")
        .insert(insertPayload)
        .select("id")
        .single();
      if (profileErr) {
        setError(formatAddFlowError(profileErr));
        setSubmitting(false);
        return;
      }
      const profileId = (newProfile as { id: string }).id;
      createdProfileId = profileId;
      await enrichProfileFromName(supabase, profileId, userId, name, varietyCultivar.trim(), {
        vendor: vendor.trim(),
        skipHero: false,
        accessToken: session?.access_token ?? undefined,
      });
    }

    setSubmitting(false);
    hapticSuccess();
    setPlantName("");
    setVarietyCultivar("");
    setVendor("");
    setTagsToSave([]);
    setSourceUrlToSave("");
    onboardingCtx?.reportAction("seed_added");
    onSuccess(createdProfileId ? { newProfileId: createdProfileId } : undefined);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = plantName.trim();
    if (!name) {
      setError("Plant name is required.");
      return;
    }
    // Require auth hook user so RLS allows insert; never attempt save without it.
    if (!user?.id) {
      setError("You must be signed in to add a seed.");
      return;
    }
    const userId = user.id;
    setSubmitMessage("Adding to vault…");
    setSubmitting(true);

    const { coreVariety, tags: packetTags } = parseVarietyWithModifiers(varietyCultivar);
    const varietyName = coreVariety || varietyCultivar.trim() || null;
    const vendorVal = vendor.trim() ? (toCanonicalDisplay(vendor.trim()) || vendor.trim()) : null;
    const sourceUrlVal = sourceUrlToSave.trim() || null;
    const volumeForDb = (typeof volume === "string" ? volume.toLowerCase() : "full") as Volume;

    const nameNorm = normalizeForMatch(name);
    const varietyNorm = normalizeForMatch(varietyName);
    const volToQty: Record<string, number> = { full: 100, partial: 50, low: 25, empty: 0 };
    const qtyStatus = volToQty[volumeForDb] ?? 100;

    const { data: profilesWithNames } = await supabase.from("plant_profiles").select("id, name, variety_name").eq("user_id", userId).is("deleted_at", null).eq("profile_type", "seed");
    const match = (profilesWithNames ?? []).find(
      (p: { name: string; variety_name: string | null }) =>
        normalizeForMatch(p.name) === nameNorm && normalizeForMatch(p.variety_name) === varietyNorm
    );

    const notesVal = notesToSave.trim() || null;
    const priceVal = priceToSave.trim() || null;
    if (match) {
      const { error: packetErr } = await supabase.from("seed_packets").insert({
        plant_profile_id: match.id,
        user_id: userId,
        vendor_name: vendorVal,
        purchase_url: sourceUrlVal,
        purchase_date: new Date().toISOString().slice(0, 10),
        qty_status: qtyStatus,
        ...(packetTags.length > 0 && { tags: packetTags }),
        ...(notesVal && { user_notes: notesVal }),
        ...(priceVal && { price: priceVal }),
      });
      if (packetErr) {
        setSubmitting(false);
        setError(formatAddFlowError(packetErr));
        return;
      }
      await supabase.from("plant_profiles").update({ status: "in_stock" }).eq("id", match.id).eq("user_id", userId);
      setSubmitting(false);
      hapticSuccess();
      setAddedToVault(true);
      setTimeout(() => {
        setPlantName("");
        setVarietyCultivar("");
        setVendor("");
        setVolume("full");
        setTagsToSave([]);
        setSourceUrlToSave("");
        setNotesToSave("");
        setPriceToSave("");
        setAddedToVault(false);
        onboardingCtx?.reportAction("seed_added");
        onSuccess();
        onClose();
      }, 1500);
      return;
    }

    // No match: send to loading page → manual import (enrich + hero → save directly)
    setPendingManualAdd({
      plantName: name.trim(),
      varietyCultivar: varietyCultivar.trim(),
      vendor: vendor.trim(),
      volume: volumeForDb,
      tagsToSave: tagsToSave.length > 0 ? tagsToSave : undefined,
      sourceUrlToSave: sourceUrlVal ?? undefined,
      notesToSave: notesToSave.trim() || undefined,
      priceToSave: priceToSave.trim() || undefined,
    });
    setSubmitting(false);
    setPlantName("");
    setVarietyCultivar("");
    setVendor("");
    setVolume("full");
    setTagsToSave([]);
    setSourceUrlToSave("");
    setNotesToSave("");
    onClose();
    onStartManualImport?.();
  }

  if (!open) return null;

  const modalTitle = screen === "choose" ? "Add Seed" : "Quick Add Seed";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-4 right-4 bottom-20 z-50 rounded-3xl bg-white border border-neutral-200/80 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        role="dialog"
        aria-labelledby="quick-add-title"
        aria-modal="true"
      >
        <div className="flex items-center gap-2 mb-4">
          {screen === "manual" ? (
            <button
              type="button"
              onClick={goBack}
              className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Back to choose method"
            >
              <ICON_MAP.Back stroke="currentColor" className="w-5 h-5" />
            </button>
          ) : onBackToMenu ? (
            <button
              type="button"
              onClick={onBackToMenu}
              className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Back to add menu"
            >
              <ICON_MAP.Back stroke="currentColor" className="w-5 h-5" />
            </button>
          ) : null}
          <h2
            id="quick-add-title"
            className="text-xl font-bold text-neutral-900 flex-1 text-center"
          >
            {modalTitle}
          </h2>
        </div>

        {screen === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-500 text-center mb-4">Choose how you want to add a seed.</p>
            <button
              type="button"
              onClick={() => setScreen("manual")}
              className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
            >
              <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📝</span>
              Manual Entry
            </button>
            {onOpenBatch && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBatch();
                }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📸</span>
                Photo Import
              </button>
            )}
            {onOpenLinkImport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLinkImport();
                }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>🌐</span>
                Link Import
              </button>
            )}
            {onOpenPurchaseOrder && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPurchaseOrder();
                }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>🧾</span>
                Purchase Order
              </button>
            )}
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {screen === "manual" && (
          <div className="relative">
            <SubmitLoadingOverlay show={submitting} message={submitMessage} />
            {!preSelectedProfileId && (
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setManualMode("link")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${manualMode === "link" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                Link to existing
              </button>
              <button
                type="button"
                onClick={() => setManualMode("new")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${manualMode === "new" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                Add new
              </button>
            </div>
            )}
            {manualMode === "link" || preSelectedProfileId ? (
              <form onSubmit={handleLinkToExisting} className="space-y-4">
                {preSelectedProfileId ? (
                  <>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/90 mb-0.5">Variety</p>
                      <p className="text-neutral-900 font-medium">{lockedInVarietyLabel ?? "Loading…"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setLinkSubChoice("new_packet")}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${linkSubChoice === "new_packet" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                      >
                        Add new packet
                      </button>
                      <button
                        type="button"
                        onClick={() => setLinkSubChoice("use_existing")}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${linkSubChoice === "use_existing" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                      >
                        Use existing packet
                      </button>
                    </div>
                    {linkSubChoice === "use_existing" ? (
                      <div className="space-y-2">
                        {packetsLoading ? (
                          <p className="text-sm text-neutral-500">Loading packets…</p>
                        ) : packetsForProfile.length === 0 ? (
                          <p className="text-sm text-neutral-600">No in-stock packets for this variety. Add new packet instead.</p>
                        ) : packetsForProfile.length === 1 && selectedPacketId ? (
                          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 flex items-center justify-between gap-2">
                            <span className="text-sm text-neutral-800">
                              Selected: {packetsForProfile[0].vendor_name || "Unknown"} {packetsForProfile[0].purchase_date ? `(${packetsForProfile[0].purchase_date})` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedPacketId(null)}
                              className="text-sm font-medium text-emerald-700 hover:underline min-w-[44px] min-h-[44px] flex items-center justify-center"
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <div>
                            <label htmlFor="quick-add-link-packet" className="block text-sm font-medium text-black/80 mb-1">
                              Choose packet
                            </label>
                            <select
                              id="quick-add-link-packet"
                              value={selectedPacketId ?? ""}
                              onChange={(e) => setSelectedPacketId(e.target.value || null)}
                              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                              aria-label="Choose packet"
                            >
                              <option value="">Select a packet</option>
                              {packetsForProfile.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.vendor_name || "Unknown"} {p.purchase_date ? `(${p.purchase_date})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                    <div>
                      <label htmlFor="quick-add-link-vendor" className="block text-sm font-medium text-black/80 mb-1">
                        Vendor / Nursery (optional)
                      </label>
                      <Combobox
                        id="quick-add-link-vendor"
                        value={vendor}
                        onChange={setVendor}
                        suggestions={vendorSuggestions}
                        placeholder="e.g. Burpee"
                        aria-label="Vendor / Nursery"
                        className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                      />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-black/80 mb-2">Volume (optional)</span>
                      <div className="flex gap-2 flex-wrap">
                        {VOLUMES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setVolume(v)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              volume === v ? "bg-emerald text-white" : "bg-black/5 text-black/70 hover:bg-black/10"
                            }`}
                          >
                            {VOLUME_LABELS[v]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="quick-add-link-source-url" className="block text-sm font-medium text-black/80 mb-1">
                        Source URL (optional)
                      </label>
                      <input
                        id="quick-add-link-source-url"
                        type="url"
                        value={sourceUrlToSave}
                        onChange={(e) => setSourceUrlToSave(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                        aria-label="Product or vendor URL"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-add-link-price" className="block text-sm font-medium text-black/80 mb-1">
                        Price (optional)
                      </label>
                      <input
                        id="quick-add-link-price"
                        type="text"
                        value={priceToSave}
                        onChange={(e) => setPriceToSave(e.target.value)}
                        placeholder="e.g. $3.50"
                        className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                        aria-label="Price (optional)"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-add-link-notes" className="block text-sm font-medium text-black/80 mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        id="quick-add-link-notes"
                        value={notesToSave}
                        onChange={(e) => setNotesToSave(e.target.value)}
                        placeholder="e.g. From seed swap, organic"
                        rows={2}
                        className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px] resize-none"
                        aria-label="Packet notes"
                      />
                    </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {seedProfiles.length === 0 ? (
                      <p className="text-sm text-neutral-600">No varieties in vault. Add new instead.</p>
                    ) : (
                      <>
                        <div>
                          <label htmlFor="quick-add-link-profile" className="block text-sm font-medium text-black/80 mb-1">
                            Variety *
                          </label>
                          <select
                            id="quick-add-link-profile"
                            value={selectedProfileIdForLink}
                            onChange={(e) => setSelectedProfileIdForLink(e.target.value)}
                            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                            aria-label="Select variety"
                          >
                            <option value="">Select a variety</option>
                            {seedProfiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.variety_name?.trim() ? `${p.name} — ${p.variety_name}` : p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedProfileIdForLink && (
                          <>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setLinkSubChoice("new_packet")}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${linkSubChoice === "new_packet" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                              >
                                Add new packet
                              </button>
                              <button
                                type="button"
                                onClick={() => setLinkSubChoice("use_existing")}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${linkSubChoice === "use_existing" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                              >
                                Use existing packet
                              </button>
                            </div>
                            {linkSubChoice === "use_existing" ? (
                              <div className="space-y-2">
                                {packetsLoading ? (
                                  <p className="text-sm text-neutral-500">Loading packets…</p>
                                ) : packetsForProfile.length === 0 ? (
                                  <p className="text-sm text-neutral-600">No in-stock packets for this variety. Add new packet instead.</p>
                                ) : packetsForProfile.length === 1 && selectedPacketId ? (
                                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 flex items-center justify-between gap-2">
                                    <span className="text-sm text-neutral-800">
                                      Selected: {packetsForProfile[0].vendor_name || "Unknown"} {packetsForProfile[0].purchase_date ? `(${packetsForProfile[0].purchase_date})` : ""}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPacketId(null)}
                                      className="text-sm font-medium text-emerald-700 hover:underline min-w-[44px] min-h-[44px] flex items-center justify-center"
                                    >
                                      Change
                                    </button>
                                  </div>
                                ) : (
                                  <div>
                                    <label htmlFor="quick-add-link-packet-2" className="block text-sm font-medium text-black/80 mb-1">
                                      Choose packet
                                    </label>
                                    <select
                                      id="quick-add-link-packet-2"
                                      value={selectedPacketId ?? ""}
                                      onChange={(e) => setSelectedPacketId(e.target.value || null)}
                                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                                      aria-label="Choose packet"
                                    >
                                      <option value="">Select a packet</option>
                                      {packetsForProfile.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.vendor_name || "Unknown"} {p.purchase_date ? `(${p.purchase_date})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </>
                        )}
                        {linkSubChoice === "new_packet" && (
                          <>
                        <div>
                          <label htmlFor="quick-add-link-vendor" className="block text-sm font-medium text-black/80 mb-1">
                            Vendor / Nursery (optional)
                          </label>
                          <Combobox
                            id="quick-add-link-vendor"
                            value={vendor}
                            onChange={setVendor}
                            suggestions={vendorSuggestions}
                            placeholder="e.g. Burpee"
                            aria-label="Vendor / Nursery"
                            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                          />
                        </div>
                        <div>
                          <span className="block text-sm font-medium text-black/80 mb-2">Volume (optional)</span>
                          <div className="flex gap-2 flex-wrap">
                            {VOLUMES.map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setVolume(v)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  volume === v ? "bg-emerald text-white" : "bg-black/5 text-black/70 hover:bg-black/10"
                                }`}
                              >
                                {VOLUME_LABELS[v]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="quick-add-link-source-url-2" className="block text-sm font-medium text-black/80 mb-1">
                            Source URL (optional)
                          </label>
                          <input
                            id="quick-add-link-source-url-2"
                            type="url"
                            value={sourceUrlToSave}
                            onChange={(e) => setSourceUrlToSave(e.target.value)}
                            placeholder="https://..."
                            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                            aria-label="Product or vendor URL"
                          />
                        </div>
                        <div>
                          <label htmlFor="quick-add-link-price-2" className="block text-sm font-medium text-black/80 mb-1">
                            Price (optional)
                          </label>
                          <input
                            id="quick-add-link-price-2"
                            type="text"
                            value={priceToSave}
                            onChange={(e) => setPriceToSave(e.target.value)}
                            placeholder="e.g. $3.50"
                            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                            aria-label="Price (optional)"
                          />
                        </div>
                        <div>
                          <label htmlFor="quick-add-link-notes-2" className="block text-sm font-medium text-black/80 mb-1">
                            Notes (optional)
                          </label>
                          <textarea
                            id="quick-add-link-notes-2"
                            value={notesToSave}
                            onChange={(e) => setNotesToSave(e.target.value)}
                            placeholder="e.g. From seed swap, organic"
                            rows={2}
                            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px] resize-none"
                            aria-label="Packet notes"
                          />
                        </div>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
                {error && <p className="text-sm text-citrus font-medium">{error}</p>}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      addedToVault ||
                      (linkSubChoice === "new_packet" && !preSelectedProfileId && seedProfiles.length === 0) ||
                      (linkSubChoice === "use_existing" && !selectedPacketId)
                    }
                    className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {addedToVault ? (
                      <>
                        <CheckmarkIcon className="w-5 h-5" />
                        Added!
                      </>
                    ) : submitting ? (
                      "Adding…"
                    ) : (
                      "Add to Vault"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="quick-add-name" className="block text-sm font-medium text-black/80 mb-1">
                Plant Name *
              </label>
              <Combobox
                id="quick-add-name"
                value={plantName}
                onChange={setPlantName}
                suggestions={plantSuggestions}
                placeholder="e.g. Tomato"
                aria-label="Plant name"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              />
            </div>
            <div>
              <label htmlFor="quick-add-variety" className="block text-sm font-medium text-black/80 mb-1">
                Variety / Cultivar (optional)
              </label>
              <Combobox
                id="quick-add-variety"
                value={varietyCultivar}
                onChange={setVarietyCultivar}
                suggestions={varietySuggestions}
                placeholder="e.g. Dr. Wyche"
                aria-label="Variety or cultivar"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              />
            </div>
            <div>
              <label htmlFor="quick-add-vendor" className="block text-sm font-medium text-black/80 mb-1">
                Vendor (optional)
              </label>
              <Combobox
                id="quick-add-vendor"
                value={vendor}
                onChange={setVendor}
                suggestions={vendorSuggestions}
                placeholder="e.g. Burpee"
                aria-label="Vendor"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-black/80 mb-2">Volume (optional)</span>
              <div className="flex gap-2 flex-wrap">
                {VOLUMES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVolume(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      volume === v
                        ? "bg-emerald text-white"
                        : "bg-black/5 text-black/70 hover:bg-black/10"
                    }`}
                  >
                    {VOLUME_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="quick-add-source-url" className="block text-sm font-medium text-black/80 mb-1">
                Source URL (optional)
              </label>
              <input
                id="quick-add-source-url"
                type="url"
                value={sourceUrlToSave}
                onChange={(e) => setSourceUrlToSave(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                aria-label="Product or vendor URL"
              />
            </div>
            <div>
              <label htmlFor="quick-add-price" className="block text-sm font-medium text-black/80 mb-1">
                Price (optional)
              </label>
              <input
                id="quick-add-price"
                type="text"
                value={priceToSave}
                onChange={(e) => setPriceToSave(e.target.value)}
                placeholder="e.g. $3.50"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                aria-label="Price (optional)"
              />
            </div>
            <div>
              <label htmlFor="quick-add-notes" className="block text-sm font-medium text-black/80 mb-1">
                Notes (optional)
              </label>
              <textarea
                id="quick-add-notes"
                value={notesToSave}
                onChange={(e) => setNotesToSave(e.target.value)}
                placeholder="e.g. From seed swap, organic"
                rows={2}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px] resize-none"
                aria-label="Packet notes"
              />
            </div>
            {error && (
              <p className="text-sm text-citrus font-medium">{error}</p>
            )}
            <p className="text-xs text-black/60">
              Don&apos;t have seeds yet? <strong>Save for later</strong> adds the variety to your vault (no packet). Add a packet when you buy.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveForLater}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl border border-amber-200 text-amber-800 bg-amber-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add to vault without a packet — shows as out of stock"
              >
                {submitting ? "Saving…" : "Save for later"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || addedToVault}
                  className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addedToVault ? (
                    <>
                      <CheckmarkIcon className="w-5 h-5" />
                      Added!
                    </>
                  ) : submitting ? (
                    "Adding…"
                  ) : (
                    "Add to Vault (with packet)"
                  )}
                </button>
              </div>
            </div>
          </form>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}


