"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

export type VaultContextType = {
  refetchTrigger: number;
  refetch: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
};

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const refetch = useCallback(() => {
    setRefetchTrigger((t) => t + 1);
  }, []);

  const value: VaultContextType = {
    refetchTrigger,
    refetch,
    scrollContainerRef,
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextType {
  const ctx = useContext(VaultContext);
  if (ctx === undefined) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return ctx;
}

/** Optional hook: returns context value or null when outside VaultProvider (for components used in and out of vault). */
export function useVaultOptional(): VaultContextType | null {
  return useContext(VaultContext) ?? null;
}
