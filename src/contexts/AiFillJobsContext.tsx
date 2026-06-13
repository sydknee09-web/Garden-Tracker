"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/useToast";
import { aiFillJobToastContent, type AiFillResultSummary } from "@/lib/aiFillToast";

/**
 * Global AI Fill job tracking (backgrounding ship, 2026-06-11). Jobs are durable
 * rows in ai_fill_jobs written by /api/ai-fill/enqueue; this provider keeps the
 * user's active set in sync via Supabase realtime so:
 *   - the profile page restores the button spinner mid-job — the sole running
 *     indicator (per-field shimmer dropped 2026-06-11 after dogfood: shimmering
 *     only the empty cells read as a broken patchwork next to static filled ones)
 *     (NORTH_STAR §2 — the app carries the job state, not the user), and
 *   - the completion toast fires on ANY page, with a View action back to the
 *     profile hub (§3), through the existing useToast primitive (§1 — no second
 *     toast system).
 *
 * Toast rule (no toast-on-every-app-open): toast fires for (a) live
 * complete/failed realtime events, and (b) reconciliation completions of jobs
 * this session is actively tracking (covers events missed while the phone was
 * locked). Cold-start fetches load only ACTIVE jobs, so historical completions
 * never toast.
 */

/** Jobs stuck active past this read as dead (enqueue function timeout/crash) — UI stops spinning; the daily sweeper marks them failed server-side. */
const STALE_ACTIVE_MS = 15 * 60 * 1000;
/** Reconciliation poll cadence while jobs are active but the realtime channel isn't joined. */
const FALLBACK_POLL_MS = 10_000;

export type AiFillActiveJob = {
  jobId: string;
  profileId: string;
  overwrite: boolean;
  enqueuedAt: string;
};

export type AiFillCompletedJob = {
  jobId: string;
  profileId: string;
  status: "complete" | "failed";
  summary: AiFillResultSummary;
  /** Date.now() when this client observed the completion — page effects key off jobId, not time. */
  observedAt: number;
};

type JobRow = {
  id: string;
  plant_profile_id: string;
  status: string;
  overwrite?: boolean | null;
  enqueued_at?: string | null;
  result_summary?: AiFillResultSummary | null;
};

type AiFillJobsContextValue = {
  /** Active (pending/running, non-stale) jobs keyed by plant_profile_id. */
  activeJobs: Record<string, AiFillActiveJob>;
  /** Most recently observed completion — profile pages watch this to refetch + clear local state. */
  lastCompleted: AiFillCompletedJob | null;
  /** Enqueue a background AI Fill for a profile. Resolves fast; progress arrives via activeJobs/lastCompleted. */
  enqueue: (profileId: string, overwrite: boolean) => Promise<{ ok: boolean; error?: string }>;
};

const AiFillJobsContext = createContext<AiFillJobsContextValue | null>(null);

function isFreshActive(row: JobRow): boolean {
  if (row.status !== "pending" && row.status !== "running") return false;
  const enqueued = row.enqueued_at ? new Date(row.enqueued_at).getTime() : 0;
  return Date.now() - enqueued < STALE_ACTIVE_MS;
}

