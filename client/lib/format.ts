export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Decimal places of a currency's minor unit (2 for INR/USD, 0 for JPY). */
export function minorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Minor units (paise/cents) -> localized currency string. */
export function formatMoney(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  const locale = currency === "INR" ? "en-IN" : undefined;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 10 ** digits);
  } catch {
    return `${(minor / 10 ** digits).toFixed(digits)} ${currency}`;
  }
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}
