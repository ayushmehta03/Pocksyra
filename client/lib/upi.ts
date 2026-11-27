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

export type UpiLinkOptions = { upiId: string; name: string; amount: string; note?: string };

/** The payee and amount part of a UPI link, shared by the generic and per-app links. */
function upiQuery(opts: UpiLinkOptions): string {
  const enc = (v: string) => encodeURIComponent(v);
  const params = [
    `pa=${enc(normalizeUpi(opts.upiId)).replace(/%40/g, "@")}`,
    `pn=${enc(opts.name.trim() || "Pocksyra friend")}`,
    `am=${enc(opts.amount)}`,
    "cu=INR",
  ];
  if (opts.note?.trim()) params.push(`tn=${enc(opts.note.trim().slice(0, 50))}`);
  return params.join("&");
}

/**
 * Builds a UPI payment link (the standard upi://pay deep link). On Android it
 * opens a chooser of the user's UPI apps with the payee and amount filled in.
 * UPI only moves rupees, so the currency is always INR. `amount` is in rupees,
 * e.g. "250.50".
 */
export function buildUpiLink(opts: UpiLinkOptions): string {
  return `upi://pay?${upiQuery(opts)}`;
}

/**
 * iPhones don't show a chooser for upi://, so each app is opened through its
 * own link scheme: the same payment request with a different start.
 */
const IOS_UPI_APPS = [
  { id: "gpay", label: "Google Pay", prefix: "gpay://upi/pay" },
  { id: "phonepe", label: "PhonePe", prefix: "phonepe://pay" },
  { id: "paytm", label: "Paytm", prefix: "paytmmp://pay" },
] as const;

export type UpiAppLink = { id: string; label: string; link: string };

export function buildAppLinks(opts: UpiLinkOptions): UpiAppLink[] {
  const q = upiQuery(opts);
  return IOS_UPI_APPS.map((a) => ({ id: a.id, label: a.label, link: `${a.prefix}?${q}` }));
}

export type PayPlatform = "ios" | "android" | "desktop";

/** Which kind of device this is, for choosing how to offer a UPI payment. */
export function payPlatformFrom(userAgent: string, maxTouchPoints = 0): PayPlatform {
  if (/iPad|iPhone|iPod/.test(userAgent)) return "ios";
  // iPadOS reports itself as a Mac but has a touch screen.
  if (userAgent.includes("Macintosh") && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}
