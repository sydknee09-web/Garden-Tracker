"use client";

interface LoadingScreenProps {
  onSkip?: () => void;
}

/** Full-screen loading view shown on app open (auth loading). Uses app icon with fade animation. */
export function LoadingScreen({ onSkip }: LoadingScreenProps) {
  return (
    <main
      className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-paper gap-6 px-4"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <img
        src="/app-icon.png"
        alt=""
        aria-hidden
        width={140}
        height={140}
        className="animate-loading-fade object-contain"
      />
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="min-w-[44px] min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
        >
          Skip
        </button>
      )}
    </main>
  );
}
