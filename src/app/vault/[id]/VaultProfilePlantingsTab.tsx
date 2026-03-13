"use client";

import Link from "next/link";
import type { PlantProfile, GrowInstance } from "@/types/garden";
import { ICON_MAP } from "@/lib/styleDictionary";
import { formatDisplayDate } from "./vaultProfileUtils";

export interface VaultProfilePlantingsTabProps {
  profile: PlantProfile | null;
  profileOwnerId: string;
  growInstances: GrowInstance[];
  isPermanent: boolean;
  nonEmptyPacketsCount: number;
  canEditPage: (userId: string, permission: string) => boolean;
  onPlantAgain: () => void;
  onEditGrow: (gi: GrowInstance) => void;
  onOpenJournal: () => void;
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
}: VaultProfilePlantingsTabProps) {
  if (!profile) return null;

  return (
    <>
      {growInstances.length > 0 && (
        <div className="flex items-center justify-end mb-3">
          <button
            type="button"
            onClick={onPlantAgain}
            className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 text-sm"
            aria-label="Plant again"
          >
            <ICON_MAP.Add className="w-4 h-4" />
            Plant Again
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
            aria-label={nonEmptyPacketsCount === 0 ? "Add seed packet" : "Plant again"}
          >
            <ICON_MAP.Add className="w-4 h-4" />
            {nonEmptyPacketsCount === 0 ? "Add Seed Packet" : "Plant Again"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {growInstances.map((gi, giIdx) => {
            const statusColor = gi.status === "growing" ? "bg-emerald-100 text-emerald-800" : gi.status === "harvested" ? "bg-amber-100 text-amber-800" : gi.status === "dead" ? "bg-red-100 text-red-800" : "bg-neutral-100 text-neutral-700";
            const isActive = gi.status === "growing" || gi.status === "pending";
            const giCanEdit = canEditPage((gi as { user_id?: string }).user_id ?? profileOwnerId, "garden");
            const sowBadge = !isPermanent && ((gi as GrowInstance).sow_method === "direct_sow" ? "Direct sow" : (gi as GrowInstance).sow_method === "seed_start" ? "Seed start" : null);
            const plantLabel = isPermanent ? (gi.location?.trim() || `Plant ${giIdx + 1}`) : null;
            const vendorLabel = (gi as GrowInstance).vendor?.trim() || null;
            const cardContent = (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPermanent && plantLabel && <span className="text-sm font-medium text-neutral-900">{plantLabel}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{gi.status ?? "unknown"}</span>
                    {sowBadge && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{sowBadge}</span>}
                    {!isPermanent && gi.location && <span className="text-xs text-neutral-500">{gi.location}</span>}
                  </div>
                  <span className="text-xs text-neutral-500">{formatDisplayDate(gi.sown_date)}</span>
                </div>
                {vendorLabel && <p className="text-xs text-neutral-500">{vendorLabel}</p>}
              </>
            );
            return (
              <div key={gi.id} className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isPermanent ? (
                      <Link href={`/garden?grow=${gi.id}&from=profile&profile=${profile.id}`} className="block -m-2 p-2 rounded-xl hover:bg-neutral-50/80 transition-colors min-h-[44px]" aria-label="View plant details">
                        {cardContent}
                      </Link>
                    ) : isActive ? (
                      <Link href={`/garden?grow=${gi.id}&from=profile&profile=${profile.id}`} className="block -m-2 p-2 rounded-xl hover:bg-neutral-50/80 transition-colors min-h-[44px]" aria-label="View planting details">
                        {cardContent}
                      </Link>
                    ) : (
                      cardContent
                    )}
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
                        onClick={(e) => { e.stopPropagation(); onOpenJournal(); }}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 bg-white text-emerald-600 hover:bg-emerald/10"
                        aria-label="View journal"
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
