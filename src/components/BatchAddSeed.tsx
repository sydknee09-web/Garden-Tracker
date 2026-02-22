"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { rareseedsAutotreatment, slugToSpaced } from "@/lib/rareseedsAutotreatment";
import { parseVarietyWithModifiers, normalizeForMatch } from "@/lib/varietyModifiers";
import { getTagsFromText } from "@/lib/parseSeedFromImportUrl";
import { applyZone10bToProfile } from "@/data/zone10b_schedule";
import type { ExtractResponse } from "@/app/api/seed/extract/route";
import type { OrderLineItem } from "@/app/api/seed/extract-order/route";
import { setReviewImportData, setPendingPhotoImport, setPendingPhotoHeroImport, getPendingPhotoHeroImport, type ReviewImportItem } from "@/lib/reviewImportStorage";
import { compressImage } from "@/lib/compressImage";
import { Combobox } from "@/components/Combobox";
import { dedupeVendorsForSuggestions, toCanonicalDisplay } from "@/lib/vendorNormalize";
import { filterValidPlantTypes } from "@/lib/plantTypeSuggestions";

/** Today's date in YYYY-MM-DD for default purchase date. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Resize/compress image – delegates to shared compressImage utility. */
async function resizeImageIfNeeded(file: File, maxLongEdge = 1200, quality = 0.85): Promise<{ blob: Blob; fileName: string }> {
  return compressImage(file, maxLongEdge, quality);
}

/** Queue item before/during Gemini processing. File may be null briefly for camera placeholder before blob is ready. */
interface PendingPhoto {
  id: string;
  file: File | null;
  previewUrl: string;
  status?: "pending" | "loading";
  name?: string;
  variety?: string;
  vendor?: string;
  tags?: string[];
  purchaseDate?: string;
  error?: string;
}

/** Derive slug-like string from filename (no extension). Good for Rareseeds. */
function slugFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  return base.replace(/\s+/g, " ").replace(/_/g, "-");
}

/** Prefer Rareseeds result when filename looks like a slug (hyphens or multiple words). */
function applyRareseedsFromFilename(
  filename: string,
  knownPlantTypes: string[]
): { name: string; variety: string } | null {
  const slug = slugFromFilename(filename);
  if (!slug) return null;
  const slugWithSpaces = slugToSpaced(slug);
  const result = rareseedsAutotreatment(slugWithSpaces, knownPlantTypes);
  const looksLikeSlug = slug.includes("-") || slug.split(/\s+/).length > 1;
  if (!looksLikeSlug && result.plant_name === "General" && !result.variety_name) return null;
  return { name: result.plant_name, variety: result.variety_name ?? "" };
}

interface BatchAddSeedProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When provided, called instead of onClose + router.push so parent can skip history.back() (e.g. useModalBackClose). */
  onNavigateToHero?: () => void;
}

