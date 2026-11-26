// UPI IDs (VPAs) look like "name@bank". Keep this in sync with
// backend/internal/auth/upi.go, which is the source of truth.
const UPI_RE = /^[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,31}$/;

/** Trim and lowercase. An empty string means "no UPI ID". */
export function normalizeUpi(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUpi(raw: string): boolean {
  return UPI_RE.test(normalizeUpi(raw));
}

export const UPI_HINT = "Looks like name@bank, for example ayush@okhdfcbank";

/**
 * Builds a UPI payment link (the standard upi://pay deep link). On a phone it
 * opens the user's UPI app with the payee and amount filled in. UPI only moves
 * rupees, so the currency is always INR. `amount` is in rupees, e.g. "250.50".
 */
export function buildUpiLink(opts: { upiId: string; name: string; amount: string; note?: string }): string {
  const enc = (v: string) => encodeURIComponent(v);
  const params = [
    `pa=${enc(normalizeUpi(opts.upiId)).replace(/%40/g, "@")}`,
    `pn=${enc(opts.name.trim() || "Pocksyra friend")}`,
    `am=${enc(opts.amount)}`,
    "cu=INR",
  ];
  if (opts.note?.trim()) params.push(`tn=${enc(opts.note.trim().slice(0, 50))}`);
  return `upi://pay?${params.join("&")}`;
}
