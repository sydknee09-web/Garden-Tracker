"use client";

import { useState, useEffect } from "react";
import { ICON_MAP, FAB_MENU_SHADOW_CLASS } from "@/lib/styleDictionary";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useUniversalAddModals } from "@/contexts/UniversalAddContext";
import { TaskForm } from "@/components/NewTaskModal";
import { JournalEntryForm } from "@/components/QuickLogModal";
import { SupplyForm } from "@/components/QuickAddSupply";
import { SeedPacketForm } from "@/components/QuickAddSeed";

export type UniversalAddMenuScreen = "main" | "add-plant" | "seed" | "shed" | "task" | "journal";

export interface UniversalAddMenuProps {
  open: boolean;
  onClose: () => void;
  /** Current pathname for From Vault navigation context */
  pathname: string;
  /** When on Garden page: "active" | "plants" for Add plant default type */
  gardenTab?: "active" | "plants";
  /** Add plant type: permanent (My Plants) or seasonal (Active Garden). From UniversalAddContext. */
  addPlantDefaultType: "permanent" | "seasonal";
  /** Update add plant type. From UniversalAddContext. */
  setAddPlantDefaultType: (t: "permanent" | "seasonal") => void;
  /** Open AddPlantModal with given default type */
  onAddPlantManual: (defaultType: "permanent" | "seasonal") => void;
  /** Navigate to /vault/plant with from param */
  onAddPlantFromVault: () => void;
  /** Open Purchase Order import (screenshot of cart/order with plants); adds to vault */
  onAddPlantPurchaseOrder?: () => void;
  /** Open Photo Import (multi-photo, extract plant tags); same flow as Add seed packet Photo Import */
  onAddPlantPhotoImport?: () => void;
  // U28 fix (2026-05-20): cross-flow callbacks for the in-menu SeedPacketForm + SupplyForm.
  // Wraps the same callbacks each page already passes to its standalone modal mounts, but
  // close the MENU (closeAll) instead of the standalone modal (closeActiveModal) since
  // these fire from the menu's "seed" / "shed" sub-screens, not from a standalone modal.
  /** In-menu SeedPacketForm Photo Import button (BatchAddSeed). */
  onSeedOpenBatch?: () => void;
  /** In-menu SeedPacketForm Link Import button (navigate to /vault/import). */
  onSeedOpenLinkImport?: () => void;
  /** In-menu SeedPacketForm Purchase Order button (PurchaseOrderImport modal). */
  onSeedOpenPurchaseOrder?: () => void;
  /** In-menu SeedPacketForm save-no-match handoff (navigate to /vault/import/manual). */
  onSeedStartManualImport?: () => void;
  /** In-menu SupplyForm Purchase Order button (PurchaseOrderImport modal). */
  onSupplyOpenPurchaseOrder?: () => void;
  /** In-menu SupplyForm Photo Import button (BatchAddSupply OR navigate). */
  onSupplyOpenBatchPhotoImport?: () => void;
}

/**
 * UniversalAddMenu — the FAB add-button menu.
 *
 * Path Y (U7 corrective refactor) — all 5 picks slide in-place inside the same menu container.
 * The menu never unmounts during the add-button flow. Forms live INSIDE the menu via the
 * extracted <TaskForm> / <JournalEntryForm> / <SupplyForm> / <SeedPacketForm> sub-components.
 *
 * The 4 standalone modal shells (NewTaskModal / QuickLogModal / QuickAddSupply / QuickAddSeed)
 * remain mounted on each page for non-add-button callers (onboarding "Observe Hillside",
 * calendar ?openTask=1 deep-link, QuickLog cross-modal "+ Add New Supply", vault Plant Again,
 * etc.) — they're driven by `activeModal === "..."` from UniversalAddContext, not by this menu.
 */
