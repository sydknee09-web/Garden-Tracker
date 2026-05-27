"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingContextOptional } from "@/contexts/OnboardingContext";
import { buildProfileInsertFromName } from "@/lib/buildProfileInsertFromName";
import { enrichProfileFromName } from "@/lib/enrichProfileFromName";
import { normalizeForMatch, parseVarietyWithModifiers } from "@/lib/varietyModifiers";
import { formatAddFlowError } from "@/lib/addFlowError";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { FormError } from "@/components/FormError";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";
import { ICON_MAP } from "@/lib/styleDictionary";
import { logEvent } from "@/lib/debugLog";

export interface AddVarietySuccessOpts {
  /** UUID of the profile created (or matched + restocked). */
  profileId: string;
}

export interface AddVarietyModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (opts: AddVarietySuccessOpts) => void;
}

/**
 * AddVarietyModal — standalone "create a plant profile (no packet, no grow instance)" entry.
 *
 * Triggered from the Vault Plant Profiles tab toolbar. Creates a `plant_profiles` row with
 * `profile_type: "seed"` + `status: "out_of_stock"`, then runs background enrichment to
 * fill scientific name / hero image / botanical care notes. Mirrors the canonical
 * standalone-profile logic from QuickAddSeed.handleSaveForLater but with a purpose-built
 * 3-field form (no packet-specific fields) and a Vault-tab entry point so Maya-style users
 * can build their encyclopedia without entering through the seed-packet flow.
 */
export function AddVarietyModal({ open, onClose, onSuccess }: AddVarietyModalProps) {
  const { user, session } = useAuth();
  const onboardingCtx = useOnboardingContextOptional();
  const modalRef = useFocusTrap(open);
  useEscapeKey(open, onClose);
  useBodyScrollLock(open);

  const [plantName, setPlantName] = useState("");
  const [variety, setVariety] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setPlantName("");
    setVariety("");
    setSourceNote("");
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    logEvent("form", "submit", { name: "add_variety" });
    setError(null);

    const name = plantName.trim();
    if (!name) {
      setError("Plant name is required.");
      hapticError();
      return;
    }
    if (!user?.id) {
      setError("You must be signed in to add a variety.");
      hapticError();
      return;
    }

    setSubmitting(true);
    const userId = user.id;
    const { coreVariety } = parseVarietyWithModifiers(variety);
    const varietyName = coreVariety || variety.trim() || null;
    const nameNorm = normalizeForMatch(name);
    const varietyNorm = normalizeForMatch(varietyName);

    const { data: profilesWithNames } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("profile_type", "seed");
    const match = (profilesWithNames ?? []).find(
      (p: { name: string; variety_name: string | null }) =>
        normalizeForMatch(p.name) === nameNorm && normalizeForMatch(p.variety_name) === varietyNorm,
    );

    let profileId: string;
    if (match) {
      const { error: updateErr } = await supabase
        .from("plant_profiles")
        .update({ status: "out_of_stock", updated_at: new Date().toISOString() })
        .eq("id", match.id)
        .eq("user_id", userId);
      if (updateErr) {
        setError(formatAddFlowError(updateErr));
        setSubmitting(false);
        hapticError();
        return;
      }
      profileId = match.id;
    } else {
      const basePayload = buildProfileInsertFromName(name, variety.trim(), userId, {
        profileType: "seed",
        status: "out_of_stock",
      });
      const note = sourceNote.trim();
      const insertPayload = {
        ...basePayload,
        ...(note && { botanical_care_notes: { source_note: note } }),
      };
      const { data: newProfile, error: profileErr } = await supabase
        .from("plant_profiles")
        .insert(insertPayload)
        .select("id")
        .single();
      if (profileErr) {
        setError(formatAddFlowError(profileErr));
        setSubmitting(false);
        hapticError();
        return;
      }
      profileId = (newProfile as { id: string }).id;
      // Fire-and-forget background enrichment — modal closes immediately so
      // the user sees the new variety card right away. Modal unmounts before
      // this resolves; helper logs every lifecycle event + writes
      // hero_image_pending=true/false so cards pick up "Researching..." via
      // existing SeedVaultView getThumbState pattern.
      const runEnrichment = async () => {
        try {
          await enrichProfileFromName(supabase, profileId, userId, name, variety.trim(), {
            skipHero: false,
            accessToken: session?.access_token ?? undefined,
          });
        } catch {
          /* errors already logged inside helper */
        }
      };
      void runEnrichment();
    }

    setSubmitting(false);
    hapticSuccess();
    onboardingCtx?.reportAction("seed_added");
    resetForm();
    onSuccess?.({ profileId });
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 bg-black/20"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-variety-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl border border-neutral-200/80 shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden"
        tabIndex={-1}
      >
        <div className="flex-shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-11 shrink-0" aria-hidden />
            <h2 id="add-variety-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">
              Add Plant Variety
            </h2>
            <div className="w-11 shrink-0" aria-hidden />
          </div>
          <p className="text-sm text-neutral-500 text-center">
            Save a variety to your encyclopedia without a packet. Add a packet later when you buy.
          </p>
        </div>

        <form id="add-variety-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-2.5 relative">
          <SubmitLoadingOverlay show={submitting} message="Saving variety…" />
          <div>
            <label htmlFor="add-variety-name" className="block text-sm font-medium text-black/80 mb-1">
              Plant name *
            </label>
            <input
              ref={nameInputRef}
              id="add-variety-name"
              type="text"
              value={plantName}
              onChange={(e) => setPlantName(e.target.value)}
              placeholder="e.g. Tomato, Basil, Rose"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Plant name"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="add-variety-cultivar" className="block text-sm font-medium text-black/80 mb-1">
              Variety / cultivar (optional)
            </label>
            <input
              id="add-variety-cultivar"
              type="text"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              placeholder="e.g. Cherokee Purple, Genovese, Cecile Brunner"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Variety or cultivar"
            />
          </div>
          <div>
            <label htmlFor="add-variety-source" className="block text-sm font-medium text-black/80 mb-1">
              Where did you hear about it? (optional)
            </label>
            <input
              id="add-variety-source"
              type="text"
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="e.g. Sister's garden, podcast, seed catalog"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Source or origin note"
            />
          </div>
          {error && <FormError>{error}</FormError>}
        </form>

        <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200 flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="min-h-[44px] px-4 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium hover:bg-teal-gus/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            form="add-variety-form"
            type="submit"
            disabled={submitting || !plantName.trim()}
            className="min-h-[44px] px-4 py-2 rounded-3xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ICON_MAP.Add className="w-5 h-5 shrink-0" stroke="currentColor" />
            {submitting ? "Saving…" : "Add to Vault"}
          </button>
        </div>
      </div>
    </div>
  );
}
