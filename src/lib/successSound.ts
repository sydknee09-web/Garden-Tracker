const SUCCESS_SOUND_KEY = "success-sound-enabled";

export function isSuccessSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SUCCESS_SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSuccessSoundEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(SUCCESS_SOUND_KEY, "1");
    else localStorage.removeItem(SUCCESS_SOUND_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Play a short, pleasant success tone (E6). Only plays if user has enabled "Play sound on success" in Settings.
 * Uses Web Audio API so no asset is required. Respects reduced motion / user preference via the setting.
 */
export function playSuccessSound(): void {
  if (!isSuccessSoundEnabled() || typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 523.25;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    /* ignore */
  }
}
