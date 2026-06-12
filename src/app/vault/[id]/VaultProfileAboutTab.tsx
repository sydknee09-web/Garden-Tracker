"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { PlantProfile } from "@/types/garden";
import { TagBadges } from "@/components/TagBadges";
import { ICON_MAP } from "@/lib/styleDictionary";
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
  /** Core How-to-Grow scalar rows (sowing method, windows, spacing, depths, germination, maturity) with effective-care fallbacks applied by the page. */
  howToGrowList: AboutTabCareList;
  /** Sun/Water pill+detail pairs (page applies sun_summary→effectiveCare→sun fallback chain). */
  sunPill: string | null;
  sunDetail: string | null;
  waterPill: string | null;
  waterDetail: string | null;
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
}

// ---------------------------------------------------------------------------
// Shared primitives (NORTH_STAR §1 — one canonical shape per concept)
// ---------------------------------------------------------------------------

/**
 * True while a background AI Fill job is running for this profile — empty cells swap
 * "—" for a shimmer so the user sees WHICH fields are being filled (backgrounding ship
 * 2026-06-11). File-local context: PillDetailField has ~25 call sites; one provider at
 * the tab root beats threading a prop through every site.
 */
const AiFillShimmerContext = createContext(false);

/** Per-field shimmer block (skeleton register anchor: page loading pulse — bg-neutral-200 + animate-pulse). */
function FieldShimmer({ className = "h-5 w-24" }: { className?: string }) {
  return <span className={`block rounded bg-neutral-200 animate-pulse ${className}`} aria-hidden />;
}

/** Paragraph-register empty cell ("—") that shimmers while a background AI Fill runs. */
function EmptyNote() {
  const aiFillRunning = useContext(AiFillShimmerContext);
  return aiFillRunning ? <FieldShimmer className="h-4 w-32" /> : <EmptyNote />;
}

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
    <div id={id} className="bg-white rounded-xl border border-neutral-200 mb-4 overflow-hidden scroll-mt-20">
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
  const aiFillRunning = useContext(AiFillShimmerContext);
  // How-to-Grow rows arrive with a literal "—" fallback already applied by the page,
  // so the em-dash itself counts as empty for shimmer purposes.
  const isEmpty = list.length === 0 || (list.length === 1 && list[0] === "—");
  if (isEmpty && aiFillRunning) {
    return (
      <div>
        <dt className="text-xs text-neutral-500 mb-0.5">{label}</dt>
        <dd className="text-sm text-neutral-900 font-medium"><FieldShimmer /></dd>
      </div>
    );
  }
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

/** Field lists per About-tab section, for the per-section provenance Source line. */
const HOW_TO_GROW_PROVENANCE_FIELDS = [
  "sowing_method", "planting_window", "spring_indoor_window", "spring_outdoor_window", "summer_window",
  "fall_outdoor_window", "plant_spacing", "sowing_depth", "planting_depth", "days_to_germination",
  "harvest_days", "sun", "sun_summary", "sun_detail", "water", "water_summary", "water_detail",
  "soil_preference", "disease_susceptibility", "harvest_season", "uses", "special_features",
  "when_to_plant_description", "planting_seasons_tags", "optimal_planting_months_array",
  "indoor_start_weeks_before_frost", "outdoor_plant_weeks_after_frost",
];
const CHARACTERISTICS_PROVENANCE_FIELDS = [
  "lifecycle", "growth_form", "plant_category", "growth_habit", "mature_height", "mature_width",
  "family", "genus", "species", "pollination_requirements", "deer_rabbit_resistance",
  "drought_salt_tolerance", "native_origin", "invasiveness", "toxicity", "wildlife_value", "synonyms",
];

