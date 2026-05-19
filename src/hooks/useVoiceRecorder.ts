"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * §3.12-tester T1 voice recorder hook.
 *
 * Public-context constraints (T3 lock 2026-05-17): visible record/stop (no hold-to-record),
 * 60s max duration cap (auto-stop), plain-language permission denial copy, retake always
 * available. Anchors on existing stream-cleanup pattern from useDesktopPhotoCapture.ts.
 *
 * MIME fallback order (iOS Safari only supports audio/mp4; Chrome/Android prefer
 * audio/webm; codecs=opus). Falls through to browser default if neither matches.
 */

export type VoiceRecState = "idle" | "permission-denied" | "recording" | "recorded";

const MAX_DURATION_MS = 60_000;
const TIMER_TICK_MS = 250;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/webm",
  "audio/mp4",
  "",
] as const;

function pickMimeType(): string | null {
  if (typeof window === "undefined") return null;
  const MR = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR) return null;
  for (const candidate of MIME_CANDIDATES) {
    if (candidate === "") return "";
    try {
      if (MR.isTypeSupported(candidate)) return candidate;
    } catch {
      // Some older browsers throw on isTypeSupported — try the next candidate.
    }
  }
  return null;
}

function extensionForMime(mime: string): string {
  if (mime.startsWith("audio/mp4")) return "m4a";
  if (mime.startsWith("audio/webm")) return "webm";
  return "webm";
}

export function useVoiceRecorder() {
  const [supported, setSupported] = useState(false);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [recState, setRecState] = useState<VoiceRecState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    const picked = pickMimeType();
    setMimeType(picked);
    setSupported(picked !== null && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const revokeBlobUrl = useCallback((url: string | null) => {
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore — onstop handler still runs cleanup if state is already inactive
      }
    }
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback(() => {
    stopRecording();
    stopStream();
    revokeBlobUrl(blobUrl);
    chunksRef.current = [];
    setBlob(null);
    setBlobUrl(null);
    setElapsedMs(0);
    setErrorMessage(null);
    setRecState("idle");
  }, [stopRecording, stopStream, revokeBlobUrl, blobUrl]);

  const startRecording = useCallback(async () => {
    if (!supported || mimeType === null) return;
    setErrorMessage(null);
    revokeBlobUrl(blobUrl);
    setBlob(null);
    setBlobUrl(null);
    chunksRef.current = [];
    setElapsedMs(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorderOptions = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        clearTimer();
        const effectiveType = mimeType || (chunksRef.current[0]?.type ?? "audio/webm");
        const finalBlob = new Blob(chunksRef.current, { type: effectiveType });
        const url = URL.createObjectURL(finalBlob);
        setBlob(finalBlob);
        setBlobUrl(url);
        setRecState("recorded");
        stopStream();
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setRecState("recording");
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_DURATION_MS) {
          try {
            recorder.stop();
          } catch {
            // already stopped
          }
        }
      }, TIMER_TICK_MS);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setRecState("permission-denied");
        setErrorMessage("Microphone access denied. Type your feedback or attach a screenshot instead. To re-enable mic, check your browser's site settings.");
      } else {
        setRecState("idle");
        setErrorMessage("Couldn't start recording. Try again or attach a screenshot instead.");
      }
      stopStream();
    }
  }, [supported, mimeType, blobUrl, revokeBlobUrl, clearTimer, stopStream]);

  // Unmount cleanup — stop any in-flight recording, release tracks, revoke URL.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (blobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extension = mimeType ? extensionForMime(mimeType) : "webm";

  return {
    supported,
    mimeType,
    extension,
    recState,
    errorMessage,
    elapsedMs,
    blob,
    blobUrl,
    startRecording,
    stopRecording,
    reset,
  };
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const VOICE_MAX_DURATION_MS = MAX_DURATION_MS;
