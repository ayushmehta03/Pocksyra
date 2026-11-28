"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { CategoryIcon, categoryTone } from "@/components/category-icon";
import { EmptyState, ListSkeleton } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expenses/expense-row";
import { ExpenseSummary, myShare } from "@/components/expenses/expense-summary";
import { PlusIcon, ReceiptIcon, SearchIcon, SparkIcon } from "@/components/icons";
import { EASE, FadeUp, m } from "@/components/motion";
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
          <FadeUp>
            <ExpenseSummary expenses={expenses} meId={user.id} active={category} onPick={setCategory} />
          </FadeUp>

          <div className="space-y-3">
            <div className="relative">
              <SearchIcon width={16} height={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search expenses"
                aria-label="Search expenses"
                className="w-full rounded-xl border border-wash/10 bg-panel-2 py-2.5 pl-10 pr-4 text-sm text-fg outline-none transition placeholder:text-fg-3 focus:border-accent focus:ring-4 focus:ring-accent/20"
              />
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by category">
              <button
                type="button"
                onClick={() => setCategory("all")}
                aria-pressed={category === "all"}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  category === "all" ? "bg-fg text-page" : "bg-wash/[0.06] text-fg-2 hover:bg-wash/10"
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
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
                      on ? "bg-fg text-page" : `${categoryTone(id).chip} hover:brightness-95 dark:hover:brightness-125`
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
            <p className="py-10 text-center text-sm text-fg-3">Nothing matches. Try another category or search.</p>
          ) : (
            <div className="space-y-6">
              {groups.map(([key, items], gi) => {
                const currency = items[0]!.currency;
                const dayShare = items.filter((e) => e.currency === currency).reduce((n, e) => n + myShare(e, user.id), 0);
                return (
                  <m.section
                    key={key}
                    aria-label={dayLabel(key)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: Math.min(gi, 6) * 0.05 }}
                  >
                    <div className="mb-2 flex items-baseline justify-between px-1">
                      <h2 className="text-sm font-semibold text-fg">{dayLabel(key)}</h2>
                      {dayShare > 0 && <span className="num font-mono text-xs text-fg-3">your share {formatMoney(dayShare, currency)}</span>}
                    </div>
                    <ul className="surface divide-y divide-wash/[0.06] overflow-hidden">
                      {items.map((e) => (
                        <ExpenseRow key={e.id} expense={e} people={people} meId={user.id} onDelete={remove} />
                      ))}
                    </ul>
                  </m.section>
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
