"use client";

/**
 * Full-viewport placeholder shown during initial app load (auth + fonts).
 * Background matches manifest so system splash transitions seamlessly — no teal, no icon.
 */
export function LoadingScreen() {
  return (
    <main
      className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backgroundColor: "#F9FAFB",
      }}
      aria-hidden
    />
  );
}
