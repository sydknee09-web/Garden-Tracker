"use client";

import Link from "next/link";
import { useOnboardingContext } from "@/contexts/OnboardingContext";
import { useUniversalAddModals } from "@/contexts/UniversalAddContext";

/** 3-step Quick Start dock: Personalize → Populate → Plan. Glassmorphism, Concierge Checklist progress. */
export function OnboardingDock() {
  const { step, completed, isLoading, dismiss, openTaskForOnboarding } = useOnboardingContext();
  const { openSeed } = useUniversalAddModals();

  if (completed || isLoading) return null;

  return (
    <div
      className="mb-3 rounded-xl bg-white/80 backdrop-blur-md border border-amber-200/60 shadow-card-soft overflow-hidden"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2" aria-label="Progress">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                    s <= step ? "bg-emerald-900" : "bg-neutral-200"
                  }`}
                  aria-hidden
                />
              ))}
            </div>
            <p className="text-sm font-medium text-neutral-800 mb-1">Quick Start</p>
            {step === 1 && (
              <Link
                href="/settings"
                className="text-sm text-emerald-700 hover:text-emerald-800 hover:underline font-medium"
              >
                Set your garden zone
              </Link>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={() => openSeed()}
                className="text-sm text-emerald-700 hover:text-emerald-800 hover:underline font-medium text-left"
              >
                Add your first seed packet
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={() => openTaskForOnboarding()}
                className="text-sm text-emerald-700 hover:text-emerald-800 hover:underline font-medium text-left"
              >
                Schedule your first task
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss()}
            className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-200/80 hover:text-neutral-700 transition-colors"
            aria-label="Dismiss"
          >
            <span className="text-lg font-bold leading-none">×</span>
          </button>
        </div>
        <Link
          href="/help"
          className="mt-2 inline-block text-xs text-neutral-500 hover:text-emerald-600 hover:underline"
        >
          View Full Guide
        </Link>
      </div>
    </div>
  );
}
