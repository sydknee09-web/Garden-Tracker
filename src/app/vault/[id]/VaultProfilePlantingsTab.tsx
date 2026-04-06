"use client";

import type { PlantProfile, GrowInstance, PageKey } from "@/types/garden";
import { ICON_MAP } from "@/lib/styleDictionary";
import { formatDisplayDate } from "./vaultProfileUtils";

export interface VaultProfilePlantingsTabProps {
  profile: PlantProfile | null;
  profileOwnerId: string;
  growInstances: GrowInstance[];
  isPermanent: boolean;
  nonEmptyPacketsCount: number;
  canEditPage: (userId: string, permission: PageKey) => boolean;
  onPlantAgain: () => void;
  onEditGrow: (gi: GrowInstance) => void;
  onOpenJournal: (gi: GrowInstance) => void;
  /** Open read-only planting details (care history, stats) without leaving the profile. */
  onViewGrow: (gi: GrowInstance) => void;
}

export function VaultProfilePlantingsTab({
  profile,
  profileOwnerId,
  growInstances,
  isPermanent,
  nonEmptyPacketsCount,
  canEditPage,
  onPlantAgain,
  onEditGrow,
  onOpenJournal,
  onViewGrow,
}: VaultProfilePlantingsTabProps) {
  if (!profile) return null;

  return (
    <>
      {growInstances.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
          <p className="text-xs text-neutral-500 max-w-md">
            The bold name is <span className="font-medium text-neutral-600">Location</span> on each planting. Tap <span className="font-medium text-neutral-600">Edit</span> → in the planting screen use <span className="font-medium text-neutral-600">Location</span> (top bar or Overview) to rename. Count shows when saved on that planting.
          </p>
          <button
            type="button"
            onClick={onPlantAgain}
            className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 text-sm shrink-0 self-end sm:self-start"
            aria-label="Add plant"
          >
            <ICON_MAP.Add className="w-4 h-4" />
            Add Plant
          </button>
        </div>
      )}
      {growInstances.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <p className="text-neutral-500 text-sm">{isPermanent ? "No plants yet." : "No plantings yet."}</p>
          <p className="text-neutral-400 text-xs mt-1 mb-4">
            {isPermanent ? "Add your trees or perennials via the FAB from Home or Vault." : nonEmptyPacketsCount === 0 ? "Add a seed packet first, then start a planting." : "Start a new planting from your packets."}
          </p>
          <button
            type="button"
            onClick={onPlantAgain}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 text-sm"
            aria-label="Add plant"
          >
            <ICON_MAP.Add className="w-4 h-4" />
            Add Plant
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {growInstances.map((gi, giIdx) => {
            const statusColor = gi.status === "growing" ? "bg-emerald-100 text-emerald-800" : gi.status === "harvested" ? "bg-amber-100 text-amber-800" : gi.status === "dead" ? "bg-red-100 text-red-800" : "bg-neutral-100 text-neutral-700";
            const giCanEdit = canEditPage((gi as { user_id?: string }).user_id ?? profileOwnerId, "garden");
            const sowBadge = !isPermanent && ((gi as GrowInstance).sow_method === "direct_sow" ? "Direct sow" : (gi as GrowInstance).sow_method === "seed_start" ? "Seed start" : null);
            const loc = gi.location?.trim() ?? "";
            const titleLabel = loc || (isPermanent ? `Planting ${giIdx + 1}` : `Batch ${giIdx + 1}`);
            const qty = (gi as GrowInstance).plant_count;
            const qtyLabel =
              qty != null && qty > 0
                ? `${qty} ${qty === 1 ? "plant" : "plants"}`
                : (gi as GrowInstance).purchase_quantity != null && (gi as GrowInstance).purchase_quantity! > 0
                  ? `${(gi as GrowInstance).purchase_quantity} purchased`
                  : null;
            const vendorLabel = (gi as GrowInstance).vendor?.trim() || null;
            const cardContent = (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-sm font-medium text-neutral-900 truncate">{titleLabel}</span>
                    {qtyLabel && (
                      <span className="text-xs font-medium text-neutral-600 shrink-0" title="Plant count for this planting">
                        {qtyLabel}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${statusColor}`}>{gi.status ?? "unknown"}</span>
                    {sowBadge && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{sowBadge}</span>}
                  </div>
                  <span className="text-xs text-neutral-500 shrink-0">{formatDisplayDate(gi.sown_date)}</span>
                </div>
                {!loc && (
                  <p className="text-xs text-amber-700/90 mb-1">No location label — tap Edit to add one.</p>
                )}
                {vendorLabel && <p className="text-xs text-neutral-500">{vendorLabel}</p>}
              </>
            );
            return (
              <div key={gi.id} className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onViewGrow(gi)}
                      className="block w-full text-left -m-2 p-2 rounded-xl hover:bg-neutral-50/80 transition-colors min-h-[44px]"
                      aria-label={isPermanent ? "View plant details" : "View planting details"}
                    >
                      {cardContent}
                    </button>
                  </div>
                  {giCanEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditGrow(gi); }}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 bg-white text-neutral-600 hover:bg-neutral-50"
                        aria-label="Edit plant"
                      >
                        <ICON_MAP.Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenJournal(gi); }}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 bg-white text-emerald-600 hover:bg-emerald/10"
                        aria-label="Add journal entry"
                      >
                        <ICON_MAP.Journal className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
