"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Reusable error boundary fallback for route segments. */
export function RouteErrorFallback({
  error,
  reset,
  pageName,
  logPrefix = "[Error boundary]",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  pageName?: string;
  logPrefix?: string;
}) {
  useEffect(() => {
    console.error(logPrefix, error);
  }, [error, logPrefix]);

  const message = error.message || (pageName ? `We couldn't load ${pageName}.` : "An unexpected error occurred.");

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 bg-paper">
      <h1 className="text-xl font-semibold text-neutral-900 mb-2">Something went wrong</h1>
      <p className="text-neutral-600 text-sm mb-4 text-center max-w-md">{message}</p>
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