export function BatchAddSeed({ open, onClose, onSuccess, onNavigateToHero }: BatchAddSeedProps) {
  const router = useRouter();
  const { user, session: authSession } = useAuth();
  const [queue, setQueue] = useState<PendingPhoto[]>([]);
  const [step, setStep] = useState<"capture" | "extracting" | "review">("capture");
  const [processingAll, setProcessingAll] = useState(false);
  const [geminiProcessing, setGeminiProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    phase: "upload" | "extract";
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccessCount, setSaveSuccessCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [knownPlantTypes, setKnownPlantTypes] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);
  const [orderProcessing, setOrderProcessing] = useState(false);
  const [plantSuggestions, setPlantSuggestions] = useState<string[]>([]);
  const [varietySuggestionsByPlant, setVarietySuggestionsByPlant] = useState<Record<string, string[]>>({});
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [shutterActive, setShutterActive] = useState(false);
  const queueScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      queue.forEach((i) => {
        if (i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl);
      });
      setQueue([]);
      setStep("capture");
      setError(null);
      setSaveSuccessCount(null);
      setProcessingAll(false);
      setGeminiProcessing(false);
      setSaving(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [open]);

  // Reset step to capture when queue is cleared (e.g. after save) so next open starts at capture
  useEffect(() => {
    if (queue.length === 0 && step !== "capture") setStep("capture");
  }, [queue.length, step]);

  // Auto-scroll queue to end when new photo is added
  useEffect(() => {
    if (queue.length === 0) return;
    queueScrollRef.current?.scrollTo({ left: queueScrollRef.current.scrollWidth, behavior: "smooth" });
  }, [queue.length]);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    supabase
      .from("plant_profiles")
      .select("name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .then(({ data }) => {
        if (cancelled) return;
        const types = [...new Set((data ?? []).map((r: { name?: string }) => (r.name ?? "").trim().split(/\s+/)[0]?.trim()).filter(Boolean))];
        setKnownPlantTypes(types);
      });
    return () => { cancelled = true; };
  }, [open, user?.id]);

  // Plant suggestions from global_plant_cache
  useEffect(() => {
    if (!open) return;
    supabase.rpc("get_global_plant_cache_plant_types").then(({ data }) => {
      const raw = ((data ?? []) as { plant_type: string | null }[]).map((r) => (r.plant_type ?? "").trim()).filter(Boolean);
      setPlantSuggestions(filterValidPlantTypes(raw));
    });
  }, [open]);

  // Variety suggestions per plant (for queue items)
  useEffect(() => {
    if (!open || queue.length === 0) return;
    const plantNames = [...new Set(queue.map((i) => (i.name ?? "").trim()).filter(Boolean))];
    plantNames.forEach((name) => {
      if (varietySuggestionsByPlant[name]) return; // already fetched
      supabase.rpc("get_global_plant_cache_varieties", { p_plant_type: name }).then(({ data }) => {
        setVarietySuggestionsByPlant((prev) => {
          if (prev[name]) return prev;
          const varieties = ((data ?? []) as { variety: string | null }[]).map((r) => (r.variety ?? "").trim()).filter(Boolean);
          return { ...prev, [name]: varieties };
        });
      });
    });
  }, [open, queue]);

  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      const { data: profileRows } = await supabase.from("plant_profiles").select("id").eq("user_id", user.id).is("deleted_at", null);
      const ids = (profileRows ?? []).map((r: { id: string }) => r.id);
      if (ids.length === 0) {
        setVendorSuggestions([]);
        return;
      }
      const { data: packetRows } = await supabase.from("seed_packets").select("vendor_name").in("plant_profile_id", ids).is("deleted_at", null);
      const raw = (packetRows ?? []).map((r: { vendor_name: string | null }) => (r.vendor_name ?? "").trim()).filter(Boolean);
      setVendorSuggestions(dedupeVendorsForSuggestions(raw));
    })();
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires an HTTPS connection.");
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Camera access denied."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const processOneItem = useCallback(
    async (itemId: string, file: File, knownTypes: string[]) => {
      try {
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

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authSession?.access_token) headers.Authorization = `Bearer ${authSession.access_token}`;
        const res = await fetch("/api/seed/extract", {
          method: "POST",
          headers,
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || "image/jpeg" }),
        });

        let name = "";
        let variety = "";
        let vendor = "";
        let tags: string[] = [];
        if (res.ok) {
          const data = (await res.json()) as ExtractResponse;
          name = (data.type ?? "").trim();
          variety = (data.variety ?? "").trim();
          vendor = (data.vendor ?? "").trim();
          tags = Array.isArray(data.tags) ? data.tags : [];
        }
        if (!name || !variety) {
          const fromFilename = applyRareseedsFromFilename(file.name, knownTypes);
          if (fromFilename && (fromFilename.name !== "General" || fromFilename.variety)) {
            name = name || fromFilename.name;
            variety = variety || fromFilename.variety;
          }
        }
        if (!name) name = "Unknown";

        setQueue((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  status: "pending" as const,
                  name,
                  variety,
                  vendor,
                  tags,
                  ocrText: "",
                  purchaseDate: todayISO(),
                  error: undefined,
                }
              : i
          )
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Extraction failed";
        setQueue((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, status: "pending" as const, error: errMsg, name: "Unknown", variety: "", vendor: "" } : i
          )
        );
      }
    },
    []
  );

  const [processTrigger, setProcessTrigger] = useState(0);
  const inFlightIdRef = useRef<string | null>(null);
  useEffect(() => {
    const loading = queue.find((i) => i.status === "loading" && i.file != null && i.id !== inFlightIdRef.current);
    if (!loading || !loading.file) return;
    inFlightIdRef.current = loading.id;
    processOneItem(loading.id, loading.file, knownPlantTypes).finally(() => {
      inFlightIdRef.current = null;
      setProcessTrigger((t) => t + 1);
    });
  }, [queue, knownPlantTypes, processOneItem, processTrigger]);

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    const newItems: PendingPhoto[] = list.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "loading" as const,
      name: "",
      variety: "",
      vendor: "",
      tags: [],
      ocrText: "",
      purchaseDate: todayISO(),
    }));
    setQueue((prev) => [...prev, ...newItems]);
    setError(null);
  }

  async function processFilesWithGeminiAndRedirect(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      setError("No image files selected.");
      return;
    }
    setError(null);
    setGeminiProcessing(true);
    setBatchProgress({ phase: "upload", current: 0, total: list.length, label: "Preparing files…" });
    try {
      const pendingItems: { id: string; fileName: string; imageBase64: string }[] = [];
      for (let i = 0; i < list.length; i++) {
        setBatchProgress({ phase: "upload", current: i + 1, total: list.length, label: `${i + 1} of ${list.length} files prepared` });
        const file = list[i];
        const { blob, fileName } = await resizeImageIfNeeded(file);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (typeof result === "string") resolve(result.includes(",") ? result.split(",")[1] ?? result : result);
            else reject(new Error("Read failed"));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        pendingItems.push({ id: crypto.randomUUID(), fileName, imageBase64: base64 });
      }
      setBatchProgress(null);
      setPendingPhotoImport({ items: pendingItems });
      onClose();
      router.push("/vault/import/photos");
    } catch (e) {
      const isQuota = e instanceof DOMException && (e.name === "QuotaExceededError" || (e as { code?: number }).code === 22);
      setError(isQuota ? "Too many or large photos—try fewer or smaller images." : (e instanceof Error ? e.message : "Preparation failed"));
    } finally {
      setGeminiProcessing(false);
      setBatchProgress(null);
    }
  }

  async function processOrderConfirmation(file: File) {
    setOrderProcessing(true);
    setError(null);
    try {
      const { blob } = await resizeImageIfNeeded(file);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") resolve(result.includes(",") ? result.split(",")[1] ?? result : result);
          else reject(new Error("Read failed"));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authSession?.access_token) headers.Authorization = `Bearer ${authSession.access_token}`;
      const res = await fetch("/api/seed/extract-order", {
        method: "POST",
        headers,
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type || "image/jpeg" }),
      });

      if (!res.ok) {
        setError("Failed to process order confirmation.");
        setOrderProcessing(false);
        return;
      }

      const data = (await res.json()) as { items: OrderLineItem[]; vendor: string; error?: string };
      if (data.error) {
        setError(data.error);
        setOrderProcessing(false);
        return;
      }

      if (!data.items.length) {
        setError("No seed items found in this image. Try a clearer screenshot.");
        setOrderProcessing(false);
        return;
      }

      // Convert order items to review items and navigate to review
      const reviewItems: ReviewImportItem[] = data.items.map((item) => ({
        id: crypto.randomUUID(),
        imageBase64: "",
        fileName: "",
        type: item.name || "Imported seed",
        variety: item.variety,
        vendor: item.vendor || data.vendor,
        tags: [],
        purchaseDate: todayISO(),
      }));

      setReviewImportData({ items: reviewItems });
      onClose();
      router.push("/vault/review-import");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order scan failed");
    } finally {
      setOrderProcessing(false);
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current || video.readyState < 2) return;

    // 1. Immediate feedback: shutter flash + haptic
    setShutterActive(true);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(50);
    setTimeout(() => setShutterActive(false), 100);

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // 2. Add placeholder immediately so queue count increments (preview from canvas)
    const placeholderId = crypto.randomUUID();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setQueue((prev) => [
      ...prev,
      {
        id: placeholderId,
        file: null,
        previewUrl: dataUrl,
        status: "loading",
        name: "",
        variety: "",
        vendor: "",
        tags: [],
        purchaseDate: todayISO(),
      },
    ]);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `packet-${Date.now()}.jpg`, { type: "image/jpeg" });
        setQueue((prev) =>
          prev.map((i) => (i.id === placeholderId ? { ...i, file, previewUrl: URL.createObjectURL(file) } : i))
        );
        // Revoke the data URL we used as placeholder (no-op for data URLs; we're replacing with blob URL)
        if (dataUrl.startsWith("data:")) {
          // data URLs are not revokable; the new previewUrl is the blob URL
        }
      },
      "image/jpeg",
      0.85
    );
  }

  const pendingCount = queue.filter((i) => i.status === "pending").length;
  const loadingCount = queue.filter((i) => i.status === "loading").length;
  const canGoToReview = queue.length > 0;

  function goToReview() {
    if (!canGoToReview) return;
    if (loadingCount > 0) setStep("extracting");
    else setStep("review");
  }

  // When in extracting step and all items finish loading, go to review
  useEffect(() => {
    if (step === "extracting" && queue.length > 0 && loadingCount === 0) setStep("review");
  }, [step, queue.length, loadingCount]);

  function updateItem(id: string, updates: Partial<Pick<PendingPhoto, "name" | "variety" | "vendor" | "tags" | "purchaseDate">>) {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }

  async function handleLoadPlantProfilePicture() {
    const toProcess = queue.filter((i): i is PendingPhoto & { file: File } => i.status === "pending" && i.file != null);
    if (toProcess.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      const pendingItems: { id: string; imageBase64: string; fileName: string; vendor: string; type: string; variety: string; tags: string[]; purchaseDate: string }[] = [];
      for (const item of toProcess) {
        const { blob, fileName } = await resizeImageIfNeeded(item.file);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (typeof result === "string") resolve(result.includes(",") ? result.split(",")[1] ?? result : result);
            else reject(new Error("Read failed"));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        pendingItems.push({
          id: item.id,
          imageBase64: base64,
          fileName: item.file.name || fileName || "packet.jpg",
          vendor: (item.vendor ?? "").trim() || "",
          type: (item.name ?? "").trim() || "Imported seed",
          variety: (item.variety ?? "").trim() || "",
          tags: item.tags ?? [],
          purchaseDate: (item.purchaseDate ?? todayISO()).trim() || todayISO(),
        });
      }
      try {
        setPendingPhotoHeroImport({ items: pendingItems });
      } catch (storageErr) {
        const isQuota = storageErr instanceof DOMException && (storageErr.name === "QuotaExceededError" || (storageErr as { code?: number }).code === 22);
        setError(isQuota ? "Too much data for storage—try fewer photos." : "Could not save batch for next step.");
        setSaving(false);
        return;
      }
      const verified = getPendingPhotoHeroImport();
      if (!verified?.items?.length || verified.items.length !== pendingItems.length) {
        setError("Could not save batch (storage limit?). Try fewer photos.");
        setSaving(false);
        return;
      }
      queue.forEach((i) => { if (i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl); });
      setQueue([]);
      setStep("capture");
      setSaveSuccessCount(null);
      if (onNavigateToHero) {
        onNavigateToHero();
      } else {
        onClose();
        router.push("/vault/import/photos/hero");
      }
    } catch (e) {
      const isQuota = e instanceof DOMException && (e.name === "QuotaExceededError" || (e as { code?: number }).code === 22);
      setError(isQuota ? "Too many or large photos—try fewer or smaller images." : (e instanceof Error ? e.message : "Preparation failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAll() {
    if (!user) return;
    const toSave = queue.filter((i): i is PendingPhoto & { file: File } => i.status === "pending" && i.file != null);
    if (toSave.length === 0) return;
    setError(null);
    setSaving(true);
    let bucketEnsured = false;
    for (const item of toSave) {
      const name = (item.name ?? "").trim() || "Unknown";
      const varietyName = (item.variety ?? "").trim() || null;
      let path = (item as { uploadedPath?: string }).uploadedPath;
      if (!path) {
        if (!bucketEnsured) {
          const ensureRes = await fetch("/api/seed/ensure-storage-bucket", { method: "POST" });
          if (!ensureRes.ok) {
            setError((await ensureRes.json()).error ?? "Storage bucket unavailable");
            setSaving(false);
            return;
          }
          bucketEnsured = true;
        }
        path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { blob } = await compressImage(item.file);
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
      const { coreVariety, tags: packetTags } = parseVarietyWithModifiers(item.variety ?? "");
      const coreVarietyName = coreVariety || varietyName;
      const functionalTags = getTagsFromText([name, varietyName ?? ""].filter(Boolean).join(" "));
      const allTags = [...new Set([...packetTags, ...functionalTags, ...(item.tags ?? [])])];
      const zone10b = applyZone10bToProfile(name, {});
      const nameNorm = normalizeForMatch(name);
      const varietyNorm = normalizeForMatch(coreVarietyName);
      const { data: allProfiles } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name")
        .eq("user_id", user.id);
      const exact = (allProfiles ?? []).find(
        (p: { name: string; variety_name: string | null }) =>
          normalizeForMatch(p.name) === nameNorm && normalizeForMatch(p.variety_name) === varietyNorm
      );
      let profileId: string;
      if (exact) {
        profileId = exact.id;
      } else {
        const { data: newProfile, error: profileErr } = await supabase
          .from("plant_profiles")
          .insert({
            user_id: user.id,
            name: name.trim(),
            variety_name: coreVarietyName || varietyName,
            primary_image_path: path,
            tags: allTags.length > 0 ? allTags : undefined,
            ...(zone10b.sun && { sun: zone10b.sun }),
            ...(zone10b.plant_spacing && { plant_spacing: zone10b.plant_spacing }),
            ...(zone10b.days_to_germination && { days_to_germination: zone10b.days_to_germination }),
            ...(zone10b.harvest_days != null && { harvest_days: zone10b.harvest_days }),
            ...(zone10b.sowing_method && { sowing_method: zone10b.sowing_method }),
            ...(zone10b.planting_window && { planting_window: zone10b.planting_window }),
          })
          .select("id")
          .single();
        if (profileErr) {
          setError(profileErr.message);
          setSaving(false);
          return;
        }
        profileId = (newProfile as { id: string }).id;
      }
      const purchaseDate = item.purchaseDate?.trim() || todayISO();
      const tagsToSave = packetTags.length > 0 ? packetTags : (item.tags ?? []);
      const { error: packetErr } = await supabase.from("seed_packets").insert({
        plant_profile_id: profileId,
        user_id: user.id,
        vendor_name: item.vendor?.trim() ? (toCanonicalDisplay(item.vendor.trim()) || item.vendor.trim()) : null,
        qty_status: 100,
        primary_image_path: path,
        purchase_date: purchaseDate,
        ...(tagsToSave.length > 0 && { tags: tagsToSave }),
      });
      if (packetErr) {
        setError(packetErr.message);
        setSaving(false);
        return;
      }
      await supabase.from("plant_profiles").update({ status: "in_stock" }).eq("id", profileId).eq("user_id", user.id);
    }
    setSaving(false);
    const count = queue.filter((i) => i.status === "pending").length;
    queue.forEach((i) => { if (i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl); });
    setSaveSuccessCount(count);
    onSuccess();
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function handleClose() {
    queue.forEach((i) => { if (i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl); });
    setQueue([]);
    setStep("capture");
    setError(null);
    setSaveSuccessCount(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" aria-hidden onClick={handleClose} />
      {geminiProcessing && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/95 px-6" aria-live="polite" aria-busy="true">
          <p className="text-lg font-medium text-black mb-2 text-center">
            {batchProgress?.phase === "upload" ? "Preparing files" : "Extraction"}
          </p>
          <p className="text-sm text-black/60 mb-4 text-center">{batchProgress?.label ?? "Starting…"}</p>
          <div className="w-full max-w-xs h-2.5 bg-black/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald transition-all duration-300 ease-out"
              style={{
                width: batchProgress
                  ? `${(batchProgress.phase === "upload" ? batchProgress.current / (2 * batchProgress.total) : 0.5 + batchProgress.current / (2 * batchProgress.total)) * 100}%`
                  : "0%",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-black/50">
            {batchProgress ? `${batchProgress.current} of ${batchProgress.total} complete` : ""}
          </p>
        </div>
      )}
      <div
        className="fixed left-4 right-4 top-1/2 z-[70] max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-card border border-black/5 max-w-md mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-add-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="batch-add-title" className="text-lg font-semibold text-black pt-0.5">
            {step === "capture" ? "Photo Import" : step === "extracting" ? "Extracting…" : "Confirm & Save"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/15 text-black/50 hover:text-black/70 hover:bg-black/5 -m-2"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === "extracting" && (
          <div className="py-6">
            <p className="text-sm text-black/70 mb-4">
              Extracting packet details from your photos. This usually takes a few seconds per image.
            </p>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-emerald-700">{pendingCount} of {queue.length} ready</span>
              {loadingCount > 0 && <span className="text-black/60">{loadingCount} still scanning…</span>}
            </div>
            <div
              className="h-2.5 w-full rounded-full bg-black/10 overflow-hidden"
              role="progressbar"
              aria-valuenow={queue.length > 0 ? Math.round((pendingCount / queue.length) * 100) : 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald transition-all duration-300 ease-out"
                style={{ width: queue.length > 0 ? `${(pendingCount / queue.length) * 100}%` : "0%" }}
              />
            </div>
            <p className="mt-3 text-xs text-black/50">You’ll go to Confirm & Save when all are done.</p>
            {pendingCount > 0 && loadingCount > 0 && (
              <button
                type="button"
                onClick={() => setStep("review")}
                className="mt-4 w-full py-2.5 rounded-xl border border-black/20 text-black/70 text-sm font-medium hover:bg-black/5 transition-colors min-h-[44px]"
              >
                Continue with {pendingCount} ready
              </button>
            )}
          </div>
        )}

        {step === "capture" && (
          <>
            {typeof window !== "undefined" && !window.isSecureContext && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                Camera may not work on this connection. Use HTTPS or localhost for reliable access.
              </p>
            )}
            <p className="text-sm text-black/70 mb-3">
              <strong>Tips for best results:</strong> Take photos in bright light with minimal background. Make sure packet text is clear and visible. Wait until results finish loading before pressing Continue.
            </p>
            <div className="relative rounded-xl overflow-hidden bg-black/10 aspect-[4/3] mb-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Shutter flash on capture */}
              {shutterActive && (
                <div className="absolute inset-0 bg-white animate-shutter-flash" aria-hidden />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={captureFrame}
                className="flex-1 py-3 rounded-xl bg-emerald text-white font-medium min-h-[44px]"
              >
                Capture
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 rounded-xl border border-black/20 text-black/80 font-medium min-h-[44px]"
              >
                Upload from Files
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) {
                  addFiles(files);
                  e.target.value = "";
                }
              }}
            />

            {queue.length > 0 && (
              <>
                <p className="text-sm mb-2">
                  <span className="font-bold text-emerald-700">
                    Queue: {pendingCount} ready{loadingCount > 0 ? ` · ${loadingCount} loading` : ""}
                  </span>
                </p>
                <div
                  ref={queueScrollRef}
                  className="flex gap-2 overflow-x-auto overflow-y-hidden pb-2 mb-3 min-h-[72px] snap-x snap-mandatory scroll-smooth"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {queue.map((item) => (
                    <div
                      key={item.id}
                      className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-neutral-100 border border-black/10 relative snap-center"
                    >
                      {item.status === "loading" ? (
                        <>
                          <img
                            src={item.previewUrl}
                            alt=""
                            className="w-full h-full object-cover scale-110 blur-md"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 animate-pulse">
                            <div className="w-7 h-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          </div>
                        </>
                      ) : (
                        <>
                          <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                          <span
                            className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald text-white shadow"
                            aria-label="OCR complete"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={goToReview}
                    disabled={!canGoToReview}
                    className="flex-1 py-3 rounded-xl border border-black/20 text-black/80 font-medium disabled:opacity-50"
                  >
                    {loadingCount > 0 ? `Review pending (${pendingCount} ready · ${loadingCount} scanning)` : `Review pending (${pendingCount})`}
                  </button>
                </div>
              </>
            )}
            {error && <p className="text-sm text-citrus mt-2">{error}</p>}
          </>
        )}

        {saveSuccessCount != null ? (
          <div className="py-4 text-center">
            <p className="text-lg font-medium text-emerald-700 mb-2">Saved to vault</p>
            <p className="text-sm text-black/70 mb-4">{saveSuccessCount} item{saveSuccessCount !== 1 ? "s" : ""} added. You can add more from the vault or close.</p>
            <button type="button" onClick={handleClose} className="py-3 px-6 rounded-xl bg-emerald text-white font-medium">
              Done
            </button>
          </div>
        ) : step === "review" ? (
          <>
            <p className="text-sm text-black/70 mb-2">Confirm or edit Plant Type and Variety for each entry before saving to the Vault.</p>
            {loadingCount > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                <span className="inline-block h-4 w-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" aria-hidden />
                <span>{loadingCount} more still extracting — they’ll appear below when ready.</span>
              </div>
            )}
            <ul className="space-y-4 mb-4 max-h-[50vh] overflow-y-auto">
              {queue
                .filter((i) => i.status === "pending")
                .map((item) => (
                  <li key={item.id} className="border border-black/10 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <Combobox
                          value={item.vendor ?? ""}
                          onChange={(v) => updateItem(item.id, { vendor: v })}
                          suggestions={vendorSuggestions}
                          placeholder="Vendor"
                          aria-label="Vendor"
                          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm min-h-[44px] min-w-[44px]"
                        />
                        <Combobox
                          value={item.name ?? ""}
                          onChange={(v) => updateItem(item.id, { name: v })}
                          suggestions={plantSuggestions}
                          placeholder="Plant type"
                          aria-label="Plant type"
                          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm min-h-[44px] min-w-[44px]"
                        />
                        <Combobox
                          value={item.variety ?? ""}
                          onChange={(v) => updateItem(item.id, { variety: v })}
                          suggestions={varietySuggestionsByPlant[item.name ?? ""] ?? []}
                          placeholder="Variety"
                          aria-label="Variety"
                          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm min-h-[44px] min-w-[44px]"
                        />
                        <label className="block">
                          <span className="text-xs text-black/50">Purchase date</span>
                          <input
                            type="date"
                            value={item.purchaseDate || todayISO()}
                            onChange={(e) => updateItem(item.id, { purchaseDate: e.target.value })}
                            className="mt-0.5 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                            aria-label="Purchase date"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromQueue(item.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg border border-black/10 text-black/50 hover:bg-black/5"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                    {item.error && <p className="text-xs text-citrus">{item.error}</p>}
                    {(item.tags ?? []).length > 0 && (
                      <p className="text-xs text-black/60">Tags: {(item.tags ?? []).join(", ")}</p>
                    )}
                  </li>
                ))}
            </ul>
            {error && <p className="text-sm text-citrus mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("capture");
                }}
                className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleLoadPlantProfilePicture}
                disabled={saving || pendingCount === 0}
                className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Preparing…" : "Load Plant Profile Picture"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
