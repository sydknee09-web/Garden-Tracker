"use client";

import { useState, useEffect } from "react";
import { ICON_MAP, FAB_MENU_SHADOW_CLASS } from "@/lib/styleDictionary";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useUniversalAddModals } from "@/contexts/UniversalAddContext";
import { TaskForm } from "@/components/NewTaskModal";
import { JournalEntryForm } from "@/components/QuickLogModal";
import { SupplyForm } from "@/components/QuickAddSupply";
import { SeedPacketForm } from "@/components/QuickAddSeed";
import { AddPlantModal } from "@/components/AddPlantModal";
import { PlantingForm } from "@/components/PlantingForm";
import { AddVarietyForm } from "@/components/AddVarietyModal";

export type UniversalAddMenuScreen = "main" | "add-plant" | "add-plant-manual" | "add-plant-from-vault" | "seed" | "shed" | "task" | "journal" | "variety";

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
  onAddPlantPurchaseOrder,
  onAddPlantPhotoImport,
  onSeedOpenBatch,
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
  const { openShed, pendingMenuScreen, clearPendingMenuScreen } = useUniversalAddModals();

  useEffect(() => {
    if (open) {
      // If a caller requested a specific sub-screen via openMenuOnScreen (e.g. Back arrow on
      // BatchAddSupply restoring "shed" sub-menu), honor it. Otherwise reset to "main".
      setScreen(pendingMenuScreen ?? "main");
      setScreenDirection("forward");
      if (pendingMenuScreen) clearPendingMenuScreen();
    }
    // Dep list intentionally only watches `open` so a stale-while-open pendingMenuScreen update
    // doesn't cause mid-flow screen jumps. The screen target is read at the open-transition moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Preload page-local-state modal chunks when the FAB menu opens so chip-tap-to-mount has no
  // perceptible gap. These modals are imported via next/dynamic on every page mount for code-split
  // bundle savings, but the lazy fetch (~100-300ms first time) shows as a visual void between
  // menu unmount and modal paint — exactly the gap VISION §7 "No perceptible gap when transitioning
  // from menu to target modal" (locked 2026-05-08) forbids. Preload-on-open warms the chunk cache
  // by the time the user navigates the sub-screen + taps the chip (~500ms+ in real usage). Fire-
  // and-forget; if user closes the menu before preload completes, the next open re-fires (cheap,
  // browser caches modules after first fetch).
  useEffect(() => {
    if (!open) return;
    void import("@/components/BatchAddSeed").catch(() => {});
    void import("@/components/BatchAddSupply").catch(() => {});
    void import("@/components/PurchaseOrderImport").catch(() => {});
  }, [open]);

  useBodyScrollLock(open);

  if (!open) return null;

  const handleAddPlantManual = () => {
    setScreenDirection("forward");
    setScreen("add-plant-manual");
  };

  const slideClass = screenDirection === "forward" ? "animate-submenu-slide-forward" : "animate-submenu-slide-back";
  const goBackToMain = () => { setScreenDirection("back"); setScreen("main"); };
  const goBackToAddPlant = () => { setScreenDirection("back"); setScreen("add-plant"); };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20 animate-fade-in" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-none">
      <div
        className={`relative w-full max-w-md rounded-3xl bg-white border border-neutral-200/80 max-h-[85svh] flex flex-col overflow-hidden animate-fab-menu-enter pointer-events-auto ${FAB_MENU_SHADOW_CLASS}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="universal-add-title"
      >
        {screen === "main" && (
          <div key="main" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
            <div className="flex-shrink-0 px-6 pt-6 pb-4">
              <h2 id="universal-add-title" className="text-xl font-bold text-center text-neutral-900 mb-1">Add</h2>
              <p className="text-sm text-neutral-500 text-center">What would you like to add?</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { setScreenDirection("forward"); setScreen("variety"); }}
                  className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.Plant className="w-5 h-5" /></span>
                  <div>
                    <div>Add Variety</div>
                    <div className="text-xs font-normal text-neutral-500">Save to your plant encyclopedia</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setScreenDirection("forward"); setScreen("seed"); }}
                  className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.SeedPacket className="w-5 h-5" /></span>
                  <div>
                    <div>Add Seed Packet</div>
                    <div className="text-xs font-normal text-neutral-500">Seeds for your vault</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setScreenDirection("forward"); setScreen("add-plant"); }}
                  className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.Tree className="w-5 h-5" /></span>
                  <div>
                    <div>Add Plant</div>
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
                    <div>Add to Shed</div>
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
                    <div>Add Task</div>
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
                    <div>Add Journal</div>
                    <div className="text-xs font-normal text-neutral-500">Log growth, harvest, notes</div>
                  </div>
                </button>
              </div>
            </div>
            <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200">
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium min-h-[44px] hover:bg-teal-gus/10">Cancel</button>
            </div>
          </div>
        )}

        {screen === "add-plant" && (
          <div key="add-plant" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
            <div className="flex-shrink-0 px-6 pt-6 pb-4">
              <div className="flex items-center gap-2 mb-4">
                <button type="button" onClick={goBackToMain} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-teal-gus hover:bg-teal-gus/10 -ml-1" aria-label="Back">
                  <ICON_MAP.Back className="w-5 h-5" />
                </button>
                <h2 id="universal-add-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">Add Plant</h2>
                <div className="w-11 shrink-0" aria-hidden />
              </div>
              <p className="text-xs font-medium text-neutral-500 mb-2">Add to</p>
              <div className="flex gap-2 mb-2">
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
              <p className="text-sm text-neutral-500 text-center">How do you want to add a plant?</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleAddPlantManual}
                  className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.ManualEntry className="w-5 h-5" /></span>
                  <div>
                    <div>Manual Entry</div>
                    <div className="text-xs font-normal text-neutral-500">Enter name, variety, notes</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setScreenDirection("forward"); setScreen("add-plant-from-vault"); }}
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
                      <div>Scan Purchase Order</div>
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
                      <div>Photo Import</div>
                      <div className="text-xs font-normal text-neutral-500">Multi-photo, extract plant tags</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200">
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium min-h-[44px] hover:bg-teal-gus/10">Cancel</button>
            </div>
          </div>
        )}

        {screen === "add-plant-manual" && (
          <div key="add-plant-manual" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
            <AddPlantModal
              open
              embedded
              onClose={onClose}
              onBackToMenu={goBackToAddPlant}
              defaultPlantType={addPlantDefaultType}
              stayInGarden={pathname.startsWith("/garden")}
              hidePlantTypeToggle={pathname.startsWith("/garden")}
            />
          </div>
        )}

        {screen === "add-plant-from-vault" && (
          <div key="add-plant-from-vault" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
            <div className="flex-shrink-0 px-6 pt-6 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goBackToAddPlant}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-teal-gus hover:bg-teal-gus/10 -ml-1"
                  aria-label="Back"
                >
                  <ICON_MAP.Back className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-neutral-900 flex-1 text-center">Planting</h2>
                <div className="w-11 shrink-0" aria-hidden />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
              <PlantingForm
                profileIds={[]}
                fromGarden={pathname.startsWith("/garden")}
                mode="modal"
                onSaved={onClose}
              />
            </div>
          </div>
        )}

        {screen === "seed" && (
          <div key="seed" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
            <SeedPacketForm
              onClose={onClose}
              onSuccess={onClose}
              onBack={goBackToMain}
              onOpenBatch={onSeedOpenBatch}
              onOpenPurchaseOrder={onSeedOpenPurchaseOrder}
              onStartManualImport={onSeedStartManualImport}
            />
          </div>
        )}

        {screen === "shed" && (
          <div key="shed" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
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
          <div key="task" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
            <TaskForm
              onClose={onClose}
              onBack={goBackToMain}
            />
          </div>
        )}

        {screen === "journal" && (
          <div key="journal" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
            <JournalEntryForm
              onClose={onClose}
              onAddSupplyFromEmptyState={(name) => { onClose(); openShed(name); }}
              onBack={goBackToMain}
            />
          </div>
        )}

        {screen === "variety" && (
          <div key="variety" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
            <AddVarietyForm
              onClose={onClose}
              onSuccess={onClose}
              onBack={goBackToMain}
            />
          </div>
        )}
      </div>
      </div>
    </>
  );
}
