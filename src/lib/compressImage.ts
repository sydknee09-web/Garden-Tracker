/**
 * Shared image compression utility.
 * All upload paths (hero, journal, growth logs, packet photos, etc.) use this
 * to keep images under ~800 KB and prevent Supabase storage bloat.
 */

export interface CompressedImage {
  blob: Blob;
  fileName: string;
}

/**
 * Resize and compress an image File.
 * @param file      - The raw File from an <input> or camera capture.
 * @param maxLongEdge - Max pixels on the longest edge (default 1200).
 * @param quality   - JPEG quality 0–1 (default 0.85).
 * @param maxSizeKB - Target max size in KB (default 800). Will retry at lower
 *                    quality if the first pass exceeds this.
 */
export async function compressImage(
  file: File,
  maxLongEdge = 1200,
  quality = 0.85,
  maxSizeKB = 800,
): Promise<CompressedImage> {
  // Non-images pass through unchanged
  if (!file.type.startsWith("image/")) {
    return { blob: file as Blob, fileName: file.name };
  }

  try {
    const img = await createImageBitmap(file);
    const w = img.width;
    const h = img.height;
    const scale =
      w > h ? Math.min(1, maxLongEdge / w) : Math.min(1, maxLongEdge / h);

    // Already small enough – return as-is
    if (scale >= 1 && file.size < maxSizeKB * 1024) {
      img.close();
      return { blob: file as Blob, fileName: file.name };
    }

    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      img.close();
      return { blob: file as Blob, fileName: file.name };
    }
    ctx.drawImage(img, 0, 0, cw, ch);
    img.close();

    // First pass
    let blob = await canvasToBlob(canvas, quality);

    // If still too large, retry at progressively lower quality
    if (blob && blob.size > maxSizeKB * 1024) {
      const lowerQuality = Math.max(0.5, quality - 0.15);
      blob = await canvasToBlob(canvas, lowerQuality);
    }

    const outBlob = blob || (file as Blob);
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return { blob: outBlob, fileName: `${base}.jpg` };
  } catch {
    // If anything fails, return original
    return { blob: file as Blob, fileName: file.name };
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
}
