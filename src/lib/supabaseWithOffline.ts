/**
 * Supabase write helpers that queue failed writes to IndexedDB when offline or on network error.
 * OfflineIndicator replays queued writes when the user reconnects.
 */

import { supabase } from "@/lib/supabase";
import { enqueueWrite } from "@/lib/offlineQueue";
import { logEvent } from "@/lib/debugLog";

/** Detect network/connectivity errors from Supabase or thrown errors. */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as { message?: string }).message ?? "").toLowerCase();
  const code = String((err as { code?: string }).code ?? "").toLowerCase();
  // Common network/offline indicators
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch")) return true;
  if (msg.includes("connection") || msg.includes("timeout") || msg.includes("econnrefused")) return true;
  if (code === "pgrst301" || code === "jwt_expired") return false; // auth/session, not network
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return false;
}

export type InsertResult = { data: unknown; error: { message: string } | null };
export type UpdateResult = { error: { message: string } | null };
export type UpsertResult = { data: unknown; error: { message: string } | null };
export type DeleteResult = { error: { message: string } | null };

/**
 * Insert with offline queue. On network failure, enqueues and returns success so UI can update optimistically.
 */
export async function insertWithOfflineQueue(
  table: string,
  payload: Record<string, unknown>,
): Promise<InsertResult> {
  const t0 = Date.now();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!online) {
    await enqueueWrite({ table, operation: "insert", payload });
    logEvent("db", "queued", { table, op: "insert", online });
    return { data: null, error: null };
  }
  const { data, error } = await supabase.from(table).insert(payload);
  if (error && isNetworkError(error)) {
    await enqueueWrite({ table, operation: "insert", payload });
    logEvent("db", "queued", { table, op: "insert", online, ms: Date.now() - t0 });
    return { data: null, error: null };
  }
  logEvent("db", error ? "error" : "ok", {
    table,
    op: "insert",
    ms: Date.now() - t0,
    ...(error ? { message: error.message } : {}),
  });
  return { data, error };
}

/**
 * Update with offline queue. filters are applied as .eq(key, value) for each entry.
 */
export async function updateWithOfflineQueue(
  table: string,
  payload: Record<string, unknown>,
  filters: Record<string, string | number | boolean>,
): Promise<UpdateResult> {
  const t0 = Date.now();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!online) {
    await enqueueWrite({ table, operation: "update", payload, filters });
    logEvent("db", "queued", { table, op: "update", online });
    return { error: null };
  }
  let query = supabase.from(table).update(payload);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { error } = await query;
  if (error && isNetworkError(error)) {
    await enqueueWrite({ table, operation: "update", payload, filters });
    logEvent("db", "queued", { table, op: "update", online, ms: Date.now() - t0 });
    return { error: null };
  }
  logEvent("db", error ? "error" : "ok", {
    table,
    op: "update",
    ms: Date.now() - t0,
    ...(error ? { message: error.message } : {}),
  });
  return { error };
}

/**
 * Bulk insert with offline queue. On network failure, enqueues each row individually.
 */
export async function insertManyWithOfflineQueue(
  table: string,
  rows: Record<string, unknown>[],
): Promise<InsertResult> {
  if (rows.length === 0) return { data: null, error: null };
  const t0 = Date.now();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!online) {
    for (const payload of rows) {
      await enqueueWrite({ table, operation: "insert", payload });
    }
    logEvent("db", "queued", { table, op: "insert_many", count: rows.length, online });
    return { data: null, error: null };
  }
  const { data, error } = await supabase.from(table).insert(rows);
  if (error && isNetworkError(error)) {
    for (const payload of rows) {
      await enqueueWrite({ table, operation: "insert", payload });
    }
    logEvent("db", "queued", { table, op: "insert_many", count: rows.length, online, ms: Date.now() - t0 });
    return { data: null, error: null };
  }
  logEvent("db", error ? "error" : "ok", {
    table,
    op: "insert_many",
    count: rows.length,
    ms: Date.now() - t0,
    ...(error ? { message: error.message } : {}),
  });
  return { data, error };
}

/**
 * Upsert with offline queue. Supports optional onConflict for replay.
 */
export async function upsertWithOfflineQueue(
  table: string,
  payload: Record<string, unknown>,
  options?: { onConflict?: string },
): Promise<UpsertResult> {
  const t0 = Date.now();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const enqueue = async () => {
    await enqueueWrite({
      table,
      operation: "upsert",
      payload,
      upsertOnConflict: options?.onConflict,
    });
  };
  if (!online) {
    await enqueue();
    logEvent("db", "queued", { table, op: "upsert", online });
    return { data: null, error: null };
  }
  const { data, error } = await supabase.from(table).upsert(payload, options);
  if (error && isNetworkError(error)) {
    await enqueue();
    logEvent("db", "queued", { table, op: "upsert", online, ms: Date.now() - t0 });
    return { data: null, error: null };
  }
  logEvent("db", error ? "error" : "ok", {
    table,
    op: "upsert",
    ms: Date.now() - t0,
    ...(error ? { message: error.message } : {}),
  });
  return { data, error };
}

/**
 * Delete with offline queue. filters are applied as .eq(key, value) for each entry.
 * Use for tables that allow hard delete (e.g. shopping_list). Protected tables use soft delete.
 */
export async function deleteWithOfflineQueue(
  table: string,
  filters: Record<string, string | number | boolean>,
): Promise<DeleteResult> {
  const t0 = Date.now();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!online) {
    await enqueueWrite({ table, operation: "delete", payload: {}, filters });
    logEvent("db", "queued", { table, op: "delete", online });
    return { error: null };
  }
  let query = supabase.from(table).delete();
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { error } = await query;
  if (error && isNetworkError(error)) {
    await enqueueWrite({ table, operation: "delete", payload: {}, filters });
    logEvent("db", "queued", { table, op: "delete", online, ms: Date.now() - t0 });
    return { error: null };
  }
  logEvent("db", error ? "error" : "ok", {
    table,
    op: "delete",
    ms: Date.now() - t0,
    ...(error ? { message: error.message } : {}),
  });
  return { error };
}
