"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPendingPhotoImport,
  clearPendingPhotoImport,
  setReviewImportData,
  type PendingPhotoImportItem,
  type ReviewImportItem,
} from "@/lib/reviewImportStorage";
import type { ExtractResponse } from "@/app/api/seed/extract/route";

type PhotoPhase = "uploading" | "scanning" | "finding_hero" | "success" | "error";

interface PhotoItem extends PendingPhotoImportItem {
  phase: PhotoPhase;
  phaseLabel: string;
  error?: string;
  extractResult?: ExtractResponse & { stock_photo_url?: string };
  heroPhotoUrl?: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ImportPhotosPage() {
  const router = useRouter();
  const { session: authSession } = useAuth();
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [processing, setProcessing] = useState(true);
  const [allDone, setAllDone] = useState(false);
  const processingRef = useRef(false);

  const updateItem = useCallback((id: string, updates: Partial<PhotoItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  useEffect(() => {
    const pending = getPendingPhotoImport();
    if (!pending?.items?.length) {
      router.replace("/vault");
      return;
    }
    clearPendingPhotoImport();
    setItems(
      pending.items.map((p) => ({
        ...p,
        phase: "uploading" as PhotoPhase,
        phaseLabel: "Uploading file...",
      }))
    );
  }, [router]);

  useEffect(() => {
    if (items.length === 0 || processingRef.current) return;
    const next = items.find(
      (i) => i.phase === "uploading" || i.phase === "scanning" || i.phase === "finding_hero"
    );
    if (!next) {
      setProcessing(false);
      setAllDone(true);
      return;
    }
    processingRef.current = true;
    const id = next.id;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authSession?.access_token)
      headers.Authorization = `Bearer ${authSession.access_token}`;

    const run = async () => {
      if (next.phase === "uploading") {
        updateItem(id, { phase: "scanning", phaseLabel: "Scanning image (AI Pass 1)..." });
      }
      if (next.phase === "uploading" || next.phase === "scanning") {
        try {
          const res = await fetch("/api/seed/extract", {
            method: "POST",
            headers,
            body: JSON.stringify({
              imageBase64: next.imageBase64,
              mimeType: "image/jpeg",
            }),
          });
          const data = (await res.json()) as ExtractResponse & { error?: string };
          if (!res.ok || data?.error) {
            updateItem(id, {
              phase: "error",
              phaseLabel: "",
              error: typeof data?.error === "string" ? data.error : "Scan failed",
            });
            processingRef.current = false;
            return;
          }
          const stockUrl = (data as { stock_photo_url?: string }).stock_photo_url?.trim();
          if (stockUrl) {
            updateItem(id, {
              phase: "success",
              phaseLabel: "Ready",
              extractResult: { ...data, stock_photo_url: stockUrl },
              heroPhotoUrl: stockUrl,
            });
            processingRef.current = false;
            return;
          }
          updateItem(id, {
            phase: "finding_hero",
            phaseLabel: "Finding hero photo (Pass 2)...",
            extractResult: data,
          });
          const heroRes = await fetch("/api/seed/find-hero-photo", {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: data.type || "Imported seed",
              variety: data.variety ?? "",
              vendor: data.vendor ?? "",
            }),
          });
          const heroData = (await heroRes.json()) as { hero_image_url?: string };
          const heroUrl = heroData.hero_image_url?.trim();
          updateItem(id, {
            phase: "success",
            phaseLabel: "Ready",
            heroPhotoUrl: heroUrl,
            extractResult: heroUrl
              ? { ...data, stock_photo_url: heroUrl, hero_image_url: heroUrl }
              : data,
          });
        } catch (e) {
          updateItem(id, {
            phase: "error",
            phaseLabel: "",
            error: e instanceof Error ? e.message : "Scan failed",
          });
        }
        processingRef.current = false;
        return;
      }
      processingRef.current = false;
    };
    run();
  }, [items, updateItem, authSession?.access_token]);

