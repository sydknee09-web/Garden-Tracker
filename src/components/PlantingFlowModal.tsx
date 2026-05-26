"use client";

import { ICON_MAP } from "@/lib/styleDictionary";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { PlantingForm } from "@/components/PlantingForm";

interface PlantingFlowModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after the celebration completes (parent typically refetches lists). */
  onSuccess: () => void;
  /** When provided, renders a Back arrow that returns to the parent menu (e.g. FAB tree). */
  onBack?: () => void;
  /** Pre-selected profile ids; defaults to [] for FAB flow (user picks via in-form Add Seed). */
  profileIds?: string[];
  /** Indicates the launch surface — when true, post-save redirect logic favours garden context.
   * Modal mode doesn't redirect (just closes + onSuccess) — kept for parity with PlantingForm prop. */
  fromGarden?: boolean;
}

/**
 * PlantingFlowModal — bottom-sheet shell that mounts <PlantingForm mode="modal">.
 *
 * Item 1 of the FAB-tree modal-consistency cluster: replaces the
 * router.push("/vault/plant?from=…") full-page exit so the FAB-tree "Add plant
 * → From Vault" pick stays in the modal flow.
 *
 * Phone: bottom-sheet, ~90% screen height, slides up from bottom.
 * iPad+ / desktop: centered card, max-w-2xl, max-h-[90vh].
 *
 * The /vault/plant page route remains alive for non-FAB callers (Calendar
 * Plantable "Plant" button, Vault toolbar batch-select Plant) — those still
 * pass ?ids= and hit the page shell directly.
 */
export function PlantingFlowModal({
  open,
  onClose,
  onSuccess,
  onBack,
  profileIds = [],
  fromGarden = false,
}: PlantingFlowModalProps) {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl border border-neutral-200/80 max-h-[90vh] sm:max-h-[90vh] flex flex-col animate-modal-slide-up"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        role="dialog"
        aria-labelledby="planting-flow-modal-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-6 pt-5 pb-3 flex-shrink-0">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex-shrink-0 p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Back"
            >
              <ICON_MAP.Back stroke="currentColor" className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-11 shrink-0" aria-hidden />
          )}
          <h2 id="planting-flow-modal-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">
            Planting
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <ICON_MAP.Close stroke="currentColor" className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <PlantingForm
            profileIds={profileIds}
            fromGarden={fromGarden}
            mode="modal"
            onSaved={() => {
              onSuccess();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
