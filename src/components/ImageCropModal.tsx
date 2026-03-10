"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type CropShape = "square" | "circle";

export interface ImageCropModalProps {
  open: boolean;
  onClose: () => void;
  /** Image source: URL string or object URL from File. */
  imageSrc: string;
  /** Crop shape. Square = 1:1; circle uses same 1:1 crop with circular mask. Ignored when aspectRatio !== 1 (rectangular priority). */
  shape?: CropShape;
  /** Width / height of crop box. Default 1 (square). Use 16/10 for hero. When !== 1, shape is forced to rectangle. */
  aspectRatio?: number;
  /** Called with the cropped image as a Blob (JPEG). */
  onConfirm: (blob: Blob) => void;
}

const DEFAULT_MIN_SIZE = 80;

/**
 * User-guided crop modal. Supports optional aspect ratio; when aspectRatio !== 1, crop is rectangular and shape is ignored.
 */
export function ImageCropModal({
  open,
  onClose,
  imageSrc,
  shape = "square",
  aspectRatio: aspectRatioProp = 1,
  onConfirm,
}: ImageCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const aspectRatio = aspectRatioProp > 0 ? aspectRatioProp : 1;
  const isRectangular = Math.abs(aspectRatio - 1) > 0.01;
  const effectiveShape = isRectangular ? "square" : shape;

  const isCrossOrigin =
    typeof imageSrc === "string" &&
    !imageSrc.startsWith("blob:") &&
    !imageSrc.startsWith("data:");

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
    const w = containerSize.width;
    const h = containerSize.height;
    let cw: number;
    let ch: number;
    if (isRectangular) {
      cw = Math.min(w, h * aspectRatio);
      ch = cw / aspectRatio;
      if (ch > h) {
        ch = h;
        cw = h * aspectRatio;
      }
    } else {
      const size = Math.min(w, h, 320);
      cw = size;
      ch = size;
    }
    const x = Math.max(0, (w - cw) / 2);
    const y = Math.max(0, (h - ch) / 2);
    setCrop({ x, y, width: cw, height: ch });
  }, [open, containerSize.width, containerSize.height, aspectRatio, isRectangular]);

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
      const cw = crop.width;
      const ch = crop.height;
      let nx = e.clientX - dragStart.x;
      let ny = e.clientY - dragStart.y;
      nx = Math.max(0, Math.min(w - cw, nx));
      ny = Math.max(0, Math.min(h - ch, ny));
      setCrop((prev) => ({ ...prev, x: nx, y: ny }));
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, dragStart, containerSize, crop.width, crop.height]);

  const handleConfirm = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !img.complete || !container || imageSize.width === 0) return;
    const scaleX = img.naturalWidth / img.offsetWidth;
    const scaleY = img.naturalHeight / img.offsetHeight;
    const sx = crop.x * scaleX;
    const sy = crop.y * scaleY;
    const sw = crop.width * Math.min(scaleX, scaleY);
    const sh = crop.height * Math.min(scaleX, scaleY);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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

  const containerAspectStyle = isRectangular ? { aspectRatio: `${aspectRatio}` } : undefined;

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
        <div
          ref={containerRef}
          className={`relative w-full max-h-[60vh] bg-neutral-100 rounded-xl overflow-hidden ${!isRectangular ? "aspect-square" : ""}`}
          style={containerAspectStyle}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
            style={{ touchAction: "none" }}
            {...(isCrossOrigin ? { crossOrigin: "anonymous" as const } : {})}
          />
          <div
            className={`absolute border-2 border-white shadow-lg ${effectiveShape === "circle" ? "rounded-full" : ""}`}
            style={{
              left: crop.x,
              top: crop.y,
              width: crop.width,
              height: crop.height,
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onPointerDown={handlePointerDown}
          />
          <div
            className={`absolute inset-0 pointer-events-none ${effectiveShape === "circle" ? "rounded-full" : ""}`}
            style={{
              boxShadow: `inset ${crop.x}px ${crop.y}px 0 0 rgba(0,0,0,0.5), inset ${crop.x + crop.width}px 0 0 0 rgba(0,0,0,0.5), inset 0 ${crop.y + crop.height}px 0 0 rgba(0,0,0,0.5), inset 0 0 ${crop.x}px 0 rgba(0,0,0,0.5)`,
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
