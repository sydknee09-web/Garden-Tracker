"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

type SyncContextValue = {
  syncing: boolean;
  setSyncing: (value: boolean) => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const countRef = useRef(0);
  const setSyncingStable = useCallback((value: boolean) => {
    if (value) {
      countRef.current += 1;
      setSyncing(true);
    } else {
      countRef.current = Math.max(0, countRef.current - 1);
      setSyncing(countRef.current > 0);
    }
  }, []);
  return (
    <SyncContext.Provider value={{ syncing, setSyncing: setSyncingStable }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) return { syncing: false, setSyncing: () => {} };
  return ctx;
}
