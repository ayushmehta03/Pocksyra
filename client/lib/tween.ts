/** Starts fast and settles gently; t runs from 0 to 1. */
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
