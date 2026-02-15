"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getZone10bScheduleForPlant, applyZone10bToProfile } from "@/data/zone10b_schedule";
import {
  getRareseedsSlugFromUrl,
  slugToSpaced,
  rareseedsAutotreatment,
} from "@/lib/rareseedsAutotreatment";
import { setReviewImportData, addProgressiveItem, clearProgressiveItems, getProgressiveItems } from "@/lib/reviewImportStorage";
import type { ReviewImportItem } from "@/lib/reviewImportStorage";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { getCanonicalKey } from "@/lib/canonicalKey";
import { identityKeyFromVariety, isGenericTrapName } from "@/lib/identityKey";
import { compressImage } from "@/lib/compressImage";
import { stripVarietySuffixes, varietySlugFromUrl } from "@/app/api/seed/extract/route";
import type { ExtractResponse } from "@/app/api/seed/extract/route";
import { getVendorFromUrl } from "@/lib/vendorNormalize";

type ItemStatus = "pending" | "processing" | "success" | "error" | "skipped";

type DataSource = "Perenual API" | "Vendor Scraper";
type BrainStatus = "New Type: Added to Brain" | "Linked to Existing Profile";

interface ImportItem {
  id: string;
  url: string;
  status: ItemStatus;
  displayName?: string;
  error?: string;
  /** Data source note for this item */
  dataSource?: DataSource;
  /** Brain status note: new type added or linked to existing */
  brainStatus?: BrainStatus;
  /** True when a new plant type was created (show "New Type" badge) */
  newTypeAddedToBrain?: boolean;
  /** Set when link import (extract) succeeds; used to build review payload */
  extractResult?: ExtractResponse & { failed?: boolean };
  /** Progress phase label during processing (e.g. "Scraping Link...", "Rescuing...") */
  phaseLabel?: string;
  /** True when Pass 1 returned failed: true; triggers Pass 2 rescue */
  needsRescue?: boolean;
}

/** Cached scrape + context for one import item (used when resuming after "Teach the Brain"). */
interface PendingImportItem {
  index: number;
  url: string;
  plantName: string;
  varietyName: string | null;
  vendorName: string | null;
  vendorNotes: string | null;
  uploadedImagePath: string | null;
  scrapeData: Record<string, unknown>;
}

function parseUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("http") ? s : "https://" + s));
}

function deriveNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const slug = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const name = slug
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\.(html?|aspx|php)$/i, "")
      .trim();
    return name.length > 1 ? name : "Imported seed";
  } catch {
    return "Imported seed";
  }
}

/** Vendors that block product-page fetches (403). Skip Pass 1 and use AI extraction + Pass 3 only. */
const BLOCKED_VENDOR_DOMAINS = ["rareseeds.com"];

function isBlockedVendorUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_VENDOR_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

/** Persist a hero-photo pass to central import logs (Settings). Same shape as review-import persistHeroSearchLog. Fire-and-forget. error_message uses [Pass N] convention. */
function persistHeroSearchLogFromImport(
  url: string,
  vendorName: string | null | undefined,
  identityKey: string | null,
  passNumber: number,
  success: boolean,
  statusCode: number,
  queryUsed: string,
  heroImageUrl?: string
): void {
  const error_message =
    "[Pass " + passNumber + "] " + (success ? "Success" : "Failed") + "\nQuery: " + (queryUsed || "—");
  (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    if (!token) return;
    const payload = {
      url: url.trim() || "hero-search",
      vendor_name: (vendorName ?? "").trim() || null,
      status_code: statusCode,
      identity_key_generated: (identityKey ?? "").trim() || null,
      error_message,
      ...(success && heroImageUrl?.trim().startsWith("http") ? { hero_image_url: heroImageUrl.trim() } : {}),
    };
    try {
      await fetch("/api/settings/import-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    } catch (_) {
      /* fire-and-forget */
    }
  })();
}

/** True when vendor is Rare Seeds (slug rescue / 403 flow). Ensures Pass 3 Image Search runs for hero. */
function isRareSeedsVendor(vendor: string | null | undefined): boolean {
  const v = (vendor ?? "").toLowerCase();
  return /rare\s*seeds?/.test(v) || v.includes("rareseeds");
}

/** Exact variety names that must not be used for identity or display (prevents 'Vegetables-Vegetables' duplicates). */
/** Parse days_to_maturity string (e.g. "75", "65-80") to a number for harvest_days. */
function parseDaysToMaturityFromScrapeData(d: Record<string, unknown>): number | null {
  const num = d.harvest_days;
  if (typeof num === "number" && Number.isFinite(num) && num > 0 && num < 365) return num;
  const str = (d.days_to_maturity as string) ?? "";
  const m = String(str).trim().match(/^(\d+)/);
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 && n < 365 ? n : null;
}

/** Normalize scrape/extract payload so both naming conventions (sun vs sun_requirement, etc.) work for zone10b and form. */
function normalizedSpecFromScrapeData(d: Record<string, unknown>): {
  sun: string | null;
  plant_spacing: string | null;
  days_to_germination: string | null;
  harvest_days: number | null;
} {
  const sun = (d.sun as string) ?? (d.sun_requirement as string);
  const plant_spacing = (d.plant_spacing as string) ?? (d.spacing as string);
  const days_to_germination = d.days_to_germination != null ? String(d.days_to_germination).trim() : null;
  const harvest_days = parseDaysToMaturityFromScrapeData(d);
  return {
    sun: sun?.trim() || null,
    plant_spacing: plant_spacing?.trim() || null,
    days_to_germination: days_to_germination || null,
    harvest_days,
  };
}

/** Parse streamed result line; return partial ExtractResponse with empty strings for missing fields so we can still show Import Review. */
function parseStreamedExtractResult(payload: string, url: string): ExtractResponse | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    const match = payload.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      raw = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const str = (k: string) => (typeof raw[k] === "string" ? String(raw[k]).trim() : "");
  let tags: string[] = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => String(t).trim())
      .filter(Boolean);
  }
  const type = str("plant_type") || str("type");
  return {
    vendor: str("vendor"),
    type: type || "Imported seed",
    variety: str("variety"),
    tags,
    sowing_depth: str("sowing_depth") || undefined,
    spacing: str("spacing") || undefined,
    sun_requirement: str("sun_requirement") || undefined,
    days_to_germination: str("days_to_germination") || undefined,
    days_to_maturity: str("days_to_maturity") || undefined,
    source_url: str("source_url") || url,
    stock_photo_url: str("stock_photo_url") || str("hero_image_url") || undefined,
    hero_image_url: str("hero_image_url") || str("stock_photo_url") || undefined,
  };
}

