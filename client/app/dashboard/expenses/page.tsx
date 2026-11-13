"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { EmptyState, ListSkeleton } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expenses/expense-row";
import { PlusIcon, ReceiptIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Button, FormError } from "@/components/ui";
import { errorMessage, expensesApi } from "@/lib/api";
import { useExpenses } from "@/lib/use-expenses";
import { useState } from "react";

export default function ExpensesPage() {
  const { user } = useAuth();
  const { expenses, people, hasMore, loading, loadingMore, error, reload, loadMore } = useExpenses();
  const [actionError, setActionError] = useState("");
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="Expenses" title="Everything you've split" subtitle="Newest first. Tap an expense to see who owes what." />
        <Link href="/dashboard/expenses/new">
          <Button size="sm">
            <PlusIcon width={16} height={16} />
            Add expense
          </Button>
        </Link>
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
          <ul className="surface divide-y divide-white/[0.06]">
            {expenses.map((e) => (
              <ExpenseRow key={e.id} expense={e} people={people} meId={user.id} onDelete={remove} />
            ))}
          </ul>
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
