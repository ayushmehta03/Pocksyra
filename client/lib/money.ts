import { minorDigits } from "@/lib/format";

/**
 * Parses what a person typed ("12", "12.5", "1,250.75") into integer minor
 * units. Returns null for anything that isn't a clean amount. No floats are
 * involved, so 0.1 + 0.2 style drift can't happen.
 */
export function parseMinor(input: string, currency: string): number | null {
  const digits = minorDigits(currency);
  const clean = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  if (frac.length > digits) return null;
  const minor = Number(whole + frac.padEnd(digits, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Percent text ("33.33") -> basis points (3333). Max 2 decimals. */
export function parseBasisPoints(input: string): number | null {
  const clean = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Minor units -> plain editable text ("1250.50"), no currency symbol. */
export function minorToInput(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  if (digits === 0) return String(minor);
  const s = String(Math.abs(minor)).padStart(digits + 1, "0");
  return `${minor < 0 ? "-" : ""}${s.slice(0, -digits)}.${s.slice(-digits)}`;
}
