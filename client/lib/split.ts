import type { SplitMethod } from "@/lib/api";

// Mirrors backend/internal/split so the form can preview exact amounts. The
// server is still the authority and recomputes everything on save.

export type SplitRow = { userId: string; value: number };
export type SplitResult = { ok: true; shares: Map<string, number> } | { ok: false; error: string };

export function computeSplit(total: number, method: SplitMethod, rows: SplitRow[]): SplitResult {
  if (!(total > 0)) return { ok: false, error: "Enter an amount first." };
  if (rows.length === 0) return { ok: false, error: "Pick who is sharing this." };

  if (method === "exact") {
    const sum = rows.reduce((a, r) => a + r.value, 0);
    if (sum !== total) return { ok: false, error: `Amounts are off by ${total - sum} (minor units).` };
    return { ok: true, shares: new Map(rows.map((r) => [r.userId, r.value])) };
  }

  let weights: number[];
  if (method === "equal") weights = rows.map(() => 1);
  else weights = rows.map((r) => r.value);
  if (weights.some((w) => !(w > 0))) return { ok: false, error: "Every person needs a value above zero." };
  const wsum = weights.reduce((a, b) => a + b, 0);
  if (method === "percent" && wsum !== 10000) {
    return { ok: false, error: `Percentages add up to ${(wsum / 100).toFixed(2)}%, not 100%.` };
  }

  // Largest remainder: floors first, then leftover minor units to the biggest remainders.
  const base = weights.map((w) => Math.floor((total * w) / wsum));
  const rem = weights.map((w) => (total * w) % wsum);
  let left = total - base.reduce((a, b) => a + b, 0);
  const order = rows.map((_, i) => i).sort((a, b) => rem[b]! - rem[a]! || a - b);
  for (const i of order) {
    if (left <= 0) break;
    base[i] = base[i]! + 1;
    left -= 1;
  }
  return { ok: true, shares: new Map(rows.map((r, i) => [r.userId, base[i]!])) };
}
