"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 font-sans">
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
      </body>
    </html>
  );
}