/** Human phrasing for non-seed propagation methods in the B3 sub-header. */
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
  sunPill,
  sunDetail,
  waterPill,
  waterDetail,
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
}: VaultProfileAboutTabProps) {
  // B4 anchor sections — auto-generated from the sections this profile renders.
  const anchorSections = [
    { key: "characteristics", label: "Characteristics", show: !isLegacy },
    { key: "howToGrow", label: "How to Grow", show: true },
    { key: "companion", label: "Companion Planting", show: true },
    { key: "propagation", label: "Propagation", show: !isLegacy },
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
    const OFFSET = 96; // sticky pill row clearance, matches scroll-mt-20
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
  // Tier suffix for the Description/Growing-Notes "Source: AI research" lines, e.g. " (species-level data)".
  const descriptionLevels = sectionProvenanceLevels(profile.field_provenance, ["plant_description"]);
  const descriptionTierSuffix =
    descriptionLevels.length > 0 ? ` (${descriptionLevels.map((l) => PROVENANCE_PHRASES[l]).join(" + ")})` : "";

  return (
    <AiFillShimmerContext.Provider value={retryRunning}>
      {/* ── B4: sticky quick-jump anchor pills (GroupTabs tab-slot register) ── */}
      {anchorSections.length > 1 && (
        <div className="sticky top-0 z-20 -mx-6 px-6 py-2 mb-2 bg-neutral-50/95 backdrop-blur-sm">
          <div className="overflow-x-auto scrollbar-hide" role="tablist" aria-label="Jump to profile section">
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

      {/* Description (profile-level: vendor or AI) */}
      {!isLegacy && profile?.plant_description?.trim() && (
        <SectionCard title="Description" isOpen={isAboutOpen("description")} onToggle={() => toggleAboutSection("description")}>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{profile.plant_description}</p>
          {profile.description_source && (
            <p className="text-xs text-neutral-500 mt-2">
              Source: {profile.description_source === "vendor" ? "Vendor" : profile.description_source === "ai" ? `AI research${descriptionTierSuffix}` : "You"}
            </p>
          )}
        </SectionCard>
      )}

      {/* Growing Notes — borrows plant_description when growing_notes is empty so the section doesn't vanish */}
      {(growingNotes || (!isLegacy && profile?.plant_description?.trim())) && (
        <SectionCard title="Growing Notes" isOpen={isAboutOpen("growingNotes")} onToggle={() => toggleAboutSection("growingNotes")}>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{growingNotes || profile.plant_description}</p>
          {growingNotes ? (
            <ProvenanceSourceLine levels={sectionProvenanceLevels(profile.field_provenance, ["growing_notes"])} />
          ) : (
            profile.description_source && (
              <p className="text-xs text-neutral-500 mt-2">
                Source: {profile.description_source === "vendor" ? "Vendor" : profile.description_source === "ai" ? `AI research${descriptionTierSuffix}` : "You"}
              </p>
            )
          )}
        </SectionCard>
      )}

      {/* ── B1: Plant Characteristics — intrinsic properties of the species/variety ── */}
      {!isLegacy && (
        <SectionCard
          id="about-section-characteristics"
          title="Plant Characteristics"
          isOpen={isAboutOpen("characteristics")}
          onToggle={() => toggleAboutSection("characteristics")}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <PillDetailField label="Lifecycle" value={profile.lifecycle} pill />
            <PillDetailField label="Growth Form" value={profile.growth_form} pill />
            <PillDetailField label="Plant Category" value={profile.plant_category} pill />
            <PillDetailField label="Growth Habit" value={profile.growth_habit} pill />
            <PillDetailField label="Mature Height" value={profile.mature_height} />
            <PillDetailField label="Mature Width" value={profile.mature_width} />
            <PillDetailField label="Family" value={profile.family} />
            <PillDetailField label="Genus" value={profile.genus} />
            <PillDetailField label="Species" value={profile.species} />
            <PillDetailField label="Pollination" value={profile.pollination_requirements} pill />
            <PillDetailField label="Deer / Rabbit Resistance" value={profile.deer_rabbit_resistance} pill />
            <PillDetailField label="Drought / Salt Tolerance" value={profile.drought_salt_tolerance} pill />
            <PillDetailField label="Native Origin" value={profile.native_origin} />
            <PillDetailField label="Invasiveness" value={profile.invasiveness} />
          </dl>
          <dl className="mt-3 space-y-3">
            <PillDetailField label="Toxicity" value={profile.toxicity} />
            <PillDetailField label="Wildlife Value" value={profile.wildlife_value} />
            <PillDetailField label="Synonyms" values={profile.synonyms} />
          </dl>
          <ProvenanceSourceLine levels={sectionProvenanceLevels(profile.field_provenance, CHARACTERISTICS_PROVENANCE_FIELDS)} />
        </SectionCard>
      )}

      {/* ── B1: How to Grow — action-oriented growing instructions ── */}
      <SectionCard
        id="about-section-howToGrow"
        title="How to Grow"
        isOpen={isAboutOpen("howToGrow")}
        onToggle={() => toggleAboutSection("howToGrow")}
      >
        {profile?.planting_window?.trim().startsWith("Not viable in Zone") && (
          <p className="mb-3 text-sm text-neutral-600 italic">
            This plant won&apos;t survive outdoor growing in Zone {profile.planting_window_zone || "your zone"}. Consider growing indoors or in a greenhouse.
          </p>
        )}
        {/* When to Plant (Ship 2): quick-scan pills above the narrative. Pill register matches
            PillDetailField; emoji markers are content-lane (seasonal/timing moments) per VISION §8. */}
        {(() => {
          const desc = profile?.when_to_plant_description?.trim();
          const seasons = (profile?.planting_seasons_tags ?? []).filter(Boolean);
          const indoorWeeks = profile?.indoor_start_weeks_before_frost;
          const outdoorWeeks = profile?.outdoor_plant_weeks_after_frost;
          if (!desc && seasons.length === 0 && indoorWeeks == null && outdoorWeeks == null) return null;
          const pills: string[] = [];
          if (indoorWeeks != null) {
            pills.push(`🏠 Start indoors ${indoorWeeks} wk before last frost`);
          }
          if (outdoorWeeks != null) {
            pills.push(
              outdoorWeeks === 0
                ? "🌱 Plant outside at last frost"
                : outdoorWeeks < 0
                  ? `🌱 Plant outside ${Math.abs(outdoorWeeks)} wk before last frost`
                  : `🌱 Plant outside ${outdoorWeeks} wk after last frost`
            );
          }
          if (seasons.length > 0) pills.push(`🌸 ${seasons.join(" · ")}`);
          return (
            <div className="mb-4">
              <SubHeader>When to Plant</SubHeader>
              {pills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {pills.map((p) => (
                    <span key={p} className="inline-block text-sm font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-900">
                      {p}
                    </span>
                  ))}
                </div>
              )}
              {desc && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{desc}</p>}
            </div>
          );
        })()}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {howToGrowList.map(({ label, value }) => (
            <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="text-sm text-neutral-900 font-medium">{value}</dd></div>
          ))}
        </dl>
        <dl className="mt-4 space-y-4">
          <PillDetailField label="Sun" value={sunPill} detail={sunDetail} pill />
          <PillDetailField label="Water" value={waterPill} detail={waterDetail} pill />
          <PillDetailField label="Soil" value={isLegacy ? null : profile.soil_preference} pill />
          {!isLegacy && (
            <>
              <PillDetailField label="Disease Susceptibility" values={profile.disease_susceptibility} pill />
              <PillDetailField label="Harvest Season" values={profile.harvest_season} pill />
              <PillDetailField label="Uses" values={profile.uses} pill />
              <PillDetailField label="Special Features" values={profile.special_features} pill />
            </>
          )}
        </dl>
        {profile?.planting_window_zone?.trim() && profile?.planting_window?.trim() && (
          <p className="mt-3 text-sm text-neutral-600 italic">
            Generated for Zone {profile.planting_window_zone}.
          </p>
        )}
        {profile?.seed_propagation_context?.trim() &&
          howToGrowList.every(({ value }) => value === "—") &&
          !sunPill && !waterPill && (
            <p className="mt-3 text-sm text-neutral-600 italic">{profile.seed_propagation_context}</p>
          )}
        <ProvenanceSourceLine levels={sectionProvenanceLevels(profile.field_provenance, HOW_TO_GROW_PROVENANCE_FIELDS)} />
      </SectionCard>

      {/* Companion planting */}
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

      {/* Tags */}
      {profile?.tags && profile.tags.length > 0 && (
        <SectionCard title="Tags" isOpen={isAboutOpen("tags")} onToggle={() => toggleAboutSection("tags")}>
          <TagBadges tags={profile.tags} />
        </SectionCard>
      )}

      {/* ── B3: Propagation — predictable header, sub-content adapts to propagation_method ── */}
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
                    <EmptyNote />
                  )}
                </div>
                <div>
                  <SubHeader>How to Save Seeds</SubHeader>
                  {profile?.seed_saving_notes?.trim() ? (
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{profile.seed_saving_notes}</p>
                  ) : (
                    <EmptyNote />
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
                      <EmptyNote />
                    )}
                  </div>
                )}
                {hasSeedMethod && (
                  <div>
                    <SubHeader>Starting from Seed &amp; Saving Seeds</SubHeader>
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
                        <EmptyNote />
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </SectionCard>
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
          <div className="overflow-x-auto flex gap-2 pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
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
    </AiFillShimmerContext.Provider>
  );
}
