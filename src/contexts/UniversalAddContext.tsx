"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type UniversalAddModal = "seed" | "shed" | "plant" | "task" | "journal" | "variety" | null;

/** Sub-screens of UniversalAddMenu. Mirrors the union in UniversalAddMenu.tsx; lives here so callers can
 * request a specific sub-screen when reopening the menu (e.g. Back arrow on BatchAddSupply returns to
 * "shed" sub-menu, not "main"). */
export type UniversalAddMenuScreenTarget =
  | "main"
  | "add-plant"
  | "add-plant-manual"
  | "seed"
  | "shed"
  | "task"
  | "journal"
  | "variety";

type UniversalAddContextValue = {
  addMenuOpen: boolean;
  setAddMenuOpen: (open: boolean) => void;
  activeModal: UniversalAddModal;
  addPlantDefaultType: "permanent" | "seasonal";
  setAddPlantDefaultType: (t: "permanent" | "seasonal") => void;
  openMenu: () => void;
  closeMenu: () => void;
  openSeed: () => void;
  /** Open shed modal. Pass search string to pre-fill QuickAddSupply name (e.g. from QuickLog "+ Add New Supply"). */
  openShed: (initialName?: string) => void;
  shedInitialName: string;
  openPlant: (type?: "permanent" | "seasonal") => void;
  openTask: () => void;
  openJournal: () => void;
  closeActiveModal: () => void;
  /** Close current add modal and re-open the FAB menu (e.g. back from QuickAddSupply choose screen).
   * IMPORTANT: only closes `activeModal`-managed modals. For page-local-state modals
   * (BatchAddSeed/BatchAddSupply/PlantingFlowModal), the caller MUST also close its own local state
   * BEFORE calling backToMenu — otherwise the menu reopens at z-[100] on top of the still-mounted
   * modal at z-[60]/[70]. Prefer openMenuOnScreen for those modals — it returns to the correct
   * parent sub-screen instead of resetting to "main". */
  backToMenu: () => void;
  /** Close menu and any open add modal (e.g. for escape or browser back). */
  closeAll: () => void;
  /** Request the menu to open on a specific sub-screen. Sets pendingMenuScreen + clears activeModal
   * + opens menu. UniversalAddMenu's open-transition useEffect reads pendingMenuScreen and clears
   * it after consumption. For page-local-state modals (BatchAddSeed/BatchAddSupply/PlantingFlow),
   * caller closes local state BEFORE calling this. */
  openMenuOnScreen: (screen: UniversalAddMenuScreenTarget) => void;
  /** Pending sub-screen the menu should open on (consumed by UniversalAddMenu on next open). */
  pendingMenuScreen: UniversalAddMenuScreenTarget | null;
  /** Consumer-side clear of pendingMenuScreen (call after reading on menu open). */
  clearPendingMenuScreen: () => void;
};

const UniversalAddContext = createContext<UniversalAddContextValue | undefined>(undefined);

export function UniversalAddProvider({ children }: { children: React.ReactNode }) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<UniversalAddModal>(null);
  const [addPlantDefaultType, setAddPlantDefaultType] = useState<"permanent" | "seasonal">("seasonal");
  const [shedInitialName, setShedInitialName] = useState("");
  const [pendingMenuScreen, setPendingMenuScreen] = useState<UniversalAddMenuScreenTarget | null>(null);

  const closeMenu = useCallback(() => setAddMenuOpen(false), []);
  const openMenu = useCallback(() => setAddMenuOpen(true), []);
  const closeActiveModal = useCallback(() => setActiveModal(null), []);

  const openSeed = useCallback(() => {
    setAddMenuOpen(false);
    setActiveModal("seed");
  }, []);

  const openShed = useCallback((initialName?: string) => {
    setAddMenuOpen(false);
    setShedInitialName(initialName ?? "");
    setActiveModal("shed");
  }, []);

  const openPlant = useCallback((type: "permanent" | "seasonal" = "seasonal") => {
    setAddMenuOpen(false);
    setAddPlantDefaultType(type);
    setActiveModal("plant");
  }, []);

  const openTask = useCallback(() => {
    setAddMenuOpen(false);
    setActiveModal("task");
  }, []);

  const openJournal = useCallback(() => {
    setAddMenuOpen(false);
    setActiveModal("journal");
  }, []);

  const backToMenu = useCallback(() => {
    setActiveModal(null);
    setAddMenuOpen(true);
  }, []);

  const closeAll = useCallback(() => {
    setActiveModal(null);
    setAddMenuOpen(false);
  }, []);

  const openMenuOnScreen = useCallback((screen: UniversalAddMenuScreenTarget) => {
    setPendingMenuScreen(screen);
    setActiveModal(null);
    setAddMenuOpen(true);
  }, []);

  const clearPendingMenuScreen = useCallback(() => {
    setPendingMenuScreen(null);
  }, []);

  const value: UniversalAddContextValue = {
    addMenuOpen,
    setAddMenuOpen,
    activeModal,
    addPlantDefaultType,
    setAddPlantDefaultType,
    openMenu,
    closeMenu,
    openSeed,
    openShed,
    shedInitialName,
    openPlant,
    openTask,
    openJournal,
    closeActiveModal,
    backToMenu,
    closeAll,
    openMenuOnScreen,
    pendingMenuScreen,
    clearPendingMenuScreen,
  };

  return (
    <UniversalAddContext.Provider value={value}>
      {children}
    </UniversalAddContext.Provider>
  );
}

export function useUniversalAddModals(): UniversalAddContextValue {
  const ctx = useContext(UniversalAddContext);
  if (ctx === undefined) {
    throw new Error("useUniversalAddModals must be used within UniversalAddProvider");
  }
  return ctx;
}
