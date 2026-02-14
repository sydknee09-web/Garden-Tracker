"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPendingPhotoHeroImport,
  clearPendingPhotoHeroImport,
  setReviewImportData,
  type PendingPhotoHeroItem,
} from "@/lib/reviewImportStorage";
import type { ReviewImportItem } from "@/lib/reviewImportStorage";
import { identityKeyFromVariety } from "@/lib/identityKey";

type HeroStatus = "pending" | "processing" | "success" | "error";

interface HeroItem extends PendingPhotoHeroItem {
  status: HeroStatus;
  phaseLabel?: string;
  hero_image_url?: string;
  error?: string;
}

export default function HeroImportPage() {
  const router = useRouter();
  const { session: authSession } = useAuth();
  const [items, setItems] = useState<HeroItem[]>([]);
  const [processing, setProcessing] = useState(true);
  const stopRequestedRef = useRef(false);
  const processingRef = useRef(false);

  const updateItem = useCallback((id: string, updates: Partial<HeroItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  // Load batch from storage; do not clear here so we don't lose the batch if the page fails to mount
  useEffect(() => {
    const pending = getPendingPhotoHeroImport();
    if (!pending?.items?.length) {
      router.replace("/vault");
      return;
    }
    setItems(
      pending.items.map((p) => ({
        ...p,
        status: "pending" as HeroStatus,
      }))
    );
  }, [router]);

  // Clear storage when leaving the page so we don't show stale data on next visit
  useEffect(() => {
    return () => {
      clearPendingPhotoHeroImport();
    };
  }, []);

  useEffect(() => {
    if (items.length === 0 || processingRef.current || stopRequestedRef.current) return;
    const next = items.find((i) => i.status === "pending");
    const hasProcessing = items.some((i) => i.status === "processing");
    if (!next) {
      if (!hasProcessing) setProcessing(false);
      return;
    }
    processingRef.current = true;
    const id = next.id;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authSession?.access_token)
      headers.Authorization = `Bearer ${authSession.access_token}`;

    const run = async () => {
      updateItem(id, { status: "processing", phaseLabel: "Finding hero photo…" });
      const item = items.find((i) => i.id === id);
      if (!item) {
        processingRef.current = false;
        return;
      }
      const identityKey = identityKeyFromVariety(item.type || "Imported seed", item.variety ?? "");
      try {
        const res = await fetch("/api/seed/find-hero-photo", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: item.type || "Imported seed",
            variety: item.variety ?? "",
            vendor: item.vendor ?? "",
            ...(identityKey && { identity_key: identityKey }),
          }),
        });
        const data = (await res.json()) as { hero_image_url?: string; error?: string };
        const heroUrl = data.hero_image_url?.trim();
        if (stopRequestedRef.current) {
          processingRef.current = false;
          return;
        }
        updateItem(id, {
          status: "success",
          phaseLabel: heroUrl ? "Ready" : "No hero found",
          hero_image_url: heroUrl || undefined,
        });
      } catch (e) {
        if (stopRequestedRef.current) {
          processingRef.current = false;
          return;
        }
        updateItem(id, {
          status: "error",
          phaseLabel: "",
          error: e instanceof Error ? e.message : "Failed",
        });
      }
      processingRef.current = false;
    };
    run();
  }, [items, updateItem, authSession?.access_token]);

  const handleStopAndReview = useCallback(() => {
    stopRequestedRef.current = true;
    setProcessing(false);
    const completed = items.filter((i) => i.status === "success" || i.status === "error" || i.status === "processing");
    const reviewItems: ReviewImportItem[] = completed.map((i) => {
      const heroUrl = i.hero_image_url?.trim();
      return {
        id: crypto.randomUUID(),
        imageBase64: i.imageBase64,
        fileName: i.fileName,
        vendor: i.vendor ?? "",
        type: i.type ?? "Imported seed",
        variety: i.variety ?? "",
        tags: i.tags ?? [],
        purchaseDate: i.purchaseDate ?? new Date().toISOString().slice(0, 10),
        hero_image_url: heroUrl || "/seedling-icon.svg",
        useStockPhotoAsHero: !!heroUrl,
        identityKey: identityKeyFromVariety(i.type ?? "Imported seed", i.variety ?? "") || undefined,
      };
    });
    if (reviewItems.length > 0) {
      setReviewImportData({ items: reviewItems });
      router.push("/vault/review-import");
    }
  }, [items, router]);

  const handleCancel = useCallback(() => {
    stopRequestedRef.current = true;
    setProcessing(false);
    clearPendingPhotoHeroImport();
    router.push("/vault");
  }, [router]);

  const handleRetryFailed = useCallback(() => {
    stopRequestedRef.current = false;
    setItems((prev) =>
      prev.map((i) =>
        i.status === "error" ? { ...i, status: "pending" as HeroStatus, error: undefined, phaseLabel: undefined } : i
      )
    );
    setProcessing(true);
  }, []);

  const completed = items.filter((i) => i.status === "success" || i.status === "error").length;
  const total = items.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const successCount = items.filter((i) => i.status === "success").length;
  const allDone = completed === total;
  const canReview = allDone && completed > 0;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6 pb-24">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/vault"
          className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6"
        >
          ← Back to Vault
        </Link>

        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Load Plant Profile Picture</h1>
        <p className="text-neutral-600 text-sm mb-6">
          Finding a plant photo for each entry (not the packet). You can stop early and review what we have so far.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600 mb-2">
          <span>
            {completed} of {total} processed · {progressPercent}%
          </span>
          <div className="flex items-center gap-3 flex-shrink-0">
            {processing ? (
              <button
                type="button"
                onClick={handleStopAndReview}
                className="text-amber-600 hover:text-amber-800 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center"
              >
                Stop & Review
              </button>
            ) : items.some((i) => i.status === "error") ? (
              <button
                type="button"
                onClick={handleRetryFailed}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center"
              >
                Retry Failed
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCancel}
              className="text-red-500 hover:text-red-700 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center"
            >
              Cancel
            </button>
          </div>
        </div>
        <div
          className="h-2 rounded-full bg-black/10 overflow-hidden mb-6"
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

        <ul className="space-y-4 list-none p-0 m-0">
          {items.map((item) => {
            const previewSrc = item.imageBase64?.startsWith("data:")
              ? item.imageBase64
              : `data:image/jpeg;base64,${item.imageBase64}`;
            const isError = item.status === "error";
            const isSuccess = item.status === "success";
            const isProcessing = item.status === "processing";
            return (
              <li
                key={item.id}
                className="rounded-xl border bg-white shadow-sm overflow-hidden border-neutral-200"
              >
                <div className="flex gap-4 p-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={previewSrc}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800 truncate mb-1">
                      {item.type} {item.variety ? `– ${item.variety}` : ""}
                    </p>
                    {isError ? (
                      <p className="text-sm text-red-600" role="alert">
                        {item.error}
                      </p>
                    ) : (
                      <p className="text-sm text-neutral-600">
                        {isProcessing ? item.phaseLabel : isSuccess ? item.phaseLabel : "Waiting…"}
                      </p>
                    )}
                    {isProcessing && (
                      <div className="mt-2 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                        <div className="h-full bg-emerald transition-all duration-300 ease-out animate-pulse" style={{ width: "60%" }} />
                      </div>
                    )}
                  </div>
                  {isSuccess && (
                    <div className="flex-shrink-0 flex items-center" aria-hidden>
                      <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                        ✓
                      </span>
                    </div>
                  )}
                  {isError && (
                    <div className="flex-shrink-0 flex items-center" aria-hidden>
                      <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                        ✕
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {allDone && (
          <div className="mt-8 flex flex-col gap-3">
            {successCount > 0 ? (
              <p className="text-sm text-neutral-600">
                {successCount} item{successCount !== 1 ? "s" : ""} ready for review.
                {items.length - successCount > 0 &&
                  ` ${items.length - successCount} failed.`}
              </p>
            ) : (
              <p className="text-sm text-amber-700">No hero photos could be found. You can still save to review with packet images.</p>
            )}
            <button
              type="button"
              onClick={handleStopAndReview}
              disabled={!canReview}
              className="w-full py-3 px-6 rounded-xl bg-emerald-600 text-white font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors min-h-[44px]"
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
