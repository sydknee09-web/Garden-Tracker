"use client";

import type { PlantProfile, CareSchedule, CareScheduleSuggestion, GrowInstance } from "@/types/garden";
import { CareScheduleManager } from "@/components/CareScheduleManager";
import { CareSuggestions, GetAiSuggestionsButton } from "@/components/CareSuggestions";
import { TagBadges } from "@/components/TagBadges";
import { ICON_MAP } from "@/lib/styleDictionary";
import { generateCareTasks } from "@/lib/generateCareTasks";

export interface VaultProfileCareTabProps {
  profileId: string;
  profile: PlantProfile | null;
  userId: string;
  careSchedules: CareSchedule[];
  careSuggestions: CareScheduleSuggestion[];
  growInstances: GrowInstance[];
  standaloneTasks: { id: string; title: string | null; category: string; due_date: string; completed_at: string | null; grow_instance_id: string | null }[];
  isLegacy: boolean;
  isPermanent: boolean;
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
  aboutCollapsed: Record<string, boolean>;
  toggleAboutSection: (key: string) => void;
  isAboutOpen: (key: string) => boolean;
}

export function VaultProfileCareTab({
  profileId,
  profile,
  userId,
  careSchedules,
  careSuggestions,
  growInstances,
  standaloneTasks,
  isLegacy,
  isPermanent,
  canEdit,
  onChanged,
  aboutCollapsed,
  toggleAboutSection,
  isAboutOpen,
}: VaultProfileCareTabProps) {
  const handleCareChanged = async () => {
    if (userId) await generateCareTasks(userId);
    await onChanged();
  };

  return (
    <div className="space-y-4">
      {!isLegacy && !isPermanent && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4">
          <CareSuggestions profileId={profileId} userId={userId} profileName={profile?.name ?? ""} profileVariety={profile?.variety_name ?? null} profileType="seed" suggestions={careSuggestions} hasSchedules={careSchedules.length > 0} onChanged={onChanged} readOnly={!canEdit} />
          <p className="text-xs text-neutral-500">Recurring care that auto-copies when you plant this variety.</p>
          <CareScheduleManager
            profileId={profileId}
            userId={userId}
            schedules={careSchedules}
            onChanged={handleCareChanged}
            readOnly={!canEdit}
            extraActions={canEdit ? <GetAiSuggestionsButton profileId={profileId} userId={userId} profileName={profile?.name ?? ""} profileVariety={profile?.variety_name ?? null} profileType="seed" onChanged={onChanged} /> : null}
          />
        </div>
      )}
      {!isLegacy && isPermanent && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4">
          <CareSuggestions profileId={profileId} userId={userId} profileName={profile?.name ?? ""} profileVariety={profile?.variety_name ?? null} profileType="permanent" suggestions={careSuggestions} hasSchedules={careSchedules.length > 0} onChanged={onChanged} readOnly={!canEdit} />
          <CareScheduleManager
            profileId={profileId}
            userId={userId}
            schedules={careSchedules}
            onChanged={handleCareChanged}
            isTemplate={false}
            readOnly={!canEdit}
            growInstances={growInstances}
            isPermanent={isPermanent}
            extraActions={canEdit ? <GetAiSuggestionsButton profileId={profileId} userId={userId} profileName={profile?.name ?? ""} profileVariety={profile?.variety_name ?? null} profileType="permanent" onChanged={onChanged} /> : null}
          />
        </div>
      )}
      {!isLegacy && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <button type="button" onClick={() => toggleAboutSection("historicalTasks")} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] hover:bg-neutral-50/80" aria-expanded={isAboutOpen("historicalTasks")}>
            <h3 className="text-sm font-semibold text-neutral-700">Historical tasks</h3>
            <span className="text-neutral-500 text-sm">{standaloneTasks.length > 0 ? `(${standaloneTasks.length})` : ""}</span>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("historicalTasks") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("historicalTasks") && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-xs text-neutral-500 mb-3">Tasks you added from the calendar (not from a schedule). Review these if you want to add a recurring task.</p>
              {standaloneTasks.length === 0 ? (
                <p className="text-sm text-neutral-500">None Available.</p>
              ) : (
                <ul className="space-y-2">
                  {standaloneTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 py-2 border-b border-neutral-100 last:border-b-0">
                      <span className="font-medium text-neutral-800 text-sm">{(t.title ?? t.category).trim() || t.category}</span>
                      <span className="text-xs text-neutral-500 shrink-0">
                        {new Date(t.due_date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        {t.completed_at ? " · Done" : " · Upcoming"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {profile?.tags && profile.tags.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <button type="button" onClick={() => toggleAboutSection("tags")} className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] hover:bg-neutral-50/80" aria-expanded={isAboutOpen("tags")}>
            <h3 className="text-sm font-semibold text-neutral-700">Tags</h3>
            <span className="shrink-0 text-neutral-400" aria-hidden>{isAboutOpen("tags") ? <ICON_MAP.ChevronDown className="w-3 h-3" /> : <ICON_MAP.ChevronRight className="w-3 h-3" />}</span>
          </button>
          {isAboutOpen("tags") && (
            <div className="px-4 pb-4 pt-0">
              <TagBadges tags={profile.tags} />
            </div>
          )}
        </div>
      )}

      {isLegacy && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center">
          <p className="text-neutral-500 text-sm">Care schedules are not available for legacy imports.</p>
        </div>
      )}
    </div>
  );
}
