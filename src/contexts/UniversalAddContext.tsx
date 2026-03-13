"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type UniversalAddModal = "seed" | "shed" | "plant" | "task" | "journal" | null;

type UniversalAddContextValue = {
  addMenuOpen: boolean;
  setAddMenuOpen: (open: boolean) => void;
  activeModal: UniversalAddModal;
  addPlantDefaultType: "permanent" | "seasonal";
  setAddPlantDefaultType: (t: "permanent" | "seasonal") => void;
  openMenu: () => void;
  closeMenu: () => void;
  openSeed: () => void;
  openShed: () => void;
  openPlant: (type?: "permanent" | "seasonal") => void;
  openTask: () => void;
  openJournal: () => void;
  closeActiveModal: () => void;
  /** Close current add modal and re-open the FAB menu (e.g. back from QuickAddSupply choose screen). */
  backToMenu: () => void;
  /** Close menu and any open add modal (e.g. for escape or browser back). */
  closeAll: () => void;
};

const UniversalAddContext = createContext<UniversalAddContextValue | undefined>(undefined);

export function UniversalAddProvider({ children }: { children: React.ReactNode }) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<UniversalAddModal>(null);
  const [addPlantDefaultType, setAddPlantDefaultType] = useState<"permanent" | "seasonal">("seasonal");

  const closeMenu = useCallback(() => setAddMenuOpen(false), []);
  const openMenu = useCallback(() => setAddMenuOpen(true), []);
  const closeActiveModal = useCallback(() => setActiveModal(null), []);

  const openSeed = useCallback(() => {
    setAddMenuOpen(false);
    setActiveModal("seed");
  }, []);

  const openShed = useCallback(() => {
    setAddMenuOpen(false);
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
    openPlant,
    openTask,
    openJournal,
    closeActiveModal,
    backToMenu,
    closeAll,
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
