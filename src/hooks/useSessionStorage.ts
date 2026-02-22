"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Persist state to sessionStorage. Survives navigation within the app.
 * @param key - sessionStorage key
 * @param defaultValue - initial value if key is missing
 * @param serialize/deserialize - optional; defaults to JSON
 */
export function useSessionStorage<T>(
  key: string,
  defaultValue: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
): [T, (value: T | ((prev: T) => T)) => void] {
  const serialize = options?.serialize ?? ((v: T) => JSON.stringify(v));
  const deserialize = options?.deserialize ?? ((s: string) => JSON.parse(s) as T);

  const [stored, setStored] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const item = sessionStorage.getItem(key);
      if (item == null) return defaultValue;
      return deserialize(item);
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(key, serialize(next));
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [key, serialize]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.storageArea === sessionStorage && e.newValue != null) {
        try {
          setStored(deserialize(e.newValue));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, deserialize]);

  return [stored, setValue];
}
