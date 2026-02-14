"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "garden-dev-unlocked";

const DeveloperUnlockContext = createContext<{
  isUnlocked: boolean;
  tapVersion: () => void;
  reset: () => void;
}>({ isUnlocked: false, tapVersion: () => {}, reset: () => {} });

export function DeveloperUnlockProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const tapCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setIsUnlocked(true);
  }, []);

  const tapVersion = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    tapCountRef.current += 1;
    if (tapCountRef.current >= 7) {
      setIsUnlocked(true);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "true");
      tapCountRef.current = 0;
    } else {
      timeoutRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000);
    }
  }, []);

  const reset = useCallback(() => {
    setIsUnlocked(false);
    tapCountRef.current = 0;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <DeveloperUnlockContext.Provider value={{ isUnlocked, tapVersion, reset }}>
      {children}
    </DeveloperUnlockContext.Provider>
  );
}

export function useDeveloperUnlock() {
  return useContext(DeveloperUnlockContext);
}