export function AiFillJobsProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const router = useRouter();
  const { toast, showToast } = useToast();

  const [activeJobs, setActiveJobs] = useState<Record<string, AiFillActiveJob>>({});
  const [lastCompleted, setLastCompleted] = useState<AiFillCompletedJob | null>(null);

  const activeJobsRef = useRef(activeJobs);
  activeJobsRef.current = activeJobs;
  /** jobIds already toasted — realtime + reconciliation can both observe the same completion. */
  const toastedRef = useRef<Set<string>>(new Set());
  const channelJoinedRef = useRef(false);

  const addActive = useCallback((row: JobRow) => {
    setActiveJobs((prev) => {
      const existing = prev[row.plant_profile_id];
      if (existing && existing.jobId === row.id) return prev;
      return {
        ...prev,
        [row.plant_profile_id]: {
          jobId: row.id,
          profileId: row.plant_profile_id,
          overwrite: Boolean(row.overwrite),
          enqueuedAt: row.enqueued_at ?? new Date().toISOString(),
        },
      };
    });
  }, []);

  const removeActive = useCallback((profileId: string, jobId: string) => {
    setActiveJobs((prev) => {
      if (prev[profileId]?.jobId !== jobId) return prev;
      const next = { ...prev };
      delete next[profileId];
      return next;
    });
  }, []);

  const handleCompletion = useCallback(
    (row: JobRow) => {
      removeActive(row.plant_profile_id, row.id);
      if (toastedRef.current.has(row.id)) return;
      toastedRef.current.add(row.id);
      const summary: AiFillResultSummary = row.result_summary ?? {};
      const status = row.status === "failed" ? "failed" : "complete";
      setLastCompleted({ jobId: row.id, profileId: row.plant_profile_id, status, summary, observedAt: Date.now() });
      const { message, variant } = aiFillJobToastContent(summary);
      const profileId = row.plant_profile_id;
      showToast(message, {
        variant,
        action: { label: "View", onAction: () => router.push(`/library/${profileId}`) },
      });
    },
    [removeActive, router, showToast]
  );

  /** Live realtime event for one row. */
  const handleLiveRow = useCallback(
    (row: JobRow | undefined) => {
      if (!row?.id || !row.plant_profile_id) return;
      if (row.status === "complete" || row.status === "failed") {
        handleCompletion(row);
      } else if (isFreshActive(row)) {
        addActive(row);
      }
    },
    [addActive, handleCompletion]
  );

  /**
   * Reconciliation: refetch the active set; tracked jobs that vanished from it
   * completed while we weren't listening (locked phone, dropped channel) — fetch
   * their rows and run completion handling. Also the fallback poll body.
   */
  const reconcile = useCallback(async () => {
    if (!user) return;
    const { data: rows, error } = await supabase
      .from("ai_fill_jobs")
      .select("id, plant_profile_id, status, overwrite, enqueued_at, result_summary")
      .eq("user_id", user.id)
      .in("status", ["pending", "running"]);
    if (error) return;
    const fresh = ((rows ?? []) as JobRow[]).filter(isFreshActive);
    const freshIds = new Set(fresh.map((r) => r.id));
    const missing = Object.values(activeJobsRef.current).filter((j) => !freshIds.has(j.jobId));

    setActiveJobs(() => {
      const next: Record<string, AiFillActiveJob> = {};
      for (const row of fresh) {
        next[row.plant_profile_id] = {
          jobId: row.id,
          profileId: row.plant_profile_id,
          overwrite: Boolean(row.overwrite),
          enqueuedAt: row.enqueued_at ?? new Date().toISOString(),
        };
      }
      return next;
    });

    if (missing.length > 0) {
      const { data: doneRows } = await supabase
        .from("ai_fill_jobs")
        .select("id, plant_profile_id, status, overwrite, enqueued_at, result_summary")
        .in("id", missing.map((j) => j.jobId));
      for (const row of (doneRows ?? []) as JobRow[]) {
        if (row.status === "complete" || row.status === "failed") handleCompletion(row);
      }
    }
  }, [user, handleCompletion]);

  // Realtime subscription + initial snapshot per signed-in user.
  useEffect(() => {
    if (!user) {
      setActiveJobs({});
      return;
    }
    let cancelled = false;
    const channel = supabase
      .channel(`ai-fill-jobs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_fill_jobs", filter: `user_id=eq.${user.id}` },
        (payload: { new: unknown }) => {
          if (!cancelled) handleLiveRow(payload.new as JobRow);
        }
      )
      .subscribe((status: string) => {
        channelJoinedRef.current = status === "SUBSCRIBED";
        // (Re)join → reconcile to catch anything missed while detached.
        if (status === "SUBSCRIBED" && !cancelled) void reconcile();
      });
    void reconcile();
    return () => {
      cancelled = true;
      channelJoinedRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, [user, handleLiveRow, reconcile]);

  // Missed-event recovery on tab/app foreground (locked phone, backgrounded PWA).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Object.keys(activeJobsRef.current).length > 0) {
        void reconcile();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reconcile]);

  // Bounded fallback: poll only while jobs are active AND realtime isn't joined.
  useEffect(() => {
    if (Object.keys(activeJobs).length === 0) return;
    const interval = setInterval(() => {
      if (!channelJoinedRef.current) void reconcile();
    }, FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [activeJobs, reconcile]);

  const enqueue = useCallback(
    async (profileId: string, overwrite: boolean): Promise<{ ok: boolean; error?: string }> => {
      const token = session?.access_token;
      if (!token) return { ok: false, error: "Not signed in" };
      try {
        const res = await fetch("/api/ai-fill/enqueue", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ profileId, ...(overwrite ? { overwrite: true } : {}) }),
        });
        const data = (await res.json().catch(() => ({}))) as { jobId?: string; error?: string };
        if (!res.ok || !data.jobId) return { ok: false, error: data.error || "Could not start AI fill" };
        // Optimistic add; the realtime INSERT/UPDATE for the same jobId merges idempotently.
        addActive({
          id: data.jobId,
          plant_profile_id: profileId,
          status: "running",
          overwrite,
          enqueued_at: new Date().toISOString(),
        });
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not start AI fill" };
      }
    },
    [session?.access_token, addActive]
  );

  const value = useMemo<AiFillJobsContextValue>(
    () => ({ activeJobs, lastCompleted, enqueue }),
    [activeJobs, lastCompleted, enqueue]
  );

  return (
    <AiFillJobsContext.Provider value={value}>
      {children}
      {toast}
    </AiFillJobsContext.Provider>
  );
}

export function useAiFillJobs(): AiFillJobsContextValue {
  const ctx = useContext(AiFillJobsContext);
  if (!ctx) throw new Error("useAiFillJobs must be used within AiFillJobsProvider");
  return ctx;
}
