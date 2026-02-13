"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper">
      <h1 className="text-xl font-semibold text-neutral-900 mb-2">Something went wrong</h1>
      <p className="text-neutral-600 text-sm mb-4 text-center max-w-md">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-[44px] min-w-[120px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
