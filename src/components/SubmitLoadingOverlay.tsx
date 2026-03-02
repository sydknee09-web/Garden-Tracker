"use client";

interface SubmitLoadingOverlayProps {
  show: boolean;
  message?: string;
}

/** Loading overlay shown when submitting add forms. Gives immediate feedback and prevents double-submit. */
export function SubmitLoadingOverlay({ show, message = "Saving…" }: SubmitLoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl"
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div
        className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"
        aria-hidden
      />
      <p className="text-sm font-medium text-neutral-700">{message}</p>
    </div>
  );
}
