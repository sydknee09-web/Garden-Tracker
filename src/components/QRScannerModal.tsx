"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

export function QRScannerModal({ open, onClose, onScan }: QRScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader";

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    setError(null);

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (!mounted || !open) return;
        if (!cameras?.length) {
          setError("No camera found.");
          return;
        }
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        scanner
          .start(
            cameras[0].id,
            { fps: 5, qrbox: { width: 200, height: 200 } },
            (decodedText) => {
              onScan(decodedText);
              onClose();
            },
            () => {}
          )
          .catch((err: Error) => {
            if (mounted) setError(err.message || "Could not start camera.");
          });
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message || "Could not access cameras.");
      });

    return () => {
      mounted = false;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [open, onClose, onScan]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" aria-hidden onClick={onClose} />
      <div
        className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white p-4 shadow-card max-w-sm mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scanner-title"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id="qr-scanner-title" className="text-lg font-semibold text-black">
            Scan seed packet
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-black/60 hover:bg-black/5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div id={containerId} className="rounded-xl overflow-hidden bg-black/5 min-h-[200px]" />
        {error && <p className="mt-2 text-sm text-citrus">{error}</p>}
      </div>
    </>
  );
}
