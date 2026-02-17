"use client";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

/** Shared loading indicator used across all pages for visual consistency. */
export function LoadingState({ message = "Loading…", className = "" }: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center gap-2 py-8 ${className}`}>
      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" aria-hidden />
      <p className="text-neutral-500 text-sm">{message}</p>
    </div>
  );
}
