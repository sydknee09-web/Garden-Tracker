"use client";

import { useState, useEffect } from "react";
import { ICON_MAP, FAB_MENU_SHADOW_CLASS } from "@/lib/styleDictionary";

export type UniversalAddMenuScreen = "main" | "add-plant";

export interface UniversalAddMenuProps {
  open: boolean;
  onClose: () => void;
  /** Current pathname for From Vault navigation context */
  pathname: string;
  /** When on Garden page: "active" | "plants" for Add plant default type */
  gardenTab?: "active" | "plants";
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

  useEffect(() => {
    if (open) setScreen("main");
  }, [open]);

  if (!open) return null;

  const defaultPlantType = gardenTab === "plants" ? "permanent" : "seasonal";

  const handleAddPlantFromVault = () => {
    onClose();
    onAddPlantFromVault();
  };

  const handleAddPlantManual = () => {
    onClose();
    onAddPlantManual(defaultPlantType);
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20" aria-hidden onClick={onClose} />
      <div
        className={`fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[100] rounded-3xl bg-white border border-neutral-200/80 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto ${FAB_MENU_SHADOW_CLASS}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="universal-add-title"
      >
        {screen === "main" && (
          <>
            <h2 id="universal-add-title" className="text-xl font-bold text-center text-neutral-900 mb-1">Add</h2>
            <p className="text-sm text-neutral-500 text-center mb-4">What would you like to add?</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { onClose(); onAddSeed(); }}
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
                onClick={() => setScreen("add-plant")}
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
                onClick={() => { onClose(); onAddToShed(); }}
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
                onClick={() => { onClose(); onAddTask(); }}
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
                onClick={() => { onClose(); onAddJournal(); }}
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
          </>
        )}

        {screen === "add-plant" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setScreen("main")} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-teal-gus hover:bg-teal-gus/10 -ml-1" aria-label="Back">
                <ICON_MAP.Back className="w-5 h-5" />
              </button>
              <h2 id="universal-add-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">Add plant</h2>
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
                    <div className="text-xs font-normal text-neutral-500">Screenshot of cart or order with seeds</div>
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
          </>
        )}
      </div>
    </>
  );
}
