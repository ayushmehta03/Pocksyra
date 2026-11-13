// Deterministic numbers for the monthly roast. All maths happens here, in plain
// code: the language model never calculates anything, it only words these facts.
import type { Expense } from "../api.ts";

export type CategoryStat = { id: string; amount: number; count: number; pct: number };
export type MerchantStat = { name: string; amount: number; count: number };

export type Summary = {
  currency: string;
  days: number;
  /** my share of everything in the window, minor units */
  total: number;
  /** what I actually paid out of pocket in the window */
  paid: number;
  count: number;
  perDay: number;
  previousTotal: number;
  /** null when there is nothing in the previous window to compare with */
  changePct: number | null;
  categories: CategoryStat[];
  merchants: MerchantStat[];
  biggest?: { description: string; amount: number; category: string };
  busiestWeekday?: { day: string; amount: number };
  weekendPct: number;
  soloCount: number;
  splitCount: number;
  /** expenses in other currencies that were left out */
  skipped: number;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const myShare = (e: Expense, me: string) => e.splits.find((s) => s.userId === me)?.amount ?? 0;

/**
 * Summarises my last `days` days (rolling, ending today) and compares them with
 * the `days` before. Only my own share counts, so a bill split four ways adds
 * a quarter of itself.
 */
export function buildSummary(expenses: Expense[], me: string, days = 30, now = new Date()): Summary | null {
  const dayStart = (back: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - back).getTime();
  const from = dayStart(days - 1);
  const to = dayStart(-1); // start of tomorrow
  const prevFrom = dayStart(2 * days - 1);

  const mine = expenses.filter((e) => myShare(e, me) > 0);
  const inWindow = mine.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= from && t < to;
  });
  if (inWindow.length === 0) return null;

  // Totals are only meaningful in one currency: use the most common one.
  const counts = new Map<string, number>();
  for (const e of inWindow) counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const rows = inWindow.filter((e) => e.currency === currency);

  const total = rows.reduce((n, e) => n + myShare(e, me), 0);
  const paid = rows.filter((e) => e.paidBy === me).reduce((n, e) => n + e.amount, 0);

  const previousTotal = mine
    .filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= prevFrom && t < from && e.currency === currency;
    })
    .reduce((n, e) => n + myShare(e, me), 0);

  const cat = new Map<string, { amount: number; count: number }>();
  const mer = new Map<string, MerchantStat>();
  const wd = new Array<number>(7).fill(0);
  let biggest: Summary["biggest"];
  let biggestShare = 0;
  let solo = 0;

  for (const e of rows) {
    const s = myShare(e, me);
    const c = cat.get(e.category) ?? { amount: 0, count: 0 };
    cat.set(e.category, { amount: c.amount + s, count: c.count + 1 });

    const name = (e.merchant || e.description).trim();
    const key = name.toLowerCase();
    const m = mer.get(key) ?? { name, amount: 0, count: 0 };
    mer.set(key, { name: m.name, amount: m.amount + s, count: m.count + 1 });

    wd[new Date(e.date).getDay()]! += s;
    if (s > biggestShare) {
      biggestShare = s;
      biggest = { description: e.description, amount: s, category: e.category };
    }
    if (e.splits.length === 1) solo++;
  }

  const busiest = wd.reduce((best, v, i) => (v > wd[best]! ? i : best), 0);

  return {
    currency,
    days,
    total,
    paid,
    count: rows.length,
    perDay: Math.round(total / days),
    previousTotal,
    changePct: previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null,
    categories: [...cat.entries()]
      .map(([id, v]) => ({ id, amount: v.amount, count: v.count, pct: Math.round((v.amount / total) * 100) }))
      .sort((a, b) => b.amount - a.amount),
    merchants: [...mer.values()].sort((a, b) => b.amount - a.amount).slice(0, 3),
    biggest,
    busiestWeekday: wd[busiest]! > 0 ? { day: WEEKDAYS[busiest]!, amount: wd[busiest]! } : undefined,
    weekendPct: Math.round(((wd[0]! + wd[6]!) / total) * 100),
    soloCount: solo,
    splitCount: rows.length - solo,
    skipped: inWindow.length - rows.length,
  };
}
