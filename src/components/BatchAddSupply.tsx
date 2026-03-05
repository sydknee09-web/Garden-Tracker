"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { setSupplyReviewData, type SupplyReviewItem } from "@/lib/supplyReviewStorage";
import { compressImage } from "@/lib/compressImage";

const SUPPLY_CATEGORIES = ["fertilizer", "pesticide", "soil_amendment", "other"] as const;
const MAX_PHOTOS = 15;

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "extracting" | "done" | "error";
  error?: string;
}

interface BatchAddSupplyProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchAddSupply({ open, onClose, onSuccess }: BatchAddSupplyProps) {
  const router = useRouter();
  const { user, session: authSession } = useAuth();
  const [queue, setQueue] = useState<PendingPhoto[]>([]);
  const [step, setStep] = useState<"capture" | "extracting">("capture");
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const queueScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      queue.forEach((i) => {
        if (i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl);
      });
      setQueue([]);
      setStep("capture");
      setError(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (queue.length > 0) {
      queueScrollRef.current?.scrollTo({ left: queueScrollRef.current.scrollWidth, behavior: "smooth" });
    }
  }, [queue.length]);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires HTTPS.");
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

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    const remaining = MAX_PHOTOS - queue.length;
    const toAdd = list.slice(0, Math.max(0, remaining));
    if (toAdd.length === 0) {
      setError(`Maximum ${MAX_PHOTOS} photos per batch.`);
      return;
    }
    setError(null);
    const newItems: PendingPhoto[] = toAdd.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }, [queue.length]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const extractOne = useCallback(
    async (item: PendingPhoto): Promise<SupplyReviewItem | null> => {
      if (!authSession?.access_token) return null;
      setQueue((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "extracting" as const } : i))
      );
      try {
        const { blob } = await compressImage(item.file);
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
        const res = await fetch("/api/supply/extract-from-photo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setQueue((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: "error" as const, error: (data.error as string) ?? "Extraction failed" } : i
            )
          );
          return null;
        }
        const cat = (data.category as string)?.toLowerCase();
        const category = SUPPLY_CATEGORIES.includes(cat as (typeof SUPPLY_CATEGORIES)[number])
          ? cat
          : "other";
        const supplyItem: SupplyReviewItem = {
          id: crypto.randomUUID(),
          name: (data.name as string)?.trim() || "Imported product",
          brand: (data.brand as string)?.trim() || "",
          category: category as (typeof SUPPLY_CATEGORIES)[number],
          npk: (data.npk as string)?.trim() || "",
          application_rate: (data.application_rate as string)?.trim() || "",
          usage_instructions: (data.usage_instructions as string)?.trim() || "",
          vendor: "",
          quantity: 1,
          primary_image_path: data.primary_image_path as string | undefined,
        };
        setQueue((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "done" as const } : i))
        );
        return supplyItem;
      } catch (e) {
        setQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error" as const, error: e instanceof Error ? e.message : "Extraction failed" }
              : i
          )
        );
        return null;
      }
    },
    [authSession?.access_token]
  );

  const handleExtractAll = useCallback(async () => {
    const toExtract = queue.filter((i) => i.status === "pending");
    if (toExtract.length === 0) return;
    setStep("extracting");
    setError(null);
    setExtractProgress({ current: 0, total: toExtract.length });
    const results: SupplyReviewItem[] = [];
    for (let i = 0; i < toExtract.length; i++) {
      setExtractProgress({ current: i + 1, total: toExtract.length });
      const item = toExtract[i];
      const result = await extractOne(item);
      if (result) results.push(result);
    }
    const successCount = results.length;
    if (successCount === 0) {
      setError("No items could be extracted. Try clearer photos.");
      setStep("capture");
      return;
    }
    setSupplyReviewData({ items: results });
    queue.forEach((i) => {
      if (i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl);
    });
    onSuccess();
    onClose();
    router.push("/shed/review-import");
  }, [queue, extractOne, onSuccess, onClose, router]);

  const handleClose = useCallback(() => {
    queue.forEach((i) => {
      if (i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl);
    });
    setQueue([]);
    setStep("capture");
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onClose();
  }, [queue, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" aria-hidden onClick={handleClose} />
      <div
        className="fixed left-4 right-4 top-1/2 z-[70] max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-card border border-black/5 max-w-md mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-add-supply-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="batch-add-supply-title" className="text-lg font-semibold text-black pt-0.5">
            {step === "capture" ? "Import Supplies from Photos" : "Extracting…"}
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
              Extracting product details from your photos. This usually takes a few seconds per image.
            </p>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-emerald-700">
                Extracting {extractProgress.current} of {extractProgress.total}
              </span>
            </div>
            <div
              className="h-2.5 w-full rounded-full bg-black/10 overflow-hidden"
              role="progressbar"
              aria-valuenow={extractProgress.total > 0 ? Math.round((extractProgress.current / extractProgress.total) * 100) : 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald transition-all duration-300 ease-out"
                style={{
                  width: extractProgress.total > 0 ? `${(extractProgress.current / extractProgress.total) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
        )}

        {step === "capture" && (
          <>
            {typeof window !== "undefined" && !window.isSecureContext && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                Camera may not work on this connection. Use HTTPS or localhost.
              </p>
            )}
            <p className="text-sm text-black/70 mb-3">
              Take or upload photos of product labels (fertilizer, pesticide, soil amendment). Up to {MAX_PHOTOS} photos per batch.
            </p>
            <div className="relative rounded-xl overflow-hidden bg-black/10 aspect-[4/3] mb-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 py-3 rounded-xl bg-emerald text-white font-medium min-h-[44px]"
              >
                Take photo
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 py-3 rounded-xl border border-black/20 text-black/80 font-medium min-h-[44px]"
              >
                From gallery
              </button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addFiles([f]);
                e.target.value = "";
              }}
              aria-label="Take product photo"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) addFiles(files);
                e.target.value = "";
              }}
              aria-label="Choose product photos from gallery"
            />

            {queue.length > 0 && (
              <>
                <p className="text-sm mb-2">
                  <span className="font-bold text-emerald-700">
                    {queue.length} photo{queue.length !== 1 ? "s" : ""} added
                    {queue.length >= MAX_PHOTOS ? ` (max ${MAX_PHOTOS})` : ""}
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
                      <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFromQueue(item.id)}
                        className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold hover:bg-red-600"
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleExtractAll}
                  disabled={queue.length === 0}
                  className="w-full py-3 rounded-xl bg-emerald text-white font-medium min-h-[44px] disabled:opacity-50"
                >
                  Extract & Review ({queue.length} photo{queue.length !== 1 ? "s" : ""})
                </button>
              </>
            )}
            {error && <p className="text-sm text-red-600 mt-2" role="alert">{error}</p>}
          </>
        )}
      </div>
    </>
  );
}
