// Pixel maths for receipt preprocessing. Pure functions, no DOM, so they are testable.

/** RGBA -> grayscale (0-255), one byte per pixel. */
export function toGrayscale(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    out[p] = Math.round(0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!);
  }
  return out;
}

/**
 * Stretches contrast so the darkest 1% maps to black and the lightest 1% to
 * white. Crumpled, dim or faded receipts become much easier for OCR to read.
 * Mutates and returns the input.
 */
export function stretchContrast(gray: Uint8ClampedArray, clip = 0.01): Uint8ClampedArray {
  if (gray.length === 0) return gray;
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]!++;

  const cut = Math.floor(gray.length * clip);
  let lo = 0;
  let seen = 0;
  while (lo < 255 && seen + hist[lo]! <= cut) seen += hist[lo++]!;
  let hi = 255;
  seen = 0;
  while (hi > 0 && seen + hist[hi]! <= cut) seen += hist[hi--]!;

  if (hi - lo < 16) return gray; // nearly flat image: stretching would only amplify noise
  const scale = 255 / (hi - lo);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.max(0, Math.min(255, Math.round((gray[i]! - lo) * scale)));
  }
  return gray;
}

/** Size that fits the longest side into maxSide, never upscaling. */
export function fitSize(w: number, h: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}