  const handleContinueToReview = useCallback(() => {
    const successful = items.filter((i) => i.phase === "success" && i.extractResult);
    const reviewItems: ReviewImportItem[] = successful.map((i) => {
      const r = i.extractResult!;
      const heroUrl = i.heroPhotoUrl?.trim() || r.stock_photo_url?.trim() || r.hero_image_url?.trim();
      return {
        id: crypto.randomUUID(),
        imageBase64: i.imageBase64,
        fileName: i.fileName,
        vendor: r.vendor ?? "",
        type: r.type ?? "Imported seed",
        variety: r.variety ?? "",
        tags: r.tags ?? [],
        purchaseDate: todayISO(),
        sowing_depth: r.sowing_depth,
        spacing: r.spacing,
        sun_requirement: r.sun_requirement,
        days_to_germination: r.days_to_germination,
        days_to_maturity: r.days_to_maturity,
        source_url: r.source_url,
        stock_photo_url: r.stock_photo_url?.trim() || undefined,
        hero_image_url: heroUrl || "/seedling-icon.svg",
        useStockPhotoAsHero: !!heroUrl,
      };
    });
    setReviewImportData({ items: reviewItems });
    router.push("/vault/review-import");
  }, [items, router]);

  const completed = items.filter((i) => i.phase === "success" || i.phase === "error").length;
  const total = items.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const successCount = items.filter((i) => i.phase === "success").length;
  const canContinue = allDone && successCount > 0;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/vault"
          className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6"
        >
          ← Back to Vault
        </Link>

        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Photo Import</h1>
        <p className="text-neutral-600 text-sm mb-6">
          Processing your photos. Each image is scanned for seed details, then we find a hero photo for the profile.
        </p>

        {/* Global progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-neutral-600 mb-2">
            <span>
              Processing {completed} of {total} photos...
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div
            className="h-2 rounded-full bg-black/10 overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-emerald transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Card list */}
        <ul className="space-y-4 list-none p-0 m-0">
          {items.map((item, index) => {
            const previewSrc =
              item.imageBase64?.startsWith("data:") ?
                item.imageBase64
              : `data:image/jpeg;base64,${item.imageBase64}`;
            const isError = item.phase === "error";
            const isSuccess = item.phase === "success";
            const step = isError ? 0 : isSuccess ? 3 : item.phase === "uploading" ? 1 : item.phase === "scanning" ? 2 : 3;
            return (
              <li
                key={item.id}
                className="rounded-xl border bg-white shadow-sm overflow-hidden border-neutral-200 animate-fade-slide-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex gap-4 p-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0 flex items-center justify-center">
                    {isError ? (
                      <span className="text-3xl text-neutral-400" aria-hidden title="No preview">
                        🖼️
                      </span>
                    ) : (
                      <img
                        src={previewSrc}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800 truncate mb-1">
                      {item.fileName}
                    </p>
                    {isError ? (
                      <p className="text-sm text-red-600" role="alert">
                        {item.error}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-neutral-600 mb-2">{item.phaseLabel}</p>
                        <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald transition-all duration-300 ease-out"
                            style={{
                              width:
                                step === 1 ? "33%" : step === 2 ? "66%" : step === 3 ? "100%" : "0%",
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {isSuccess && (
                    <div className="flex-shrink-0 flex items-center" aria-hidden>
                      <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                        ✓
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {allDone && (
          <div className="mt-8 flex flex-col gap-3 animate-fade-slide-in">
            {successCount > 0 ? (
              <p className="text-sm text-neutral-600">
                {successCount} photo{successCount !== 1 ? "s" : ""} ready for review.
                {items.length - successCount > 0 &&
                  ` ${items.length - successCount} failed.`}
              </p>
            ) : (
              <p className="text-sm text-amber-700">No photos could be processed. You can try again with different images.</p>
            )}
            <button
              type="button"
              onClick={handleContinueToReview}
              disabled={!canContinue}
              className="w-full py-3 px-6 rounded-xl bg-emerald-600 text-white font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            >
              Continue to Import Review
            </button>
            <Link
              href="/vault"
              className="text-center text-sm text-neutral-500 hover:text-neutral-700"
            >
              Back to Vault
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