export default function VaultImportPage() {
  const { user, session: authSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed") === "1";
  const [urlText, setUrlText] = useState("");
  const [items, setItems] = useState<ImportItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const [knownPlantTypesFromProfiles, setKnownPlantTypesFromProfiles] = useState<string[]>([]);
  const [showNewPlantModal, setShowNewPlantModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState("");
  const [newPlantForm, setNewPlantForm] = useState({
    sowingMethod: "",
    plantingWindow: "",
    sun: "",
    spacing: "",
    germination: "",
    maturity: "",
  });
  const [pendingImportItem, setPendingImportItem] = useState<PendingImportItem | null>(null);
  const [savingBrain, setSavingBrain] = useState(false);
  const [brainSaveError, setBrainSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("plant_profiles").select("name").eq("user_id", user.id).is("deleted_at", null).then(({ data }) => {
      const types = [...new Set((data ?? []).map((r: { name?: string }) => (r.name ?? "").trim().split(/\s+/)[0]?.trim()).filter(Boolean))];
      setKnownPlantTypesFromProfiles(types);
    });
  }, [user?.id]);

  useEffect(() => {
    if (showNewPlantModal) setBrainSaveError(null);
  }, [showNewPlantModal]);

  const hasScheduleForPlant = useCallback(
    (plantName: string) => !!getZone10bScheduleForPlant(plantName),
    []
  );

  const updateItem = useCallback((index: number, update: Partial<ImportItem>) => {
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], ...update };
      return next;
    });
  }, []);

  const runCreateProfileAndPacket = useCallback(
    async (
      i: number,
      url: string,
      plantName: string,
      varietyName: string | null,
      vendorName: string | null,
      vendorNotes: string | null,
      uploadedImagePath: string | null,
      scrapeData: Record<string, unknown>,
      zone10bMerged: ReturnType<typeof applyZone10bToProfile>,
      opts?: { fromSaveToBrain?: boolean }
    ): Promise<{ ok: boolean; dataSource?: DataSource; brainStatus?: BrainStatus; newTypeAddedToBrain?: boolean }> => {
      const uid = user!.id;
      const safePlantName = (plantName ?? "").trim() || "Imported seed";
      const nameKey = getCanonicalKey(safePlantName);
      const varietyKey = getCanonicalKey(varietyName ?? "");
      const { data: allProfiles } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name")
        .eq("user_id", uid)
        .is("deleted_at", null);
      const exact = (allProfiles ?? []).find(
        (p: { name: string; variety_name: string | null }) =>
          getCanonicalKey(p.name ?? "") === nameKey &&
          getCanonicalKey(p.variety_name ?? "") === varietyKey
      );

      let profileId: string;
      const matchedExisting = !!exact;
      if (exact) {
        profileId = exact.id;
        const { data: prof } = await supabase
          .from("plant_profiles")
          .select("sun, harvest_days, plant_spacing, days_to_germination, sowing_method, planting_window")
          .eq("id", profileId)
          .single();
        const p = prof as { sun?: string; harvest_days?: number; plant_spacing?: string; days_to_germination?: string; sowing_method?: string; planting_window?: string } | null;
        const updates: Record<string, unknown> = {};
        if (!p?.sun && zone10bMerged.sun != null) updates.sun = zone10bMerged.sun;
        if ((p?.harvest_days == null || p?.harvest_days === 0) && zone10bMerged.harvest_days != null) updates.harvest_days = zone10bMerged.harvest_days;
        if (!p?.plant_spacing && zone10bMerged.plant_spacing != null) updates.plant_spacing = zone10bMerged.plant_spacing;
        if (!p?.days_to_germination && zone10bMerged.days_to_germination != null) updates.days_to_germination = zone10bMerged.days_to_germination;
        if (zone10bMerged.sowing_method != null) updates.sowing_method = zone10bMerged.sowing_method;
        if (zone10bMerged.planting_window != null) updates.planting_window = zone10bMerged.planting_window;
        if (Object.keys(updates).length > 0) await supabase.from("plant_profiles").update(updates).eq("id", profileId).eq("user_id", uid);
      } else {
        const { data: newProfile, error: profileErr } = await supabase
          .from("plant_profiles")
          .insert({
            user_id: uid,
            name: safePlantName,
            variety_name: varietyName,
            ...(uploadedImagePath && { primary_image_path: uploadedImagePath }),
            ...(zone10bMerged.sun != null && { sun: zone10bMerged.sun }),
            ...(typeof scrapeData.water === "string" && scrapeData.water?.trim() && { water: String(scrapeData.water).trim() }),
            ...(zone10bMerged.plant_spacing != null && { plant_spacing: zone10bMerged.plant_spacing }),
            ...(zone10bMerged.days_to_germination != null && { days_to_germination: zone10bMerged.days_to_germination }),
            ...(zone10bMerged.harvest_days != null && { harvest_days: zone10bMerged.harvest_days }),
            ...(zone10bMerged.sowing_method != null && { sowing_method: zone10bMerged.sowing_method }),
            ...(zone10bMerged.planting_window != null && { planting_window: zone10bMerged.planting_window }),
            ...(typeof scrapeData.pretreatment_notes === "string" && scrapeData.pretreatment_notes?.trim() && { pretreatment_notes: String(scrapeData.pretreatment_notes).trim() }),
          })
          .select("id")
          .single();
        if (profileErr) {
          updateItem(i, { status: "error", displayName: safePlantName, error: profileErr.message });
          return { ok: false };
        }
        profileId = (newProfile as { id: string }).id;
      }

      let dataSource: DataSource = "Vendor Scraper";
      try {
        const perenualRes = await fetch(
          `/api/seed/perenual-enrich?q=${encodeURIComponent(safePlantName)}`,
          { cache: "no-store" }
        );
        if (perenualRes.ok) {
          const perenualData = (await perenualRes.json()) as {
            perenual_id?: number;
            scientific_name?: string | null;
            botanical_care_notes?: Record<string, unknown>;
          } | null;
          if (perenualData?.perenual_id) {
            await supabase
              .from("plant_profiles")
              .update({
                perenual_id: perenualData.perenual_id,
                ...(perenualData.scientific_name != null && { scientific_name: perenualData.scientific_name }),
                ...(perenualData.botanical_care_notes != null && { botanical_care_notes: perenualData.botanical_care_notes }),
              })
              .eq("id", profileId);
            dataSource = "Perenual API";
          }
        }
      } catch {
        // non-fatal
      }

      const packetErr = await supabase.from("seed_packets").insert({
        plant_profile_id: profileId,
        user_id: uid,
        vendor_name: vendorName || null,
        purchase_url: url,
        purchase_date: new Date().toISOString().slice(0, 10),
        qty_status: 100,
        scraped_details: vendorNotes,
        ...(uploadedImagePath && { primary_image_path: uploadedImagePath }),
      }).then((r) => r.error);

      if (packetErr) {
        updateItem(i, { status: "error", displayName: safePlantName, error: packetErr.message });
        return { ok: false };
      }
      // Reinstate profile when adding a packet (e.g. was out_of_stock / archived)
      await supabase.from("plant_profiles").update({ status: "in_stock" }).eq("id", profileId).eq("user_id", uid);

      const brainStatus: BrainStatus = matchedExisting ? "Linked to Existing Profile" : "New Type: Added to Brain";
      const newTypeAddedToBrain = opts?.fromSaveToBrain === true && !matchedExisting;

      updateItem(i, {
        status: "success",
        displayName: safePlantName,
        dataSource,
        brainStatus,
        newTypeAddedToBrain,
      });
      return { ok: true, dataSource, brainStatus, newTypeAddedToBrain };
    },
    [user, updateItem]
  );

  const processOneItem = useCallback(
    async (i: number, cached: PendingImportItem | null) => {
      const parsed = parseUrls(urlText);
      if (i >= parsed.length) {
        setProcessing(false);
        setPendingImportItem(null);
        return;
      }
      const url = parsed[i];
      const uid = user!.id;
      const knownPlantTypes = knownPlantTypesFromProfiles;
      updateItem(i, { status: "processing" });

      let plantName: string;
      let varietyName: string | null;
      let vendorName: string | null;
      let uploadedImagePath: string | null;
      let vendorNotes: string | null;
      let scrapeData: Record<string, unknown>;

      if (cached) {
        plantName = cached.plantName;
        varietyName = cached.varietyName;
        vendorName = cached.vendorName;
        uploadedImagePath = cached.uploadedImagePath;
        vendorNotes = cached.vendorNotes;
        scrapeData = cached.scrapeData;
      } else {
        try {
          const isRareseeds = url.toLowerCase().includes("rareseeds.com");
          const scrapeRes = await fetch("/api/seed/scrape-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              ...(isRareseeds && { knownPlantTypes }),
            }),
          });
          scrapeData = await scrapeRes.json().catch(() => ({}));
          if (!scrapeRes.ok || scrapeData?.error) {
          updateItem(i, {
            status: "error",
            displayName: (scrapeData?.ogTitle as string) ?? deriveNameFromUrl(url),
            error: (scrapeData?.error as string) ?? "Scrape failed",
          });
            processOneItem(i + 1, null);
            return;
          }
          plantName = ((scrapeData.plant ?? scrapeData.plant_name ?? scrapeData.ogTitle ?? deriveNameFromUrl(url)) as string)?.trim() || "Imported seed";
          varietyName = ((scrapeData.variety ?? scrapeData.variety_name ?? "") as string)?.trim() || null;
          vendorName = ((scrapeData.vendor ?? scrapeData.vendor_name ?? "") as string).trim() || null;
          if (isRareseeds) {
            const slug = getRareseedsSlugFromUrl(url);
            if (slug) {
              const result = rareseedsAutotreatment(slugToSpaced(slug), knownPlantTypes);
              plantName = result.plant_name;
              varietyName = result.variety_name.trim() || null;
            }
          }
          updateItem(i, { displayName: plantName });

          uploadedImagePath = null;
          if (scrapeData.imageUrl) {
            try {
              const proxyRes = await fetch("/api/seed/proxy-image?url=" + encodeURIComponent(scrapeData.imageUrl as string));
              if (proxyRes.ok) {
                const rawBlob = await proxyRes.blob();
                if (rawBlob.type.startsWith("image/")) {
                  const file = new File([rawBlob], "packet.jpg", { type: rawBlob.type });
                  const { blob } = await compressImage(file);
                  const path = `${uid}/${crypto.randomUUID()}.jpg`;
                  const { error: uploadErr } = await supabase.storage.from("seed-packets").upload(path, blob, { contentType: "image/jpeg", upsert: false });
                  if (!uploadErr) uploadedImagePath = path;
                }
              }
            } catch {
              // non-fatal
            }
          }
          vendorNotes = [scrapeData.plant_description, scrapeData.growing_notes]
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .join("\n\n")
            .trim() || null;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          updateItem(i, { status: "error", displayName: deriveNameFromUrl(url), error: message });
          processOneItem(i + 1, null);
          return;
        }
      }

      const hasSchedule = cached ? true : !!getZone10bScheduleForPlant(plantName);
      const needsDnaPopup = scrapeData.REQUIRE_CONFIG === true || !hasSchedule;

      if (!cached && needsDnaPopup) {
        setPendingImportItem({
          index: i,
          url,
          plantName,
          varietyName,
          vendorName,
          vendorNotes,
          uploadedImagePath,
          scrapeData,
        });
        setNewPlantName(plantName);
        const spec = normalizedSpecFromScrapeData(scrapeData);
        setNewPlantForm({
          sowingMethod: "",
          plantingWindow: "",
          sun: spec.sun ?? "",
          spacing: spec.plant_spacing ?? "",
          germination: spec.days_to_germination ?? "",
          maturity: spec.harvest_days != null ? String(spec.harvest_days) : "",
        });
        setShowNewPlantModal(true);
        return;
      }

      const spec = normalizedSpecFromScrapeData(scrapeData);
      const zone10bMerged = applyZone10bToProfile(plantName.trim(), {
        sun: spec.sun,
        plant_spacing: spec.plant_spacing,
        days_to_germination: spec.days_to_germination,
        harvest_days: spec.harvest_days,
      });

      const result = await runCreateProfileAndPacket(
        i,
        url,
        plantName,
        varietyName,
        vendorName,
        vendorNotes,
        uploadedImagePath,
        scrapeData,
        zone10bMerged
      );
      if (!result.ok) {
        processOneItem(i + 1, null);
        return;
      }

      processOneItem(i + 1, null);
    },
    [urlText, user, updateItem, knownPlantTypesFromProfiles, runCreateProfileAndPacket]
  );

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUrlText("");
    setItems([]);
    setProcessing(false);
    stopRequestedRef.current = false;
    clearProgressiveItems();
  }, []);

  const handleStopAndReview = useCallback(() => {
    // Signal the processing loop to stop, then navigate to review with what we have
    stopRequestedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const progressiveItems = getProgressiveItems();
    if (progressiveItems.length > 0) {
      setReviewImportData({ items: progressiveItems });
      clearProgressiveItems();
      router.push("/vault/review-import");
    }
    setProcessing(false);
  }, [router]);

  const handleRetryFailed = useCallback(() => {
    // Reset failed items to pending and re-trigger processing
    setItems((prev) => prev.map((item) => item.status === "error" ? { ...item, status: "pending" as ItemStatus, error: undefined, phaseLabel: undefined } : item));
  }, []);

  const processBatch = useCallback(async () => {
    const parsed = parseUrls(urlText);
    if (parsed.length === 0) return;
    if (!user?.id) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    setProcessing(true);
    setItems(parsed.map((url) => ({ id: crypto.randomUUID(), url, status: "pending" as const })));

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authSession?.access_token) headers.Authorization = `Bearer ${authSession.access_token}`;

    type ResultRow = (ExtractResponse & { failed?: boolean; productPageStatus?: number; errorMessage?: string }) | undefined;
    const results: ResultRow[] = new Array(parsed.length);

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const randomDelay = () => delay(500);

    const fetchExtractMetadata = async (url: string, i: number) => {
      const skipProductPageFetch = isBlockedVendorUrl(url);
      const res = await fetch("/api/seed/extract-metadata", {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify({
          url,
          batchIndex: i,
          batchTotal: parsed.length,
          isFirstInBatch: i === 0,
          skipProductPageFetch: skipProductPageFetch || undefined,
        }),
      });
      const data = (await res.json()) as ExtractResponse & { failed?: boolean; error?: string; productPageStatus?: number };
      return { res, data };
    };

    const applyPass1Result = (
      i: number,
      url: string,
      res: Response,
      data: ExtractResponse & { failed?: boolean; error?: string; productPageStatus?: number }
    ) => {
      if (res.status === 404 && data.error === "LINK_NOT_FOUND") {
        const fallback: ExtractResponse & { linkNotFound: true; productPageStatus?: number } = {
          vendor: getVendorFromUrl(url),
          type: "Imported seed",
          variety: deriveNameFromUrl(url),
          tags: [],
          source_url: url,
          linkNotFound: true,
          productPageStatus: data.productPageStatus ?? 404,
        };
        results[i] = fallback;
        const displayName = fallback.variety || fallback.vendor || "Dead link";
        updateItem(i, {
          status: "success",
          displayName,
          extractResult: fallback,
          phaseLabel: undefined,
        });
        return;
      }
      if (!res.ok) {
        const errMsg = data.error ?? "Failed";
        results[i] = {
          vendor: getVendorFromUrl(url),
          type: "Imported seed",
          variety: "",
          tags: [],
          productPageStatus: data.productPageStatus ?? null,
          errorMessage: errMsg,
        } as ResultRow;
        updateItem(i, { status: "error", error: errMsg });
        return;
      }
      results[i] = { ...data, productPageStatus: data.productPageStatus };
      const displayName =
        [data.type, data.variety].filter(Boolean).join(" ").trim() ||
        data.variety ||
        data.vendor ||
        "Imported seed";
      if (data.failed) {
        updateItem(i, {
          status: "processing",
          displayName,
          extractResult: data,
          phaseLabel: "Rescuing...",
          needsRescue: true,
        });
      } else {
        updateItem(i, {
          status: "processing",
          displayName,
          extractResult: data,
          phaseLabel: "Extraction complete. Finding hero photo...",
        });
      }
    };

    // Pass 1: Metadata only — chunks of 3, 1–2s delay between chunks, retry once on 429/403
    for (let chunkStart = 0; chunkStart < parsed.length; chunkStart += 3) {
      if (signal.aborted) break;
      const indices = [chunkStart, chunkStart + 1, chunkStart + 2].filter((j) => j < parsed.length);
      for (const i of indices) {
        updateItem(i, { status: "processing", phaseLabel: "Scraping Link..." });
      }
      const outcomes = await Promise.all(
        indices.map(async (i) => {
          try {
            const { res, data } = await fetchExtractMetadata(parsed[i], i);
            return { i, url: parsed[i], res, data, err: null as Error | null };
          } catch (err) {
            return {
              i,
              url: parsed[i],
              res: null,
              data: null,
              err: err instanceof Error ? err : new Error(String(err)),
            };
          }
        })
      );
      for (const { i, url, res, data, err } of outcomes) {
        if (signal.aborted) break;
        if (err) {
          if (err.name === "AbortError") continue;
          results[i] = {
            vendor: getVendorFromUrl(url),
            type: "Imported seed",
            variety: "",
            tags: [],
            errorMessage: err.message,
          } as ResultRow;
          updateItem(i, { status: "error", displayName: deriveNameFromUrl(url), error: err.message });
          continue;
        }
        if (!res || data === null) continue;
        const isRateLimited = res.status === 429 && (data as { error?: string }).error === "RATE_LIMITED";
        const isForbidden = res.status === 403;
        if (isRateLimited || isForbidden) {
          await delay(5000);
          if (signal.aborted) break;
          try {
            const { res: res2, data: data2 } = await fetchExtractMetadata(url, i);
            if (res2.ok) {
              applyPass1Result(i, url, res2, data2 as ExtractResponse & { failed?: boolean; error?: string; productPageStatus?: number });
            } else {
              // RareSeeds 403 recovery: use URL slug as variety and run Pass 2/3 (rescue + Pass 3 image search "[Variety] Rare Seeds")
              const isRareSeeds403 = isForbidden && url.toLowerCase().includes("rareseeds.com");
              if (isRareSeeds403) {
                const slugVariety = (() => {
                  const slug = getRareseedsSlugFromUrl(url);
                  if (slug) return slugToSpaced(slug).replace(/\b\w/g, (c) => c.toUpperCase());
                  return varietySlugFromUrl(url);
                })();
                const synthetic: ResultRow = {
                  vendor: getVendorFromUrl(url),
                  type: "Imported seed",
                  variety: slugVariety || "",
                  tags: [],
                  failed: true,
                  productPageStatus: 403,
                };
                results[i] = synthetic;
                const displayName = slugVariety ? `Imported seed ${slugVariety}`.trim() : deriveNameFromUrl(url);
                updateItem(i, {
                  status: "processing",
                  displayName,
                  extractResult: synthetic,
                  phaseLabel: "Rescuing...",
                  needsRescue: true,
                });
              } else {
                const msg = res2.status === 429 || res2.status === 403 ? "Rate limited (vendor blocked request)" : (data2 as { error?: string })?.error ?? "Failed";
                results[i] = {
                  vendor: getVendorFromUrl(url),
                  type: "Imported seed",
                  variety: "",
                  tags: [],
                  productPageStatus: (data2 as { productPageStatus?: number })?.productPageStatus ?? res2.status,
                  errorMessage: msg,
                } as ResultRow;
                updateItem(i, { status: "error", displayName: deriveNameFromUrl(url), error: msg });
              }
            }
          } catch (retryErr) {
            if (retryErr instanceof Error && retryErr.name === "AbortError") break;
            // RareSeeds 403 recovery: synthetic failed so Pass 2/3 run (slug → variety, Pass 3 "[Variety] Rare Seeds" for image)
            const isRareSeeds403 = isForbidden && url.toLowerCase().includes("rareseeds.com");
            if (isRareSeeds403) {
              const slugVariety = (() => {
                const slug = getRareseedsSlugFromUrl(url);
                if (slug) return slugToSpaced(slug).replace(/\b\w/g, (c) => c.toUpperCase());
                return varietySlugFromUrl(url);
              })();
              const synthetic: ResultRow = {
                vendor: getVendorFromUrl(url),
                type: "Imported seed",
                variety: slugVariety || "",
                tags: [],
                failed: true,
                productPageStatus: 403,
              };
              results[i] = synthetic;
              const displayName = slugVariety ? `Imported seed ${slugVariety}`.trim() : deriveNameFromUrl(url);
              updateItem(i, {
                status: "processing",
                displayName,
                extractResult: synthetic,
                phaseLabel: "Rescuing...",
                needsRescue: true,
              });
            } else {
              results[i] = {
                vendor: getVendorFromUrl(url),
                type: "Imported seed",
                variety: "",
                tags: [],
                errorMessage: "Rate limited (vendor blocked request)",
              } as ResultRow;
              updateItem(i, { status: "error", displayName: deriveNameFromUrl(url), error: "Rate limited (vendor blocked request)" });
            }
          }
        } else {
          applyPass1Result(i, url, res, data);
        }
      }
      if (chunkStart + 3 < parsed.length && !signal.aborted) {
        await randomDelay();
      }
    }

    if (signal.aborted) {
      abortControllerRef.current = null;
      setProcessing(false);
      return;
    }

    // Pass 2: Rescue failed links (3 at a time)
    const rescueIndices = results
      .map((r, i) => (r?.failed ? i : -1))
      .filter((i) => i >= 0);
    const RESCUE_CONCURRENCY = 3;
    for (let chunkStart = 0; chunkStart < rescueIndices.length; chunkStart += RESCUE_CONCURRENCY) {
      if (signal.aborted) break;
      const chunk = rescueIndices.slice(chunkStart, chunkStart + RESCUE_CONCURRENCY);
      await Promise.all(
        chunk.map(async (i, pos) => {
          const ii = chunkStart + pos;
          const url = parsed[i];
          updateItem(i, { phaseLabel: "Rescuing Data via Search..." });
          try {
            const res = await fetch("/api/seed/extract-rescue", {
              method: "POST",
              headers,
              signal,
              body: JSON.stringify({
                url,
                batchIndex: ii,
                batchTotal: rescueIndices.length,
                isFirstInBatch: ii === 0,
              }),
            });
            const data = (await res.json()) as ExtractResponse;
            if (!res.ok) {
              const errMsg = (data as { error?: string }).error ?? "Rescue failed";
              const r = results[i];
              if (r) {
                (r as NonNullable<ResultRow>).errorMessage = errMsg;
              } else {
                results[i] = { vendor: getVendorFromUrl(url), type: "Imported seed", variety: "", tags: [], errorMessage: errMsg } as ResultRow;
              }
              updateItem(i, { status: "error", error: errMsg });
              return;
            }
            results[i] = { ...results[i], ...data, failed: false };
            const displayName =
              [data.type, data.variety].filter(Boolean).join(" ").trim() || "Imported seed";
            updateItem(i, {
              extractResult: results[i],
              displayName,
              phaseLabel: "Rescue complete. Finding hero photo...",
              needsRescue: false,
              status: "processing",
            });
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
            const message = err instanceof Error ? err.message : "Rescue failed";
            const r2 = results[i];
            if (r2) (r2 as NonNullable<ResultRow>).errorMessage = message;
            else results[i] = { vendor: getVendorFromUrl(url), type: "Imported seed", variety: "", tags: [], errorMessage: message } as ResultRow;
            updateItem(i, { status: "error", error: message });
          }
        })
      );
    }

    if (signal.aborted) {
      abortControllerRef.current = null;
      setProcessing(false);
      return;
    }

    // Pass 3: Photo — run find-hero-photo for items that need it (2 at a time). Log every attempt via persistHeroSearchLogFromImport.
    const heroIndices: number[] = [];
    for (let i = 0; i < parsed.length; i++) {
      if (signal.aborted) break;
      const r = results[i];
      if (!r || r.failed) continue;
      const linkNotFound = !!(r as { linkNotFound?: boolean }).linkNotFound;
      if (linkNotFound) {
        updateItem(i, { status: "success", phaseLabel: undefined });
        continue;
      }
      const hasHeroFromPass1 = !!(r.hero_image_url?.trim() || r.stock_photo_url?.trim());
      const isRareSeeds = isRareSeedsVendor(r.vendor);
      if (hasHeroFromPass1 && !isRareSeeds) {
        updateItem(i, { status: "success", phaseLabel: undefined });
        continue;
      }
      if (!(r.type?.trim() || r.variety?.trim())) {
        updateItem(i, { status: "success", phaseLabel: undefined });
        continue;
      }
      const plantTypeNorm = (r.type ?? "").trim().toLowerCase();
      if (isGenericTrapName(r.type) || /^vegetables?$/.test(plantTypeNorm)) {
        updateItem(i, { status: "success", phaseLabel: undefined });
        continue;
      }
      heroIndices.push(i);
    }
    const heroStatusByIndex: string[] = new Array(parsed.length).fill("");
    const HERO_CONCURRENCY = 2;
    for (let chunkStart = 0; chunkStart < heroIndices.length; chunkStart += HERO_CONCURRENCY) {
      if (signal.aborted) break;
      const chunk = heroIndices.slice(chunkStart, chunkStart + HERO_CONCURRENCY);
      await Promise.all(
        chunk.map(async (i) => {
          const r = results[i]!;
          const sourceUrl = parsed[i] ?? (r.source_url ?? "").trim();
          const idKey = identityKeyFromVariety(r.type ?? "", r.variety ?? "") || null;
          const queryUsed = `${(r.type ?? "").trim()} ${(r.variety ?? "").trim()}`.trim() || "—";
          let heroSummary = "";

          updateItem(i, { phaseLabel: "Finding Hero Photo...", status: "processing" });
          let heroUrl = "";
          try {
            const res = await fetch("/api/seed/find-hero-photo", {
              method: "POST",
              headers,
              signal,
              body: JSON.stringify({
                name: r.type,
                variety: r.variety,
                vendor: r.vendor ?? "",
                scientific_name: (r as { scientific_name?: string }).scientific_name ?? "",
                identity_key: idKey || undefined,
                pass: 3,
              }),
            });
            const data = (await res.json()) as { hero_image_url?: string; image_url?: string; url?: string };
            heroUrl = (data.hero_image_url ?? data.image_url ?? data.url)?.trim() ?? "";
            if (heroUrl.startsWith("http")) {
              results[i] = { ...r, hero_image_url: heroUrl, stock_photo_url: heroUrl };
              updateItem(i, { extractResult: results[i] });
            }
            heroSummary = heroUrl.startsWith("http") ? "Pass 3 Success" : "Pass 3 Fail";
            persistHeroSearchLogFromImport(sourceUrl, r.vendor, idKey, 3, heroUrl.startsWith("http"), res.status, queryUsed, heroUrl.startsWith("http") ? heroUrl : undefined);
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
            heroSummary = "Pass 3 Fail";
            persistHeroSearchLogFromImport(sourceUrl, r.vendor, idKey, 3, false, 0, queryUsed, undefined);
          }
          heroStatusByIndex[i] = heroSummary;

          if (!heroUrl?.startsWith("http") && (r.type?.trim() || r.variety?.trim())) {
            console.log("[PASS 3] Search Failed: Retrying with simplified Pass 4 query...");
            updateItem(i, { phaseLabel: "Searching AI (fallback)...", status: "processing" });
            await delay(500);
            if (signal.aborted) return;
            try {
              const res4 = await fetch("/api/seed/find-hero-photo", {
                method: "POST",
                headers,
                signal,
                body: JSON.stringify({
                  name: r.type,
                  variety: r.variety,
                  vendor: "",
                  identity_key: idKey || undefined,
                  pass: 4,
                }),
              });
              const data4 = (await res4.json()) as { hero_image_url?: string; image_url?: string; url?: string };
              const heroUrl4 = (data4.hero_image_url ?? data4.image_url ?? data4.url)?.trim() ?? "";
              if (heroUrl4.startsWith("http")) {
                results[i] = { ...results[i], hero_image_url: heroUrl4, stock_photo_url: heroUrl4 } as ResultRow;
                updateItem(i, { extractResult: results[i] });
                heroUrl = heroUrl4;
              }
              heroSummary += heroUrl4.startsWith("http") ? ", Pass 4 Success" : ", Pass 4 Fail";
              persistHeroSearchLogFromImport(sourceUrl, r.vendor, idKey, 4, heroUrl4.startsWith("http"), res4.status, queryUsed, heroUrl4.startsWith("http") ? heroUrl4 : undefined);
            } catch (pass4Err) {
              if (pass4Err instanceof Error && pass4Err.name === "AbortError") return;
              heroSummary += ", Pass 4 Fail";
              persistHeroSearchLogFromImport(sourceUrl, r.vendor, idKey, 4, false, 0, queryUsed, undefined);
            }
            heroStatusByIndex[i] = heroSummary;
          }

          if (!heroUrl?.startsWith("http") && isRareSeedsVendor(r.vendor) && (r.type?.trim() || r.variety?.trim())) {
            console.log("[PASS 4] Search Failed: Retrying with Pass 5 (clean plant name)...");
            updateItem(i, { phaseLabel: "Searching AI (final try)...", status: "processing" });
            try {
              const res5 = await fetch("/api/seed/find-hero-photo", {
                method: "POST",
                headers,
                signal,
                body: JSON.stringify({
                  name: r.type,
                  variety: r.variety,
                  vendor: r.vendor ?? "",
                  identity_key: idKey || undefined,
                  pass: 5,
                }),
              });
              const data5 = (await res5.json()) as { hero_image_url?: string; image_url?: string; url?: string };
              const heroUrl5 = (data5.hero_image_url ?? data5.image_url ?? data5.url)?.trim() ?? "";
              if (heroUrl5.startsWith("http")) {
                results[i] = { ...results[i], hero_image_url: heroUrl5, stock_photo_url: heroUrl5 } as ResultRow;
                updateItem(i, { extractResult: results[i] });
              }
              heroSummary += heroUrl5.startsWith("http") ? ", Pass 5 Success" : ", Pass 5 Fail";
              persistHeroSearchLogFromImport(sourceUrl, r.vendor, idKey, 5, heroUrl5.startsWith("http"), res5.status, queryUsed, heroUrl5.startsWith("http") ? heroUrl5 : undefined);
            } catch (pass5Err) {
              if (pass5Err instanceof Error && pass5Err.name === "AbortError") return;
              heroSummary += ", Pass 5 Fail";
              persistHeroSearchLogFromImport(sourceUrl, r.vendor, idKey, 5, false, 0, queryUsed, undefined);
            }
            heroStatusByIndex[i] = heroSummary;
          }

          updateItem(i, { status: "success", phaseLabel: undefined });
        })
      );
    }

    if (signal.aborted) {
      abortControllerRef.current = null;
      setProcessing(false);
      return;
    }

    // Build review items from pipeline results (identity key from variety only; skip generic trap names)
    const reviewItems: ReviewImportItem[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < parsed.length; i++) {
      const r = results[i];
      if (!r || r.failed) continue;
      const varietyRaw = (r.variety ?? "").trim();
      if (isGenericTrapName(varietyRaw)) continue; // FAILED: do not generate identity key or add to review
      const varietyCleaned = stripVarietySuffixes(varietyRaw) || varietyRaw;
      const variety = decodeHtmlEntities(varietyCleaned) || varietyCleaned;
      const heroUrl = r.hero_image_url?.trim() || r.stock_photo_url?.trim();
      const type = decodeHtmlEntities(r.type ?? "Imported seed") || (r.type ?? "Imported seed");
      const identityKey = identityKeyFromVariety(type, variety) || "imported";
      const originalType = (r.type ?? "Imported seed").trim();
      const originalVariety = varietyRaw;
      reviewItems.push({
        id: crypto.randomUUID(),
        imageBase64: "",
        fileName: "link",
        vendor: decodeHtmlEntities(r.vendor ?? "") || (r.vendor ?? ""),
        type,
        variety: variety || "",
        originalType,
        originalVariety,
        cleanVariety: variety || "",
        scientific_name: (r as { scientific_name?: string }).scientific_name ?? undefined,
        tags: r.tags ?? [],
        purchaseDate: today,
        sowing_depth: r.sowing_depth,
        spacing: r.spacing,
        sun_requirement: r.sun_requirement,
        days_to_germination: r.days_to_germination,
        days_to_maturity: r.days_to_maturity,
        source_url: r.source_url ?? parsed[i],
        stock_photo_url: r.stock_photo_url?.trim() || undefined,
        hero_image_url: heroUrl || "/seedling-icon.svg",
        useStockPhotoAsHero: !!heroUrl,
        linkNotFound: !!(r as { linkNotFound?: boolean }).linkNotFound,
        identityKey,
        water: (r as { water?: string }).water?.trim() || undefined,
        sun: (r as { sun?: string }).sun ?? r.sun_requirement,
        plant_spacing: (r as { plant_spacing?: string }).plant_spacing ?? r.spacing,
        harvest_days: (() => {
          const hd = (r as Record<string, unknown>).harvest_days;
          return typeof hd === "number" ? hd : undefined;
        })(),
      });
    }
    // Mark later duplicates in the same batch so UI can show "Merge with existing"
    const seenKeys = new Set<string>();
    for (const item of reviewItems) {
      const key = item.identityKey ?? "";
      if (key && seenKeys.has(key)) {
        item.isPotentialDuplicate = true;
      } else if (key) {
        seenKeys.add(key);
      }
    }

    // Persist import history for troubleshooting (Pass 1/2/3 + hero summary). Summary row includes hero_image_url and Hero: Pass N status.
    if (user?.id) {
      const logEntries = parsed.map((url, i) => {
        const r = results[i] as ResultRow | undefined;
        const reason = r?.errorMessage?.trim() || (r?.productPageStatus != null ? `Status ${r.productPageStatus}` : "No trace");
        const heroStatus = heroStatusByIndex[i]?.trim();
        const heroSuffix = heroStatus ? ` | Hero: ${heroStatus}` : "";
        const finalHeroUrl = (r?.hero_image_url ?? r?.stock_photo_url)?.trim();
        return {
          user_id: user.id,
          url,
          vendor_name: (r?.vendor ?? getVendorFromUrl(url)) || null,
          status_code: r?.productPageStatus ?? 0,
          identity_key_generated: (r && !isGenericTrapName(r.variety) ? identityKeyFromVariety(r.type ?? "", r.variety ?? "") || null : null),
          error_message: `[Link Import] - ${reason}${heroSuffix}`,
          ...(finalHeroUrl?.startsWith("http") ? { hero_image_url: finalHeroUrl } : {}),
        };
      });
      supabase.from("seed_import_logs").insert(logEntries).then(({ error }) => {
        if (error) console.warn("[import] seed_import_logs insert failed:", error.message);
      });
    }

    abortControllerRef.current = null;
    setProcessing(false);
    stopRequestedRef.current = false;
    // Merge progressive items with final batch
    const allItems = [...getProgressiveItems(), ...reviewItems.filter((ri) => !getProgressiveItems().some((pi) => pi.id === ri.id))];
    clearProgressiveItems();
    setReviewImportData({ items: allItems.length > 0 ? allItems : reviewItems });
    if ((allItems.length > 0 || reviewItems.length > 0)) router.push("/vault/review-import");
  }, [urlText, user?.id, router, updateItem, authSession?.access_token]);

  const handleAddNewPlant = useCallback(async () => {
    if (!user?.id || !newPlantName.trim() || !pendingImportItem) return;
    setBrainSaveError(null);
    setSavingBrain(true);
    const pending = pendingImportItem;
    setPendingImportItem(null);
    setShowNewPlantModal(false);

    const spec = normalizedSpecFromScrapeData(pending.scrapeData as Record<string, unknown>);
    const zone10b = applyZone10bToProfile(pending.plantName.trim(), {
      sun: spec.sun,
      plant_spacing: spec.plant_spacing,
      days_to_germination: spec.days_to_germination,
      harvest_days: spec.harvest_days,
    });
    const maturityStr = newPlantForm.maturity.trim();
    const maturityNum = maturityStr === "" ? null : parseInt(maturityStr.replace(/^(\d+).*/, "$1"), 10);
    const zone10bMerged = {
      ...zone10b,
      sowing_method: newPlantForm.sowingMethod.trim() || zone10b.sowing_method,
      planting_window: newPlantForm.plantingWindow.trim() || zone10b.planting_window,
      sun: newPlantForm.sun.trim() || zone10b.sun,
      plant_spacing: newPlantForm.spacing.trim() || zone10b.plant_spacing,
      days_to_germination: newPlantForm.germination.trim() || zone10b.days_to_germination,
      harvest_days: maturityNum != null && !Number.isNaN(maturityNum) ? maturityNum : zone10b.harvest_days,
    };

    await runCreateProfileAndPacket(
      pending.index,
      pending.url,
      pending.plantName,
      pending.varietyName,
      pending.vendorName,
      pending.vendorNotes,
      pending.uploadedImagePath,
      pending.scrapeData,
      zone10bMerged,
      { fromSaveToBrain: true } // legacy param name; creates profile with form values
    );
    setSavingBrain(false);
    processOneItem(pending.index + 1, null);
  }, [user?.id, newPlantName, newPlantForm, pendingImportItem, processOneItem, runCreateProfileAndPacket]);

  const completed = items.filter(
    (i) => i.status === "success" || i.status === "error" || i.status === "skipped"
  ).length;
  const total = items.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const closeToVault = useCallback(() => {
    router.push("/vault");
  }, [router]);

  const mainContent = (
    <>
      {showNewPlantModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-4 sm:pb-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="new-plant-dialog-title">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-6 pb-2">
              <h2 id="new-plant-dialog-title" className="text-lg font-semibold text-neutral-900">New Plant Detected: Add Plant Defaults</h2>
              <p className="text-sm text-neutral-600 mt-1">{newPlantName}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 border-t border-neutral-100">
              <div className="space-y-4">
                <div>
                  <label htmlFor="new-plant-sowing" className="block text-sm font-medium text-neutral-700 mb-1">Sowing Method</label>
                  <input
                    id="new-plant-sowing"
                    type="text"
                    value={newPlantForm.sowingMethod}
                    onChange={(e) => setNewPlantForm((f) => ({ ...f, sowingMethod: e.target.value }))}
                    placeholder="e.g. Direct Sow or Start Indoors / Transplant"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="new-plant-window" className="block text-sm font-medium text-neutral-700 mb-1">Planting Window</label>
                  <input
                    id="new-plant-window"
                    type="text"
                    value={newPlantForm.plantingWindow}
                    onChange={(e) => setNewPlantForm((f) => ({ ...f, plantingWindow: e.target.value }))}
                    placeholder="e.g. Spring: Feb-May"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="new-plant-sun" className="block text-sm font-medium text-neutral-700 mb-1">Sun</label>
                  <input
                    id="new-plant-sun"
                    type="text"
                    value={newPlantForm.sun}
                    onChange={(e) => setNewPlantForm((f) => ({ ...f, sun: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="new-plant-spacing" className="block text-sm font-medium text-neutral-700 mb-1">Spacing</label>
                  <input
                    id="new-plant-spacing"
                    type="text"
                    value={newPlantForm.spacing}
                    onChange={(e) => setNewPlantForm((f) => ({ ...f, spacing: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="new-plant-germination" className="block text-sm font-medium text-neutral-700 mb-1">Germination</label>
                  <input
                    id="new-plant-germination"
                    type="text"
                    value={newPlantForm.germination}
                    onChange={(e) => setNewPlantForm((f) => ({ ...f, germination: e.target.value }))}
                    placeholder="e.g. 7-14 days"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="new-plant-maturity" className="block text-sm font-medium text-neutral-700 mb-1">Maturity (days)</label>
                  <input
                    id="new-plant-maturity"
                    type="text"
                    value={newPlantForm.maturity}
                    onChange={(e) => setNewPlantForm((f) => ({ ...f, maturity: e.target.value }))}
                    placeholder="e.g. 80"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col gap-2 p-4 border-t-2 border-neutral-200 bg-white rounded-b-xl sticky bottom-0 z-50">
              {brainSaveError && (
                <p className="text-sm text-red-600" role="alert">
                  {brainSaveError}
                </p>
              )}
              <div className="flex flex-row gap-3 justify-stretch sm:justify-end">
                <button
                  type="button"
                  onClick={handleAddNewPlant}
                  disabled={savingBrain}
                  style={{ backgroundColor: "#10b981", color: "#ffffff", border: "none" }}
                  className="min-h-[44px] min-w-[44px] flex-1 sm:flex-none px-5 py-3 rounded-lg font-semibold disabled:opacity-60 shadow-md border-0 !bg-emerald-600 !text-white hover:!bg-emerald-700"
                >
                  {savingBrain ? "Adding…" : "Add to Vault"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrainSaveError(null);
                    if (pendingImportItem) {
                      const pending = pendingImportItem;
                      setPendingImportItem(null);
                      updateItem(pending.index, { status: "skipped", displayName: pending.plantName });
                      processOneItem(pending.index + 1, null);
                    } else {
                      setPendingImportItem(null);
                    }
                    setShowNewPlantModal(false);
                  }}
                  disabled={savingBrain}
                  className="min-h-[44px] min-w-[44px] flex-1 sm:flex-none px-4 py-3 rounded-lg border-2 border-neutral-300 text-neutral-800 font-medium hover:bg-neutral-100 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-2xl">
        {!embed && (
          <Link
            href="/vault"
            className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6"
          >
            ← Back to Vault
          </Link>
        )}
        {!embed && (
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">
            Link Import
          </h1>
        )}
        <p className="text-neutral-600 text-sm mb-6">
          Paste one URL per line. Each link is analyzed with Google Search, then you review and save to your vault—same flow as photo import.
        </p>

        <textarea
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          placeholder={"https://www.rareseeds.com/...\nhttps://www.johnnyseeds.com/..."}
          rows={10}
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald font-mono text-sm resize-y"
          aria-label="URLs to import (one per line)"
        />

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            type="button"
            onClick={processBatch}
            disabled={processing || parseUrls(urlText).length === 0 || !user}
            title={
              !user
                ? "Sign in to import seeds"
                : parseUrls(urlText).length === 0
                  ? "Paste at least one URL (one per line)"
                  : processing
                    ? "Import in progress"
                    : undefined
            }
            className="py-3 px-6 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {processing ? "Processing…" : "Import"}
          </button>
          {!user && (
            <p className="text-sm text-amber-700 self-center">
              Sign in to import seeds.
            </p>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600 mb-2">
              <span>
                {completed} of {total} processed · {progressPercent}%
              </span>
              <div className="flex items-center gap-3 flex-shrink-0">
                {processing ? (
                  <button type="button" onClick={handleStopAndReview} className="text-amber-600 hover:text-amber-800 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center">
                    Stop & Review
                  </button>
                ) : items.some((i) => i.status === "error") ? (
                  <button type="button" onClick={handleRetryFailed} className="text-blue-600 hover:text-blue-800 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center">
                    Retry Failed
                  </button>
                ) : null}
                <button type="button" onClick={handleCancel} className="text-red-500 hover:text-red-700 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center">
                  Clear All
                </button>
              </div>
            </div>
            <div
              className="h-2 rounded-full bg-black/10 overflow-hidden mb-4"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <ul className="space-y-2 list-none p-0 m-0">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white border text-sm ${
                    item.status === "pending"
                      ? "border-black/5 text-neutral-500"
                      : item.status === "processing"
                        ? "border-blue-200 text-blue-700"
                        : item.status === "success"
                          ? "border-emerald-200 text-emerald-700"
                          : item.status === "error"
                            ? "border-red-200 text-red-700"
                            : "border-black/5 text-neutral-500"
                  }`}
                >
                  {item.status === "pending" && (
                    <span className="shrink-0 text-neutral-400" aria-hidden title="Waiting">
                      ⌛
                    </span>
                  )}
                  {item.status === "processing" && (
                    <span className="shrink-0 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden title="Processing" />
                  )}
                  {item.status === "success" && (
                    <span className="shrink-0 text-emerald-600 font-bold" aria-hidden title="Success">
                      ✓
                    </span>
                  )}
                  {item.status === "error" && (
                    <span className="shrink-0 text-red-600 font-bold" aria-hidden title="Error">
                      ✕
                    </span>
                  )}
                  {item.status === "skipped" && (
                    <span className="shrink-0 text-neutral-400" aria-hidden>
                      ⊘
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate flex items-center gap-2 flex-wrap">
                    {item.status === "processing" && (
                      <span className="flex flex-col gap-0.5">
                        <span className="text-blue-700">Analyzing… {item.url}</span>
                        {item.phaseLabel && (
                          <span className="text-xs text-blue-600/90">Phase: {item.phaseLabel}</span>
                        )}
                      </span>
                    )}
                    {item.status === "success" && (
                      <>
                        <span>Added {decodeHtmlEntities(item.displayName ?? item.url) || item.url}</span>
                        {item.dataSource && (
                          <span className="text-neutral-500 text-xs">{item.dataSource}</span>
                        )}
                        {item.brainStatus && (
                          <span className="text-neutral-500 text-xs">{item.brainStatus}</span>
                        )}
                        {item.newTypeAddedToBrain === true && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            New Type
                          </span>
                        )}
                      </>
                    )}
                    {item.status === "error" && (
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="truncate text-neutral-800">{item.url}</span>
                        <span className="text-neutral-600 text-xs">
                          We couldn&apos;t load this link. Go to Review & Save to keep the link and try again later.
                        </span>
                        {item.error && (
                          <span className="text-red-600 font-medium text-xs">{item.error}</span>
                        )}
                      </span>
                    )}
                    {item.status === "skipped" && (
                      <span className="text-neutral-500">
                        Skipped – not added to vault: {decodeHtmlEntities(item.displayName ?? item.url) || item.url}
                      </span>
                    )}
                    {item.status === "pending" && (
                      <span className="text-neutral-500 truncate">{item.url}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!processing && completed === total && total > 0 && (
          <div className="mt-6 space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-600 font-medium">{items.filter((i) => i.status === "success").length} succeeded</span>
              {items.filter((i) => i.status === "error").length > 0 && (
                <span className="text-red-600 font-medium">{items.filter((i) => i.status === "error").length} failed</span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/vault")}
                className="py-2.5 px-4 rounded-xl bg-emerald text-white font-medium"
              >
                View Vault
              </button>
              <button
                type="button"
                onClick={() => setUrlText("")}
                className="py-2.5 px-4 rounded-xl border border-black/10 text-black/80 font-medium"
              >
                Import more
              </button>
              {items.some((i) => i.status === "error") && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-neutral-600">
                    Save links in Review & Save to try again later, or retry now.
                  </span>
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    className="py-2.5 px-4 rounded-xl border border-blue-200 text-blue-700 font-medium hover:bg-blue-50 min-h-[44px] min-w-[44px]"
                  >
                    Retry {items.filter((i) => i.status === "error").length} Failed
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (embed) {
    return (
      <>
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          aria-hidden
          onClick={closeToVault}
        />
        <div className="fixed inset-0 z-[70] flex flex-col bg-white overflow-auto max-h-screen">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-black/10 bg-white">
            <h1 className="text-xl font-bold text-neutral-900">Link Import</h1>
            <button
              type="button"
              onClick={closeToVault}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/15 text-black/60 hover:bg-black/5"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 pb-24">
            {mainContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6 pb-24">
      {mainContent}
    </div>
  );
}
