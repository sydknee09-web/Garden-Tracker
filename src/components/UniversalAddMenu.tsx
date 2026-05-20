"use client";

import { useState, useEffect, useRef } from "react";
import { ICON_MAP, FAB_MENU_SHADOW_CLASS } from "@/lib/styleDictionary";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

// Belt-and-suspenders fallback in case onAnimationEnd doesn't fire (slow device, animation preempt).
// 200ms = 150ms fab-menu-exit duration + 50ms safety margin.
const EXIT_FALLBACK_MS = 200;

export type UniversalAddMenuScreen = "main" | "add-plant";

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
  /** Open QuickAddSeed (has its own Manual/Photo/Link/PO chooser) */
  onAddSeed: () => void;
  /** Open AddPlantModal with given default type */
  onAddPlantManual: (defaultType: "permanent" | "seasonal") => void;
  /** Navigate to /vault/plant with from param */
  onAddPlantFromVault: () => void;
  /** Open Purchase Order import (screenshot of cart/order with seeds); adds to vault */
  onAddPlantPurchaseOrder?: () => void;
  /** Open Photo Import (multi-photo, extract plant tags); same flow as Add seed packet Photo Import */
  onAddPlantPhotoImport?: () => void;
  /** Open QuickAddSupply (has its own chooser) */
  onAddToShed: () => void;
  /** Open task form (navigate to calendar or open modal) */
  onAddTask: () => void;
  /** Navigate to add journal entry */
  onAddJournal: () => void;
}

export function UniversalAddMenu({
  open,
  onClose,
  pathname,
  gardenTab = "active",
  addPlantDefaultType,
  setAddPlantDefaultType,
  onAddSeed,
  onAddPlantManual,
  onAddPlantFromVault,
  onAddPlantPurchaseOrder,
  onAddPlantPhotoImport,
  onAddToShed,
  onAddTask,
  onAddJournal,
}: UniversalAddMenuProps) {
  const [screen, setScreen] = useState<UniversalAddMenuScreen>("main");
  // Direction tracks forward / back nav so submenu slide animation reads correctly. See docs/VISION.md §4.
  const [screenDirection, setScreenDirection] = useState<"forward" | "back">("forward");
  // Exit choreography: when user picks a target modal entry, the menu plays fab-menu-exit
  // and on animationend (or fallback timeout) calls onClose() + the target opener. This makes
  // the 5 entry points share one transition language (menu fades-down, target slides-up at the
  // same anchor) instead of the prior close-then-open glitch.
  const [isExiting, setIsExiting] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setScreen("main");
      setScreenDirection("forward");
      setIsExiting(false);
      pendingActionRef.current = null;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    }
  }, [open]);

  // Cleanup any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, []);

  useBodyScrollLock(open);

  if (!open) return null;

  const runPending = () => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsExiting(false);
    if (action) {
      onClose();
      action();
    }
  };

  const beginExit = (action: () => void) => {
    if (isExiting) return; // guard double-tap during exit animation
    pendingActionRef.current = action;
    setIsExiting(true);
    fallbackTimerRef.current = setTimeout(runPending, EXIT_FALLBACK_MS);
  };

  const handleClose = () => {
    // Cancel any pending action; user explicitly dismissed.
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    pendingActionRef.current = null;
    setIsExiting(false);
    onClose();
  };

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    // Animation events bubble; only the exit keyframe on the panel itself triggers the open.
    if (e.animationName === "fab-menu-exit") {
      runPending();
    }
  };

  const handleAddPlantFromVault = () => {
    beginExit(onAddPlantFromVault);
  };

  const handleAddPlantManual = () => {
    beginExit(() => onAddPlantManual(addPlantDefaultType));
  };

  const slideClass = screenDirection === "forward" ? "animate-submenu-slide-forward" : "animate-submenu-slide-back";
  const panelAnimationClass = isExiting ? "animate-fab-menu-exit" : "animate-fab-menu-enter";

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20 animate-fade-in" aria-hidden onClick={handleClose} />
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-20 sm:pb-4 pointer-events-none">
      <div
        className={`relative w-full max-w-md rounded-3xl bg-white border border-neutral-200/80 p-6 max-h-[85svh] overflow-y-auto ${panelAnimationClass} pointer-events-auto ${FAB_MENU_SHADOW_CLASS}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="universal-add-title"
        onAnimationEnd={handleAnimationEnd}
      >
        {screen === "main" && (
          <div key="main" className={slideClass}>
            <h2 id="universal-add-title" className="text-xl font-bold text-center text-neutral-900 mb-1">Add</h2>
            <p className="text-sm text-neutral-500 text-center mb-4">What would you like to add?</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => beginExit(onAddSeed)}
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
                onClick={() => beginExit(onAddToShed)}
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
                onClick={() => beginExit(onAddTask)}
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
                onClick={() => beginExit(onAddJournal)}
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
              <button type="button" onClick={handleClose} className="w-full py-2.5 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium min-h-[44px] hover:bg-teal-gus/10">Cancel</button>
            </div>
          </div>
        )}

        {screen === "add-plant" && (
          <div key="add-plant" className={slideClass}>
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => { setScreenDirection("back"); setScreen("main"); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-teal-gus hover:bg-teal-gus/10 -ml-1" aria-label="Back">
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
                  onClick={() => onAddPlantPurchaseOrder && beginExit(onAddPlantPurchaseOrder)}
                  className="w-full py-4 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5"><ICON_MAP.PurchaseOrder className="w-5 h-5" /></span>
                  <div>
                    <div>Scan purchase order</div>
                    <div className="text-xs font-normal text-neutral-500">Screenshot of cart or order with seeds</div>
                  </div>
                </button>
              )}
              {onAddPlantPhotoImport && (
                <button
                  type="button"
                  onClick={() => onAddPlantPhotoImport && beginExit(onAddPlantPhotoImport)}
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
              <button type="button" onClick={handleClose} className="w-full py-2.5 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium min-h-[44px] hover:bg-teal-gus/10">Cancel</button>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
