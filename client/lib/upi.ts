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
