"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ActionNowView } from "@/components/schedule/ActionNowView";
import { MonthlyPulseView } from "@/components/schedule/MonthlyPulseView";
import { AnnualRoadmapView } from "@/components/schedule/AnnualRoadmapView";

type ScheduleView = "roadmap" | "heatmap" | "action";

const TABS: { value: ScheduleView; label: string }[] = [
  { value: "action", label: "Action now" },
  { value: "heatmap", label: "Monthly pulse" },
  { value: "roadmap", label: "Annual roadmap" },
];

function isValidView(v: string | null): v is ScheduleView {
  return v === "roadmap" || v === "heatmap" || v === "action";
}

export default function SchedulePage() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: ScheduleView = isValidView(viewParam) ? viewParam : "action";

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/70 hover:bg-black/5"
          aria-label="Back to Home"
        >
          <span aria-hidden>&larr;</span>
        </Link>
        <h1 className="text-lg font-bold text-black">Planting Schedule</h1>
      </div>

      <p className="text-sm text-black/60 mb-4">
        Zone 10b reference guide — when to start indoors or plant outside. Not your vault.
      </p>

      <nav
        className="flex rounded-xl border border-black/15 bg-white p-1 mb-4"
        aria-label="Schedule views"
      >
        {TABS.map((tab) => {
          const isActive = view === tab.value;
          const href = `/schedule?view=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`flex-1 min-h-[44px] flex items-center justify-center rounded-lg text-sm font-medium transition-colors border-2 ${
                isActive
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-transparent text-black/70 hover:bg-black/5"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {view === "action" && <ActionNowView />}
      {view === "heatmap" && <MonthlyPulseView />}
      {view === "roadmap" && <AnnualRoadmapView />}
    </div>
  );
}
