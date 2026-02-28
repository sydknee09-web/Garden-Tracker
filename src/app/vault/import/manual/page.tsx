"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  getPendingManualAdd,
  clearPendingManualAdd,
  setReviewImportData,
  type ReviewImportItem,
} from "@/lib/reviewImportStorage";
import { parseVarietyWithModifiers } from "@/lib/varietyModifiers";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getZone10bScheduleForPlant } from "@/data/zone10b_schedule";

type Phase = "idle" | "enrich" | "hero" | "schedule" | "done" | "error";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ImportManualPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);
  const proceededRef = useRef(false);
  const skipHeroRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const pending = getPendingManualAdd();
    if (!pending?.plantName?.trim()) {
      router.replace("/vault");
      return;
    }
    clearPendingManualAdd();

    if (ranRef.current) return;
    ranRef.current = true;

    const plantName = pending.plantName.trim();
    const { coreVariety } = parseVarietyWithModifiers(pending.varietyCultivar);
    const variety = coreVariety || pending.varietyCultivar.trim() || "";

    const run = async () => {
      let sun: string | undefined;
      let plant_spacing: string | undefined;
      let days_to_germination: string | undefined;
      let harvest_days: number | undefined;
      let sowing_depth: string | undefined;
      let companion_plants: string[] | undefined;
      let avoid_plants: string[] | undefined;

      try {
        setPhase("enrich");
        const enrichRes = await fetch("/api/seed/enrich-from-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: plantName, variety }),
        });
        const enrichData = (await enrichRes.json()) as {
          enriched?: boolean;
          sun?: string;
          plant_spacing?: string;
          days_to_germination?: string;
          harvest_days?: number;
          sowing_depth?: string;
          companion_plants?: string[] | null;
          avoid_plants?: string[] | null;
        };
        if (enrichData?.enriched) {
          if (enrichData.sun != null) sun = enrichData.sun;
          if (enrichData.plant_spacing != null) plant_spacing = enrichData.plant_spacing;
          if (enrichData.days_to_germination != null) days_to_germination = enrichData.days_to_germination;
          if (enrichData.harvest_days != null) harvest_days = enrichData.harvest_days;
          if (enrichData.sowing_depth != null) sowing_depth = enrichData.sowing_depth;
          if (Array.isArray(enrichData.companion_plants) && enrichData.companion_plants.length > 0) companion_plants = enrichData.companion_plants;
          if (Array.isArray(enrichData.avoid_plants) && enrichData.avoid_plants.length > 0) avoid_plants = enrichData.avoid_plants;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Enrich failed");
        setPhase("error");
        return;
      }

      const proceedToReview = (hero_image_url: string | undefined) => {
        if (proceededRef.current) return;
        proceededRef.current = true;
        setPhase("done");
        const identityKey = identityKeyFromVariety(plantName, variety);
        const reviewItem: ReviewImportItem = {
          id: crypto.randomUUID(),
          imageBase64: "",
          fileName: "",
          vendor: (pending.vendor ?? "").trim(),
          type: plantName,
          variety,
          tags: pending.tagsToSave ?? [],
          purchaseDate: todayISO(),
          source_url: pending.sourceUrlToSave?.trim(),
          hero_image_url: hero_image_url || undefined,
          stock_photo_url: hero_image_url || undefined,
          useStockPhotoAsHero: !!hero_image_url,
          identityKey: identityKey || undefined,
          sun_requirement: sun,
          plant_spacing,
          spacing: plant_spacing,
          days_to_germination,
          days_to_maturity: harvest_days != null ? String(harvest_days) : undefined,
          harvest_days,
          sowing_depth,
          companion_plants,
          avoid_plants,
        };
        setReviewImportData({ items: [reviewItem] });
        router.push("/vault/review-import");
      };

      setPhase("hero");
      skipHeroRef.current = () => proceedToReview(undefined);

      fetch("/api/seed/find-hero-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: plantName,
          variety,
          vendor: (pending.vendor ?? "").trim() || "",
        }),
      })
        .then((r) => r.json())
        .then((heroData: { hero_image_url?: string; error?: string }) => {
          if (proceededRef.current) return;
          proceedToReview(heroData.hero_image_url?.trim());
        })
        .catch(() => {
          if (proceededRef.current) return;
          proceedToReview(undefined);
        });
    };

    run();
  }, [router, user?.id]);

  if (phase === "error") {
    return (
      <div
        className="fixed inset-x-0 flex flex-col items-center justify-center bg-neutral-50 p-6 z-30"
        style={{
          top: "calc(2.75rem + env(safe-area-inset-top, 0px))",
          bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <p className="text-citrus font-medium mb-2">Something went wrong</p>
        <p className="text-sm text-black/60 mb-4">{error}</p>
        <Link
          href="/vault"
          className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald text-white font-medium inline-flex items-center gap-2"
        >
          ← Back to Vault
        </Link>
      </div>
    );
  }

  const phaseLabels: Record<Phase, string> = {
    idle: "Preparing…",
    enrich: "Enriching plant details…",
    hero: "Finding hero photo…",
    schedule: "Preparing schedule…",
    done: "Redirecting to review…",
    error: "",
  };
  const label = phaseLabels[phase];

  return (
    <div
      className="fixed inset-x-0 flex flex-col items-center justify-center bg-neutral-50 p-6 z-30"
      style={{
        top: "calc(2.75rem + env(safe-area-inset-top, 0px))",
        bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="rounded-2xl bg-white shadow-card border border-black/5 p-8 max-w-sm w-full text-center mx-auto">
        <div className="animate-pulse flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald/20" />
        </div>
        <p className="text-sm font-medium text-black/80">{label}</p>
      </div>
      <div className="mt-6 flex flex-col items-center gap-3">
        {phase === "hero" && (
          <button
            type="button"
            onClick={() => skipHeroRef.current?.()}
            className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl border border-emerald/40 text-emerald-700 bg-emerald-50 font-medium hover:bg-emerald-100"
          >
            Skip
          </button>
        )}
        <Link href="/vault" className="text-sm text-black/50 hover:text-black/70">
          Cancel
        </Link>
      </div>
    </div>
  );
}
