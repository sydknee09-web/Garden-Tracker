"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getPendingWrites, removeWrite, incrementRetry } from "@/lib/offlineQueue";
import type { QueuedWrite } from "@/lib/offlineQueue";

const MAX_RETRIES = 5;

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Track online/offline status
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setDismissed(false); // Reset so it shows again next time offline
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Replay queued writes when coming back online
  const replayWrites = useCallback(async () => {
    if (replaying || !isOnline) return;
    setReplaying(true);

    try {
      const writes = await getPendingWrites();
      setPendingCount(writes.length);

      if (writes.length === 0) {
        setReplaying(false);
        return;
      }

      for (const write of writes) {
        if (write.retries >= MAX_RETRIES) {
          await removeWrite(write.id);
          continue;
        }

        try {
          await replayOneWrite(write);
          await removeWrite(write.id);
          setPendingCount((c) => Math.max(0, c - 1));
        } catch {
          await incrementRetry(write.id);
        }
      }
    } catch {
      // IndexedDB access failed -- ignore silently
    } finally {
      setReplaying(false);
    }
  }, [replaying, isOnline]);

  // Auto-replay when online status changes
  useEffect(() => {
    if (isOnline) {
      replayWrites();
    }
  }, [isOnline, replayWrites]);

  // Check pending count periodically
  useEffect(() => {
    const check = async () => {
      try {
        const writes = await getPendingWrites();
        setPendingCount(writes.length);
      } catch {
        // Ignore
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Only show toast when offline and not dismissed; rely on header cloud icon for syncing/synced status
  if (isOnline || dismissed) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 pl-4 pr-12 rounded-xl shadow-lg text-sm font-medium bg-amber-600 text-white text-center max-w-[min(20rem,calc(100vw-2rem))] flex items-center justify-center gap-2 relative"
      role="status"
      aria-live="polite"
    >
      <span>Offline — will sync when reconnected</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-amber-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Dismiss offline message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}

async function replayOneWrite(write: QueuedWrite): Promise<void> {
  const { table, operation, payload, filters } = write;

  switch (operation) {
    case "insert": {
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
      break;
    }
    case "update": {
      let query = supabase.from(table).update(payload);
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value as string);
        }
      }
      const { error } = await query;
      if (error) throw error;
      break;
    }
    case "upsert": {
      const opts = (write as QueuedWrite & { upsertOnConflict?: string }).upsertOnConflict
        ? { onConflict: (write as QueuedWrite & { upsertOnConflict?: string }).upsertOnConflict! }
        : undefined;
      const { error } = await supabase.from(table).upsert(payload, opts);
      if (error) throw error;
      break;
    }
    case "delete": {
      // Law 2: protected tables must use soft delete; never hard-delete on replay
      const protectedTables = ["plant_profiles", "seed_packets", "journal_entries", "grow_instances", "tasks", "supply_profiles"];
      if (protectedTables.includes(table)) {
        let updateQuery = supabase.from(table).update({ deleted_at: new Date().toISOString() });
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            updateQuery = updateQuery.eq(key, value as string);
          }
        }
        const { error } = await updateQuery;
        if (error) throw error;
      } else {
        let query = supabase.from(table).delete();
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value as string);
          }
        }
        const { error } = await query;
        if (error) throw error;
      }
      break;
    }
  }
}
