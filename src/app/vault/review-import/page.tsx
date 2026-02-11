"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  getReviewImportData,
  setReviewImportData,
  clearReviewImportData,
  type ReviewImportItem,
} from "@/lib/reviewImportStorage";
import { parseVarietyWithModifiers } from "@/lib/varietyModifiers";
import { getCanonicalKey } from "@/lib/canonicalKey";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { applyZone10bToProfile } from "@/data/zone10b_schedule";
import { stripVarietySuffixes } from "@/app/api/seed/extract/route";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Clean AI-returned URL: trim and strip surrounding quotes so validation doesn't reject valid URLs. */
function cleanHeroUrl(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["']|["']$/g, "");
}

/**
 * Normalize vendor image URL: trim, strip quotes, protocol-relative -> https, decode URI.
 * Use for display and storage so complex URLs (e.g. Select Seeds) work.
 */
function formatVendorUrl(url: string): string {
  let s = (url ?? "").trim().replace(/^["']|["']$/g, "");
  if (s.startsWith("//")) s = "https:" + s;
  try {
    s = decodeURIComponent(s);
  } catch {
    // leave as-is if decode fails
  }
  return s.trim();
}

/** Golden Record: vendor priority for display (Johnny's cleanest, Rare Seeds fallback). */
const GOLDEN_RECORD_VENDOR_PRIORITY = ["Johnny's", "Select Seeds", "Botanical Interests", "Rare Seeds"];

function vendorMatchesPriority(vendorLabel: string, priority: string): boolean {
  const v = vendorLabel.trim().toLowerCase();
  if (priority === "Johnny's") return v.includes("johnny");
  if (priority === "Select Seeds") return v.includes("select");
  if (priority === "Botanical Interests") return v.includes("botanical");
  if (priority === "Rare Seeds") return v.includes("rare");
  return v.includes(priority.toLowerCase());
}

/** Returns the variety name from the highest-priority vendor in the merged group (same identityKey). Uses cleanVariety for display when set. */
function getGoldenVarietyForGroup(items: ReviewImportItem[], identityKey: string | undefined): string | null {
  if (!identityKey?.trim()) return null;
  const group = items.filter((i) => (i.identityKey ?? "").trim() === identityKey);
  if (group.length === 0) return null;
  for (const priority of GOLDEN_RECORD_VENDOR_PRIORITY) {
    const match = group.find((i) => vendorMatchesPriority(i.vendor ?? "", priority));
    const label = (match?.cleanVariety ?? match?.variety ?? "").trim();
    if (label) return label;
  }
  return (group[0]?.cleanVariety ?? group[0]?.variety ?? "").trim() || null;
}

/** Returns the primary (golden) vendor name for the merged group for display. */
function getGoldenVendorForGroup(items: ReviewImportItem[], identityKey: string | undefined): string | null {
  if (!identityKey?.trim()) return null;
  const group = items.filter((i) => (i.identityKey ?? "").trim() === identityKey);
  if (group.length === 0) return null;
  for (const priority of GOLDEN_RECORD_VENDOR_PRIORITY) {
    const match = group.find((i) => vendorMatchesPriority(i.vendor ?? "", priority));
    if (match?.vendor?.trim()) return match.vendor.trim();
  }
  return (group[0]?.vendor ?? "").trim() || null;
}

/** Returns the item that is the golden source (highest-priority vendor) in the group, so we only show golden variety on that row. */
function getGoldenSourceItem(items: ReviewImportItem[], identityKey: string | undefined): ReviewImportItem | null {
  if (!identityKey?.trim()) return null;
  const group = items.filter((i) => (i.identityKey ?? "").trim() === identityKey);
  if (group.length === 0) return null;
  for (const priority of GOLDEN_RECORD_VENDOR_PRIORITY) {
    const match = group.find((i) => vendorMatchesPriority(i.vendor ?? "", priority) && (i.variety ?? "").trim());
    if (match) return match;
  }
  return group[0] ?? null;
}

/** Collapsible Technical Log panel: batch-level accordion, per-seed details with query and pass results. */
function LogPanel({
  logs,
  isOpen,
  onToggle,
}: {
  logs: ImportLogEntry[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const batches = Array.from(new Set(logs.map((l) => l.batchId)));
  const byBatch = batches.map((batchId) => ({
    batchId,
    entries: logs.filter((l) => l.batchId === batchId),
  }));

  if (logs.length === 0) return null;

  return (
    <div className="border border-black/10 rounded-xl bg-neutral-50/80 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2.5 px-3 text-left text-sm font-medium text-black/80 hover:bg-black/5"
        aria-expanded={isOpen}
      >
        <span>Technical Log</span>
        <span className="text-neutral-400 text-xs">{logs.length} entries</span>
        <span className="text-neutral-400">{isOpen ? "▼" : "▶"}</span>
      </button>
      {isOpen && (
        <div className="border-t border-black/10 max-h-[280px] overflow-y-auto">
          {byBatch.map(({ batchId, entries }) => {
            const batchOpen = expandedBatchId === batchId;
            const itemIds = Array.from(new Set(entries.map((e) => e.itemId)));
            const byItem = itemIds.map((itemId) => ({
              itemId,
              itemLabel: entries.find((e) => e.itemId === itemId)?.itemLabel ?? itemId.slice(0, 8),
              itemEntries: entries.filter((e) => e.itemId === itemId),
            }));
            return (
              <div key={batchId} className="border-b border-black/5 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedBatchId((prev) => (prev === batchId ? null : batchId))}
                  className="w-full flex items-center justify-between py-2 px-3 text-left text-xs font-medium text-black/70 hover:bg-black/5"
                >
                  <span>Batch {batchId.replace("batch-", "")}</span>
                  <span className="text-neutral-400">{batchOpen ? "▼" : "▶"}</span>
                </button>
                {batchOpen && (
                  <div className="pl-3 pr-2 pb-2 space-y-1">
                    {byItem.map(({ itemId, itemLabel, itemEntries }) => {
                      const itemOpen = expandedItemId === itemId;
                      const last = itemEntries[itemEntries.length - 1];
                      const status = last?.resultStatus ?? "pending";
                      return (
                        <div key={itemId} className="rounded-lg border border-black/5 bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedItemId((prev) => (prev === itemId ? null : itemId))}
                            className="w-full flex items-center justify-between py-1.5 px-2 text-left text-xs"
                          >
                            <span className="truncate font-medium text-black/80">{itemLabel || itemId.slice(0, 8)}</span>
                            <span
                              className={`shrink-0 ml-2 px-1.5 py-0.5 rounded text-xs ${
                                status === "success"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : status === "failed"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {status}
                            </span>
                            <span className="ml-1 text-neutral-400">{itemOpen ? "▼" : "▶"}</span>
                          </button>
                          {itemOpen && (
                            <div className="border-t border-black/5 px-2 py-1.5 space-y-1 text-xs text-neutral-600">
                              {itemEntries.map((entry, i) => (
                                <div key={i} className="flex flex-wrap gap-x-2 gap-y-0.5">
                                  <span>Pass {entry.passNumber}</span>
                                  <span title={entry.queryUsed} className="truncate max-w-[200px]">
                                    Query: {entry.queryUsed}
                                  </span>
                                  <span className={entry.resultStatus === "success" ? "text-emerald-600" : entry.resultStatus === "failed" ? "text-red-600" : "text-amber-600"}>
                                    {entry.resultStatus}
                                  </span>
                                  {entry.resultMessage && <span className="text-neutral-500">{entry.resultMessage}</span>}
                                  <span className="text-neutral-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Single entry for the Technical Log (hero search pass). */
export type ImportLogEntry = {
  timestamp: string;
  itemId: string;
  itemLabel: string;
  passNumber: number;
  queryUsed: string;
  resultStatus: "pending" | "success" | "failed";
  resultMessage?: string;
  batchId: string;
};

/** Persist a hero-photo pass to central import logs (Settings). Fire-and-forget so UI is not blocked. error_message is always set (mandatory diagnostic trace). */
function persistHeroSearchLog(
  item: ReviewImportItem,
  passNumber: number,
  success: boolean,
  statusCode: number,
  queryUsed: string,
  heroImageUrl?: string
): void {
  // Construct trace before any fetch — never null
  const error_message =
    "[Pass " + passNumber + "] " + (success ? "Success" : "Failed") + "\nQuery: " + (queryUsed || "—");
  const url = (item.source_url ?? "").trim() || "hero-search";
  (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    if (!token) {
      console.error("❌ LOGGING BLOCKED: No Auth Token");
      return;
    }
    const payload = {
      url,
      vendor_name: (item.vendor ?? "").trim() || null,
      status_code: statusCode,
      identity_key_generated: (item.identityKey ?? "").trim() || null,
      error_message,
      ...(success && heroImageUrl?.trim().startsWith("http") ? { hero_image_url: heroImageUrl.trim() } : {}),
    };
    console.info("🚀 LOGGING ATTEMPT:", payload);
    try {
      const res = await fetch("/api/settings/import-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.warn("[persistHeroSearchLog] request failed:", res.status, await res.text());
      }
    } catch (err) {
      console.warn("[persistHeroSearchLog]", err);
    }
  })();
}

/** True when the item has a real image URL: http(s), protocol-relative (//), or data:. No file extension required. */
function hasValidImageUrl(item: ReviewImportItem): boolean {
  const stock = (item.stock_photo_url ?? "").trim();
  const hero = (item.hero_image_url ?? "").trim();
  const base64 = (item.imageBase64 ?? "").trim();
  const valid = (s: string) =>
    s.length > 0 &&
    (s.startsWith("http") || s.startsWith("//") || s.startsWith("data:"));
  if (stock && valid(stock)) return true;
  if (base64) return true;
  if (hero && valid(hero)) return true;
  return false;
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64.includes(",") ? base64.split(",")[1] ?? base64 : base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || "image/jpeg" });
}

type ProfileMatch = {
  id: string;
  name: string;
  variety_name: string | null;
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
  botanical_care_notes?: Record<string, unknown> | null;
};

export default function ReviewImportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<ReviewImportItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileMatch[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingPhase, setSavingPhase] = useState("Saving\u2026");
  const [error, setError] = useState<string | null>(null);
  const [heroLoadingIds, setHeroLoadingIds] = useState<Set<string>>(new Set());
  const heroFetchedRef = useRef<Set<string>>(new Set());
  const heroFetchingRef = useRef<Set<string>>(new Set());
  const [heroGuardrailItemId, setHeroGuardrailItemId] = useState<string | null>(null);
  /** Item ids we tried in bulk search but no photo was found (show "No photo found" label) */
  const [noPhotoFoundIds, setNoPhotoFoundIds] = useState<Set<string>>(new Set());
  const [bulkHeroSearching, setBulkHeroSearching] = useState(false);
  const [importLogs, setImportLogs] = useState<ImportLogEntry[]>([]);
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const initialBatchIdRef = useRef<string | null>(null);

  useEffect(() => {
    const data = getReviewImportData();
    if (!data?.items?.length) {
      router.replace("/vault");
      return;
    }
    setItems(
      data.items.map((i) => ({
        ...i,
        variety: decodeHtmlEntities(i.variety ?? "") || (i.variety ?? ""),
        type: decodeHtmlEntities(i.type ?? "") || (i.type ?? ""),
        vendor: decodeHtmlEntities(i.vendor ?? "") || (i.vendor ?? ""),
        useStockPhotoAsHero: hasValidImageUrl(i) ? (i.useStockPhotoAsHero !== false) : false,
      }))
    );
  }, [router]);

  useEffect(() => {
    if (!user?.id || items.length === 0) return;
    supabase
      .from("plant_profiles")
      .select("id, name, variety_name, sun, plant_spacing, days_to_germination, harvest_days, botanical_care_notes")
      .eq("user_id", user.id)
      .then(({ data }) => setProfiles((data ?? []) as ProfileMatch[]));
  }, [user?.id, items.length]);

  // Run when item count is set (e.g. load from storage). [items.length] only — hero URL updates do not re-trigger.
  // Phase 0: fetch vault (import logs with status 200 + hero_image_url), then for each item missing hero either use vault URL (skip API) or call find-hero-photo. Always call persistHeroSearchLog for every API result (success or fail).
  useEffect(() => {
    if (items.length === 0) return;
    const batchId = initialBatchIdRef.current ?? `batch-${Date.now()}`;
    if (!initialBatchIdRef.current) initialBatchIdRef.current = batchId;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Phase 0 (Vault): build identity_key -> hero_image_url for entries with status 200 and stored URL
      const vaultMap = new Map<string, string>();
      if (token) {
        try {
          const res = await fetch("/api/settings/import-logs", { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const json = (await res.json()) as { logs?: { status_code?: number; hero_image_url?: string | null; identity_key_generated?: string | null }[] };
            const logs = json.logs ?? [];
            for (const log of logs) {
              if (log.status_code === 200 && typeof log.hero_image_url === "string" && log.hero_image_url.trim().startsWith("http") && log.identity_key_generated) {
                vaultMap.set(log.identity_key_generated.trim(), log.hero_image_url.trim());
              }
            }
          }
        } catch (_) {
          // non-fatal; we'll call find-hero-photo for all
        }
      }

      items.forEach((item) => {
        if (heroFetchedRef.current.has(item.id)) return;
        if (item.hero_image_url) return;
        const hasPhoto = (item.stock_photo_url ?? "").trim() || (item.hero_image_url ?? "").trim() || (item.imageBase64 ?? "").trim();
        if (hasPhoto) return;
        heroFetchedRef.current.add(item.id);
        heroFetchingRef.current.add(item.id);
        setHeroLoadingIds((prev) => new Set(prev).add(item.id));
        const searchName = (item.originalType ?? item.type ?? "").trim() || "Unknown";
        const searchVariety = (item.originalVariety ?? item.variety ?? "").trim();
        const queryUsed = `${searchName} ${searchVariety}`.trim() || "—";
        const itemLabel = (item.cleanVariety ?? item.variety ?? "").trim() || item.id.slice(0, 8);
        setImportLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            itemId: item.id,
            itemLabel,
            passNumber: 1,
            queryUsed,
            resultStatus: "pending" as const,
            batchId,
          },
        ]);

        const identityKey = (item.identityKey ?? "").trim();
        const vaultUrl = identityKey ? vaultMap.get(identityKey) : undefined;
        if (vaultUrl) {
          // Phase 0 hit: use saved URL, skip API call entirely
          setImportLogs((prev) => {
            const idx = prev.findIndex((l) => l.itemId === item.id && l.batchId === batchId && l.resultStatus === "pending");
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], resultStatus: "success", resultMessage: "Vault (Phase 0)" };
            return next;
          });
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, stock_photo_url: vaultUrl, hero_image_url: vaultUrl, useStockPhotoAsHero: true }
                : i
            )
          );
          heroFetchingRef.current.delete(item.id);
          setHeroLoadingIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
          return;
        }

        (async () => {
          let didLog = false;
          try {
            const res = await fetch("/api/seed/find-hero-photo", {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: searchName,
                variety: searchVariety,
                vendor: (item.vendor ?? "").trim(),
                scientific_name: (item.scientific_name ?? "").trim() || undefined,
                identity_key: identityKey || undefined,
              }),
            });
            const data = (await res.json()) as { hero_image_url?: string; image_url?: string; url?: string; error?: string };
            let raw = data.hero_image_url ?? data.image_url ?? data.url ?? "";
            let cleanedUrl = cleanHeroUrl(typeof raw === "string" ? raw : "");
            let success = cleanedUrl.startsWith("http");
            if (res.status === 0 && identityKey && token && !success) {
              try {
                const vaultRes = await fetch("/api/settings/import-logs", { headers: { Authorization: `Bearer ${token}` } });
                if (vaultRes.ok) {
                  const vaultJson = (await vaultRes.json()) as { logs?: { identity_key_generated?: string; status_code?: number; hero_image_url?: string }[] };
                  const entry = (vaultJson.logs ?? []).find(
                    (l) => l.identity_key_generated === identityKey && l.status_code === 200 && typeof l.hero_image_url === "string" && l.hero_image_url.trim().startsWith("http")
                  );
                  if (entry?.hero_image_url) {
                    cleanedUrl = cleanHeroUrl(entry.hero_image_url.trim());
                    if (cleanedUrl.startsWith("http")) success = true;
                  }
                }
              } catch (_) {
                /* non-fatal */
              }
            }
            setImportLogs((prev) => {
              const idx = prev.findIndex((l) => l.itemId === item.id && l.batchId === batchId && l.resultStatus === "pending");
              if (idx < 0) return prev;
              const next = [...prev];
              next[idx] = { ...next[idx], resultStatus: success ? "success" : "failed", resultMessage: success ? "Image found" : (data.error ?? "No image") };
              return next;
            });
            persistHeroSearchLog(item, 1, success, success ? 200 : res.status, queryUsed, success ? cleanedUrl : undefined);
            didLog = true;
            if (success) {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id
                    ? { ...i, stock_photo_url: cleanedUrl, hero_image_url: cleanedUrl, useStockPhotoAsHero: true }
                    : i
                )
              );
            }
          } catch (err) {
            setImportLogs((prev) => {
              const idx = prev.findIndex((l) => l.itemId === item.id && l.batchId === batchId && l.resultStatus === "pending");
              if (idx < 0) return prev;
              const next = [...prev];
              next[idx] = { ...next[idx], resultStatus: "failed", resultMessage: (err as Error)?.message ?? "Request failed" };
              return next;
            });
            persistHeroSearchLog(item, 1, false, 0, queryUsed);
            didLog = true;
          } finally {
            if (!didLog) {
              persistHeroSearchLog(item, 1, false, 0, queryUsed);
            }
            heroFetchingRef.current.delete(item.id);
            setHeroLoadingIds((prev) => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
            });
          }
        })();
      });
    })();
  }, [items.length, user?.id]);

  const updateItem = useCallback((id: string, updates: Partial<ReviewImportItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (next.length) setReviewImportData({ items: next });
      else clearReviewImportData();
      return next;
    });
    setNoPhotoFoundIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const mergeDuplicateIntoOriginal = useCallback((duplicateItem: ReviewImportItem) => {
    const key = duplicateItem.identityKey;
    if (!key) return;
    setItems((prev) => {
      const originalIndex = prev.findIndex((i) => i.identityKey === key && i.id !== duplicateItem.id);
      const original = originalIndex >= 0 ? prev[originalIndex] : null;
      if (!original) return prev;
      const urlToAdd = (duplicateItem.source_url ?? "").trim();
      const nextSecondary = [...(original.secondary_urls ?? []), ...(urlToAdd ? [urlToAdd] : [])];
      const next = prev
        .filter((i) => i.id !== duplicateItem.id)
        .map((i) =>
          i.id === original.id ? { ...i, secondary_urls: nextSecondary.length ? nextSecondary : undefined } : i
        );
      setReviewImportData({ items: next });
      return next;
    });
    setNoPhotoFoundIds((prev) => {
      const next = new Set(prev);
      next.delete(duplicateItem.id);
      return next;
    });
  }, []);

  const itemsMissingHero = items.filter((i) => !hasValidImageUrl(i));

  const handleFindMissingHeroPhotos = useCallback(async () => {
    const missing = itemsMissingHero;
    if (missing.length === 0) return;
    setBulkHeroSearching(true);
    setNoPhotoFoundIds(new Set());
    setHeroLoadingIds((prev) => {
      const next = new Set(prev);
      missing.forEach((i) => next.add(i.id));
      return next;
    });

    const batchId = `batch-${Date.now()}`;
    setImportLogs((prev) => [
      ...prev,
      ...missing.map((item) => ({
        timestamp: new Date().toISOString(),
        itemId: item.id,
        itemLabel: `${(item.type ?? "").trim()} ${(item.variety ?? "").trim()}`.trim() || item.id.slice(0, 8),
        passNumber: 1,
        queryUsed: `${(item.type ?? "").trim()} ${(item.variety ?? "").trim()}`.trim() || "—",
        resultStatus: "pending" as const,
        batchId,
      })),
    ]);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) authHeaders.Authorization = `Bearer ${token}`;

    const results = await Promise.all(
      missing.map(async (item) => {
        const searchName = (item.originalType ?? item.type ?? "").trim() || "Unknown";
        const searchVariety = (item.originalVariety ?? item.variety ?? "").trim();
        const queryUsed = `${searchName} ${searchVariety}`.trim() || "—";
        let didLog = false;
        try {
          const res = await fetch("/api/seed/find-hero-photo", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              name: searchName,
              variety: searchVariety,
              vendor: (item.vendor ?? "").trim(),
              scientific_name: (item.scientific_name ?? "").trim() || undefined,
              identity_key: (item.identityKey ?? "").trim() || undefined,
            }),
          });
          const data = (await res.json()) as {
            hero_image_url?: string;
            image_url?: string;
            url?: string;
            error?: string;
          };
          let raw = data.hero_image_url ?? data.image_url ?? data.url ?? "";
          let cleaned = cleanHeroUrl(typeof raw === "string" ? raw : "");
          let formatted = formatVendorUrl(cleaned);
          let url = formatted.startsWith("http") ? formatted : undefined;
          const identityKeyBulk = (item.identityKey ?? "").trim();
          if (res.status === 0 && identityKeyBulk && token && !url) {
            try {
              const vaultRes = await fetch("/api/settings/import-logs", { headers: { Authorization: `Bearer ${token}` } });
              if (vaultRes.ok) {
                const vaultJson = (await vaultRes.json()) as { logs?: { identity_key_generated?: string; status_code?: number; hero_image_url?: string }[] };
                const entry = (vaultJson.logs ?? []).find(
                  (l) => l.identity_key_generated === identityKeyBulk && l.status_code === 200 && typeof l.hero_image_url === "string" && l.hero_image_url.trim().startsWith("http")
                );
                if (entry?.hero_image_url) {
                  formatted = formatVendorUrl(cleanHeroUrl(entry.hero_image_url.trim()));
                  if (formatted.startsWith("http")) url = formatted;
                }
              }
            } catch (_) {
              /* non-fatal */
            }
          }
          const isError = !res.ok && !url;
          setImportLogs((prev) => {
            const idx = prev.findIndex((l) => l.itemId === item.id && l.batchId === batchId && l.resultStatus === "pending");
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              resultStatus: url ? "success" : "failed",
              resultMessage: url ? "Image found" : (data.error ?? "No image"),
            };
            return next;
          });
          persistHeroSearchLog(item, 1, !!url, url ? 200 : res.status, queryUsed, url);
          didLog = true;
          return {
            id: item.id,
            url,
            isError,
            variety: item.cleanVariety ?? item.variety ?? item.type ?? "",
          };
        } catch (err) {
          setImportLogs((prev) => {
            const idx = prev.findIndex((l) => l.itemId === item.id && l.batchId === batchId && l.resultStatus === "pending");
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], resultStatus: "failed", resultMessage: (err as Error)?.message ?? "Request failed" };
            return next;
          });
          persistHeroSearchLog(item, 1, false, 0, queryUsed);
          didLog = true;
          return {
            id: item.id,
            url: undefined,
            isError: true,
            variety: "",
          };
        } finally {
          if (!didLog) {
            persistHeroSearchLog(item, 1, false, 0, queryUsed);
          }
        }
      })
    );

    const notFound: string[] = [];
    const successList: { id: string; url: string; variety: string }[] = [];

    results.forEach((r) => {
      if (r.url) {
        const cleanedUrl = formatVendorUrl(r.url);
        successList.push({ id: r.id, url: cleanedUrl, variety: r.variety });
        setNoPhotoFoundIds((prev) => {
          const next = new Set(prev);
          next.delete(r.id);
          return next;
        });
        console.log("SUCCESS:", r.variety, "Cleaned URL:", cleanedUrl);
      } else if (!r.isError) {
        notFound.push(r.id);
      }
    });

    setItems((prev) => {
      const next = prev.map((i) => {
        const s = successList.find((x) => x.id === i.id);
        if (s?.url) {
          return {
            ...i,
            stock_photo_url: s.url,
            hero_image_url: s.url,
            useStockPhotoAsHero: true,
          };
        }
        return i;
      });
      // Persist to localStorage immediately so re-renders don't lose the new hero URLs
      setReviewImportData({ items: next });
      return next;
    });

    setNoPhotoFoundIds((prev) => {
      const next = new Set(prev);
      notFound.forEach((id) => next.add(id));
      return next;
    });
    setHeroLoadingIds((prev) => {
      const next = new Set(prev);
      missing.forEach((i) => next.delete(i.id));
      return next;
    });
    setBulkHeroSearching(false);
  }, [itemsMissingHero, user?.id]);

  const getExistingProfile = useCallback(
    (item: ReviewImportItem): ProfileMatch | null => {
      const name = (item.type ?? "").trim() || "Unknown";
      const { coreVariety } = parseVarietyWithModifiers(item.variety);
      const varietyName = (coreVariety || (item.variety ?? "").trim()) || "";
      const nameKey = getCanonicalKey(name);
      const varietyKey = getCanonicalKey(varietyName);
      const p = profiles.find(
        (x) =>
          getCanonicalKey(x.name ?? "") === nameKey &&
          getCanonicalKey(x.variety_name ?? "") === varietyKey
      );
      return p ?? null;
    },
    [profiles]
  );

  const hasExistingProfile = useCallback((item: ReviewImportItem) => getExistingProfile(item) != null, [getExistingProfile]);

  const careDiff = useCallback(
    (item: ReviewImportItem, profile: ProfileMatch): boolean => {
      const sun = (item.sun_requirement ?? "").trim();
      const spacing = (item.spacing ?? "").trim();
      const germ = (item.days_to_germination ?? "").trim();
      const mat = (item.days_to_maturity ?? "").trim();
      const firstNum = mat.match(/\d+/);
      const harvestDays = firstNum ? parseInt(firstNum[0], 10) : null;
      if (sun && (profile.sun ?? "").trim() !== sun) return true;
      if (spacing && (profile.plant_spacing ?? "").trim() !== spacing) return true;
      if (germ && (profile.days_to_germination ?? "").trim() !== germ) return true;
      if (harvestDays != null && (profile.harvest_days ?? null) !== harvestDays) return true;
      const itemSowing = (item.sowing_depth ?? "").trim();
      const profileSowing = profile.botanical_care_notes && typeof profile.botanical_care_notes === "object" && typeof profile.botanical_care_notes.sowing_depth === "string" ? profile.botanical_care_notes.sowing_depth : "";
      if (itemSowing && profileSowing !== itemSowing) return true;
      return false;
    },
    []
  );

  const updateVarietyDefaults = useCallback(
    async (item: ReviewImportItem) => {
      const profile = getExistingProfile(item);
      if (!profile || !user?.id) return;
      const sun = (item.sun_requirement ?? "").trim() || null;
      const spacing = (item.spacing ?? "").trim() || null;
      const germ = (item.days_to_germination ?? "").trim() || null;
      const mat = (item.days_to_maturity ?? "").trim();
      const firstNum = mat.match(/\d+/);
      const harvestDays = firstNum ? parseInt(firstNum[0], 10) : null;
      const careNotes: Record<string, unknown> = { ...(typeof profile.botanical_care_notes === "object" && profile.botanical_care_notes ? profile.botanical_care_notes : {}) };
      if ((item.sowing_depth ?? "").trim()) careNotes.sowing_depth = item.sowing_depth!.trim();
      if ((item.source_url ?? "").trim()) careNotes.source_url = item.source_url!.trim();
      await supabase
        .from("plant_profiles")
        .update({
          sun: sun ?? null,
          plant_spacing: spacing ?? null,
          days_to_germination: germ ?? null,
          harvest_days: harvestDays ?? null,
          ...(Object.keys(careNotes).length > 0 && { botanical_care_notes: careNotes }),
        })
        .eq("id", profile.id)
        .eq("user_id", user.id);
      const { data } = await supabase.from("plant_profiles").select("id, name, variety_name, sun, plant_spacing, days_to_germination, harvest_days, botanical_care_notes").eq("user_id", user.id);
      setProfiles((data ?? []) as ProfileMatch[]);
    },
    [getExistingProfile, user?.id]
  );

  useEffect(() => {
    if (items.length) setReviewImportData({ items });
  }, [items]);

  const handleSaveAll = useCallback(async () => {
    if (!user?.id || items.length === 0) return;
    setError(null);
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    const ensureRes = await fetch("/api/seed/ensure-storage-bucket", { method: "POST" });
    if (!ensureRes.ok) {
      setError((await ensureRes.json()).error ?? "Storage bucket unavailable");
      setSaving(false);
      return;
    }

    const newProfileIdsWithoutHero: string[] = [];
    const savedItems: { item: ReviewImportItem; profileId: string }[] = [];
    for (const item of items) {
      const name = (item.type ?? "").trim() || "Unknown";
      const varietyName = (item.variety ?? "").trim() || null;
      const isLinkImport = !(item.imageBase64?.trim());
      let path: string | null = null;
      if (!isLinkImport) {
        path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const blob = base64ToBlob(item.imageBase64!, "image/jpeg");
        const file = new File([blob], item.fileName || "packet.jpg", { type: "image/jpeg" });
        const { error: uploadErr } = await supabase.storage.from("seed-packets").upload(path, file, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (uploadErr) {
          setError(uploadErr.message);
          setSaving(false);
          return;
        }
      }

      const { coreVariety, tags: packetTags } = parseVarietyWithModifiers(item.variety);
      const coreVarietyName = coreVariety || varietyName;
      const zone10b = applyZone10bToProfile(name, {});
      const nameKey = getCanonicalKey(name);
      const varietyKey = getCanonicalKey(coreVarietyName ?? "");
      const { data: allProfiles } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name")
        .eq("user_id", user.id);
      const exact = (allProfiles ?? []).find(
        (p: { name: string; variety_name: string | null }) =>
          getCanonicalKey(p.name ?? "") === nameKey && getCanonicalKey(p.variety_name ?? "") === varietyKey
      );
      let profileId: string;
      if (exact) {
        profileId = exact.id;
        // Display priority: prefer name/variety from Select Seeds or Johnny's over Rare Seeds slug-rescue name
        const vendorNorm = (item.vendor ?? "").toLowerCase();
        const isSelectSeedsOrJohnnys = vendorNorm.includes("select") || vendorNorm.includes("johnny");
        if (isSelectSeedsOrJohnnys && (name.trim() !== (exact.name ?? "").trim() || (coreVarietyName || varietyName || "").trim() !== (exact.variety_name ?? "").trim())) {
          await supabase
            .from("plant_profiles")
            .update({ name: name.trim(), variety_name: (coreVarietyName || varietyName || "").trim() || null })
            .eq("id", profileId)
            .eq("user_id", user.id);
        }
        const rawHero = (item.stock_photo_url ?? "").trim() || (item.hero_image_url ?? "").trim();
        const heroUrlToSet = item.useStockPhotoAsHero !== false && rawHero ? rawHero : undefined;
        if (heroUrlToSet) {
          const { data: existing } = await supabase
            .from("plant_profiles")
            .select("hero_image_path, hero_image_url")
            .eq("id", profileId)
            .single();
          const hasHero = (existing as { hero_image_path?: string; hero_image_url?: string } | null)?.hero_image_path?.trim() || (existing as { hero_image_url?: string } | null)?.hero_image_url?.trim();
          if (!hasHero) {
            await supabase.from("plant_profiles").update({ hero_image_url: heroUrlToSet }).eq("id", profileId).eq("user_id", user.id);
          }
        }
      } else {
        const researchSun = (item.sun_requirement ?? "").trim() || zone10b.sun;
        const researchSpacing = (item.spacing ?? "").trim() || zone10b.plant_spacing;
        const researchGerm = (item.days_to_germination ?? "").trim() || zone10b.days_to_germination;
        const maturityStr = (item.days_to_maturity ?? "").trim();
        const firstNum = maturityStr.match(/\d+/);
        const harvestDaysFromResearch = firstNum ? parseInt(firstNum[0], 10) : undefined;
        const harvestDays = zone10b.harvest_days ?? harvestDaysFromResearch ?? undefined;
        const careNotes: Record<string, unknown> = {};
        if ((item.sowing_depth ?? "").trim()) careNotes.sowing_depth = item.sowing_depth!.trim();
        if ((item.source_url ?? "").trim()) careNotes.source_url = item.source_url!.trim();
        const rawHeroNew = (item.stock_photo_url ?? "").trim() || (item.hero_image_url ?? "").trim();
        const heroUrlForNew = item.useStockPhotoAsHero !== false && rawHeroNew ? rawHeroNew : "/seedling-icon.svg";
        const { data: newProfile, error: profileErr } = await supabase
          .from("plant_profiles")
          .insert({
            user_id: user.id,
            name: name.trim(),
            variety_name: coreVarietyName || varietyName,
            primary_image_path: null,
            hero_image_url: heroUrlForNew,
            tags: item.tags?.length ? item.tags : undefined,
            ...(researchSun && { sun: researchSun }),
            ...(researchSpacing && { plant_spacing: researchSpacing }),
            ...(researchGerm && { days_to_germination: researchGerm }),
            ...(harvestDays != null && { harvest_days: harvestDays }),
            ...(zone10b.sowing_method && { sowing_method: zone10b.sowing_method }),
            ...(zone10b.planting_window && { planting_window: zone10b.planting_window }),
            ...(Object.keys(careNotes).length > 0 && { botanical_care_notes: careNotes }),
          })
          .select("id")
          .single();
        if (profileErr) {
          setError(profileErr.message);
          setSaving(false);
          return;
        }
        profileId = (newProfile as { id: string }).id;
        if (!heroUrlForNew) newProfileIdsWithoutHero.push(profileId);
      }
      const purchaseDate = (item.purchaseDate ?? "").trim() || todayISO();
      const tagsToSave = packetTags?.length ? packetTags : (item.tags ?? []);
      const allUrls = [
        (item.source_url ?? "").trim(),
        ...((item.secondary_urls ?? []).map((u) => (u ?? "").trim()).filter(Boolean)),
      ].filter(Boolean) as string[];
      const urlsToSave = allUrls.length > 0 ? allUrls : [null];
      for (let u = 0; u < urlsToSave.length; u++) {
        const purchaseUrl = urlsToSave[u];
        const isFirst = u === 0;
        const { error: packetErr } = await supabase.from("seed_packets").insert({
          plant_profile_id: profileId,
          user_id: user.id,
          vendor_name: (item.vendor ?? "").trim() || null,
          qty_status: 100,
          ...(isFirst && path && { primary_image_path: path }),
          purchase_date: purchaseDate,
          ...(purchaseUrl && { purchase_url: purchaseUrl }),
          ...(tagsToSave.length > 0 && { tags: tagsToSave }),
        });
        if (packetErr) {
          setError(packetErr.message);
          setSaving(false);
          return;
        }
      }
      savedItems.push({ item, profileId });
    }

    // Phase: Download hero images to Supabase Storage + upsert plant_extract_cache
    setSavingPhase("Storing photos\u2026");
    const DOWNLOAD_CONCURRENCY = 3;
    const DOWNLOAD_TIMEOUT_MS = 5_000;
    for (let chunkStart = 0; chunkStart < savedItems.length; chunkStart += DOWNLOAD_CONCURRENCY) {
      const chunk = savedItems.slice(chunkStart, chunkStart + DOWNLOAD_CONCURRENCY);
      await Promise.all(
        chunk.map(async ({ item: savedItem, profileId: savedProfileId }) => {
          const identityKey = (savedItem.identityKey ?? "").trim();
          const vendorStr = (savedItem.vendor ?? "").trim();
          const sourceUrl = (savedItem.source_url ?? "").trim();
          if (!identityKey || !sourceUrl) return; // can't cache without key or URL

          let heroStoragePath: string | null = null;
          const rawHero = (savedItem.stock_photo_url ?? "").trim() || (savedItem.hero_image_url ?? "").trim();
          const shouldDownloadHero = savedItem.useStockPhotoAsHero !== false && rawHero.startsWith("http");

          // A. Download and store hero image (5s timeout per image)
          if (shouldDownloadHero) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
              const imgRes = await fetch(rawHero, { signal: controller.signal });
              clearTimeout(timeout);
              if (imgRes.ok) {
                const blob = await imgRes.blob();
                const sanitizedKey = (vendorStr + "_" + identityKey).toLowerCase().replace(/[^a-z0-9]/g, "_");
                const storagePath = `${user.id}/hero-cache/${sanitizedKey}.jpg`;
                const { error: uploadErr } = await supabase.storage.from("journal-photos").upload(storagePath, blob, {
                  contentType: blob.type || "image/jpeg",
                  upsert: true,
                });
                if (!uploadErr) {
                  heroStoragePath = storagePath;
                  // Update profile: set hero_image_path, clear hero_image_url (same pattern as manual upload)
                  await supabase
                    .from("plant_profiles")
                    .update({ hero_image_path: storagePath, hero_image_url: null })
                    .eq("id", savedProfileId)
                    .eq("user_id", user.id);
                } else {
                  console.warn("[save] Hero upload failed:", uploadErr.message);
                }
              }
            } catch (e) {
              console.warn("[save] Hero download failed/timed out:", (e instanceof Error ? e.message : String(e)));
            }
          }

          // B. Upsert full extraction into plant_extract_cache
          const extractData = {
            type: (savedItem.type ?? "").trim(),
            variety: (savedItem.variety ?? "").trim(),
            vendor: vendorStr,
            tags: savedItem.tags ?? [],
            scientific_name: (savedItem.scientific_name ?? "").trim() || undefined,
            sowing_depth: (savedItem.sowing_depth ?? "").trim() || undefined,
            spacing: (savedItem.spacing ?? "").trim() || undefined,
            sun_requirement: (savedItem.sun_requirement ?? "").trim() || undefined,
            days_to_germination: (savedItem.days_to_germination ?? "").trim() || undefined,
            days_to_maturity: (savedItem.days_to_maturity ?? "").trim() || undefined,
            source_url: sourceUrl,
            hero_image_url: rawHero || undefined,
          };
          const { error: cacheErr } = await supabase
            .from("plant_extract_cache")
            .upsert(
              {
                user_id: user.id,
                source_url: sourceUrl,
                identity_key: identityKey,
                vendor: vendorStr || null,
                extract_data: extractData,
                hero_storage_path: heroStoragePath,
                original_hero_url: rawHero || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,source_url" }
            );
          if (cacheErr) {
            console.warn("[save] plant_extract_cache upsert failed:", cacheErr.message);
          }
        })
      );
    }
    setSavingPhase("Saving\u2026");

    if (token) {
      newProfileIdsWithoutHero.forEach((profileId) => {
        fetch("/api/seed/background-hero-for-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ profileId }),
        }).catch(() => {});
      });
    }

    setSaving(false);
    clearReviewImportData();
    router.replace("/vault?status=vault");
  }, [user?.id, items, router]);

  if (!user) return null;
  if (items.length === 0) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-black/60">Loading…</p>
      </div>
    );
  }

  return (
    <div className="px-8 pt-8 pb-32 max-w-[1600px] mx-auto w-full">
      <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-2">
        ← Back to Vault
      </Link>
      <h1 className="text-xl font-semibold text-black mb-1">Import Review</h1>
      <p className="text-sm text-black/60 mb-4">
        Edit the extracted data below, then save all to the vault.
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={handleFindMissingHeroPhotos}
          disabled={itemsMissingHero.length === 0 || bulkHeroSearching || saving}
          title={
            itemsMissingHero.length === 0
              ? "All items have a hero image"
              : bulkHeroSearching
                ? "Searching for photos…"
                : `Find hero photos for ${itemsMissingHero.length} item(s)`
          }
          className="min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-blue-500 bg-transparent text-blue-600 font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-500 transition-colors"
        >
          {bulkHeroSearching ? "Searching…" : "Find Missing Hero Photos"}
        </button>
        {itemsMissingHero.length > 0 && !bulkHeroSearching && (
          <span className="text-sm text-neutral-500">
            {itemsMissingHero.length} without image
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white -mx-8 w-full">
        <table className="w-full text-sm border-collapse" aria-label="Import review">
          <thead>
            <tr className="border-b border-black/10 bg-neutral-50/80">
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-black/70 w-20">Image</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-black/70 min-w-[140px]">Vendor</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-black/70 min-w-[120px]">Plant Type</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-black/70 min-w-[200px]">Variety</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-black/70 w-36">Purchase date</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-black/70 min-w-[140px]">Research</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-black/70 w-14"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const stockUrl = item.stock_photo_url?.trim();
              const heroUrl = item.hero_image_url?.trim();
              const packetDataUrl = item.imageBase64?.trim()
                ? (item.imageBase64.includes("data:") ? item.imageBase64 : `data:image/jpeg;base64,${item.imageBase64}`)
                : null;
              const urlValid = (s: string) =>
                s && (s.startsWith("http") || s.startsWith("//") || s.startsWith("data:"));
              const hasRealImage = !!(
                urlValid(stockUrl ?? "") ||
                urlValid(heroUrl ?? "") ||
                packetDataUrl
              );
              const rawUrl = stockUrl || heroUrl || "";
              const imgSrc = rawUrl && urlValid(rawUrl)
                ? (rawUrl.startsWith("data:") ? rawUrl : formatVendorUrl(rawUrl))
                : packetDataUrl || null;
              const heroLoading = heroLoadingIds.has(item.id);
              const useAsHero = item.useStockPhotoAsHero !== false;
              const showGuardrail = heroGuardrailItemId === item.id;
              const existing = hasExistingProfile(item);
              const isDuplicate = item.isPotentialDuplicate === true;
              const hasIdentityKey = !!(item.identityKey ?? "").trim();
              const originalExists = hasIdentityKey && items.some((i) => i.id !== item.id && i.identityKey === item.identityKey);
              const canMerge = isDuplicate && hasIdentityKey && originalExists;
              const canonicalRowKey = item.identityKey ? `${item.identityKey}-${item.id}` : item.id;
              const goldenSource = getGoldenSourceItem(items, item.identityKey);
              const isGoldenSourceRow = goldenSource?.id === item.id;
              const displayVarietyRaw = isGoldenSourceRow ? (getGoldenVarietyForGroup(items, item.identityKey) ?? item.cleanVariety ?? item.variety ?? "") : (item.cleanVariety ?? item.variety ?? "");
              const displayVariety = stripVarietySuffixes(displayVarietyRaw) || displayVarietyRaw;
              const mergedSourceCount = item.secondary_urls?.length ?? 0;
              const displayVendor = getGoldenVendorForGroup(items, item.identityKey) ?? item.vendor ?? "";
              return (
                <tr
                  key={canonicalRowKey}
                  className={`border-b align-top ${isDuplicate ? "border-l-4 border-l-amber-400 bg-amber-50/50 hover:bg-amber-50/70" : "border-black/5 hover:bg-black/[0.02]"}`}
                >
                  <td className="py-2.5 px-3 align-top">
                    <div className="flex flex-col gap-1.5">
                      <div className="w-16 h-16 rounded-lg bg-black/5 overflow-hidden flex items-center justify-center relative shrink-0">
                        {heroLoading ? (
                          <div className="absolute inset-0 bg-neutral-200 animate-pulse rounded-lg" aria-hidden />
                        ) : null}
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt=""
                            className="w-full h-full object-cover object-center relative z-10"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              console.error("Image failed to load:", item.hero_image_url);
                              const t = e.target as HTMLImageElement;
                              t.style.display = "none";
                              const fallback = t.parentElement?.querySelector(".review-import-thumb-fallback");
                              if (fallback) (fallback as HTMLElement).classList.remove("hidden");
                              // Clear broken URL and uncheck so state matches "No image"
                              updateItem(item.id, {
                                stock_photo_url: undefined,
                                hero_image_url: undefined,
                                useStockPhotoAsHero: false,
                              });
                            }}
                          />
                        ) : null}
                        {heroLoading && (
                          <span className="absolute inset-0 flex items-center justify-center z-10 text-neutral-500 text-xs font-medium">
                            Searching AI…
                          </span>
                        )}
                        <span
                          className={`review-import-thumb-fallback text-neutral-500 text-xs text-center px-1 ${imgSrc || heroLoading ? "hidden" : ""}`}
                          aria-hidden={!!imgSrc}
                        >
                          No image
                        </span>
                      </div>
                      {noPhotoFoundIds.has(item.id) && !heroLoading && (
                        <p className="text-amber-700 text-xs mt-0.5" role="status">
                          No photo found
                        </p>
                      )}
                      {!hasRealImage && !heroLoading && (
                        <p className="text-neutral-500 text-xs mt-0.5" title="Edit the Variety name and use Find Missing Hero Photos, or paste an image URL if you have one">
                          No photo found. Try editing the Variety name or adding a manual URL.
                        </p>
                      )}
                      <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasRealImage ? useAsHero : false}
                          onChange={(e) => {
                            if (e.target.checked && !hasRealImage) {
                              setHeroGuardrailItemId(item.id);
                              setTimeout(() => setHeroGuardrailItemId(null), 3000);
                              return;
                            }
                            updateItem(item.id, { useStockPhotoAsHero: e.target.checked });
                          }}
                          className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                          aria-label="Use this as Profile Hero Image"
                          title={!hasRealImage ? "Please find or upload a photo first" : undefined}
                        />
                        <span>Use as profile hero</span>
                      </label>
                      {showGuardrail && (
                        <p className="text-amber-700 text-xs" role="alert">
                          Please find or upload a photo first
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    {mergedSourceCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-black/90">{decodeHtmlEntities(displayVendor) || "Vendor"}</span>
                        <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded px-1.5 py-0.5" title={`${mergedSourceCount} additional link${mergedSourceCount === 1 ? "" : "s"} linked`}>
                          +{mergedSourceCount}
                        </span>
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={item.vendor}
                        onChange={(e) => updateItem(item.id, { vendor: e.target.value })}
                        placeholder="Vendor"
                        className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]"
                        aria-label="Vendor"
                      />
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={item.type}
                      onChange={(e) => updateItem(item.id, { type: e.target.value })}
                      placeholder="Plant type"
                      className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]"
                      aria-label="Plant type"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          value={decodeHtmlEntities(displayVariety)}
                          onChange={(e) => updateItem(item.id, { variety: e.target.value })}
                          placeholder="Variety"
                          className="flex-1 min-w-[100px] rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]"
                          aria-label="Variety"
                        />
                        {item.linkNotFound && (
                          <span className="text-red-600 text-xs font-medium whitespace-nowrap flex items-center gap-1" title="Product page returned 404">
                            <span aria-hidden>⚠</span>
                            (Link may be dead)
                          </span>
                        )}
                        {(item.tags?.length ?? 0) > 0 && (
                          <span className="text-xs text-neutral-500 whitespace-nowrap" title={(item.tags ?? []).join(", ")}>
                            🏷️ {(item.tags ?? []).length} tag{(item.tags ?? []).length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      {existing && (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="inline-block text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                            Existing Profile Found
                          </span>
                          {(() => {
                            const profile = getExistingProfile(item);
                            const conflict = profile && careDiff(item, profile);
                            if (!conflict) return null;
                            return (
                              <>
                                <span className="inline-block text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded px-2 py-0.5">
                                  Data differs from variety defaults
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateVarietyDefaults(item)}
                                  className="text-xs font-medium text-amber-800 underline hover:no-underline"
                                >
                                  Update Variety Defaults
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="date"
                      value={item.purchaseDate || todayISO()}
                      onChange={(e) => updateItem(item.id, { purchaseDate: e.target.value })}
                      className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]"
                      aria-label="Purchase date"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-sm text-black/70">
                    {item.sowing_depth ?? item.spacing ?? item.sun_requirement ?? item.days_to_germination ?? item.days_to_maturity ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {item.sowing_depth && <span title="Sowing depth">{item.sowing_depth}</span>}
                          {item.spacing && <span title="Spacing">{item.spacing}</span>}
                          {item.sun_requirement && <span title="Sun">{item.sun_requirement}</span>}
                          {(item.days_to_germination || item.days_to_maturity) && (
                            <span title="Germ / Maturity">
                              {[item.days_to_germination, item.days_to_maturity].filter(Boolean).join(" / ")} d
                            </span>
                          )}
                        </div>
                        {item.source_url && (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:underline text-xs"
                          >
                            Verify source →
                          </a>
                        )}
                        {(item.secondary_urls?.length ?? 0) > 0 && (
                          <span className="text-xs text-neutral-500" title={item.secondary_urls!.join("\n")}>
                            +{item.secondary_urls!.length} link{(item.secondary_urls!.length ?? 0) === 1 ? "" : "s"} linked (will save as separate packets)
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right relative z-10 bg-inherit">
                    {isDuplicate && (
                      <button
                        type="button"
                        onClick={() => canMerge && mergeDuplicateIntoOriginal(item)}
                        disabled={!canMerge}
                        title={
                          !hasIdentityKey
                            ? "Cannot link without variety name"
                            : !originalExists
                              ? "No matching variety row to link to"
                              : "Add this link as another packet under the same variety (saves as separate packet when you save)"
                        }
                        className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-lg border border-amber-500 bg-amber-100 text-amber-900 text-xs font-medium hover:bg-amber-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-amber-50/80 disabled:border-amber-300 disabled:hover:bg-amber-50/80 mr-2"
                      >
                        Link to Existing Variety
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 text-black/50 hover:bg-red-50 hover:text-red-600 ml-auto"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {importLogs.length > 0 && (
        <div className="mt-6 mb-4">
          <LogPanel logs={importLogs} isOpen={logPanelOpen} onToggle={() => setLogPanelOpen((o) => !o)} />
        </div>
      )}

      <div
        className="fixed left-0 right-0 bottom-20 z-[100] p-4 bg-white/95 border-t border-black/10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))" }}
      >
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving || items.length === 0}
          className="w-full min-h-[56px] rounded-xl bg-emerald text-white text-lg font-semibold hover:bg-emerald/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {saving ? savingPhase : "Save All to Vault"}
        </button>
      </div>
    </div>
  );
}
