"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { PlantProfile } from "@/types/garden";
import { TagBadges } from "@/components/TagBadges";
import { ICON_MAP } from "@/lib/styleDictionary";
import { isEdiblePlant } from "@/constants/seedTypes";
import { useUserPlantingZone } from "@/hooks/useUserPlantingZone";
import { formatVendorDetails } from "./vaultProfileUtils";

export type AboutTabCareList = { label: string; value: string }[];

type JournalPhoto = { id: string; image_file_path: string; created_at: string };

export interface VaultProfileAboutTabProps {
  profile: PlantProfile | null;
  packets: { id: string; vendor_name?: string | null; purchase_url?: string | null; vendor_specs?: unknown }[];
  journalPhotos: JournalPhoto[];
  isLegacy: boolean;
  legacyNotes: string;
  legacyPlantDesc: string | null;
  legacyGrowingInfo: string | null;
  legacySourceUrl: string | null;
  /** How to Grow at-a-glance care rows (Spacing + Days to Maturity) with effective-care fallbacks. */
  howToGrowList: AboutTabCareList;
  /** Seed Starting card rows (sowing method/depth, planting depth, germination); empty when not seed-grown. */
  seedStartingList: AboutTabCareList;
  /** Whether the Seed Starting card renders (seed-propagatable). Single source of truth from the page. */
  showSeedStarting: boolean;
  /** Planting-window scalar for the When to Plant card (page applies schedule fallback). */
  plantingWindow: string | null;
  /** Sun/Water summary pills (page applies sun_summary→effectiveCare→sun fallback chain). */
  sunPill: string | null;
  waterPill: string | null;
  growingNotes: string;
  aboutCollapsed: Record<string, boolean>;
  toggleAboutSection: (key: string) => void;
  isAboutOpen: (key: string) => boolean;
  vendorDetailsOpen: boolean;
  setVendorDetailsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setImageLightbox: (v: { urls: string[]; index: number } | null) => void;
  /** B5 variety-not-found: last AI run couldn't find this exact plant → inline notice + Try Again. */
  aiNotFound?: boolean;
  retryRunning?: boolean;
  onRetryAi?: () => void;
  onDismissAiNotFound?: () => void;
  /** AI Fill in flight + on-row data is LEGACY (version < CURRENT) → hide possibly-stale AI values
   *  behind a skeleton until the fill completes (kills the value-flash from Finding #39). */
  enrichmentLoading?: boolean;
  /** AI Fill in flight + on-row data is CURRENT → values stay (only blanks fill); show a subtle
   *  "filling in details" skeleton hint rather than hiding anything. */
  enrichmentBlankLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Shared primitives (NORTH_STAR §1 — one canonical shape per concept)
// ---------------------------------------------------------------------------

/** Collapsible section card — the single About-tab card primitive (existing register). */
function SectionCard({
  id,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id?: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-white rounded-xl border border-neutral-200 mb-4 overflow-hidden scroll-mt-32">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl"
        aria-expanded={isOpen}
      >
        <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
        <span className="shrink-0 text-neutral-400" aria-hidden>
          {isOpen ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4 pt-0">{children}</div>}
    </div>
  );
}

/**
 * B2 pill+detail primitive — bold pill summary + 1-2 sentence detail beneath, both visible
 * by default (no tap-to-expand, Q8 lock). One shared component for every data-rich field.
 * `pill` renders value(s) as neutral chips; without it the value renders in the plain dd register.
 * Empty values show "—" per the locked empty-cell convention.
 */
function PillDetailField({
  label,
  value,
  values,
  detail,
  pill = false,
}: {
  label: string;
  value?: string | null;
  values?: string[] | null;
  detail?: string | null;
  pill?: boolean;
}) {
  const list = (values ?? (value != null ? [value] : []))
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
  const detailText = detail?.trim();
  return (
    <div>
      <dt className="text-xs text-neutral-500 mb-0.5">{label}</dt>
      {list.length === 0 ? (
        <dd className="text-sm text-neutral-900 font-medium">—</dd>
      ) : pill ? (
        <dd className="flex flex-wrap gap-1.5">
          {list.map((v) => (
            <span key={v} className="inline-block text-sm font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-900">
              {v}
            </span>
          ))}
        </dd>
      ) : (
        <dd className="text-sm text-neutral-900 font-medium">{list.join(", ")}</dd>
      )}
      {detailText && <dd className="mt-1 text-sm text-neutral-600">{detailText}</dd>}
    </div>
  );
}

/** In-card sub-header register (existing "How to propagate" label anchor). */
function SubHeader({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1.5">{children}</p>;
}

// ---------------------------------------------------------------------------
// Enrichment-versioning loading states (2026-06-13). Skeleton lines use the
// canonical bg-neutral-200 rounded animate-pulse token (PageSkeleton); the spinner
// matches the existing AI-button spinner primitive.
// ---------------------------------------------------------------------------

/** A single AI-section card placeholder shown while AI Fill runs on a LEGACY profile. */
function AiFillSkeletonCard({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 mb-4 overflow-hidden" aria-hidden>
      <div className="flex items-center justify-between gap-2 p-4 min-h-[44px]">
        <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
        <span className="w-4 h-4 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin shrink-0" />
      </div>
      <div className="px-4 pb-4 pt-0 space-y-2">
        <div className="h-4 bg-neutral-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-neutral-200 rounded animate-pulse w-5/6" />
        <div className="h-4 bg-neutral-200 rounded animate-pulse w-2/3" />
      </div>
    </div>
  );
}

/** Legacy-profile loading group: hides possibly-stale AI content behind skeletons. */
function AiFillSkeletonGroup() {
  return (
    <div aria-live="polite" aria-busy="true">
      <AiFillSkeletonCard title="At a Glance" />
      <AiFillSkeletonCard title="How to Grow" />
    </div>
  );
}

/** Current-profile loading hint: values already shown stay put; this signals blanks are filling. */
function AiFillBlankHint() {
  return (
    <div className="flex items-center gap-2 mb-4 px-1 text-xs text-neutral-500" aria-live="polite" aria-busy="true">
      <span className="w-3.5 h-3.5 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin shrink-0" aria-hidden />
      <span>Filling in remaining details…</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provenance (Ship 2) — extends the existing Source-line pattern with the AI
// tier the data was found at (variety / cultivar / species).
// ---------------------------------------------------------------------------

const PROVENANCE_PHRASES: Record<string, string> = {
  variety: "variety match",
  cultivar: "cultivar match",
  species: "species-level data",
};

/**
 * Distinct AI tiers among a section's fields, from the profile's field_provenance map.
 * Empty result = nothing AI-tagged in this section (user/legacy/vendor data).
 */
function sectionProvenanceLevels(
  provenance: Record<string, string> | null | undefined,
  fields: string[]
): string[] {
  if (!provenance) return [];
  const levels = new Set<string>();
  for (const f of fields) {
    const level = provenance[f];
    if (level && PROVENANCE_PHRASES[level]) levels.add(level);
  }
  return ["variety", "cultivar", "species"].filter((l) => levels.has(l));
}

/** "Source: AI research (species-level data)" line in the existing Source-line register. */
function ProvenanceSourceLine({ levels }: { levels: string[] }) {
  if (levels.length === 0) return null;
  const phrase = levels.map((l) => PROVENANCE_PHRASES[l]).join(" + ");
  return <p className="text-xs text-neutral-500 mt-3">Source: AI research ({phrase})</p>;
}

// Per-card provenance field lists (Sprint 10): re-bucketed so each card's Source line reflects
// only the fields that card now renders.
const AT_A_GLANCE_PROVENANCE_FIELDS = [
  "lifecycle", "growth_form", "plant_category", "mature_height", "mature_width",
];
const HOW_TO_GROW_PROVENANCE_FIELDS = [
  "plant_spacing", "harvest_days", "sun", "sun_summary", "water", "water_summary", "soil_preference",
];
const CHARACTERISTICS_PROVENANCE_FIELDS = [
  "growth_habit", "family", "genus", "species", "pollination_requirements", "deer_rabbit_resistance",
  "drought_salt_tolerance", "native_origin", "invasiveness", "toxicity", "wildlife_value", "synonyms",
  "uses", "special_features",
];

// ---------------------------------------------------------------------------
// Growing Notes sectioning (Sprint 10). The v3 AI prompt emits growing_notes as
// labeled sections (Soil / Watering / Feeding / Pruning & Training / Pests & Disease);
// we parse those into bold-prefixed paragraphs. Legacy (v2 and earlier) single-narrative
// notes have no labels → parse returns null → render as one block (graceful self-heal).
// ---------------------------------------------------------------------------

const GROWING_NOTES_LABELS = ["Soil", "Watering", "Feeding", "Pruning & Training", "Pests & Disease"];

function parseGrowingNotes(text: string): { label: string; body: string }[] | null {
  const labelAlt = GROWING_NOTES_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")).join("|");
  // Match each label at a line start, tolerating optional **bold** markers around it: "Soil:",
  // "**Soil:**", "**Soil**:". The label group (1) is captured for the bold subhead.
  const re = new RegExp(`(?:^|\\n)\\s*\\*{0,2}(${labelAlt})\\*{0,2}\\s*:`, "g");
  const matches = [...text.matchAll(re)];
  if (matches.length < 2) return null; // not the sectioned format → treat as a single narrative
  const sections: { label: string; body: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const body = text.slice(start, end).replace(/^\s*\*{0,2}/, "").trim();
    if (body) sections.push({ label: m[1], body });
  }
  return sections.length >= 2 ? sections : null;
}

/** Combine mature height + width into one human phrase; null when neither is known. */
function formatMatureSize(height?: string | null, width?: string | null): string | null {
  const h = height?.trim();
  const w = width?.trim();
  if (h && w) return `${h} tall × ${w} wide`;
  if (h) return `${h} tall`;
  if (w) return `${w} wide`;
  return null;
}

/** Human phrasing for non-seed propagation methods in the Propagation sub-header. */
const METHOD_PHRASES: Record<string, string> = {
  Cutting: "Cuttings",
  Division: "Division",
  Layering: "Layering",
  Grafting: "Grafting",
  "Bulb-Tuber division": "Bulb or Tuber Division",
  Spore: "Spores",
  Runner: "Runners",
};

function joinWithOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

export function VaultProfileAboutTab({
  profile,
  packets,
  journalPhotos,
  isLegacy,
  legacyNotes,
  legacyPlantDesc,
  legacyGrowingInfo,
  legacySourceUrl,
  howToGrowList,
  seedStartingList,
  showSeedStarting,
  plantingWindow,
  sunPill,
  waterPill,
  growingNotes,
  aboutCollapsed,
  toggleAboutSection,
  isAboutOpen,
  vendorDetailsOpen,
  setVendorDetailsOpen,
  setImageLightbox,
  aiNotFound = false,
  retryRunning = false,
  onRetryAi,
  onDismissAiNotFound,
  enrichmentLoading = false,
  enrichmentBlankLoading = false,
}: VaultProfileAboutTabProps) {
  // Zone-aware viability is computed at RENDER TIME (zone-agnostic encyclopedia, Syd 2026-06-13):
  // stored data carries only a zone-agnostic hardiness range; the user's own zone decides whether
  // this plant is viable outdoors here. Nothing zone-specific is persisted.
  const { zone: userZoneRaw } = useUserPlantingZone();
  const userZoneNum = (() => {
    const m = (userZoneRaw ?? "").match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  })();
  const zMin = profile?.hardiness_zone_min ?? null;
  const zMax = profile?.hardiness_zone_max ?? null;
  const hardinessLabel =
    zMin != null && zMax != null ? `${zMin}–${zMax}` : zMin != null ? `${zMin}+` : zMax != null ? `Up to ${zMax}` : null;
  // Only computable when we know BOTH the plant's range and the user's zone. Unknown zone or
  // missing range → no banner (we don't assert viability we can't determine).
  const notViableHere =
    userZoneNum != null && zMin != null && zMax != null && (userZoneNum < zMin || userZoneNum > zMax);

  // Sticky quick-jump anchors — follow the Sprint 10 card order (At a Glance → How to Grow →
  // Companion → Growing Notes). Growing Notes only anchors when the card renders.
  const anchorSections = [
    { key: "glance", label: "At a Glance", show: !isLegacy },
    { key: "howToGrow", label: "How to Grow", show: true },
    { key: "companion", label: "Companion", show: true },
    { key: "growingNotes", label: "Growing Notes", show: !!growingNotes },
  ].filter((s) => s.show);
  const [activeSection, setActiveSection] = useState<string>(anchorSections[0]?.key ?? "");
  const sectionKeysJoined = anchorSections.map((s) => s.key).join(",");
  const suppressSpyUntilRef = useRef(0);

  // Scroll-spy: highlight the section the user has scrolled into. Observer fires on
  // boundary crossings; active = the last section whose top sits above the sticky-row
  // offset. Disconnects on unmount / tab switch (About unmounts on tab change).
  useEffect(() => {
    const keys = sectionKeysJoined.split(",").filter(Boolean);
    const els = keys
      .map((key) => ({ key, el: document.getElementById(`about-section-${key}`) }))
      .filter((x): x is { key: string; el: HTMLElement } => !!x.el);
    if (els.length === 0) return;
    const OFFSET = 140; // global header (44) + sticky pill row clearance, matches scroll-mt-32
    const recompute = () => {
      if (Date.now() < suppressSpyUntilRef.current) return;
      let current = els[0].key;
      for (const { key, el } of els) {
        if (el.getBoundingClientRect().top <= OFFSET) current = key;
      }
      setActiveSection(current);
    };
    const observer = new IntersectionObserver(recompute, {
      rootMargin: `-${OFFSET}px 0px 0px 0px`,
      threshold: [0, 1],
    });
    els.forEach(({ el }) => observer.observe(el));
    window.addEventListener("scroll", recompute, { passive: true });
    recompute();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", recompute);
    };
  }, [sectionKeysJoined]);

  if (!profile) return null;

  const handleAnchorTap = (key: string) => {
    setActiveSection(key);
    // Let smooth-scroll settle before the spy recomputes, so the tapped pill doesn't flicker.
    suppressSpyUntilRef.current = Date.now() + 700;
    document.getElementById(`about-section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const propagationMethods = (profile.propagation_method ?? []).map((m) => m.trim()).filter(Boolean);
  const nonSeedMethods = propagationMethods.filter((m) => m !== "Seed");
  const hasSeedMethod = propagationMethods.includes("Seed");
  const notFoundName = [profile.name, profile.variety_name].map((s) => s?.trim()).filter(Boolean).join(" ");
  // Sprint 8 #32 conditional Characteristics: hide indoor-irrelevant + non-flowering fields for
  // houseplants. CORE fields (Toxicity, Wildlife) always show.
  const isHouseplant = profile.plant_category === "Houseplant";
  const isEdible = isEdiblePlant(profile);
  const matureSize = formatMatureSize(profile.mature_height, profile.mature_width);

  // When to Plant (Sprint 10): its own card now. Computed pieces drive both visibility and render.
  const wtpDesc = profile?.when_to_plant_description?.trim();
  const wtpSeasons = (profile?.planting_seasons_tags ?? []).filter(Boolean);
  const wtpIndoor = profile?.indoor_start_weeks_before_frost;
  const wtpOutdoor = profile?.outdoor_plant_weeks_after_frost;
  // Viability is computed at render time from the zone-agnostic hardiness range (notViableHere, above) —
  // no zone-baked "Not viable" string is stored anymore. hardinessLabel keeps the card visible when the
  // only When-to-Plant signal is the hardiness range.
  const hasWhenToPlant =
    !isLegacy && (!!wtpDesc || wtpSeasons.length > 0 || wtpIndoor != null || wtpOutdoor != null || !!plantingWindow || !!hardinessLabel);

  // Seed Starting (Sprint 10): a short, plain how-to line assembled from the structured fields —
  // additive phrasing over the pills above it, not a tutorial. Only the parts we have.
  const seedStartingHowTo = (() => {
    if (!showSeedStarting) return "";
    const method = (() => {
      const m = seedStartingList.find((r) => r.label === "Sowing Method")?.value;
      return m && m !== "—" ? m : "";
    })();
    const depth = (() => {
      const d = seedStartingList.find((r) => r.label === "Sowing Depth")?.value;
      return d && d !== "—" ? d : "";
    })();
    const germ = (() => {
      const g = seedStartingList.find((r) => r.label === "Days to Germination")?.value;
      return g && g !== "—" ? g : "";
    })();
    const lead = method ? `${method} ${depth ? `at ${depth}` : ""}`.trim() : depth ? `Sow ${depth} deep` : "";
    if (!lead && !germ) return "";
    const germPhrase = germ ? `germination takes about ${germ} days` : "";
    if (lead && germPhrase) return `${lead}; ${germPhrase}.`;
    return `${lead || germPhrase.charAt(0).toUpperCase() + germPhrase.slice(1)}.`;
  })();

  return (
    <>
      {/* ── B5: variety-not-found honest empty-state (info-note register + Try Again) ── */}
      {aiNotFound && !isLegacy && (
        <div className="bg-white rounded-xl border border-neutral-200 mb-4 p-4" role="status">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-neutral-600 italic flex-1">
              We couldn&apos;t find data for &apos;{notFoundName}&apos;. Please verify the spelling or fill in manually.
            </p>
            <button
              type="button"
              onClick={onDismissAiNotFound}
              className="shrink-0 min-w-[44px] min-h-[44px] -mt-2 -mr-2 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
              aria-label="Dismiss"
            >
              <ICON_MAP.Close className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onRetryAi}
            disabled={retryRunning}
            className="mt-2 min-h-[44px] px-4 py-2 rounded-xl border border-teal-gus/40 text-teal-gus text-sm font-medium hover:bg-teal-gus/10 disabled:opacity-50"
          >
            {retryRunning ? "Trying…" : "Try Again"}
          </button>
        </div>
      )}

      {/* Enrichment-versioning loading branch (2026-06-13): a legacy in-flight fill hides the
          possibly-stale AI sections behind a skeleton; otherwise render them, with a subtle
          blank-fill hint when a current-version fill is running. */}
      {enrichmentLoading ? (
        <AiFillSkeletonGroup />
      ) : (
        <>
      {enrichmentBlankLoading && <AiFillBlankHint />}

      {/* ── 1. At a Glance — description + quick-stats pill row (Sprint 10) ── */}
      {!isLegacy && (
        <SectionCard
          id="about-section-glance"
          title="At a Glance"
          isOpen={isAboutOpen("glance")}
          onToggle={() => toggleAboutSection("glance")}
        >
          {profile?.plant_description?.trim() && (
            <p className="text-sm text-neutral-700 whitespace-pre-wrap mb-4">{profile.plant_description}</p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <PillDetailField label="Lifecycle" value={profile.lifecycle} pill />
            <PillDetailField label="Growth Form" value={profile.growth_form} pill />
            <PillDetailField label="Plant Category" value={profile.plant_category} pill />
            <PillDetailField label="Mature Size" value={matureSize} />
          </dl>
          {/* ONE source footer (dogfood 2026-06-13): At a Glance merges the former Description +
              Characteristics cards, so it must not render both cards' source lines. A vendor/you
              description gets its explicit label; otherwise aggregate the AI provenance across the
              card's fields (description + quick stats) into a single "AI research" line. */}
          {(() => {
            const hasDesc = !!profile?.plant_description?.trim();
            if (hasDesc && (profile.description_source === "vendor" || profile.description_source === "you")) {
              return (
                <p className="text-xs text-neutral-500 mt-3">
                  Source: {profile.description_source === "vendor" ? "Vendor" : "You"}
                </p>
              );
            }
            return (
              <ProvenanceSourceLine
                levels={sectionProvenanceLevels(profile.field_provenance, [
                  ...(hasDesc ? ["plant_description"] : []),
                  ...AT_A_GLANCE_PROVENANCE_FIELDS,
                ])}
              />
            );
          })()}
        </SectionCard>
      )}

      {/* ── Sticky quick-jump anchor pills (GroupTabs tab-slot register) ──
          Sits below At a Glance and above the sections it navigates. sticky top-11 pins it under
          the global header once scrolled past. */}
      {anchorSections.length > 1 && (
        <div className="sticky top-11 z-20 -mx-6 px-6 py-2 mb-2 bg-neutral-50/95 backdrop-blur-sm">
          {/* stopPropagation so horizontally scrolling the sub-tab strip doesn't trigger the
              parent profile-swipe (prev/next plant). Matches VaultProfileJournalTab's gallery guard. */}
          <div
            className="overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="Jump to profile section"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="inline-flex rounded-xl p-1 bg-neutral-100 gap-0.5" role="group">
              {anchorSections.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={activeSection === s.key}
                  onClick={() => handleAnchorTap(s.key)}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeSection === s.key ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. When to Plant — timing pills + narrative + zone viability (Sprint 10: own card) ── */}
      {hasWhenToPlant && (
        <SectionCard
          id="about-section-whenToPlant"
          title="When to Plant"
          isOpen={isAboutOpen("whenToPlant")}
          onToggle={() => toggleAboutSection("whenToPlant")}
        >
          {/* Render-time viability banner: computed from the plant's zone-agnostic hardiness range
              vs the user's own zone (Syd 2026-06-13). Nothing zone-specific is stored. */}
          {notViableHere && (
            <p className="mb-3 flex items-start gap-1.5 text-sm text-neutral-600 italic">
              <ICON_MAP.Warning className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" aria-hidden />
              <span>Not viable in Zone {userZoneNum} — indoor / greenhouse only. This plant&apos;s hardiness range is Zones {hardinessLabel}.</span>
            </p>
          )}
          {/* Quick-scan timing pills above the narrative. Emoji markers are content-lane
              (seasonal/timing moments) per VISION §8. */}
          {(() => {
            const pills: string[] = [];
            if (hardinessLabel) pills.push(`🗺️ Hardy in Zones ${hardinessLabel}`);
            if (wtpIndoor != null) pills.push(`🏠 Start indoors ${wtpIndoor} wk before last frost`);
            if (wtpOutdoor != null) {
              pills.push(
                wtpOutdoor === 0
                  ? "🌱 Plant outside at last frost"
                  : wtpOutdoor < 0
                    ? `🌱 Plant outside ${Math.abs(wtpOutdoor)} wk before last frost`
                    : `🌱 Plant outside ${wtpOutdoor} wk after last frost`
              );
            }
            if (wtpSeasons.length > 0) pills.push(`🌸 ${wtpSeasons.join(" · ")}`);
            return pills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {pills.map((p) => (
                  <span key={p} className="inline-block text-sm font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-900">
                    {p}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
          {wtpDesc && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{wtpDesc}</p>}
          {plantingWindow && !notViableHere && (
            <dl className="mt-3"><PillDetailField label="Planting Window" value={plantingWindow} /></dl>
          )}
        </SectionCard>
      )}

      {/* ── 3. How to Grow — decluttered to at-a-glance care pills (Sprint 10) ── */}
      <SectionCard
        id="about-section-howToGrow"
        title="How to Grow"
        isOpen={isAboutOpen("howToGrow")}
        onToggle={() => toggleAboutSection("howToGrow")}
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {howToGrowList.map(({ label, value }) => (
            <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="text-sm text-neutral-900 font-medium">{value}</dd></div>
          ))}
        </dl>
        <dl className="mt-4 space-y-4">
          <PillDetailField label="Sun" value={sunPill} pill />
          <PillDetailField label="Water" value={waterPill} pill />
          <PillDetailField label="Soil" value={isLegacy ? null : profile.soil_preference} pill />
        </dl>
        <ProvenanceSourceLine levels={sectionProvenanceLevels(profile.field_provenance, HOW_TO_GROW_PROVENANCE_FIELDS)} />
      </SectionCard>

      {/* ── 4. Seed Starting — sowing mechanics split out of Propagation (Sprint 10) ── */}
      {!isLegacy && showSeedStarting && (
        <SectionCard
          id="about-section-seedStarting"
          title="Seed Starting"
          isOpen={isAboutOpen("seedStarting")}
          onToggle={() => toggleAboutSection("seedStarting")}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {seedStartingList.map(({ label, value }) => (
              <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="text-sm text-neutral-900 font-medium">{value}</dd></div>
            ))}
          </dl>
          {seedStartingHowTo && <p className="mt-3 text-sm text-neutral-700">{seedStartingHowTo}</p>}
        </SectionCard>
      )}

      {/* ── 5. Pest + Disease ── */}
      {!isLegacy && (
        <SectionCard
          id="about-section-pestDisease"
          title="Pest + Disease"
          isOpen={isAboutOpen("pestDisease")}
          onToggle={() => toggleAboutSection("pestDisease")}
        >
          <dl><PillDetailField label="Susceptibility" values={profile.disease_susceptibility} pill /></dl>
        </SectionCard>
      )}

      {/* ── 6. Harvest (edible only) ── */}
      {!isLegacy && isEdible && (
        <SectionCard
          id="about-section-harvest"
          title="Harvest"
          isOpen={isAboutOpen("harvest")}
          onToggle={() => toggleAboutSection("harvest")}
        >
          <dl><PillDetailField label="Harvest Season" values={profile.harvest_season} pill /></dl>
        </SectionCard>
      )}

      {/* ── 7. Companion Planting ── */}
      <SectionCard
        id="about-section-companion"
        title="Companion Planting"
        isOpen={isAboutOpen("companion")}
        onToggle={() => toggleAboutSection("companion")}
      >
        {(() => {
          const companions = profile?.companion_plants ?? [];
          const avoid = profile?.avoid_plants ?? [];
          const hasCompanions = Array.isArray(companions) && companions.length > 0;
          const hasAvoid = Array.isArray(avoid) && avoid.length > 0;
          const hasAny = hasCompanions || hasAvoid;
          return hasAny ? (
            <div className="space-y-3">
              {hasCompanions && (
                <div>
                  <SubHeader>Plant with</SubHeader>
                  <TagBadges tags={companions} />
                </div>
              )}
              {hasAvoid && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700 mb-1.5">Don&apos;t plant with</p>
                  <div className="flex flex-wrap gap-1.5">
                    {avoid.map((name) => {
                      const key = name.trim();
                      if (!key) return null;
                      return (
                        <span key={key} className="inline-block text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                          {key}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">None known</p>
          );
        })()}
      </SectionCard>

      {/* ── 8. Characteristics Deep-Dive — collapsed by default; advanced taxonomy (Sprint 10) ── */}
      {!isLegacy && (
        <SectionCard
          id="about-section-characteristics"
          title="Characteristics Deep-Dive"
          isOpen={isAboutOpen("characteristics")}
          onToggle={() => toggleAboutSection("characteristics")}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <PillDetailField label="Growth Habit" value={profile.growth_habit} pill />
            <PillDetailField label="Family" value={profile.family} />
            <PillDetailField label="Genus" value={profile.genus} />
            <PillDetailField label="Species" value={profile.species} />
            <PillDetailField label="Native Origin" value={profile.native_origin} />
            <PillDetailField label="Invasiveness" value={profile.invasiveness} />
            {!isHouseplant && <PillDetailField label="Pollination" value={profile.pollination_requirements} pill />}
            {!isHouseplant && <PillDetailField label="Deer / Rabbit Resistance" value={profile.deer_rabbit_resistance} pill />}
            {!isHouseplant && <PillDetailField label="Drought / Salt Tolerance" value={profile.drought_salt_tolerance} pill />}
          </dl>
          <dl className="mt-3 space-y-3">
            <PillDetailField label="Toxicity" value={profile.toxicity} />
            <PillDetailField label="Wildlife Value" value={profile.wildlife_value} />
            <PillDetailField label="Uses" values={profile.uses} pill />
            <PillDetailField label="Special Features" values={profile.special_features} pill />
            <PillDetailField label="Synonyms" values={profile.synonyms} />
          </dl>
          <ProvenanceSourceLine levels={sectionProvenanceLevels(profile.field_provenance, CHARACTERISTICS_PROVENANCE_FIELDS)} />
        </SectionCard>
      )}

      {/* ── 9. Propagation (advanced) — multiplying an existing plant; predictable header ── */}
      {!isLegacy && (
        <SectionCard
          id="about-section-propagation"
          title="Propagation"
          isOpen={isAboutOpen("propagation")}
          onToggle={() => toggleAboutSection("propagation")}
        >
          <div className="space-y-4">
            {profile?.seed_propagation_context?.trim() && (
              <p className="text-sm text-neutral-600 italic">{profile.seed_propagation_context}</p>
            )}
            <dl>
              <PillDetailField label="Method" values={propagationMethods} pill />
            </dl>
            {propagationMethods.length === 0 ? (
              <>
                <div>
                  <SubHeader>How to Propagate</SubHeader>
                  {profile?.propagation_notes?.trim() ? (
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{profile.propagation_notes}</p>
                  ) : (
                    <p className="text-sm text-neutral-500">—</p>
                  )}
                </div>
                <div>
                  <SubHeader>How to Save Seeds</SubHeader>
                  {profile?.seed_saving_notes?.trim() ? (
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{profile.seed_saving_notes}</p>
                  ) : (
                    <p className="text-sm text-neutral-500">—</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {nonSeedMethods.length > 0 && (
                  <div>
                    <SubHeader>
                      Propagated by {joinWithOr(nonSeedMethods.map((m) => METHOD_PHRASES[m] ?? m))}
                    </SubHeader>
                    {profile?.propagation_notes?.trim() ? (
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap">{profile.propagation_notes}</p>
                    ) : (
                      <p className="text-sm text-neutral-500">—</p>
                    )}
                  </div>
                )}
                {hasSeedMethod && (
                  <div>
                    <SubHeader>Saving Seeds</SubHeader>
                    {(() => {
                      // When Seed is the ONLY method, the general how-to narrative belongs here too.
                      const paras = [
                        nonSeedMethods.length === 0 ? profile?.propagation_notes?.trim() : "",
                        profile?.seed_saving_notes?.trim(),
                      ].filter((s): s is string => !!s);
                      return paras.length > 0 ? (
                        <div className="space-y-2">
                          {paras.map((s, i) => (
                            <p key={i} className="text-sm text-neutral-700 whitespace-pre-wrap">{s}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-500">—</p>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── 10. Growing Notes (BOTTOM) — sectioned care narrative (Sprint 10) ── */}
      {growingNotes && (
        <SectionCard
          id="about-section-growingNotes"
          title="Growing Notes"
          isOpen={isAboutOpen("growingNotes")}
          onToggle={() => toggleAboutSection("growingNotes")}
        >
          {(() => {
            const sections = parseGrowingNotes(growingNotes);
            return sections ? (
              <div className="space-y-3">
                {sections.map((s) => (
                  <p key={s.label} className="text-sm text-neutral-700 whitespace-pre-wrap">
                    <span className="font-semibold text-neutral-700">{s.label}:</span> {s.body}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{growingNotes}</p>
            );
          })()}
          <ProvenanceSourceLine levels={sectionProvenanceLevels(profile.field_provenance, ["growing_notes"])} />
        </SectionCard>
      )}
        </>
      )}

      {/* Source URL */}
      {packets.length > 0 && packets[0].purchase_url?.trim() && (
        <SectionCard title="Source" isOpen={isAboutOpen("source")} onToggle={() => toggleAboutSection("source")}>
          <a href={packets[0].purchase_url!} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline break-all">{packets[0].purchase_url}</a>
        </SectionCard>
      )}

      {/* Growth Gallery */}
      {journalPhotos.length > 0 && (
        <SectionCard title="Growth Gallery" isOpen={isAboutOpen("growthGallery")} onToggle={() => toggleAboutSection("growthGallery")}>
          <div
            className="overflow-x-auto flex gap-2 pb-2 snap-x snap-mandatory"
            style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {journalPhotos.map((photo, idx) => {
              const src = supabase.storage.from("journal-photos").getPublicUrl(photo.image_file_path).data.publicUrl;
              const galleryUrls = journalPhotos.map((p) => supabase.storage.from("journal-photos").getPublicUrl(p.image_file_path).data.publicUrl);
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setImageLightbox({ urls: galleryUrls, index: idx })}
                  className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-neutral-100 snap-center cursor-pointer hover:ring-2 hover:ring-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[44px] min-h-[44px]"
                  aria-label="View photo larger"
                >
                  <Image src={src} alt="" width={96} height={96} className="w-full h-full object-cover" sizes="96px" loading="lazy" unoptimized={src.startsWith("data:") || !src.includes("supabase.co")} />
                </button>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Legacy content */}
      {isLegacy && legacyNotes.trim() && (
        <SectionCard title="Notes" isOpen={isAboutOpen("legacyNotes")} onToggle={() => toggleAboutSection("legacyNotes")}>
          <p className="text-neutral-700 whitespace-pre-wrap text-sm">{legacyNotes}</p>
        </SectionCard>
      )}
      {(legacyPlantDesc?.trim() || legacyGrowingInfo?.trim()) && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-4">
          <button type="button" onClick={() => setVendorDetailsOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left font-medium text-neutral-800 bg-neutral-50 hover:bg-neutral-100 border-b border-neutral-200" aria-expanded={vendorDetailsOpen}>
            <span>Vendor Details</span><span className="text-neutral-500 text-lg" aria-hidden>{vendorDetailsOpen ? "-" : "+"}</span>
          </button>
          {vendorDetailsOpen && (
            <div className="p-4 space-y-4">
              {formatVendorDetails(legacyPlantDesc ?? null, legacyGrowingInfo ?? null).map(({ title, body }) => (
                <div key={title}><h4 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-1">{title}</h4><p className="text-neutral-800 whitespace-pre-wrap text-sm">{body}</p></div>
              ))}
            </div>
          )}
        </div>
      )}
      {isLegacy && legacySourceUrl?.trim() && (
        <SectionCard title="Import Link" isOpen={isAboutOpen("legacyImport")} onToggle={() => toggleAboutSection("legacyImport")}>
          <a href={legacySourceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline break-all text-sm">{legacySourceUrl}</a>
        </SectionCard>
      )}
    </>
  );
}
