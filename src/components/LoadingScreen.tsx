"use client";

/** Full-screen loading view shown on initial app open (auth loading). Uses app icon with fade animation. */
export function LoadingScreen() {
  return (
    <main
      className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center gap-6 px-4 animate-loading-screen-fade-in"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backgroundColor: "#85d2d2",
      }}
    >
      <img
        src="/app-icon.png"
        alt=""
        aria-hidden
        width={140}
        height={140}
        className="animate-loading-fade object-contain"
      />
    </main>
  );
}
