"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/compressImage";
import { setReviewImportData, type ReviewImportItem } from "@/lib/reviewImportStorage";
import type { OrderLineItem } from "@/app/api/seed/extract-order/route";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resizeImageIfNeeded(file: File, maxLongEdge = 1000, quality = 0.8): Promise<{ blob: Blob; fileName: string }> {
  return compressImage(file, maxLongEdge, quality);
}

interface PurchaseOrderImportProps {
  open: boolean;
  onClose: () => void;
}

export function PurchaseOrderImport({ open, onClose }: PurchaseOrderImportProps) {
  const router = useRouter();
  const { session: authSession } = useAuth();
  const [isExtracting, setIsExtracting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setFile(null);
      setPreviewUrl(null);
      setIsExtracting(false);
      setError(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera requires HTTPS.");
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

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current || video.readyState < 2) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const f = new File([blob], `order-${Date.now()}.jpg`, { type: "image/jpeg" });
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        setFile(f);
        setPreviewUrl(URL.createObjectURL(f));
        setError(null);
      },
      "image/jpeg",
      0.85
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen?.type.startsWith("image/")) return;
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
    setError(null);
  }

  async function handleExtract() {
    if (!file) return;
    setError(null);
    setIsExtracting(true);
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

      let data: { items: OrderLineItem[]; vendor: string; error?: string };
      try {
        data = (await res.json()) as { items: OrderLineItem[]; vendor: string; error?: string };
      } catch {
        setError(res.ok ? "Invalid response from server." : `Failed to process order (${res.status}).`);
        setIsExtracting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || `Failed to process order (${res.status}).`);
        setIsExtracting(false);
        return;
      }
      if (data.error) {
        setError(data.error);
        setIsExtracting(false);
        return;
      }

      if (!data.items?.length) {
        setError("No seed items found in this image. Try a clearer screenshot.");
        setIsExtracting(false);
        return;
      }

      const reviewItems: ReviewImportItem[] = data.items.map((item) => ({
        id: crypto.randomUUID(),
        imageBase64: "",
        fileName: "",
        type: item.name || "Imported seed",
        variety: item.variety ?? "",
        vendor: item.vendor || data.vendor || "",
        tags: [],
        purchaseDate: todayISO(),
      }));

      setReviewImportData({ items: reviewItems });
      onClose();
      router.push("/vault/review-import");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order scan failed");
      setIsExtracting(false);
    }
  }

  function handleClose() {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setIsExtracting(false);
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" aria-hidden onClick={handleClose} />
      <div
        className="fixed left-4 right-4 top-1/2 z-[70] max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-card border border-black/5 max-w-md mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-order-import-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="purchase-order-import-title" className="text-lg font-semibold text-black pt-0.5">
            Purchase Order Import
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

        <>
            <p className="text-sm text-black/70 mb-4">
              <strong>Tips:</strong> Use a screenshot of your cart, order confirmation, or receipt. We’ll extract all seed/plant line items from one image.
            </p>
            <div className="relative rounded-xl overflow-hidden bg-black/5 min-h-[200px] max-h-[320px] mb-4 border-2 border-dashed border-black/15 flex items-center justify-center">
              {previewUrl ? (
                <img src={previewUrl} alt="Order preview" className="max-w-full max-h-[280px] object-contain" />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full min-h-[200px] object-cover"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-2 mb-3">
              {!previewUrl && (
                <button
                  type="button"
                  onClick={captureFrame}
                  className="flex-1 py-3 rounded-xl bg-emerald text-white font-medium min-h-[44px]"
                >
                  Capture
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 rounded-xl border border-black/15 bg-transparent text-black/70 font-medium min-h-[44px] hover:bg-black/5 transition-colors"
              >
                {previewUrl ? "Replace image" : "Upload from Files"}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {previewUrl && (
              <button
                type="button"
                onClick={handleExtract}
                disabled={isExtracting}
                className="w-full py-3 rounded-xl bg-emerald text-white font-medium min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isExtracting ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden />
                    Extracting…
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                      <line x1="7" y1="12" x2="17" y2="12" />
                    </svg>
                    Extract items
                  </>
                )}
              </button>
            )}
            {error && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-medium text-red-800">{error}</p>
                <p className="text-xs text-red-600/90 mt-1">Try a clearer screenshot or replace the image.</p>
              </div>
            )}
        </>
      </div>
    </>
  );
}
