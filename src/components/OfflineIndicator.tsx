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

  // Track online/offline status
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
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

  // Only show toast when offline; rely on header cloud icon for syncing/synced status
  if (isOnline) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium bg-amber-600 text-white text-center max-w-[min(20rem,calc(100vw-2rem))]"
      role="status"
      aria-live="polite"
    >
      Offline — will sync when reconnected
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
      const protectedTables = ["plant_profiles", "seed_packets", "journal_entries", "grow_instances", "tasks"];
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
