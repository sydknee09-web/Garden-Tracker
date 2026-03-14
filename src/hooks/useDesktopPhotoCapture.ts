"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { isMobileDevice } from "@/lib/deviceUtils";

/**
 * Law 5 (Smart Camera): on desktop, use webcam via getUserMedia instead of
 * <input capture="environment"> (which doesn't open webcam on desktop).
 * Use with isMobile: mobile uses file input with capture="environment";
 * desktop uses startWebcam → show video → captureFromWebcam.
 */
export function useDesktopPhotoCapture(onCapture: (file: File) => void) {
  const [isMobile, setIsMobile] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setWebcamActive(false);
    setWebcamError(null);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const startWebcam = useCallback(() => {
    setWebcamError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setWebcamError("Camera not supported. Choose a file instead.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        setWebcamActive(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setWebcamError("Camera access denied. Choose a file instead.");
        streamRef.current = null;
      });
  }, []);

  const captureFromWebcam = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream?.getVideoTracks().length) return;
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    const width = settings.width ?? 640;
    const height = settings.height ?? 480;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        stopWebcam();
      },
      "image/jpeg",
      0.9
    );
  }, [onCapture, stopWebcam]);

  return { isMobile, webcamActive, webcamError, videoRef, startWebcam, stopWebcam, captureFromWebcam };
}
