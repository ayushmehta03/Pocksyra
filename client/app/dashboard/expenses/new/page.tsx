"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { PageHeader } from "@/components/page-header";

function NewExpense() {
  const friend = useSearchParams().get("friend") ?? undefined;
  return <ExpenseForm presetFriendId={friend} />;
}

export default function NewExpensePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader eyebrow="New expense" title="Split a bill" subtitle="Add what was spent and who shares it. Pocksyra does the maths to the last paisa." />
      {/* useSearchParams needs a Suspense boundary during static rendering */}
      <Suspense>
        <NewExpense />
      </Suspense>
    </div>
  );
}
