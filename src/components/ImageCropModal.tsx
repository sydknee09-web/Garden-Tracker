"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

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
const HANDLE_SIZE = 44;

type ResizeHandle = "nw" | "ne" | "sw" | "se" | null;
type AspectPreset = "square" | "original" | null;

/**
 * User-guided crop modal. Touch-friendly with resize handles, Reset, Undo, and aspect presets.
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
  const [previousCrop, setPreviousCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, crop: { x: 0, y: 0, width: 200, height: 200 } });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>(null);
  const trapRef = useFocusTrap(open);

  const naturalAspect = imageSize.width > 0 && imageSize.height > 0 ? imageSize.width / imageSize.height : 1;
  const effectiveAspect =
    aspectPreset === "original" ? naturalAspect : aspectPreset === "square" ? 1 : aspectRatioProp > 0 ? aspectRatioProp : 1;
  const isRectangular = Math.abs(effectiveAspect - 1) > 0.01;
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

  const computeInitialCrop = useCallback(
    (w: number, h: number) => {
      const aspect = effectiveAspect;
      const minSize = DEFAULT_MIN_SIZE;
      let cw: number;
      let ch: number;
      if (isRectangular) {
        cw = Math.min(w, Math.max(minSize, h * aspect));
        ch = cw / aspect;
        if (ch > h) {
          ch = Math.max(minSize, h);
          cw = ch * aspect;
        }
        cw = Math.max(minSize, Math.min(cw, w));
        ch = cw / aspect;
      } else {
        const size = Math.min(w, h, 320);
        cw = Math.max(minSize, size);
        ch = cw;
      }
      const x = Math.max(0, (w - cw) / 2);
      const y = Math.max(0, (h - ch) / 2);
      return { x, y, width: cw, height: ch };
    },
    [effectiveAspect, isRectangular]
  );

  useEffect(() => {
    if (!open || containerSize.width === 0) return;
    setCrop(computeInitialCrop(containerSize.width, containerSize.height));
  }, [open, containerSize.width, containerSize.height, effectiveAspect, isRectangular, computeInitialCrop]);

  const handleReset = useCallback(() => {
    if (containerSize.width === 0) return;
    setPreviousCrop(crop);
    setCrop(computeInitialCrop(containerSize.width, containerSize.height));
  }, [containerSize.width, containerSize.height, crop, computeInitialCrop]);

  const handleUndo = useCallback(() => {
    if (previousCrop) {
      setCrop(previousCrop);
      setPreviousCrop(null);
    }
  }, [previousCrop]);

  const handlePointerDownBox = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setPreviousCrop(crop);
      setIsDragging(true);
      setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
    },
    [crop]
  );

  const handlePointerDownHandle = useCallback(
    (e: React.PointerEvent, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();
      setPreviousCrop(crop);
      setResizeHandle(handle);
      setResizeStart({ x: e.clientX, y: e.clientY, crop: { ...crop } });
    },
    [crop]
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

  useEffect(() => {
    if (!resizeHandle) return;
    const w = containerSize.width;
    const h = containerSize.height;
    const aspect = effectiveAspect;
    const minSize = DEFAULT_MIN_SIZE;
    const onMove = (e: PointerEvent) => {
      const dy = e.clientY - resizeStart.y;
      const { crop: sc } = resizeStart;
      let nh = sc.height;
      let nx = sc.x;
      let ny = sc.y;
      if (resizeHandle === "nw" || resizeHandle === "ne") {
        nh = Math.max(minSize, Math.min(h - sc.y, sc.height - dy));
        const nw = nh * aspect;
        if (resizeHandle === "nw") {
          nx = sc.x + sc.width - nw;
          ny = sc.y + sc.height - nh;
        } else {
          nx = sc.x;
          ny = sc.y + sc.height - nh;
        }
        setCrop({ x: Math.max(0, nx), y: Math.max(0, ny), width: Math.min(nw, w - nx), height: nh });
      } else {
        nh = Math.max(minSize, Math.min(h - sc.y, sc.height + dy));
        const nw = nh * aspect;
        if (resizeHandle === "sw") {
          nx = sc.x + sc.width - nw;
        } else {
          nx = sc.x;
        }
        setCrop({ x: Math.max(0, nx), y: sc.y, width: Math.min(nw, w - nx), height: nh });
      }
    };
    const onUp = () => setResizeHandle(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizeHandle, resizeStart, containerSize.width, containerSize.height, effectiveAspect]);

  const handleConfirm = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !img.complete || !container || imageSize.width === 0) return;
    const Wc = container.offsetWidth;
    const Hc = container.offsetHeight;
    const Wn = img.naturalWidth;
    const Hn = img.naturalHeight;
    const scale = Math.min(Wc / Wn, Hc / Hn);
    const w0 = Wn * scale;
    const h0 = Hn * scale;
    const x0 = (Wc - w0) / 2;
    const y0 = (Hc - h0) / 2;
    const ix = Math.max(crop.x, x0);
    const iy = Math.max(crop.y, y0);
    const ir = Math.min(crop.x + crop.width, x0 + w0);
    const ib = Math.min(crop.y + crop.height, y0 + h0);
    const iw = Math.max(0, ir - ix);
    const ih = Math.max(0, ib - iy);
    if (iw <= 0 || ih <= 0) return;
    const sx = (ix - x0) * (Wn / w0);
    const sy = (iy - y0) * (Hn / h0);
    const sw = iw * (Wn / w0);
    const sh = ih * (Hn / h0);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    if (effectiveShape === "circle") {
      const round = document.createElement("canvas");
      round.width = canvas.width;
      round.height = canvas.height;
      const rctx = round.getContext("2d");
      if (rctx) {
        rctx.beginPath();
        rctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2, 0, 2 * Math.PI);
        rctx.closePath();
        rctx.clip();
        rctx.drawImage(canvas, 0, 0);
        round.toBlob(
          (blob) => {
            if (blob) {
              onConfirm(blob);
              onClose();
            }
          },
          "image/jpeg",
          0.9
        );
        return;
      }
    }
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
  }, [crop, imageSize, effectiveShape, onConfirm, onClose]);

  const setPresetSquare = useCallback(() => {
    setAspectPreset("square");
    setPreviousCrop(crop);
    const w = containerSize.width;
    const h = containerSize.height;
    const size = Math.max(DEFAULT_MIN_SIZE, Math.min(w, h, 320));
    const x = Math.max(0, (w - size) / 2);
    const y = Math.max(0, (h - size) / 2);
    setCrop({ x, y, width: size, height: size });
  }, [crop, containerSize.width, containerSize.height]);

  const setPresetOriginal = useCallback(() => {
    if (imageSize.width === 0 || imageSize.height === 0) return;
    setAspectPreset("original");
    setPreviousCrop(crop);
    const w = containerSize.width;
    const h = containerSize.height;
    const aspect = naturalAspect;
    let cw = Math.min(w, Math.max(DEFAULT_MIN_SIZE, h * aspect));
    let ch = cw / aspect;
    if (ch > h) {
      ch = Math.max(DEFAULT_MIN_SIZE, h);
      cw = ch * aspect;
    }
    cw = Math.max(DEFAULT_MIN_SIZE, Math.min(cw, w));
    ch = cw / aspect;
    const x = Math.max(0, (w - cw) / 2);
    const y = Math.max(0, (h - ch) / 2);
    setCrop({ x, y, width: cw, height: ch });
  }, [crop, containerSize.width, containerSize.height, imageSize.width, imageSize.height, naturalAspect]);

  if (!open) return null;

  const w = containerSize.width;
  const h = containerSize.height;
  const containerAspectStyle = isRectangular ? { aspectRatio: `${effectiveAspect}` } : undefined;

  const r = Math.min(crop.width, crop.height) / 2;
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  const overlayClipPath =
    effectiveShape === "circle"
      ? `path(evenodd, "M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z")`
      : undefined;

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-black/50" aria-hidden onClick={onClose} />
      <div
        ref={trapRef}
        className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[111] rounded-3xl bg-white border border-neutral-200 p-4 max-w-md mx-auto max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-modal-title"
      >
        <h2 id="crop-modal-title" className="text-lg font-semibold text-neutral-900 mb-2 text-center">
          Crop image
        </h2>
        <div className="flex items-center justify-center gap-2 mb-2">
          <button
            type="button"
            onClick={setPresetSquare}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-full text-sm font-medium ${aspectPreset === "square" ? "bg-amber-400 text-amber-900" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
            aria-pressed={aspectPreset === "square"}
          >
            Square
          </button>
          <button
            type="button"
            onClick={setPresetOriginal}
            disabled={imageSize.width === 0}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-full text-sm font-medium disabled:opacity-50 ${aspectPreset === "original" ? "bg-amber-400 text-amber-900" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
            aria-pressed={aspectPreset === "original"}
          >
            Original
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-sm font-medium border border-black/10 text-black/80 hover:bg-black/5"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={previousCrop === null}
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-sm font-medium border border-black/10 text-black/80 hover:bg-black/5 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Undo last change"
          >
            Undo
          </button>
        </div>
        <div
          ref={containerRef}
          className={`relative w-full max-h-[60vh] rounded-xl overflow-hidden touch-none ${!isRectangular ? "aspect-square" : ""}`}
          style={{ ...containerAspectStyle, touchAction: "none" }}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-contain select-none"
            draggable={false}
            style={{ touchAction: "none" }}
            {...(isCrossOrigin ? { crossOrigin: "anonymous" as const } : {})}
          />
          {effectiveShape === "circle" ? (
            <div
              className="absolute inset-0 bg-black/50 pointer-events-none"
              style={{
                clipPath: overlayClipPath,
                WebkitClipPath: overlayClipPath,
              }}
              aria-hidden
            />
          ) : (
            <>
              <div
                className="absolute top-0 left-0 right-0 bg-black/50 pointer-events-none"
                style={{ height: crop.y }}
                aria-hidden
              />
              <div
                className="absolute bottom-0 left-0 right-0 bg-black/50 pointer-events-none"
                style={{ height: h - crop.y - crop.height }}
                aria-hidden
              />
              <div
                className="absolute left-0 bg-black/50 pointer-events-none"
                style={{ top: crop.y, width: crop.x, height: crop.height }}
                aria-hidden
              />
              <div
                className="absolute right-0 bg-black/50 pointer-events-none"
                style={{ top: crop.y, left: crop.x + crop.width, width: w - crop.x - crop.width, height: crop.height }}
                aria-hidden
              />
            </>
          )}
          <div
            className={`absolute border-2 border-white shadow-lg ${effectiveShape === "circle" ? "rounded-full" : ""}`}
            style={{
              left: crop.x,
              top: crop.y,
              width: crop.width,
              height: crop.height,
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
            }}
            onPointerDown={handlePointerDownBox}
          />
          {(["nw", "ne", "sw", "se"] as const).map((handle) => (
            <div
              key={handle}
              className="absolute min-w-[44px] min-h-[44px] bg-amber-400/90 border-2 border-amber-600 rounded-full flex items-center justify-center touch-none"
              style={{
                left: handle === "nw" || handle === "sw" ? crop.x - HANDLE_SIZE / 2 + 2 : crop.x + crop.width - HANDLE_SIZE / 2 - 2,
                top: handle === "nw" || handle === "ne" ? crop.y - HANDLE_SIZE / 2 + 2 : crop.y + crop.height - HANDLE_SIZE / 2 - 2,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                cursor:
                  handle === "nw" ? "nwse-resize" : handle === "ne" ? "nesw-resize" : handle === "sw" ? "nesw-resize" : "nwse-resize",
                touchAction: "none",
              }}
              onPointerDown={(e) => handlePointerDownHandle(e, handle)}
              aria-label={`Resize from ${handle} corner`}
            />
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-2 text-center">Drag the box or corners to frame the image.</p>
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald-600 text-white font-medium"
          >
            Apply crop
          </button>
        </div>
      </div>
    </>
  );
}
