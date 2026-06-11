"use client";

import { useEffect } from "react";
import Link from "next/link";
import { logEvent } from "@/lib/debugLog";

/** Reusable error boundary fallback for route segments. */
export function RouteErrorFallback({
  error,
  reset,
  pageName,
  logPrefix = "[Error boundary]",
  fullScreen = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  pageName?: string;
  logPrefix?: string;
  fullScreen?: boolean;
}) {
  useEffect(() => {
    console.error(logPrefix, error);
    logEvent("error_boundary", "route_error", {
      prefix: logPrefix,
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error, logPrefix]);

  const message = pageName
    ? `We couldn't load ${pageName}.`
    : "Something went wrong on our end.";

  return (
    <div
      className={`${fullScreen ? "min-h-screen" : "min-h-[50vh]"} flex flex-col items-center justify-center p-6 bg-paper`}
    >
      <h1 className="text-xl font-semibold text-neutral-900 mb-2">Something Went Wrong</h1>
      <p className="text-neutral-600 text-sm mb-4 text-center max-w-md">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-[44px] min-w-[120px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="min-h-[44px] min-w-[120px] px-4 py-2 rounded-xl border border-black/15 bg-white text-neutral-700 font-medium hover:bg-black/5 transition-colors flex items-center justify-center"
        >
          Back to Garden
        </Link>
      </div>
      {error.digest && (
        <p className="text-xs text-neutral-400 mt-4">Error reference: {error.digest}</p>
      )}
    </div>
  );
}
