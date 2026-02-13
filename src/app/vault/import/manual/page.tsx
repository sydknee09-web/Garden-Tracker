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
import { getZone10bScheduleForPlant, getDefaultSowMonthsForZone10b } from "@/data/zone10b_schedule";

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
      let hero_image_url: string | undefined;

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
        };
        if (enrichData?.enriched) {
          if (enrichData.sun != null) sun = enrichData.sun;
          if (enrichData.plant_spacing != null) plant_spacing = enrichData.plant_spacing;
          if (enrichData.days_to_germination != null) days_to_germination = enrichData.days_to_germination;
          if (enrichData.harvest_days != null) harvest_days = enrichData.harvest_days;
          if (enrichData.sowing_depth != null) sowing_depth = enrichData.sowing_depth;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Enrich failed");
        setPhase("error");
        return;
      }

      try {
        setPhase("hero");
        const heroRes = await fetch("/api/seed/find-hero-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: plantName,
            variety,
            vendor: (pending.vendor ?? "").trim() || "",
          }),
        });
        const heroData = (await heroRes.json()) as { hero_image_url?: string; error?: string };
        hero_image_url = heroData.hero_image_url?.trim();
      } catch {
        // non-fatal
      }

      try {
        setPhase("schedule");
        if (plantName && user?.id) {
          const { data: existingSchedule } = await supabase
            .from("schedule_defaults")
            .select("id")
            .eq("user_id", user.id)
            .eq("plant_type", plantName)
            .maybeSingle();
          if (!existingSchedule) {
            const zone10b = getZone10bScheduleForPlant(plantName);
            const sowMonths = getDefaultSowMonthsForZone10b(zone10b?.planting_window);
            await supabase.from("schedule_defaults").upsert(
              {
                user_id: user.id,
                plant_type: plantName,
                updated_at: new Date().toISOString(),
                ...sowMonths,
              },
              { onConflict: "user_id,plant_type" }
            );
          }
        }
      } catch {
        // non-fatal
      }

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
      };

      setReviewImportData({ items: [reviewItem] });
      router.push("/vault/review-import");
    };

    run();
  }, [router, user?.id]);

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">
        <p className="text-citrus font-medium mb-2">Something went wrong</p>
        <p className="text-sm text-black/60 mb-4">{error}</p>
        <Link
          href="/vault"
          className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald text-white font-medium"
        >
          Back to Vault
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
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">
      <div className="rounded-2xl bg-white shadow-card border border-black/5 p-8 max-w-sm w-full text-center">
        <div className="animate-pulse flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald/20" />
        </div>
        <p className="text-sm font-medium text-black/80">{label}</p>
      </div>
      <Link href="/vault" className="mt-6 text-sm text-black/50 hover:text-black/70">
        Cancel
      </Link>
    </div>
  );
}
