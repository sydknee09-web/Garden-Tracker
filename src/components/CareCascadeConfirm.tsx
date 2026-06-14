"use client";

import { useState } from "react";
import { ModalCloseButton } from "@/components/ModalCloseButton";

export type CascadeAction = "create" | "edit";

interface Props {
  open: boolean;
  action: CascadeAction;
  /** Eligible plant count for cascade. Popup should not render when 0. */
  eligibleCount: number;
  /** For edit-cascade: number of eligible copies that have diverged from the template (locally edited). */
  locallyEditedCount?: number;
  onCancel: () => void;
  /** forceOverwrite is true when the "Overwrite locally edited copies" checkbox was checked. */
  onApply: (forceOverwrite: boolean) => Promise<void>;
}

export function CareCascadeConfirm({ open, action, eligibleCount, locallyEditedCount = 0, onCancel, onApply }: Props) {
  const [applying, setApplying] = useState(false);
  const [overwriteLocal, setOverwriteLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const plantWord = eligibleCount === 1 ? "plant" : "plants";
  const themWord = eligibleCount === 1 ? "it" : "them";
  const heading = action === "create" ? "Apply to Existing Plants?" : "Apply Changes to Existing Copies?";
  const body =
    action === "create"
      ? `You have ${eligibleCount} planted ${plantWord} of this variety. Want to add this schedule to ${themWord} too?`
      : `You have ${eligibleCount} planted ${plantWord} with copies of this schedule. Update ${themWord} to match the new settings?`;
  const showSubPrompt = action === "edit" && locallyEditedCount > 0;
  const subPromptText =
    locallyEditedCount === 1
      ? "1 of these was locally edited. Overwrite local edits too?"
      : `${locallyEditedCount} of these were locally edited. Overwrite local edits too?`;
  const applyLabel = `Apply to ${eligibleCount} ${plantWord.charAt(0).toUpperCase() + plantWord.slice(1)}`;

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      await onApply(overwriteLocal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't apply changes — please try again.");
      setApplying(false);
      return;
    }
    setApplying(false);
    setOverwriteLocal(false);
  };

  const handleCancel = () => {
    if (applying) return;
    setOverwriteLocal(false);
    setError(null);
    onCancel();
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={handleCancel} />
      <div
        className="fixed left-4 right-4 bottom-4 z-[101] bg-white rounded-2xl shadow-xl p-5 mx-auto max-w-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="care-cascade-confirm-title"
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 id="care-cascade-confirm-title" className="font-semibold text-neutral-900 text-base">
            {heading}
          </h2>
          <ModalCloseButton onClick={handleCancel} />
        </div>
        <p className="text-sm text-neutral-500 mb-4">{body}</p>

        {showSubPrompt && (
          <label className="flex items-start gap-2 mb-4 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={overwriteLocal}
              onChange={(e) => setOverwriteLocal(e.target.checked)}
              className="mt-1 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              disabled={applying}
            />
            <span className="text-sm text-neutral-700">
              {subPromptText}
              <span className="block text-xs text-neutral-500 mt-0.5">Overwrite locally edited copies</span>
            </span>
          </label>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={applying}
            className="flex-1 min-h-[44px] rounded-xl border border-teal-gus/40 text-teal-gus font-medium text-sm hover:bg-teal-gus/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {applying && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
            {applyLabel}
          </button>
        </div>
      </div>
    </>
  );
}
