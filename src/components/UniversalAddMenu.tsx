"use client";

import { useState, useEffect } from "react";

export type UniversalAddMenuScreen = "main" | "add-plant" | "add-journal";

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
  /** Open QuickAddSupply (has its own chooser) */
  onAddToShed: () => void;
  /** Open task form (navigate to calendar or open modal) */
  onAddTask: () => void;
  /** Add journal: mode determines flow */
  onAddJournal: (mode: "snapshot" | "quick" | "detailed") => void;
}

function SeedIcon() {
  return (
    <span className="text-xl" aria-hidden>🌱</span>
  );
}
function PlantIcon() {
  return (
    <span className="text-xl" aria-hidden>🌿</span>
  );
}
function ShedIcon() {
  return (
    <span className="text-xl" aria-hidden>🧾</span>
  );
}
function TaskIcon() {
  return (
    <span className="text-xl" aria-hidden>📅</span>
  );
}
function JournalIcon() {
  return (
    <span className="text-xl" aria-hidden>📖</span>
  );
}
function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function UniversalAddMenu({
  open,
  onClose,
  pathname,
  gardenTab = "active",
  onAddSeed,
  onAddPlantManual,
  onAddPlantFromVault,
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
      <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={onClose} />
      <div
        className="fixed left-4 right-4 bottom-20 z-50 rounded-3xl bg-white border border-neutral-200/80 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
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
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0"><SeedIcon /></span>
                <div>
                  <div>Add seed</div>
                  <div className="text-xs font-normal text-neutral-500">Seeds for your vault</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setScreen("add-plant")}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0"><PlantIcon /></span>
                <div>
                  <div>Add plant</div>
                  <div className="text-xs font-normal text-neutral-500">Trees, perennials, or seasonal</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onAddToShed(); }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0"><ShedIcon /></span>
                <div>
                  <div>Add to shed</div>
                  <div className="text-xs font-normal text-neutral-500">Fertilizer, soil, supplies</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onAddTask(); }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0"><TaskIcon /></span>
                <div>
                  <div>Add task</div>
                  <div className="text-xs font-normal text-neutral-500">Reminder or to-do for calendar</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setScreen("add-journal")}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0"><JournalIcon /></span>
                <div>
                  <div>Add journal</div>
                  <div className="text-xs font-normal text-neutral-500">Log growth, harvest, notes</div>
                </div>
              </button>
            </div>
            <div className="pt-4">
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]">Cancel</button>
            </div>
          </>
        )}

        {screen === "add-plant" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setScreen("main")} className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1" aria-label="Back">
                <BackIcon />
              </button>
              <h2 id="universal-add-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">Add plant</h2>
            </div>
            <p className="text-sm text-neutral-500 text-center mb-4">How do you want to add a plant?</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleAddPlantManual}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📝</span>
                Manual Entry
              </button>
              <button
                type="button"
                onClick={handleAddPlantFromVault}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>🌿</span>
                From Vault
              </button>
            </div>
            <div className="pt-4">
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]">Cancel</button>
            </div>
          </>
        )}

        {screen === "add-journal" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setScreen("main")} className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1" aria-label="Back">
                <BackIcon />
              </button>
              <h2 id="universal-add-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">Add journal</h2>
            </div>
            <p className="text-sm text-neutral-500 text-center mb-4">How do you want to log?</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { onClose(); onAddJournal("snapshot"); }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📸</span>
                Snapshot
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onAddJournal("quick"); }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📝</span>
                Quick note
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onAddJournal("detailed"); }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📋</span>
                Detailed log
              </button>
            </div>
            <div className="pt-4">
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]">Cancel</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
