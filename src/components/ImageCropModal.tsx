"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";

export type CropShape = "square" | "circle";

export interface ImageCropModalProps {
  open: boolean;
  onClose: () => void;
  /** Image source: URL string or object URL from File. */
  imageSrc: string;
  /** Crop shape. Square = 1:1; circle uses same 1:1 crop with circular mask on preview. */
  shape?: CropShape;
  /** Called with the cropped image as a Blob (JPEG). */
  onConfirm: (blob: Blob) => void;
}

const DEFAULT_MIN_SIZE = 80;

/**
 * User-guided crop modal. Renders the image and a draggable/resizable crop overlay.
 * On confirm, draws the cropped region to canvas and returns a Blob.
 * High-performance: single canvas draw on confirm.
 */
export function ImageCropModal({ open, onClose, imageSrc, shape = "square", onConfirm }: ImageCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const updateImageSize = useCallback(() => {
    const img = imageRef.current;
    if (!img || !img.complete) return;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  useEffect(() => {
    if (!open || !imageSrc) return;
    const img = imageRef.current;
    if (img) {
      if (img.complete) updateImageSize();
      else img.addEventListener("load", updateImageSize);
    }
    return () => {
      img?.removeEventListener("load", updateImageSize);
    };
  }, [open, imageSrc, updateImageSize]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setContainerSize({ width: el.offsetWidth, height: el.offsetHeight });
    });
    ro.observe(el);
    setContainerSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open || containerSize.width === 0) return;
    const size = Math.min(containerSize.width, containerSize.height, 320);
    const x = Math.max(0, (containerSize.width - size) / 2);
    const y = Math.max(0, (containerSize.height - size) / 2);
    setCrop({ x, y, size });
  }, [open, containerSize.width, containerSize.height]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
    },
    [crop.x, crop.y]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const w = containerSize.width;
      const h = containerSize.height;
      let nx = e.clientX - dragStart.x;
      let ny = e.clientY - dragStart.y;
      nx = Math.max(0, Math.min(w - crop.size, nx));
      ny = Math.max(0, Math.min(h - crop.size, ny));
      setCrop((prev) => ({ ...prev, x: nx, y: ny }));
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, dragStart, containerSize, crop.size]);

  const handleConfirm = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !img.complete || !container || imageSize.width === 0) return;
    const scaleX = img.naturalWidth / img.offsetWidth;
    const scaleY = img.naturalHeight / img.offsetHeight;
    const sx = crop.x * scaleX;
    const sy = crop.y * scaleY;
    const s = crop.size * Math.min(scaleX, scaleY);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(s);
    canvas.height = Math.round(s);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, s, s, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onConfirm(blob);
          onClose();
        }
      },
      "image/jpeg",
      0.9
    );
  }, [crop, imageSize, onConfirm, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-black/50" aria-hidden onClick={onClose} />
      <div
        className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[111] rounded-3xl bg-white border border-neutral-200 p-4 max-w-md mx-auto max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-modal-title"
      >
        <h2 id="crop-modal-title" className="text-lg font-semibold text-neutral-900 mb-3 text-center">Crop image</h2>
        <div ref={containerRef} className="relative w-full aspect-square max-h-[60vh] bg-neutral-100 rounded-xl overflow-hidden">
          <img
            ref={imageRef}
            src={imageSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
            style={{ touchAction: "none" }}
          />
          <div
            className={`absolute border-2 border-white shadow-lg ${shape === "circle" ? "rounded-full" : ""}`}
            style={{
              left: crop.x,
              top: crop.y,
              width: crop.size,
              height: crop.size,
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onPointerDown={handlePointerDown}
          />
          <div
            className={`absolute inset-0 pointer-events-none ${shape === "circle" ? "rounded-full" : ""}`}
            style={{
              boxShadow: `inset ${crop.x}px ${crop.y}px 0 0 rgba(0,0,0,0.5), inset ${crop.x + crop.size}px 0 0 0 rgba(0,0,0,0.5), inset 0 ${crop.y + crop.size}px 0 0 rgba(0,0,0,0.5), inset 0 0 ${crop.x}px 0 rgba(0,0,0,0.5)`,
            }}
            aria-hidden
          />
        </div>
        <p className="text-xs text-neutral-500 mt-2 text-center">Drag the box to frame the image.</p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={onClose} className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-black/10 text-black/80 font-medium">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald-600 text-white font-medium">
            Apply crop
          </button>
        </div>
      </div>
    </>
  );
}
