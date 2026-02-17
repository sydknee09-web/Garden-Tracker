"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  getReviewImportData,
  setReviewImportData,
  setPendingPhotoHeroImport,
  clearReviewImportData,
  type ReviewImportItem,
  type ReviewImportSource,
} from "@/lib/reviewImportStorage";
import { parseVarietyWithModifiers } from "@/lib/varietyModifiers";
import { buildPlantProfileInsertPayload } from "@/lib/reviewImportSave";
import { getCanonicalKey } from "@/lib/canonicalKey";
import { findExistingProfileByCanonical } from "@/lib/matchExistingProfile";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { compressImage } from "@/lib/compressImage";
import { decodeHtmlEntities, stripHtmlForDisplay } from "@/lib/htmlEntities";
import { applyZone10bToProfile } from "@/data/zone10b_schedule";
import { stripVarietySuffixes } from "@/app/api/seed/extract/route";
import { dedupeVendorsForSuggestions, toCanonicalDisplay } from "@/lib/vendorNormalize";
import { filterValidPlantTypes } from "@/lib/plantTypeSuggestions";
import { Combobox } from "@/components/Combobox";
import { hapticSuccess } from "@/lib/haptics";

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

function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

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
  const [importSource, setImportSource] = useState<ReviewImportSource | undefined>(undefined);
  const [profiles, setProfiles] = useState<ProfileMatch[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingPhase, setSavingPhase] = useState("Saving\u2026");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroLoadingIds, setHeroLoadingIds] = useState<Set<string>>(new Set());
  const heroFetchedRef = useRef<Set<string>>(new Set());
  const heroFetchingRef = useRef<Set<string>>(new Set());
  const [heroGuardrailItemId, setHeroGuardrailItemId] = useState<string | null>(null);
  /** Item ids we tried in bulk search but no photo was found (show "No photo found" label) */
  const [noPhotoFoundIds, setNoPhotoFoundIds] = useState<Set<string>>(new Set());
  const [bulkHeroSearching, setBulkHeroSearching] = useState(false);
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [plantSuggestions, setPlantSuggestions] = useState<string[]>([]);
  const [varietySuggestionsByPlant, setVarietySuggestionsByPlant] = useState<Record<string, string[]>>({});
  /** Full-screen lightbox for packet/hero image (tap to expand on mobile) */
  const [expandedImageSrc, setExpandedImageSrc] = useState<string | null>(null);
  const addPhotoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Plant suggestions from global_plant_cache
  useEffect(() => {
    if (items.length === 0) return;
    supabase.rpc("get_global_plant_cache_plant_types").then(({ data }) => {
      const raw = ((data ?? []) as { plant_type: string | null }[]).map((r) => (r.plant_type ?? "").trim()).filter(Boolean);
      setPlantSuggestions(filterValidPlantTypes(raw));
    });
  }, [items.length]);

  // Variety suggestions per plant (from global cache)
  useEffect(() => {
    if (items.length === 0) return;
    const plantNames = [...new Set(items.map((i) => (i.type ?? "").trim()).filter(Boolean))];
    plantNames.forEach((name) => {
      if (varietySuggestionsByPlant[name]) return;
      supabase.rpc("get_global_plant_cache_varieties", { p_plant_type: name }).then(({ data }) => {
        setVarietySuggestionsByPlant((prev) => {
          if (prev[name]) return prev;
          const varieties = ((data ?? []) as { variety: string | null }[]).map((r) => (r.variety ?? "").trim()).filter(Boolean);
          return { ...prev, [name]: varieties };
        });
      });
    });
  }, [items.length, items]);

  useEffect(() => {
    const data = getReviewImportData();
    if (!data?.items?.length) {
      router.replace("/vault");
      return;
    }
    setImportSource(data.source);
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
      .is("deleted_at", null)
      .then(({ data }) => setProfiles((data ?? []) as ProfileMatch[]));
  }, [user?.id, items.length]);

  // Vendor suggestions: existing packet vendors + scraped caches (global + user) for standardization.
  // Combobox allows free text so obscure vendors can still be entered; saving upserts to plant_extract_cache so they appear next time for this user.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const allVendors = new Set<string>();

      // 1) From existing plant profiles' seed packets (user's vault)
      const { data: profileRows } = await supabase
        .from("plant_profiles")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      const ids = (profileRows ?? []).map((r: { id: string }) => r.id);
      if (ids.length > 0) {
        const { data: packetRows } = await supabase
          .from("seed_packets")
          .select("vendor_name")
          .in("plant_profile_id", ids);
        (packetRows ?? []).forEach((r: { vendor_name: string | null }) => {
          const v = (r.vendor_name ?? "").trim();
          if (v) allVendors.add(v);
        });
      }

      // 2) From global scraped cache (bulk-scraped vendors; RLS allows SELECT for authenticated)
      const { data: globalRows } = await supabase
        .from("global_plant_cache")
        .select("vendor");
      (globalRows ?? []).forEach((r: { vendor: string | null }) => {
        const v = (r.vendor ?? "").trim();
        if (v) allVendors.add(v);
      });

      // 3) From user's own extract cache (prior imports)
      const { data: extractRows } = await supabase
        .from("plant_extract_cache")
        .select("vendor")
        .eq("user_id", user.id);
      (extractRows ?? []).forEach((r: { vendor: string | null }) => {
        const v = (r.vendor ?? "").trim();
        if (v) allVendors.add(v);
      });

      setVendorSuggestions(dedupeVendorsForSuggestions([...allVendors]));
    })();
  }, [user?.id]);

  // Run when item count is set (e.g. load from storage). [items.length] only — hero URL updates do not re-trigger.
  // Skip auto hero fetch for purchase_order: user must click "Find Hero Photos" to go to hero step first.
  // Phase 0: fetch vault (import logs with status 200 + hero_image_url), then for each item missing hero either use vault URL (skip API) or call find-hero-photo. Always call persistHeroSearchLog for every API result (success or fail).
  useEffect(() => {
    if (items.length === 0 || importSource === "purchase_order") return;

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

      // Phase 0.5 (Vault profiles): user's plant_profiles with hero — skip AI when they already have this variety
      const vaultProfileHeroMap = new Map<string, string>();
      if (user?.id) {
        try {
          const { data: profilesWithHero } = await supabase
            .from("plant_profiles")
            .select("id, name, variety_name, hero_image_path, hero_image_url")
            .eq("user_id", user.id)
            .is("deleted_at", null);
          for (const p of profilesWithHero ?? []) {
            const key = identityKeyFromVariety(p.name ?? "", p.variety_name ?? "");
            if (!key) continue;
            let heroUrl: string | null = null;
            if ((p as { hero_image_path?: string }).hero_image_path?.trim()) {
              const { data: pub } = supabase.storage.from("journal-photos").getPublicUrl((p as { hero_image_path: string }).hero_image_path.trim());
              if (pub?.publicUrl) heroUrl = pub.publicUrl;
            }
            if (!heroUrl && (p as { hero_image_url?: string }).hero_image_url?.trim().startsWith("http")) {
              heroUrl = (p as { hero_image_url: string }).hero_image_url.trim();
            }
            if (heroUrl && !vaultProfileHeroMap.has(key)) vaultProfileHeroMap.set(key, heroUrl);
          }
        } catch (_) {
          // non-fatal
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
        const identityKey = (item.identityKey ?? "").trim();
        const vaultUrl = identityKey ? vaultMap.get(identityKey) : undefined;
        const vaultProfileUrl = identityKey ? vaultProfileHeroMap.get(identityKey) : undefined;
        const heroUrlToUse = vaultUrl ?? vaultProfileUrl;
        if (heroUrlToUse) {
          // Phase 0 or 0.5 hit: use saved URL, skip API call entirely
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, stock_photo_url: heroUrlToUse, hero_image_url: heroUrlToUse, useStockPhotoAsHero: true }
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
  }, [items.length, user?.id, importSource]);

  const updateItem = useCallback((id: string, updates: Partial<ReviewImportItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const handleAddPacketPhoto = useCallback(
    async (itemId: string, file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") resolve(result.includes(",") ? result.split(",")[1] ?? result : result);
          else reject(new Error("Read failed"));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, extraPacketImages: [...(i.extraPacketImages ?? []), base64] } : i
        )
      );
    },
    []
  );

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

  /** For purchase_order: navigate to hero page to find photos for all items (two-step flow like photo import). */
  const handleGoToHeroPhotos = useCallback(() => {
    setReviewImportData({ items });
    const heroItems = items.map((i) => ({
      id: i.id,
      imageBase64: i.imageBase64 ?? "",
      fileName: i.fileName ?? "",
      vendor: i.vendor ?? "",
      type: i.type ?? "Imported seed",
      variety: i.variety ?? "",
      tags: i.tags ?? [],
      purchaseDate: i.purchaseDate ?? todayISO(),
    }));
    setPendingPhotoHeroImport({ items: heroItems });
    router.push("/vault/import/photos/hero");
  }, [items, router]);

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

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) authHeaders.Authorization = `Bearer ${token}`;

    // Build vault profile hero map — skip API when user already has this variety
    const vaultProfileHeroMap = new Map<string, string>();
    if (user?.id) {
      try {
        const { data: profilesWithHero } = await supabase
          .from("plant_profiles")
          .select("id, name, variety_name, hero_image_path, hero_image_url")
          .eq("user_id", user.id)
          .is("deleted_at", null);
        for (const p of profilesWithHero ?? []) {
          const key = identityKeyFromVariety(p.name ?? "", p.variety_name ?? "");
          if (!key) continue;
          let heroUrl: string | null = null;
          if ((p as { hero_image_path?: string }).hero_image_path?.trim()) {
            const { data: pub } = supabase.storage.from("journal-photos").getPublicUrl((p as { hero_image_path: string }).hero_image_path.trim());
            if (pub?.publicUrl) heroUrl = pub.publicUrl;
          }
          if (!heroUrl && (p as { hero_image_url?: string }).hero_image_url?.trim().startsWith("http")) {
            heroUrl = (p as { hero_image_url: string }).hero_image_url.trim();
          }
          if (heroUrl && !vaultProfileHeroMap.has(key)) vaultProfileHeroMap.set(key, heroUrl);
        }
      } catch (_) {
        /* non-fatal */
      }
    }

    const results = await Promise.all(
      missing.map(async (item) => {
        const searchName = (item.originalType ?? item.type ?? "").trim() || "Unknown";
        const searchVariety = (item.originalVariety ?? item.variety ?? "").trim();
        const queryUsed = `${searchName} ${searchVariety}`.trim() || "—";
        const identityKeyBulk = (item.identityKey ?? "").trim();
        const vaultProfileUrl = identityKeyBulk ? vaultProfileHeroMap.get(identityKeyBulk) : undefined;
        if (vaultProfileUrl) {
          persistHeroSearchLog(item, 1, true, 200, queryUsed, vaultProfileUrl);
          return {
            id: item.id,
            url: vaultProfileUrl,
            isError: false,
            variety: item.cleanVariety ?? item.variety ?? item.type ?? "",
          };
        }
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
          persistHeroSearchLog(item, 1, !!url, url ? 200 : res.status, queryUsed, url);
          didLog = true;
          return {
            id: item.id,
            url,
            isError,
            variety: item.cleanVariety ?? item.variety ?? item.type ?? "",
          };
        } catch (err) {
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
    (item: ReviewImportItem): ProfileMatch | null =>
      findExistingProfileByCanonical(profiles, item.type ?? "", item.variety),
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
      const { data } = await supabase.from("plant_profiles").select("id, name, variety_name, sun, plant_spacing, days_to_germination, harvest_days, botanical_care_notes").eq("user_id", user.id).is("deleted_at", null);
      setProfiles((data ?? []) as ProfileMatch[]);
    },
    [getExistingProfile, user?.id]
  );

  useEffect(() => {
    if (items.length) setReviewImportData({ items });
  }, [items]);

  useEffect(() => {
    return () => {
      if (saveSuccessTimeoutRef.current) clearTimeout(saveSuccessTimeoutRef.current);
    };
  }, []);

  // Lightbox: handle browser/phone back button to close
  useEffect(() => {
    if (!expandedImageSrc) return;
    const handlePopState = () => setExpandedImageSrc(null);
    window.history.pushState({ reviewImageExpanded: true }, "");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [expandedImageSrc]);

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

    const newProfileIds: string[] = [];
    const savedItems: { item: ReviewImportItem; profileId: string; packetImagePath?: string; skipPacketAsHero?: boolean }[] = [];
    for (const item of items) {
      const name = (item.type ?? "").trim() || "Unknown";
      const varietyName = (item.variety ?? "").trim() || null;
      const isLinkImport = !(item.imageBase64?.trim());
      let path: string | null = null;
      if (!isLinkImport) {
        path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const rawBlob = base64ToBlob(item.imageBase64!, "image/jpeg");
        const file = new File([rawBlob], item.fileName || "packet.jpg", { type: "image/jpeg" });
        const { blob } = await compressImage(file);
        const { error: uploadErr } = await supabase.storage.from("seed-packets").upload(path, blob, {
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
        .eq("user_id", user.id)
        .is("deleted_at", null);
      const exact = (allProfiles ?? []).find(
        (p: { name: string; variety_name: string | null }) =>
          getCanonicalKey(p.name ?? "") === nameKey && getCanonicalKey(p.variety_name ?? "") === varietyKey
      );
      let profileId: string;
      let profileAlreadyHadHero = false;
      if (exact) {
        profileId = exact.id;
        // Display priority: prefer name/variety from Select Seeds or Johnny's over Rare Seeds slug-rescue name
        const vendorNorm = (item.vendor ?? "").toLowerCase();
        const isSelectSeedsOrJohnnys = vendorNorm.includes("select") || vendorNorm.includes("johnny");
        if (isSelectSeedsOrJohnnys && (name.trim() !== (exact.name ?? "").trim() || (coreVarietyName || varietyName || "").trim() !== (exact.variety_name ?? "").trim())) {
          await supabase
            .from("plant_profiles")
            .update({
              name: stripHtmlForDisplay(name).trim() || name.trim(),
              variety_name: stripHtmlForDisplay(coreVarietyName || varietyName || "").trim() || null,
            })
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
          const heroPath = (existing as { hero_image_path?: string; hero_image_url?: string } | null)?.hero_image_path?.trim();
          const heroUrl = (existing as { hero_image_url?: string } | null)?.hero_image_url?.trim();
          const hasHero = heroPath || (heroUrl && !heroUrl.endsWith("seedling-icon.svg"));
          if (hasHero) {
            profileAlreadyHadHero = true;
          } else {
            await supabase.from("plant_profiles").update({ hero_image_url: heroUrlToSet }).eq("id", profileId).eq("user_id", user.id);
          }
        }
      } else {
        const payload = buildPlantProfileInsertPayload(item, zone10b, user.id, todayISO);
        const heroUrlForNew = payload.hero_image_url;
        const { data: newProfile, error: profileErr } = await supabase
          .from("plant_profiles")
          .insert(payload)
          .select("id")
          .single();
        if (profileErr) {
          setError(profileErr.message);
          setSaving(false);
          return;
        }
        profileId = (newProfile as { id: string }).id;
        newProfileIds.push(profileId);
      }
      const purchaseDate = (item.purchaseDate ?? "").trim() || todayISO();
      const tagsToSave = packetTags?.length ? packetTags : (item.tags ?? []);
      const vendorSpecs =
        (item.sowing_depth ?? item.spacing ?? item.sun_requirement ?? item.days_to_germination ?? item.days_to_maturity ?? item.plant_description) != null
          ? {
              ...((item.sowing_depth ?? "").trim() && { sowing_depth: item.sowing_depth!.trim() }),
              ...((item.spacing ?? "").trim() && { spacing: item.spacing!.trim() }),
              ...((item.sun_requirement ?? "").trim() && { sun_requirement: item.sun_requirement!.trim() }),
              ...((item.days_to_germination ?? "").trim() && { days_to_germination: item.days_to_germination!.trim() }),
              ...((item.days_to_maturity ?? "").trim() && { days_to_maturity: item.days_to_maturity!.trim() }),
              ...((item.plant_description ?? "").trim() && { plant_description: item.plant_description!.trim() }),
            }
          : undefined;
      const allUrls = [
        (item.source_url ?? "").trim(),
        ...((item.secondary_urls ?? []).map((u) => (u ?? "").trim()).filter(Boolean)),
      ].filter(Boolean) as string[];
      const urlsToSave = allUrls.length > 0 ? allUrls : [null];
      let firstPacketId: string | null = null;
      const extraImages = item.extraPacketImages ?? [];
      for (let u = 0; u < urlsToSave.length; u++) {
        const purchaseUrl = urlsToSave[u];
        const isFirst = u === 0;
        const { data: packetRow, error: packetErr } = await supabase.from("seed_packets").insert({
          plant_profile_id: profileId,
          user_id: user.id,
          vendor_name: (item.vendor ?? "").trim() ? (toCanonicalDisplay((item.vendor ?? "").trim()) || (item.vendor ?? "").trim()) : null,
          qty_status: 100,
          ...(isFirst && path && { primary_image_path: path }),
          purchase_date: purchaseDate,
          ...(purchaseUrl && { purchase_url: purchaseUrl }),
          ...(tagsToSave.length > 0 && { tags: tagsToSave }),
          ...(vendorSpecs && Object.keys(vendorSpecs).length > 0 && { vendor_specs: vendorSpecs }),
          ...((item.user_notes ?? "").trim() && { user_notes: item.user_notes!.trim() }),
          ...((item.storage_location ?? "").trim() && { storage_location: item.storage_location!.trim() }),
        }).select("id").single();
        if (packetErr) {
          setError(packetErr.message);
          setSaving(false);
          return;
        }
        if (isFirst && packetRow) firstPacketId = (packetRow as { id: string }).id;
      }
      // Upload extra packet images to packet_images table (first packet only)
      if (firstPacketId && extraImages.length > 0) {
        for (let i = 0; i < extraImages.length; i++) {
          const extraPath = `${user.id}/${crypto.randomUUID()}.jpg`;
          const rawBlob = base64ToBlob(extraImages[i], "image/jpeg");
          const file = new File([rawBlob], `packet-extra-${i}.jpg`, { type: "image/jpeg" });
          const { blob } = await compressImage(file);
          const { error: uploadErr } = await supabase.storage.from("seed-packets").upload(extraPath, blob, {
            contentType: "image/jpeg",
            upsert: false,
          });
          if (!uploadErr) {
            await supabase.from("packet_images").insert({
              seed_packet_id: firstPacketId,
              image_path: extraPath,
              sort_order: i,
            });
          }
        }
      }
      // Reinstate profile when adding a packet (e.g. was out_of_stock / archived)
      await supabase.from("plant_profiles").update({ status: "in_stock" }).eq("id", profileId).eq("user_id", user.id);
      savedItems.push({ item, profileId, packetImagePath: path ?? undefined, skipPacketAsHero: profileAlreadyHadHero });
    }

    // Phase: Download hero images to Supabase Storage + upsert plant_extract_cache
    setSavingPhase("Storing photos\u2026");
    const DOWNLOAD_CONCURRENCY = 3;
    const DOWNLOAD_TIMEOUT_MS = 5_000;
    for (let chunkStart = 0; chunkStart < savedItems.length; chunkStart += DOWNLOAD_CONCURRENCY) {
      const chunk = savedItems.slice(chunkStart, chunkStart + DOWNLOAD_CONCURRENCY);
      await Promise.all(
        chunk.map(async ({ item: savedItem, profileId: savedProfileId, packetImagePath, skipPacketAsHero }) => {
          const identityKey = (savedItem.identityKey ?? "").trim();
          const vendorStr = (savedItem.vendor ?? "").trim();
          const rawSourceUrl = (savedItem.source_url ?? "").trim();
          // Allow cache upsert for photo/manual: use synthetic source_url so same user benefits on re-import
          const sourceUrl = rawSourceUrl || (identityKey ? `photo:${identityKey}` : "");

          let heroStoragePath: string | null = null;
          const rawHero = (savedItem.stock_photo_url ?? "").trim() || (savedItem.hero_image_url ?? "").trim();
          const shouldDownloadHero = savedItem.useStockPhotoAsHero !== false && rawHero.startsWith("http");
          const shouldUsePacketAsHero = savedItem.useStockPhotoAsHero !== false && packetImagePath?.trim();

          // A1. Photo import: use packet image as profile hero when checked (copy from seed-packets to journal-photos)
          // Skip if the existing profile already has a real hero (guard against overwriting)
          if (shouldUsePacketAsHero && !shouldDownloadHero && !skipPacketAsHero) {
            try {
              const { data: blob, error: downloadErr } = await supabase.storage.from("seed-packets").download(packetImagePath!);
              if (!downloadErr && blob) {
                const sanitizedKey = ((vendorStr + "_" + identityKey).toLowerCase().replace(/[^a-z0-9]/g, "_")) || `hero-${savedProfileId}`;
                const storagePath = `${user.id}/hero-cache/${sanitizedKey}.jpg`;
                const { error: uploadErr } = await supabase.storage.from("journal-photos").upload(storagePath, blob, {
                  contentType: blob.type || "image/jpeg",
                  upsert: true,
                });
                if (!uploadErr) {
                  heroStoragePath = storagePath;
                  await supabase
                    .from("plant_profiles")
                    .update({ hero_image_path: storagePath, hero_image_url: null })
                    .eq("id", savedProfileId)
                    .eq("user_id", user.id);
                }
              }
            } catch (e) {
              console.warn("[save] Packet-as-hero copy failed:", (e instanceof Error ? e.message : String(e)));
            }
          }

          if (!identityKey || !sourceUrl) return; // need at least identity key to cache

          // A2. Download and store hero image from URL (5s timeout per image)
          if (shouldDownloadHero) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
              const imgRes = await fetch(rawHero, { signal: controller.signal });
              clearTimeout(timeout);
              if (imgRes.ok) {
                const blob = await imgRes.blob();
                const file = new File([blob], "hero.jpg", { type: blob.type || "image/jpeg" });
                const { blob: compressedBlob } = await compressImage(file);
                const sanitizedKey = (vendorStr + "_" + identityKey).toLowerCase().replace(/[^a-z0-9]/g, "_");
                const storagePath = `${user.id}/hero-cache/${sanitizedKey}.jpg`;
                const { error: uploadErr } = await supabase.storage.from("journal-photos").upload(storagePath, compressedBlob, {
                  contentType: "image/jpeg",
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
            type: stripHtmlForDisplay(savedItem.type ?? "").trim() || (savedItem.type ?? "").trim(),
            variety: stripHtmlForDisplay(savedItem.variety ?? "").trim() || (savedItem.variety ?? "").trim(),
            vendor: vendorStr,
            tags: savedItem.tags ?? [],
            scientific_name: stripHtmlForDisplay(savedItem.scientific_name ?? "").trim() || undefined,
            sowing_depth: (savedItem.sowing_depth ?? "").trim() || undefined,
            spacing: (savedItem.spacing ?? "").trim() || undefined,
            sun_requirement: (savedItem.sun_requirement ?? "").trim() || undefined,
            days_to_germination: (savedItem.days_to_germination ?? "").trim() || undefined,
            days_to_maturity: (savedItem.days_to_maturity ?? "").trim() || undefined,
            source_url: sourceUrl,
            hero_image_url: rawHero || undefined,
            plant_description: (savedItem.plant_description ?? "").trim() || undefined,
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

          // C. Write to global_plant_cache so other users benefit (link, photo, and manual imports)
          const wasFromCache = (savedItem as { extractResult?: { cached?: boolean } }).extractResult?.cached === true;
          const vendorNormForCache = (vendorStr || "").toLowerCase().replace(/[^a-z0-9]/g, "_") || "unknown";
          const globalCacheSourceUrl = rawSourceUrl.startsWith("http")
            ? rawSourceUrl
            : (identityKey ? `photo:${identityKey}:${vendorNormForCache}` : "");
          if (
            token &&
            globalCacheSourceUrl &&
            !wasFromCache &&
            identityKey
          ) {
            fetch("/api/seed/write-to-global-cache", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                source_url: globalCacheSourceUrl,
                type: stripHtmlForDisplay(savedItem.type ?? "").trim() || "Imported seed",
                variety: stripHtmlForDisplay(savedItem.variety ?? "").trim(),
                vendor: vendorStr || undefined,
                hero_image_url: rawHero?.startsWith("http") ? rawHero : undefined,
                tags: savedItem.tags ?? [],
                sowing_depth: (savedItem.sowing_depth ?? "").trim() || undefined,
                spacing: (savedItem.spacing ?? "").trim() || undefined,
                sun_requirement: (savedItem.sun_requirement ?? "").trim() || undefined,
                days_to_germination: (savedItem.days_to_germination ?? "").trim() || undefined,
                days_to_maturity: (savedItem.days_to_maturity ?? "").trim() || undefined,
                scientific_name: stripHtmlForDisplay(savedItem.scientific_name ?? "").trim() || undefined,
                plant_description: (savedItem.plant_description ?? "").trim() || undefined,
                growing_notes: (savedItem.growing_notes ?? "").trim() || undefined,
                water: (savedItem.water ?? "").trim() || undefined,
                sowing_method: (savedItem.sowing_method ?? "").trim() || undefined,
                planting_window: (savedItem.planting_window ?? "").trim() || undefined,
              }),
            }).catch(() => {});
          }
        })
      );
    }
    setSavingPhase("Saving\u2026");

    if (token && newProfileIds.length > 0) {
      newProfileIds.forEach((profileId) => {
        fetch("/api/seed/fill-blanks-for-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ profileId, useGemini: true }),
        }).catch(() => {});
      });
    }

    // Fire background-hero-for-profile for ALL saved profiles (new + existing).
    // The endpoint checks if a real hero already exists and returns early, so this is
    // cheap for profiles that already have one. For profiles with only a packet-as-hero
    // or placeholder, it searches for a proper plant photo and upgrades asynchronously.
    if (token && savedItems.length > 0) {
      savedItems.forEach(({ profileId }) => {
        fetch("/api/seed/background-hero-for-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ profileId }),
        }).catch(() => {});
      });
    }

    setSaving(false);
    hapticSuccess();
    setSaveSuccess(true);
    const t = setTimeout(() => {
      clearReviewImportData();
      router.replace("/vault?status=vault&added=1");
    }, 1500);
    saveSuccessTimeoutRef.current = t;
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
      {/* Full-screen image lightbox (tap thumbnail to expand, X or back to close) */}
      {expandedImageSrc && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image"
        >
          <button
            type="button"
            onClick={() => window.history.back()}
            className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/90 text-neutral-700 flex items-center justify-center hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[44px] min-h-[44px]"
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="absolute inset-0 -z-0"
            aria-hidden
          />
          <img
            src={expandedImageSrc}
            alt=""
            className="max-w-full max-h-[85vh] object-contain rounded-lg relative z-10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-2">
        ← Back to Vault
      </Link>
      <h1 className="text-xl font-semibold text-black mb-1">
        {importSource === "purchase_order" ? "Step 1: Import Review" : "Import Review"}
      </h1>
      <p className="text-sm text-black/60 mb-4">
        {importSource === "purchase_order"
          ? "Edit the extracted data below, then find hero photos (Step 2) or save to the vault."
          : "Edit the extracted data below, then save all to the vault."}
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        {importSource === "purchase_order" ? (
          <>
            <p className="text-sm text-black/70 mb-2 w-full">
              Step 2: Find plant photos for each item. We&apos;ll search for images based on your edits above.
            </p>
            <button
              type="button"
              onClick={handleGoToHeroPhotos}
              disabled={saving}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Find Hero Photos
            </button>
            <span className="text-sm text-neutral-500">
              or save without photos below
            </span>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="rounded-xl border border-black/10 bg-white -mx-4 md:-mx-8 w-full overflow-hidden">
        <div className="divide-y divide-black/5">
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
              const lowConfidence = item.confidence_score != null && item.confidence_score < 0.7;
              const inputLowConfidence = lowConfidence ? " review-input-low-confidence" : "";
              return (
                <article
                  key={canonicalRowKey}
                  className={`flex flex-col md:flex-row gap-4 p-4 md:py-4 md:px-6 ${isDuplicate ? "border-l-4 border-l-amber-400 bg-amber-50/50 hover:bg-amber-50/70" : "hover:bg-black/[0.02]"}`}
                >
                  <div className="md:w-52 shrink-0 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => imgSrc && setExpandedImageSrc(imgSrc)}
                        disabled={!imgSrc || heroLoading}
                        className="w-20 h-20 md:w-40 md:h-40 rounded-lg bg-black/5 overflow-hidden flex items-center justify-center relative shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-default disabled:opacity-100"
                        aria-label="Expand image"
                      >
                        {heroLoading ? (
                          <div className="absolute inset-0 bg-neutral-200 animate-pulse rounded-lg" aria-hidden />
                        ) : null}
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt=""
                            className="w-full h-full object-cover object-center relative z-10 pointer-events-none"
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
                      </button>
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
                      {/* Add photo: only for photo-import items (have packet image) */}
                      {packetDataUrl && (
                        <div className="mt-2 space-y-1">
                          <input
                            ref={(el) => { addPhotoInputRefs.current[item.id] = el; }}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            aria-hidden
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) await handleAddPacketPhoto(item.id, file);
                              e.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => addPhotoInputRefs.current[item.id]?.click()}
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline min-h-[44px] min-w-[44px] flex items-center"
                          >
                            + Add packet photo
                          </button>
                          {(item.extraPacketImages?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {(item.extraPacketImages ?? []).map((b64, idx) => {
                                const src = b64.includes("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
                                return (
                                  <div key={idx} className="relative w-10 h-10 rounded overflow-hidden bg-black/5 shrink-0 group">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedImageSrc(src)}
                                      className="absolute inset-0 w-full h-full block z-[1]"
                                      aria-label="Expand image"
                                    />
                                    <img src={src} alt="" className="w-full h-full object-cover pointer-events-none" />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateItem(item.id, {
                                          extraPacketImages: (item.extraPacketImages ?? []).filter((_, i) => i !== idx),
                                        });
                                      }}
                                      className="absolute top-0 right-0 w-4 h-4 rounded-bl bg-black/60 text-white text-[10px] flex items-center justify-center hover:bg-black/80 z-[2] min-w-[16px] min-h-[16px]"
                                      aria-label="Remove photo"
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 content-start">
                    <div className="sm:col-span-2 lg:col-span-1">
                    <div className="inline-flex items-center gap-1.5 flex-wrap w-full">
                      <Combobox
                        value={item.vendor}
                        onChange={(v) => updateItem(item.id, { vendor: v })}
                        suggestions={vendorSuggestions}
                        placeholder="Vendor"
                        aria-label="Vendor"
                        className={`w-full min-w-0 rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]${inputLowConfidence}`}
                      />
                      {mergedSourceCount > 0 && (
                        <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded px-1.5 py-0.5 shrink-0" title={`${mergedSourceCount} additional link${mergedSourceCount === 1 ? "" : "s"} linked`}>
                          +{mergedSourceCount}
                        </span>
                      )}
                    </div>
                    </div>
                    <div>
                    <Combobox
                      value={item.type}
                      onChange={(v) => updateItem(item.id, { type: v })}
                      suggestions={plantSuggestions}
                      placeholder="Plant type"
                      aria-label="Plant type"
                      className={`w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]${inputLowConfidence}`}
                    />
                    </div>
                    <div className="sm:col-span-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Combobox
                          value={decodeHtmlEntities(item.variety ?? item.cleanVariety ?? "")}
                          onChange={(v) => updateItem(item.id, { variety: v })}
                          suggestions={varietySuggestionsByPlant[item.type ?? ""] ?? []}
                          placeholder="Variety"
                          aria-label="Variety"
                          className={`flex-1 min-w-[100px] rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]${inputLowConfidence}`}
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
                            const label = profile
                              ? [profile.name, profile.variety_name].filter(Boolean).join(" — ") || "this variety"
                              : "this variety";
                            return (
                              <span className="text-xs text-emerald-800/90 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                                Packet will be added under <strong>{label}</strong>
                                {profile && (
                                  <Link
                                    href={`/vault/${profile.id}`}
                                    className="text-emerald-700 underline hover:no-underline font-medium min-h-[44px] min-w-[44px] inline-flex items-center"
                                    aria-label={`View ${label} profile`}
                                  >
                                    View profile
                                  </Link>
                                )}
                              </span>
                            );
                          })()}
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
                  </div>
                    <div>
                    <input
                      type="date"
                      value={item.purchaseDate || todayISO()}
                      onChange={(e) => updateItem(item.id, { purchaseDate: e.target.value })}
                      className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]"
                      aria-label="Purchase date"
                    />
                    </div>
                    <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-neutral-500 mb-0.5">Packet notes</label>
                    <textarea
                      value={item.user_notes ?? ""}
                      onChange={(e) => updateItem(item.id, { user_notes: e.target.value })}
                      placeholder="Optional"
                      rows={2}
                      className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]"
                      aria-label="Packet notes"
                    />
                    </div>
                    <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-0.5">Storage location</label>
                    <input
                      type="text"
                      value={item.storage_location ?? ""}
                      onChange={(e) => updateItem(item.id, { storage_location: e.target.value })}
                      placeholder="e.g. Green box"
                      className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm min-h-[44px]"
                      aria-label="Storage location"
                    />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 text-sm text-black/70">
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
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-2">
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
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 text-black/50 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>

      <div
        className="fixed left-0 right-0 bottom-20 z-[100] p-4 bg-paper/95 border-t border-black/10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))" }}
      >
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving || saveSuccess || items.length === 0}
          className="w-full min-h-[56px] rounded-xl bg-emerald text-white text-lg font-semibold hover:bg-emerald/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
        >
          {saveSuccess ? (
            <>
              <CheckmarkIcon className="w-6 h-6" />
              Added!
            </>
          ) : saving ? (
            savingPhase
          ) : (
            "Save All to Vault"
          )}
        </button>
      </div>
    </div>
  );
}
