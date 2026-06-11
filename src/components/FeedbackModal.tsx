"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/compressImage";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useVoiceRecorder, formatElapsed, VOICE_MAX_DURATION_MS } from "@/hooks/useVoiceRecorder";
import { ICON_MAP } from "@/lib/styleDictionary";
import { getEntries, formatEntriesForCopy } from "@/lib/debugLogBuffer";
import { APP_VERSION } from "@/lib/appVersion";

const CATEGORIES = [
  { value: "", label: "Select type…" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature request" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
] as const;

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function FeedbackModal({
  open,
  onClose,
  pageUrl,
}: {
  open: boolean;
  onClose: () => void;
  pageUrl: string;
}) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [attachDebugLog, setAttachDebugLog] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const voice = useVoiceRecorder();
  void user; // referenced via useAuth subscription; live value read from supabase below

  // T2: read snapshot only when toggle ON so empty-toggle modal opens are cheap.
  const debugLogPreview = useMemo(() => {
    if (!open || !attachDebugLog) return "";
    return formatEntriesForCopy(getEntries());
  }, [open, attachDebugLog]);

  useEffect(() => {
    if (!open) return;
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((el) => el.tabIndex !== -1);
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const msg = message.trim();
    if (!msg) return;
    setError(null);
    setSending(true);
    try {
      // Use fresh session so storage and table RLS see the same auth.uid()
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.id) {
        setError("Please sign in again and try again.");
        return;
      }
      let screenshotPath: string | null = null;
      if (screenshotFile) {
        const { blob } = await compressImage(screenshotFile);
        const path = `${currentUser.id}/feedback-${crypto.randomUUID()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("journal-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
        if (uploadErr) throw uploadErr;
        screenshotPath = path;
      }
      let voicePath: string | null = null;
      if (voice.blob) {
        const contentType = voice.mimeType || voice.blob.type || "audio/webm";
        const path = `${currentUser.id}/feedback-voice-${crypto.randomUUID()}.${voice.extension}`;
        const { error: uploadErr } = await supabase.storage
          .from("journal-photos")
          .upload(path, voice.blob, { contentType, upsert: false, cacheControl: "31536000" });
        if (uploadErr) throw uploadErr;
        voicePath = path;
      }
      const debugLogText = attachDebugLog ? formatEntriesForCopy(getEntries()) : null;
      const baseRow = {
        user_id: currentUser.id,
        message: msg,
        category: category || null,
        page_url: pageUrl || null,
        user_email: currentUser.email ?? null,
        screenshot_path: screenshotPath,
        voice_path: voicePath,
        debug_log_text: debugLogText && debugLogText.length > 0 ? debugLogText : null,
      };
      const deviceMetadata = {
        user_agent: navigator.userAgent,
        viewport_w: window.innerWidth,
        viewport_h: window.innerHeight,
        app_version: APP_VERSION,
      };
      let { error: err } = await supabase
        .from("user_feedback")
        .insert({ ...baseRow, metadata: deviceMetadata });
      if (err && (err.code === "PGRST204" || err.code === "42703")) {
        // metadata column not on this database yet — send without device context
        // rather than failing the submission.
        ({ error: err } = await supabase.from("user_feedback").insert(baseRow));
      }
      if (err) throw err;
      setSent(true);
      setMessage("");
      setCategory("");
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setAttachDebugLog(false);
      voice.reset();
      setTimeout(() => {
        setSent(false);
        onClose();
      }, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e && typeof (e as { message?: string }).message === "string" ? (e as { message: string }).message : "Failed to send");
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [message, category, screenshotFile, pageUrl, onClose, voice, attachDebugLog]);

  const handleClose = useCallback(() => {
    if (!sending) {
      setMessage("");
      setCategory("");
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setAttachDebugLog(false);
      voice.reset();
      setError(null);
      setSent(false);
      onClose();
    }
  }, [sending, onClose, voice]);

  const handleScreenshotChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, etc.).");
      return;
    }
    setScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setScreenshotFile(file);
    setError(null);
  }, []);

  const clearScreenshot = useCallback(() => {
    setScreenshotFile(null);
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [screenshotPreview]);

  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/40"
        aria-hidden
        onClick={handleClose}
      />
      <div
        ref={dialogRef}
        className="fixed left-4 right-4 top-1/2 z-[100] -translate-y-1/2 rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col max-w-md mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onKeyDown={handleKeyDown}
      >
        <div className="flex-shrink-0 flex items-center gap-2 p-4 border-b border-black/5">
          <span className="text-emerald-600" aria-hidden>
            <WrenchIcon />
          </span>
          <h2 id="feedback-title" className="text-lg font-semibold text-black">
            Send Feedback
          </h2>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-black/60">
            Found a bug or have an idea? We’d love to hear from you. Your feedback helps improve the app.
          </p>
          <div>
            <label htmlFor="feedback-category" className="block text-sm font-medium text-black/80 mb-1">
              Type
            </label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black bg-white min-h-[44px]"
              aria-label="Feedback type"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value || "none"} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="feedback-message" className="block text-sm font-medium text-black/80 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe what you’re seeing or what you’d like to see…"
              rows={4}
              className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black placeholder:text-black/40 resize-y min-h-[100px]"
              aria-label="Feedback message"
              disabled={sending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black/80 mb-1">
              Screenshot            </label>
            {screenshotPreview ? (
              <div className="relative rounded-xl border border-black/10 overflow-hidden bg-neutral-50">
                <div className="relative aspect-video max-h-40">
                  <img
                    src={screenshotPreview}
                    alt="Screenshot attachment"
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={clearScreenshot}
                  className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Remove screenshot"
                >
                  <span aria-hidden>×</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="w-full min-h-[44px] rounded-xl border border-dashed border-black/20 px-4 py-3 text-sm text-black/60 hover:bg-black/5 hover:border-black/30 disabled:opacity-50"
              >
                Attach screenshot
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshotChange}
              className="sr-only"
              aria-label="Choose screenshot file"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black/80 mb-1">
              Voice memo            </label>
            {!voice.supported ? (
              <p className="text-xs text-black/50">
                Voice recording isn&apos;t supported on this browser. Typing and screenshots still work.
              </p>
            ) : voice.recState === "recorded" && voice.blobUrl ? (
              <div className="rounded-xl border border-emerald-500 bg-emerald-50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-emerald-900">
                    Voice memo recorded ({formatElapsed(voice.elapsedMs)})
                  </span>
                  <button
                    type="button"
                    onClick={voice.reset}
                    disabled={sending}
                    className="min-h-[44px] px-3 rounded-lg text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    aria-label="Re-record voice memo"
                  >
                    Re-record
                  </button>
                </div>
                <audio
                  controls
                  src={voice.blobUrl}
                  className="w-full"
                  aria-label="Voice memo playback"
                />
              </div>
            ) : voice.recState === "recording" ? (
              <div className="rounded-xl border border-emerald-500 bg-emerald-50 p-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium text-emerald-900" aria-live="polite">
                  <span
                    className="w-2 h-2 rounded-full bg-red-500 animate-pulse"
                    aria-hidden
                  />
                  Recording… {formatElapsed(voice.elapsedMs)} / {formatElapsed(VOICE_MAX_DURATION_MS)}
                </span>
                <button
                  type="button"
                  onClick={voice.stopRecording}
                  className="min-h-[44px] px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                  aria-label="Stop recording"
                >
                  Stop
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={voice.startRecording}
                disabled={sending}
                className="w-full min-h-[44px] rounded-xl border border-dashed border-black/20 px-4 py-3 text-sm text-black/60 hover:bg-black/5 hover:border-black/30 disabled:opacity-50 flex items-center justify-center gap-2"
                aria-label="Record voice memo"
              >
                <ICON_MAP.Mic className="w-5 h-5" stroke="currentColor" />
                <span>Record voice memo (up to {Math.round(VOICE_MAX_DURATION_MS / 1000)}s)</span>
              </button>
            )}
            {voice.errorMessage && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {voice.errorMessage}
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-3 min-h-[44px]">
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-black/80">Include debug info</span>
                <span id="feedback-debug-desc" className="block text-xs text-black/50">
                  Attaches recent technical messages from your browser. Helps diagnose what went wrong. Review the text below before sending.
                </span>
              </div>
              <label className="relative inline-flex items-center shrink-0 cursor-pointer min-w-[44px] min-h-[44px]">
                <input
                  type="checkbox"
                  checked={attachDebugLog}
                  onChange={(e) => setAttachDebugLog(e.target.checked)}
                  disabled={sending}
                  className="peer sr-only"
                  aria-describedby="feedback-debug-desc"
                  aria-label="Include debug info"
                />
                <span
                  className="relative block w-11 h-6 bg-neutral-200 rounded-full peer-checked:bg-emerald-500 transition-colors after:content-[''] after:block after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow after:transition-transform peer-checked:after:translate-x-5"
                  aria-hidden
                />
              </label>
            </div>
            {attachDebugLog && (
              <textarea
                readOnly
                value={debugLogPreview || "(No console messages captured yet.)"}
                className="mt-2 w-full max-h-32 min-h-[80px] rounded-lg border border-black/10 bg-neutral-50 p-2 text-[11px] font-mono text-neutral-700 whitespace-pre-wrap"
                aria-label="Debug info preview (will be attached to feedback)"
              />
            )}
          </div>
          <div className="text-xs text-black/50 space-y-0.5">
            {pageUrl && <p>Submitting from: {pageUrl}</p>}
            <p>Includes your browser type, screen size, and app version to help diagnose issues.</p>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {sent && (
            <p className="text-sm text-emerald-600 font-medium" role="status">
              Thanks! Your feedback has been sent.
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex gap-3 p-4 border-t border-black/5">
          <button
            type="button"
            onClick={handleClose}
            disabled={sending}
            className="flex-1 min-h-[44px] rounded-xl border border-black/10 text-black/80 font-medium hover:bg-black/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
            className="flex-1 min-h-[44px] rounded-xl bg-emerald text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}
