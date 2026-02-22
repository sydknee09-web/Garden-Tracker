"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GardenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Garden error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 bg-paper">
      <h1 className="text-xl font-semibold text-neutral-900 mb-2">Something went wrong</h1>
      <p className="text-neutral-600 text-sm mb-4 text-center max-w-md">
        {error.message || "We couldn&apos;t load the Garden."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-[44px] min-w-[120px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="min-h-[44px] min-w-[120px] px-4 py-2 rounded-xl border border-black/15 bg-white text-neutral-700 font-medium hover:bg-black/5 transition-colors flex items-center justify-center"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
