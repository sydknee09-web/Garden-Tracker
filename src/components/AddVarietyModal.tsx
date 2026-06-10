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
import { useUserPlantingZone } from "@/hooks/useUserPlantingZone";
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

export interface AddVarietyFormProps {
  /** Close handler (parent menu / shell owns dismissal). */
  onClose: () => void;
  /** Optional success callback after profile created. */
  onSuccess?: (opts: AddVarietySuccessOpts) => void;
  /** Back arrow handler (return to FAB menu main screen). When omitted, no back arrow renders. */
  onBack?: () => void;
}

/**
 * AddVarietyForm — Path Y in-menu form extraction of AddVarietyModal.
 *
 * Embeds inside UniversalAddMenu's "variety" sub-screen. Mirrors the TaskForm /
 * SupplyForm / SeedPacketForm extraction pattern locked 2026-05-20 (`bee5338`).
 * No focus trap / escape / body scroll lock — the parent UniversalAddMenu owns
 * those at the outer modal level. Standalone AddVarietyModal (below) wraps this
 * for backward-compat callers (none in tree today; preserved for safety).
 */
export function AddVarietyForm({ onClose, onSuccess, onBack }: AddVarietyFormProps) {
  const { user, session } = useAuth();
  const onboardingCtx = useOnboardingContextOptional();
  const { zone: userZone } = useUserPlantingZone();

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
            userZone,
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

  return (
    <>
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-teal-gus hover:bg-teal-gus/10 -ml-1"
              aria-label="Back"
            >
              <ICON_MAP.Back className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-11 shrink-0" aria-hidden />
          )}
          <h2 id="add-variety-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">
            Add to Library
          </h2>
          <div className="w-11 shrink-0" aria-hidden />
        </div>
        <p className="text-sm text-neutral-500 text-center">
          Save a variety to your plant encyclopedia. Add a packet later when you buy.
        </p>
      </div>

      <form id="add-variety-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-2.5">
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
            Variety / cultivar          </label>
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
            Where did you hear about it?          </label>
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
          {submitting ? "Saving…" : "Save to Library"}
        </button>
      </div>
      <SubmitLoadingOverlay show={submitting} message="Saving variety…" />
    </>
  );
}

/**
 * AddVarietyModal — standalone modal-shell wrapper around AddVarietyForm.
 *
 * Preserved for backward-compat callers (none in tree post Ship A — the inline
 * Vault toolbar trigger was removed when Library moved to /plants and the
 * canonical Add Variety entry point became the FAB chip). Kept cheap to retain
 * for potential future deep-link or standalone usage.
 */
export function AddVarietyModal({ open, onClose, onSuccess }: AddVarietyModalProps) {
  const modalRef = useFocusTrap(open);
  useEscapeKey(open, onClose);
  useBodyScrollLock(open);

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
        className="relative bg-white rounded-3xl border border-neutral-200/80 shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden"
        tabIndex={-1}
      >
        <AddVarietyForm onClose={onClose} onSuccess={onSuccess} />
      </div>
    </div>
  );
}