export function UniversalAddMenu({
  open,
  onClose,
  pathname,
  gardenTab = "active",
  addPlantDefaultType,
  setAddPlantDefaultType,
  onAddPlantManual,
  onAddPlantFromVault,
  onAddPlantPurchaseOrder,
  onAddPlantPhotoImport,
  onSeedOpenBatch,
  onSeedOpenLinkImport,
  onSeedOpenPurchaseOrder,
  onSeedStartManualImport,
  onSupplyOpenPurchaseOrder,
  onSupplyOpenBatchPhotoImport,
}: UniversalAddMenuProps) {
  const [screen, setScreen] = useState<UniversalAddMenuScreen>("main");
  // Direction tracks forward / back nav so submenu slide animation reads correctly. See docs/VISION.md §4.
  const [screenDirection, setScreenDirection] = useState<"forward" | "back">("forward");

  // Cross-modal handoff: when JournalEntryForm's "+ Add New Supply" empty-state fires,
  // close the menu and open the standalone QuickAddSupply with prefill. Q1 Option B
  // (locked 2026-05-19) — accept the regression that the menu doesn't auto-resume on
  // the journal sub-screen after QuickAddSupply closes; user re-opens menu manually.
  const { openShed } = useUniversalAddModals();

  useEffect(() => {
    if (open) {
      setScreen("main");
      setScreenDirection("forward");
    }
  }, [open]);

  useBodyScrollLock(open);

  if (!open) return null;

  const handleAddPlantFromVault = () => {
    onClose();
    onAddPlantFromVault();
  };

  const handleAddPlantManual = () => {
    onClose();
    onAddPlantManual(addPlantDefaultType);
  };

  const slideClass = screenDirection === "forward" ? "animate-submenu-slide-forward" : "animate-submenu-slide-back";
  const goBackToMain = () => { setScreenDirection("back"); setScreen("main"); };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20 animate-fade-in" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-none">
      <div
        className={`relative w-full max-w-md rounded-3xl bg-white border border-neutral-200/80 p-6 max-h-[85svh] overflow-y-auto animate-fab-menu-enter pointer-events-auto ${FAB_MENU_SHADOW_CLASS}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="universal-add-title"
      >
        {screen === "main" && (
          <div key="main" className={slideClass}>
            <h2 id="universal-add-title" className="text-xl font-bold text-center text-neutral-900 mb-1">Add</h2>
            <p className="text-sm text-neutral-500 text-center mb-4">What would you like to add?</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { setScreenDirection("forward"); setScreen("seed"); }}
                className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.Seed className="w-5 h-5" /></span>
                <div>
                  <div>Add seed packet</div>
                  <div className="text-xs font-normal text-neutral-500">Seeds for your vault</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setScreenDirection("forward"); setScreen("add-plant"); }}
                className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.Plant className="w-5 h-5" /></span>
                <div>
                  <div>Add plant</div>
                  <div className="text-xs font-normal text-neutral-500">Trees, perennials, or seasonal</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setScreenDirection("forward"); setScreen("shed"); }}
                className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.Shed className="w-5 h-5" /></span>
                <div>
                  <div>Add to shed</div>
                  <div className="text-xs font-normal text-neutral-500">Fertilizer, soil, supplies</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setScreenDirection("forward"); setScreen("task"); }}
                className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.Task className="w-5 h-5" /></span>
                <div>
                  <div>Add task</div>
                  <div className="text-xs font-normal text-neutral-500">Reminder or to-do for calendar</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setScreenDirection("forward"); setScreen("journal"); }}
                className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.Journal className="w-5 h-5" /></span>
                <div>
                  <div>Add journal</div>
                  <div className="text-xs font-normal text-neutral-500">Log growth, harvest, notes</div>
                </div>
              </button>
            </div>
            <div className="pt-4">
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium min-h-[44px] hover:bg-teal-gus/10">Cancel</button>
            </div>
          </div>
        )}

        {screen === "add-plant" && (
          <div key="add-plant" className={slideClass}>
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={goBackToMain} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-teal-gus hover:bg-teal-gus/10 -ml-1" aria-label="Back">
                <ICON_MAP.Back className="w-5 h-5" />
              </button>
              <h2 id="universal-add-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">Add plant</h2>
            </div>
            <p className="text-xs font-medium text-neutral-500 mb-2">Add to</p>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setAddPlantDefaultType("permanent")}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border min-h-[44px] ${addPlantDefaultType === "permanent" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                My Plants
              </button>
              <button
                type="button"
                onClick={() => setAddPlantDefaultType("seasonal")}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border min-h-[44px] ${addPlantDefaultType === "seasonal" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                Active Garden
              </button>
            </div>
            <p className="text-sm text-neutral-500 text-center mb-4">How do you want to add a plant?</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleAddPlantManual}
                className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.ManualEntry className="w-5 h-5" /></span>
                <div>
                  <div>Manual entry</div>
                  <div className="text-xs font-normal text-neutral-500">Enter name, variety, notes</div>
                </div>
              </button>
              <button
                type="button"
                onClick={handleAddPlantFromVault}
                className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.Plant className="w-5 h-5" /></span>
                <div>
                  <div>From Vault</div>
                  <div className="text-xs font-normal text-neutral-500">Plant from your existing vault</div>
                </div>
              </button>
              {onAddPlantPurchaseOrder && (
                <button
                  type="button"
                  onClick={() => { onClose(); onAddPlantPurchaseOrder(); }}
                  className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.PurchaseOrder className="w-5 h-5" /></span>
                  <div>
                    <div>Scan purchase order</div>
                    <div className="text-xs font-normal text-neutral-500">Screenshot of cart or order with plants</div>
                  </div>
                </button>
              )}
              {onAddPlantPhotoImport && (
                <button
                  type="button"
                  onClick={() => { onClose(); onAddPlantPhotoImport(); }}
                  className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.PhotoImport className="w-5 h-5" /></span>
                  <div>
                    <div>Photo import</div>
                    <div className="text-xs font-normal text-neutral-500">Multi-photo, extract plant tags</div>
                  </div>
                </button>
              )}
            </div>
            <div className="pt-4">
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium min-h-[44px] hover:bg-teal-gus/10">Cancel</button>
            </div>
          </div>
        )}

        {screen === "seed" && (
          <div key="seed" className={slideClass}>
            <SeedPacketForm
              onClose={onClose}
              onSuccess={onClose}
              onBack={goBackToMain}
              onOpenBatch={onSeedOpenBatch}
              onOpenLinkImport={onSeedOpenLinkImport}
              onOpenPurchaseOrder={onSeedOpenPurchaseOrder}
              onStartManualImport={onSeedStartManualImport}
            />
          </div>
        )}

        {screen === "shed" && (
          <div key="shed" className={slideClass}>
            <SupplyForm
              onClose={onClose}
              onSuccess={onClose}
              onBack={goBackToMain}
              onOpenPurchaseOrder={onSupplyOpenPurchaseOrder}
              onOpenBatchPhotoImport={onSupplyOpenBatchPhotoImport}
            />
          </div>
        )}

        {screen === "task" && (
          <div key="task" className={slideClass}>
            <TaskForm
              onClose={onClose}
              onBack={goBackToMain}
            />
          </div>
        )}

        {screen === "journal" && (
          <div key="journal" className={slideClass}>
            <JournalEntryForm
              onClose={onClose}
              onAddSupplyFromEmptyState={(name) => { onClose(); openShed(name); }}
              onBack={goBackToMain}
            />
          </div>
        )}
      </div>
      </div>
    </>
  );
}
