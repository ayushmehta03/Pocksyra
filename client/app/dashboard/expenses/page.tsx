"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { CategoryIcon, categoryTone } from "@/components/category-icon";
import { EmptyState, ListSkeleton } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expenses/expense-row";
import { ExpenseSummary, myShare } from "@/components/expenses/expense-summary";
import { PlusIcon, ReceiptIcon, SparkIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Button, FormError } from "@/components/ui";
import { errorMessage, expensesApi, type Expense } from "@/lib/api";
import { categoryLabel } from "@/lib/categories";
import { formatMoney } from "@/lib/format";
import { useExpenses } from "@/lib/use-expenses";

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function dayLabel(key: string): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (key === dayKey(today.toISOString())) return "Today";
  if (key === dayKey(yesterday.toISOString())) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(y === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const { expenses, people, hasMore, loading, loadingMore, error, reload, loadMore } = useExpenses();
  const [actionError, setActionError] = useState("");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  const present = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of expenses) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = expenses.filter(
      (e) =>
        (category === "all" || e.category === category) &&
        (!q || e.description.toLowerCase().includes(q) || (e.merchant ?? "").toLowerCase().includes(q)),
    );
    const byDay = new Map<string, Expense[]>();
    for (const e of shown) {
      const k = dayKey(e.date);
      byDay.set(k, [...(byDay.get(k) ?? []), e]);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [expenses, category, query]);

  if (!user) return null;

  const remove = async (id: string) => {
    setActionError("");
    try {
      await expensesApi.remove(id);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="Expenses" title="Everything you've split" subtitle="Newest first. Tap an expense to see who owes what." />
        <div className="flex gap-2">
          <Link href="/dashboard/insights">
            <Button size="sm" variant="ghost">
              <SparkIcon width={16} height={16} />
              Roast my month
            </Button>
          </Link>
          <Link href="/dashboard/expenses/new">
            <Button size="sm">
              <PlusIcon width={16} height={16} />
              Add expense
            </Button>
          </Link>
        </div>
      </div>

      <FormError message={error || actionError} />

      {loading ? (
        <ListSkeleton />
      ) : expenses.length === 0 ? (
        <EmptyState icon={ReceiptIcon} title="No expenses yet" text="Split your first bill with a friend and it will show up here.">
          <Link href="/dashboard/expenses/new">
            <Button>Add an expense</Button>
          </Link>
        </EmptyState>
      ) : (
        <>
          <ExpenseSummary expenses={expenses} meId={user.id} active={category} onPick={setCategory} />

          <div className="space-y-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search expenses"
              aria-label="Search expenses"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-ivory-50 outline-none placeholder:text-ink-400 focus:border-jade-400/50"
            />
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by category">
              <button
                type="button"
                onClick={() => setCategory("all")}
                aria-pressed={category === "all"}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === "all" ? "bg-ivory-50 text-ink-900" : "bg-white/[0.06] text-ink-300 hover:bg-white/10"
                }`}
              >
                All <span className="font-mono opacity-60">{expenses.length}</span>
              </button>
              {present.map(([id, n]) => {
                const on = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(on ? "all" : id)}
                    aria-pressed={on}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      on ? "bg-ivory-50 text-ink-900" : `${categoryTone(id).chip} hover:brightness-125`
                    }`}
                  >
                    <CategoryIcon id={id} width={14} height={14} />
                    {categoryLabel(id)} <span className="font-mono opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">Nothing matches. Try another category or search.</p>
          ) : (
            <div className="space-y-5">
              {groups.map(([key, items]) => {
                const currency = items[0]!.currency;
                const dayShare = items.filter((e) => e.currency === currency).reduce((n, e) => n + myShare(e, user.id), 0);
                return (
                  <section key={key} aria-label={dayLabel(key)}>
                    <div className="mb-2 flex items-baseline justify-between px-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">{dayLabel(key)}</h2>
                      {dayShare > 0 && <span className="font-mono text-xs text-ink-400">your share {formatMoney(dayShare, currency)}</span>}
                    </div>
                    <ul className="surface divide-y divide-white/[0.06]">
                      {items.map((e) => (
                        <ExpenseRow key={e.id} expense={e} people={people} meId={user.id} onDelete={remove} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="ghost" loading={loadingMore} onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
