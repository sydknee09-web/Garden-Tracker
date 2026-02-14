"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { parseVarietyWithModifiers, normalizeForMatch } from "@/lib/varietyModifiers";
import type { Volume } from "@/types/vault";
import type { SeedQRPrefill } from "@/lib/parseSeedFromQR";
import { Combobox } from "@/components/Combobox";
import { setPendingManualAdd } from "@/lib/reviewImportStorage";

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
}

interface QuickAddSeedProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (opts?: QuickAddSuccessOpts) => void;
  /** When opening with prefill (e.g. from vault toolbar scan), go straight to manual with form filled */
  initialPrefill?: SeedQRPrefill | null;
  /** Open the Photo Import (group photo) flow; parent should close this modal and open BatchAddSeed */
  onOpenBatch?: () => void;
  /** Open Link Import (paste URL) flow; parent should close this modal and navigate to /vault/import */
  onOpenLinkImport?: () => void;
  /** When manual add has no matching profile; parent should navigate to /vault/import/manual */
  onStartManualImport?: () => void;
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

export function QuickAddSeed({ open, onClose, onSuccess, initialPrefill, onOpenBatch, onOpenLinkImport, onStartManualImport }: QuickAddSeedProps) {
  const { user } = useAuth();
  const [screen, setScreen] = useState<QuickAddScreen>("choose");
  const [plantName, setPlantName] = useState("");
  const [varietyCultivar, setVarietyCultivar] = useState("");
  const [vendor, setVendor] = useState("");
  const [volume, setVolume] = useState<Volume>("full");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsToSave, setTagsToSave] = useState<string[]>([]);
  const [sourceUrlToSave, setSourceUrlToSave] = useState<string>("");
  const [profiles, setProfiles] = useState<{ id: string; name: string; variety_name: string | null }[]>([]);
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [plantSuggestions, setPlantSuggestions] = useState<string[]>([]);
  const [varietySuggestions, setVarietySuggestions] = useState<string[]>([]);

  // Reset screen when modal opens/closes; apply initial prefill from parent
  useEffect(() => {
    if (open) {
      const hasPrefill = initialPrefill && Object.keys(initialPrefill).length > 0;
      setScreen(hasPrefill ? "manual" : "choose");
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
    }
  }, [open, initialPrefill]);

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase
      .from("plant_profiles")
      .select("id, name, variety_name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .then(({ data }) => setProfiles((data ?? []) as { id: string; name: string; variety_name: string | null }[]));
  }, [open, user?.id]);

  // Plant suggestions from global_plant_cache (standardized, excludes bad rows)
  useEffect(() => {
    if (!open) return;
    supabase.rpc("get_global_plant_cache_plant_types").then(({ data }) => {
      const types = ((data ?? []) as { plant_type: string | null }[]).map((r) => (r.plant_type ?? "").trim()).filter(Boolean);
      setPlantSuggestions(types);
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
      const { data: profileRows } = await supabase.from("plant_profiles").select("id").eq("user_id", user.id);
      const ids = (profileRows ?? []).map((r: { id: string }) => r.id);
      if (ids.length === 0) {
        setVendorSuggestions([]);
        return;
      }
      const { data: packetRows } = await supabase.from("seed_packets").select("vendor_name").in("plant_profile_id", ids);
      const vendors = (packetRows ?? []).map((r: { vendor_name: string | null }) => (r.vendor_name ?? "").trim()).filter(Boolean);
      setVendorSuggestions([...new Set(vendors)].sort((a, b) => a.localeCompare(b)));
    })();
  }, [open, user?.id]);

  function goBack() {
    setError(null);
    setScreen("choose");
  }

  async function handleAddToShoppingList(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = plantName.trim();
    if (!name) {
      setError("Plant name is required.");
      return;
    }
    if (!user?.id) {
      setError("You must be signed in to add to the shopping list.");
      return;
    }
    setSubmitting(true);
    const varietyVal = varietyCultivar.trim() || null;
    const { error: insertErr } = await supabase.from("shopping_list").insert({
      user_id: user.id,
      plant_profile_id: null,
      placeholder_name: name,
      placeholder_variety: varietyVal,
      is_purchased: false,
    });
    setSubmitting(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setPlantName("");
    setVarietyCultivar("");
    setVendor("");
    onSuccess();
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
    setSubmitting(true);

    const { coreVariety, tags: packetTags } = parseVarietyWithModifiers(varietyCultivar);
    const varietyName = coreVariety || varietyCultivar.trim() || null;
    const vendorVal = vendor.trim() || null;
    const sourceUrlVal = sourceUrlToSave.trim() || null;
    const volumeForDb = (typeof volume === "string" ? volume.toLowerCase() : "full") as Volume;

    const nameNorm = normalizeForMatch(name);
    const varietyNorm = normalizeForMatch(varietyName);
    const volToQty: Record<string, number> = { full: 100, partial: 50, low: 20, empty: 0 };
    const qtyStatus = volToQty[volumeForDb] ?? 100;

    const { data: profilesWithNames } = await supabase.from("plant_profiles").select("id, name, variety_name").eq("user_id", userId);
    const match = (profilesWithNames ?? []).find(
      (p: { name: string; variety_name: string | null }) =>
        normalizeForMatch(p.name) === nameNorm && normalizeForMatch(p.variety_name) === varietyNorm
    );

    if (match) {
      const { error: packetErr } = await supabase.from("seed_packets").insert({
        plant_profile_id: match.id,
        user_id: userId,
        vendor_name: vendorVal,
        purchase_url: sourceUrlVal,
        purchase_date: new Date().toISOString().slice(0, 10),
        qty_status: qtyStatus,
        ...(packetTags.length > 0 && { tags: packetTags }),
      });
      if (packetErr) {
        setSubmitting(false);
        setError(packetErr.message);
        return;
      }
      await supabase.from("plant_profiles").update({ status: "in_stock" }).eq("id", match.id).eq("user_id", userId);
      setSubmitting(false);
      setPlantName("");
      setVarietyCultivar("");
      setVendor("");
      setVolume("full");
      setTagsToSave([]);
      setSourceUrlToSave("");
      onSuccess();
      onClose();
      return;
    }

    // No match: send to loading page → review (do not create profile/packet here)
    setPendingManualAdd({
      plantName: name.trim(),
      varietyCultivar: varietyCultivar.trim(),
      vendor: vendor.trim(),
      volume: volumeForDb,
      tagsToSave: tagsToSave.length > 0 ? tagsToSave : undefined,
      sourceUrlToSave: sourceUrlVal ?? undefined,
    });
    setSubmitting(false);
    setPlantName("");
    setVarietyCultivar("");
    setVendor("");
    setVolume("full");
    setTagsToSave([]);
    setSourceUrlToSave("");
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
        className="fixed left-4 right-4 bottom-20 z-50 rounded-2xl bg-white shadow-card border border-black/5 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        role="dialog"
        aria-labelledby="quick-add-title"
        aria-modal="true"
      >
        <div className="flex items-center gap-2 mb-4">
          {screen === "manual" && (
            <button
              type="button"
              onClick={goBack}
              className="p-2 rounded-xl text-black/70 hover:bg-black/5 -ml-1"
              aria-label="Back to choose method"
            >
              <BackIcon />
            </button>
          )}
          <h2 id="quick-add-title" className="text-lg font-semibold text-black">
            {modalTitle}
          </h2>
        </div>

        {screen === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-black/70 mb-4">Choose how you want to add a seed.</p>
            <button
              type="button"
              onClick={() => setScreen("manual")}
              className="w-full py-4 px-4 rounded-xl border-2 border-black/10 hover:border-emerald/50 hover:bg-emerald/5 text-left font-medium text-black transition-colors flex items-center gap-3"
            >
              <span className="flex h-10 w-10 rounded-xl bg-black/5 items-center justify-center">
                <PencilIcon />
              </span>
              Manual Entry
            </button>
            {onOpenBatch && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBatch();
                }}
                className="w-full py-4 px-4 rounded-xl border-2 border-black/10 hover:border-emerald/50 hover:bg-emerald/5 text-left font-medium text-black transition-colors flex items-center gap-3"
              >
                <span className="flex h-10 w-10 rounded-xl bg-black/5 items-center justify-center">
                  <CameraIcon />
                </span>
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
                className="w-full py-4 px-4 rounded-xl border-2 border-black/10 hover:border-emerald/50 hover:bg-emerald/5 text-left font-medium text-black transition-colors flex items-center gap-3"
              >
                <span className="flex h-10 w-10 rounded-xl bg-black/5 items-center justify-center">
                  <LinkIcon />
                </span>
                Link Import
              </button>
            )}
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {screen === "manual" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="quick-add-name" className="block text-sm font-medium text-black/80 mb-1">
                Plant Name
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
                Variety / Cultivar
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
                Vendor
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
              <span className="block text-sm font-medium text-black/80 mb-2">Volume</span>
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
            {error && (
              <p className="text-sm text-citrus font-medium">{error}</p>
            )}
            <p className="text-xs text-black/60">
              Don&apos;t have this seed yet? Add it to your <strong>Shopping List</strong> and mark &quot;I bought this&quot; when you get it.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddToShoppingList}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-emerald/60 text-emerald-700 bg-emerald/10 font-medium disabled:opacity-60"
              >
                {submitting ? "Adding…" : "Add to Shopping List"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-60"
              >
                {submitting ? "Adding…" : "Add to Vault"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

