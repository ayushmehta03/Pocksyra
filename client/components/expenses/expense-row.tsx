"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui";
import type { Expense, PublicUser } from "@/lib/api";
import { categoryLabel } from "@/lib/categories";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * One expense in the feed. Shows my net effect up front (what I'm owed or owe
 * for this bill) and expands to the full per-person split.
 */
export function ExpenseRow({
  expense,
  people,
  meId,
  onDelete,
}: {
  expense: Expense;
  people: Record<string, PublicUser>;
  meId: string;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const payer = people[expense.paidBy];
  const iPaid = expense.paidBy === meId;
  const myShare = expense.splits.find((s) => s.userId === meId)?.amount ?? 0;
  // Positive: others owe me for this bill. Negative: I owe the payer.
  const effect = iPaid ? expense.amount - myShare : -myShare;
  const canDelete = expense.createdBy === meId;
  const personal = iPaid && expense.splits.length === 1 && expense.splits[0]!.userId === meId;

  return (
    <li className="px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-jade-400/40"
      >
        {payer ? (
          <Avatar user={iPaid ? { name: "You" } : payer} className="h-11 w-11 shrink-0 text-sm" />
        ) : (
          <span className="h-11 w-11 shrink-0 rounded-full bg-white/[0.07]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ivory-50">{expense.description}</p>
          <p className="truncate text-xs text-ink-400">
            {iPaid ? "You" : (payer?.name ?? "Someone")} paid {formatMoney(expense.amount, expense.currency)} ·{" "}
            {formatDate(expense.date)} · {categoryLabel(expense.category)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-ink-400">
            {personal ? "just you" : effect > 0 ? "you lent" : effect < 0 ? "you owe" : "not involved"}
          </p>
          <p className={`font-mono text-sm font-medium ${effect > 0 ? "text-jade-300" : effect < 0 ? "text-gold-400" : "text-ink-400"}`}>
            {personal ? formatMoney(expense.amount, expense.currency) : effect === 0 ? "—" : formatMoney(Math.abs(effect), expense.currency)}
          </p>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-3 rounded-xl bg-white/[0.03] p-4">
          <ul className="space-y-2">
            {expense.splits.map((s) => {
              const p = people[s.userId];
              return (
                <li key={s.userId} className="flex items-center gap-3 text-sm">
                  <Avatar user={s.userId === meId ? { name: "You" } : (p ?? { name: "?" })} className="h-7 w-7 text-[10px]" />
                  <span className="flex-1 truncate text-ivory-100">{s.userId === meId ? "You" : (p?.name ?? "Someone")}</span>
                  <span className="font-mono text-ink-300">{formatMoney(s.amount, expense.currency)}</span>
                </li>
              );
            })}
          </ul>
          {canDelete &&
            (confirming ? (
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-ink-300">Delete this expense? Balances will be reversed.</span>
                <Button
                  size="sm"
                  variant="danger"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onDelete(expense.id);
                    } finally {
                      setBusy(false);
                      setConfirming(false);
                    }
                  }}
                >
                  Delete
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                  Keep
                </Button>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              </div>
            ))}
        </div>
      )}
    </li>
  );
}
