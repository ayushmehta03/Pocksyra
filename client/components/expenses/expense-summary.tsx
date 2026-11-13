"use client";

import { categoryTone } from "@/components/category-icon";
import type { Expense } from "@/lib/api";
import { categoryLabel } from "@/lib/categories";
import { formatMoney } from "@/lib/format";

/** What a user's own share of an expense is (their split, or 0 if not in it). */
export const myShare = (e: Expense, meId: string) => e.splits.find((s) => s.userId === meId)?.amount ?? 0;

/**
 * This month at a glance, worked out from the expenses already loaded:
 * my share, what I paid out, and a bar showing where it went. Clicking a
 * category in the legend filters the list.
 */
export function ExpenseSummary({
  expenses,
  meId,
  active,
  onPick,
}: {
  expenses: Expense[];
  meId: string;
  active: string;
  onPick: (category: string) => void;
}) {
  const now = new Date();
  const thisMonth = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  if (thisMonth.length === 0) return null;

  // Totals only make sense in one currency: use the most common one this month.
  const counts = new Map<string, number>();
  for (const e of thisMonth) counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const rows = thisMonth.filter((e) => e.currency === currency);

  const share = rows.reduce((n, e) => n + myShare(e, meId), 0);
  const paid = rows.filter((e) => e.paidBy === meId).reduce((n, e) => n + e.amount, 0);

  const byCategory = new Map<string, number>();
  for (const e of rows) {
    const s = myShare(e, meId);
    if (s > 0) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + s);
  }
  const cats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <section className="surface space-y-5 p-5" aria-label="This month">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-ink-400">Your share this month</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-ivory-50">{formatMoney(share, currency)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-ink-400">You paid</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-ivory-50">{formatMoney(paid, currency)}</p>
        </div>
      </div>

      {cats.length > 0 && (
        <div className="space-y-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label="Spending by category">
            {cats.map(([id, amount]) => (
              <div key={id} className={categoryTone(id).bar} style={{ width: `${(amount / share) * 100}%` }} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {cats.map(([id, amount]) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onPick(active === id ? "all" : id)}
                  className={`flex items-center gap-1.5 rounded-md text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-jade-400/40 ${
                    active === id ? "text-ivory-50" : "text-ink-300 hover:text-ivory-100"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${categoryTone(id).dot}`} />
                  {categoryLabel(id)}
                  <span className="font-mono text-ink-400">{formatMoney(amount, currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
