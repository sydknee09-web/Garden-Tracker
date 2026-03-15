"use client";

import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { PlantProfile, VendorSpecs } from "@/types/garden";
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
  careList: AboutTabCareList;
  growingList: AboutTabCareList;
  harvestList: AboutTabCareList;
  growingNotes: string;
  aboutCollapsed: Record<string, boolean>;
  toggleAboutSection: (key: string) => void;
  isAboutOpen: (key: string) => boolean;
  vendorDetailsOpen: boolean;
  setVendorDetailsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setImageLightbox: (v: { urls: string[]; index: number } | null) => void;
  fillBlanksAttempted?: boolean;
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
  careList,
  growingList,
  harvestList,
  growingNotes,
  aboutCollapsed,
  toggleAboutSection,
  isAboutOpen,
  vendorDetailsOpen,
  setVendorDetailsOpen,
  setImageLightbox,
  fillBlanksAttempted = false,
}: VaultProfileAboutTabProps) {
  if (!profile) return null;

  return (
    <>
      {/* Description (profile-level: vendor or AI) */}
      {!isLegacy && profile?.plant_description?.trim() && (
        <div className="bg-white rounded-xl border border-neutral-200 mb-4">
          <button type="button" onClick={() => toggleAboutSection("description")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("description")}>
            <h3 className="text-sm font-semibold text-neutral-700">Description</h3>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("description") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("description") && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{profile.plant_description}</p>
              {profile.description_source && (
                <p className="text-xs text-neutral-500 mt-2">
                  Source: {profile.description_source === "vendor" ? "Vendor" : profile.description_source === "ai" ? "AI research" : "You"}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Growing Notes */}
      {growingNotes && (
        <div className="bg-white rounded-xl border border-neutral-200 mb-4">
          <button type="button" onClick={() => toggleAboutSection("growingNotes")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("growingNotes")}>
            <h3 className="text-sm font-semibold text-neutral-700">Growing Notes</h3>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("growingNotes") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("growingNotes") && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{growingNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* How to Grow */}
      <div className="bg-white rounded-xl border border-neutral-200 mb-4">
        <button type="button" onClick={() => toggleAboutSection("howToGrow")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("howToGrow")}>
          <h3 className="text-sm font-semibold text-neutral-700">How to Grow</h3>
          <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("howToGrow") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
        </button>
        {isAboutOpen("howToGrow") && (
          <div className="px-4 pb-4 pt-0 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-2">Planting</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {careList.map(({ label, value }) => (
                  <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="text-sm text-neutral-900 font-medium">{value}</dd></div>
                ))}
              </dl>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-2">Growing</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {growingList.map(({ label, value }) => (
                  <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="text-sm text-neutral-900 font-medium">{value}</dd></div>
                ))}
              </dl>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-2">Harvest</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {harvestList.map(({ label, value }) => (
                  <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="text-sm text-neutral-900 font-medium">{value}</dd></div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>

      {/* Companion planting */}
      <div className="bg-white rounded-xl border border-neutral-200 mb-4 overflow-hidden">
        <button type="button" onClick={() => toggleAboutSection("companion")} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("companion")}>
          <h3 className="text-sm font-semibold text-neutral-700">Companion planting</h3>
          <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("companion") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
        </button>
        {isAboutOpen("companion") && (
          <div className="px-4 pb-4 pt-0">
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
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1.5">Plant with</p>
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
          </div>
        )}
      </div>

      {/* Propagate & Harvest seeds */}
      {!isLegacy && (
        <div className="bg-white rounded-xl border border-neutral-200 mb-4">
          <button type="button" onClick={() => toggleAboutSection("propagation")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("propagation")}>
            <h3 className="text-sm font-semibold text-neutral-700">Propagate &amp; Harvest seeds</h3>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("propagation") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("propagation") && (
            <div className="px-4 pb-4 pt-0 space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1.5">How to propagate</p>
                {profile?.propagation_notes?.trim() ? (
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{profile.propagation_notes}</p>
                ) : fillBlanksAttempted ? (
                  <p className="text-sm text-neutral-500">—</p>
                ) : (
                  <p className="text-sm text-neutral-500">No data. Use the ✨ button above to fill from cache or AI.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1.5">How to harvest / save seeds</p>
                {profile?.seed_saving_notes?.trim() ? (
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{profile.seed_saving_notes}</p>
                ) : fillBlanksAttempted ? (
                  <p className="text-sm text-neutral-500">—</p>
                ) : (
                  <p className="text-sm text-neutral-500">No data. Use the ✨ button above to fill from cache or AI.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vendor recommendations */}
      {packets.some((p) => p.vendor_specs && Object.keys(p.vendor_specs as object).length > 0) && (
        <div className="bg-white rounded-xl border border-neutral-200 mb-4">
          <button type="button" onClick={() => toggleAboutSection("vendorRecs")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("vendorRecs")}>
            <h3 className="text-sm font-semibold text-neutral-700">Vendor recommendations</h3>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("vendorRecs") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("vendorRecs") && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-xs text-neutral-500 mb-3">What each packet or vendor says about growing this variety.</p>
              <ul className="space-y-4">
                {packets
                  .filter((p) => p.vendor_specs && Object.keys(p.vendor_specs as object).length > 0)
                  .map((pkt) => {
                    const vs = pkt.vendor_specs as VendorSpecs | undefined;
                    const vendorLabel = (pkt.vendor_name ?? "").trim() || "Unknown vendor";
                    const parts: string[] = [];
                    if (vs?.sowing_depth) parts.push(`Sow: ${vs.sowing_depth}`);
                    if (vs?.spacing) parts.push(`Spacing: ${vs.spacing}`);
                    if (vs?.sun_requirement) parts.push(`Sun: ${vs.sun_requirement}`);
                    if (vs?.days_to_germination) parts.push(`Germ: ${vs.days_to_germination}`);
                    if (vs?.days_to_maturity) parts.push(`Maturity: ${vs.days_to_maturity}`);
                    return (
                      <li key={pkt.id} className="border border-neutral-100 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-medium text-neutral-800">{vendorLabel}</span>
                          {pkt.purchase_url?.trim() && (
                            <a href={pkt.purchase_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline truncate max-w-[140px]">Link</a>
                          )}
                        </div>
                        <p className="text-sm text-neutral-600">{parts.join(" · ") || "—"}</p>
                        {vs?.plant_description?.trim() && (
                          <p className="text-xs text-neutral-500 mt-2 line-clamp-2">{vs.plant_description}</p>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Source URL */}
      {packets.length > 0 && packets[0].purchase_url?.trim() && (
        <div className="bg-white rounded-xl border border-neutral-200 mb-4">
          <button type="button" onClick={() => toggleAboutSection("source")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("source")}>
            <h3 className="text-sm font-semibold text-neutral-700">Source</h3>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("source") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("source") && (
            <div className="px-4 pb-4 pt-0">
              <a href={packets[0].purchase_url!} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline break-all">{packets[0].purchase_url}</a>
            </div>
          )}
        </div>
      )}

      {/* Growth Gallery */}
      {journalPhotos.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 mb-4">
          <button type="button" onClick={() => toggleAboutSection("growthGallery")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("growthGallery")}>
            <h3 className="text-sm font-semibold text-neutral-700">Growth Gallery</h3>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("growthGallery") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("growthGallery") && (
            <div className="px-4 pb-4 pt-0">
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
            </div>
          )}
        </div>
      )}

      {/* Legacy content */}
      {isLegacy && legacyNotes.trim() && (
        <div className="bg-white rounded-xl border border-neutral-200 mb-4">
          <button type="button" onClick={() => toggleAboutSection("legacyNotes")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("legacyNotes")}>
            <h3 className="text-sm font-semibold text-neutral-700">Notes</h3>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("legacyNotes") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("legacyNotes") && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-neutral-700 whitespace-pre-wrap text-sm">{legacyNotes}</p>
            </div>
          )}
        </div>
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
        <div className="bg-white rounded-xl border border-neutral-200 mb-4">
          <button type="button" onClick={() => toggleAboutSection("legacyImport")} className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px] hover:bg-neutral-50/80 rounded-t-xl" aria-expanded={isAboutOpen("legacyImport")}>
            <h3 className="text-sm font-semibold text-neutral-700">Import link</h3>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("legacyImport") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("legacyImport") && (
            <div className="px-4 pb-4 pt-0">
              <a href={legacySourceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline break-all text-sm">{legacySourceUrl}</a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
