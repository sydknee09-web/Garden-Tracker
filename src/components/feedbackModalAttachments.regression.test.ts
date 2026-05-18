/**
 * Regression test for §3.12-tester T1 + T2 — voice memo + debug-log opt-in attach
 * on FeedbackModal.
 *
 * T3 lock (2026-05-17) constraints:
 *  - T1 voice: visible Record/Stop button (no swipe / hold-to-record), 30-60s cap,
 *    plain-language mic permission, Re-record always visible, no auto-start.
 *  - T2 debug-log: default OFF, opt-in toggle, content preview before submit,
 *    plain-language disclosure.
 *
 * Asserts via source-file scans rather than rendering (matches the project's
 * existing regression-test pattern: myPlantsIconCohesion.regression.test.ts).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const feedbackModal = readFileSync(join(ROOT, "src/components/FeedbackModal.tsx"), "utf-8");
const voiceHook = readFileSync(join(ROOT, "src/hooks/useVoiceRecorder.ts"), "utf-8");
const styleDictionary = readFileSync(join(ROOT, "src/lib/styleDictionary.tsx"), "utf-8");
const migration = readFileSync(
  join(ROOT, "supabase/migrations/20260517120000_user_feedback_voice_and_debug_log.sql"),
  "utf-8",
);

describe("T1 voice recorder — FeedbackModal integration", () => {
  it("imports useVoiceRecorder hook + helpers", () => {
    expect(feedbackModal).toContain('from "@/hooks/useVoiceRecorder"');
    expect(feedbackModal).toContain("useVoiceRecorder");
    expect(feedbackModal).toContain("formatElapsed");
    expect(feedbackModal).toContain("VOICE_MAX_DURATION_MS");
  });

  it("renders a visible Record button (no hold-to-record / swipe gesture)", () => {
    expect(feedbackModal).toContain('aria-label="Record voice memo"');
    expect(feedbackModal).toContain("Record voice memo");
    expect(feedbackModal).not.toMatch(/onTouchStart=.*startRecording/);
    expect(feedbackModal).not.toMatch(/onMouseDown=.*startRecording/);
  });

  it("renders a visible Stop button when recording", () => {
    expect(feedbackModal).toContain('aria-label="Stop recording"');
  });

  it("renders a Re-record button when recorded (always-available retake)", () => {
    expect(feedbackModal).toContain('aria-label="Re-record voice memo"');
  });

  it("uses ICON_MAP.Mic for the record button (not inline SVG)", () => {
    expect(feedbackModal).toContain("ICON_MAP.Mic");
  });

  it("uses native <audio controls> for playback (no custom player)", () => {
    expect(feedbackModal).toContain("<audio");
    expect(feedbackModal).toContain("controls");
    expect(feedbackModal).toContain('aria-label="Voice memo playback"');
  });

  it("shows plain-language fallback when MediaRecorder unsupported", () => {
    expect(feedbackModal).toContain("Voice recording isn");
    expect(feedbackModal).toContain("Typing and screenshots still work");
  });
});

describe("T1 voice recorder hook — useVoiceRecorder", () => {
  it("caps duration at 60_000 ms per T3 lock (30-60s range)", () => {
    expect(voiceHook).toContain("const MAX_DURATION_MS = 60_000;");
  });

  it("declares MIME candidates with iOS-Safari fallback (audio/mp4)", () => {
    expect(voiceHook).toContain('"audio/webm;codecs=opus"');
    expect(voiceHook).toContain('"audio/mp4;codecs=mp4a.40.2"');
    expect(voiceHook).toContain('"audio/mp4"');
  });

  it("provides plain-language permission-denied copy", () => {
    expect(voiceHook).toContain("Microphone access denied");
    expect(voiceHook).toContain("type your feedback or attach a screenshot");
  });

  it("cleans up MediaStream tracks on unmount + reset", () => {
    expect(voiceHook).toContain("getTracks().forEach((t) => t.stop());");
  });

  it("declares the 4 state-machine values", () => {
    expect(voiceHook).toContain('"idle"');
    expect(voiceHook).toContain('"permission-denied"');
    expect(voiceHook).toContain('"recording"');
    expect(voiceHook).toContain('"recorded"');
  });
});

describe("T1 — Mic icon in ICON_MAP (cohesion-by-aggregation)", () => {
  it("defines MicIcon function in styleDictionary", () => {
    expect(styleDictionary).toContain("function MicIcon(");
  });

  it("exports Mic key in ICON_MAP", () => {
    expect(styleDictionary).toMatch(/Mic:\s*MicIcon/);
  });
});

describe("T2 debug-log opt-in — FeedbackModal integration", () => {
  it("imports debug-log helpers", () => {
    expect(feedbackModal).toContain('from "@/lib/debugLogBuffer"');
    expect(feedbackModal).toContain("getEntries");
    expect(feedbackModal).toContain("formatEntriesForCopy");
  });

  it("toggle state defaults OFF per T3 lock", () => {
    expect(feedbackModal).toContain("useState(false)");
    expect(feedbackModal).toContain("attachDebugLog");
  });

  it("uses 'Include debug info' label per locked copy frame", () => {
    expect(feedbackModal).toContain("Include debug info");
  });

  it("uses plain-language disclosure copy (no jargon)", () => {
    expect(feedbackModal).toContain("recent technical messages from your browser");
    expect(feedbackModal).toContain("Helps us figure out what went wrong");
    expect(feedbackModal).toContain("review the text");
  });

  it("toggle does NOT persist to localStorage (per-session privacy default)", () => {
    expect(feedbackModal).not.toMatch(/localStorage[^)]*attachDebugLog/);
    expect(feedbackModal).not.toMatch(/localStorage[^)]*debug.log/i);
  });

  it("renders content preview textarea only when toggle ON", () => {
    expect(feedbackModal).toContain("attachDebugLog && (");
    expect(feedbackModal).toContain("Debug info preview");
  });

  it("uses peer sr-only toggle shell matching SettingsSuccessSoundToggle", () => {
    expect(feedbackModal).toContain("peer sr-only");
    expect(feedbackModal).toContain("peer-checked:bg-emerald-500");
  });

  it("falls back to '(No console messages captured yet.)' for empty log", () => {
    expect(feedbackModal).toContain("(No console messages captured yet.)");
  });
});

describe("T1 + T2 — supabase migration adds voice_path + debug_log_text", () => {
  it("adds voice_path column", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS voice_path text/);
  });

  it("adds debug_log_text column", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS debug_log_text text/);
  });

  it("targets the user_feedback table", () => {
    expect(migration).toContain("public.user_feedback");
  });
});

describe("T1 + T2 — submit path uploads + inserts new fields", () => {
  it("uploads voice blob to journal-photos bucket with feedback-voice path prefix", () => {
    expect(feedbackModal).toMatch(/feedback-voice-\$\{crypto\.randomUUID\(\)\}/);
    expect(feedbackModal).toContain('.from("journal-photos")');
  });

  it("inserts voice_path + debug_log_text on the user_feedback row", () => {
    expect(feedbackModal).toContain("voice_path:");
    expect(feedbackModal).toContain("debug_log_text:");
  });
});
