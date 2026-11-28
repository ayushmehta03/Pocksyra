"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { CategoryTile } from "@/components/category-icon";
import { ChevronDownIcon } from "@/components/icons";
import { AnimatePresence, EASE, m } from "@/components/motion";
import { Button } from "@/components/ui";
import type { Expense, PublicUser } from "@/lib/api";
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

  const tone = effect > 0 ? "text-accent-text" : effect < 0 ? "text-warn" : "text-fg-3";
  const amountText = personal
    ? formatMoney(expense.amount, expense.currency)
    : effect === 0
      ? "—"
      : `${effect > 0 ? "+" : "−"}${formatMoney(Math.abs(effect), expense.currency)}`;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left outline-none transition-colors hover:bg-wash/[0.03] focus-visible:bg-wash/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
      >
        <CategoryTile id={expense.category} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{expense.description}</p>
          <p className="truncate text-xs text-fg-3">
            {iPaid ? "You" : (payer?.name ?? "Someone")} paid {formatMoney(expense.amount, expense.currency)} · {formatDate(expense.date)}
          </p>
        </div>
        <div className="text-right">
          <p className={`num font-mono text-sm font-semibold ${tone}`}>{amountText}</p>
          <p className="text-[11px] text-fg-3">
            {personal ? "just you" : effect > 0 ? "you lent" : effect < 0 ? "you owe" : "not involved"}
          </p>
        </div>
        <m.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease: EASE }} className="text-fg-3">
          <ChevronDownIcon width={16} height={16} />
        </m.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mx-5 mb-4 space-y-3 rounded-xl bg-wash/[0.04] p-4">
              <ul className="space-y-2.5">
                {expense.splits.map((s) => {
                  const p = people[s.userId];
                  return (
                    <li key={s.userId} className="flex items-center gap-3 text-sm">
                      <Avatar user={s.userId === meId ? { name: "You" } : (p ?? { name: "?" })} className="h-7 w-7 text-[10px]" />
                      <span className="flex-1 truncate text-fg">{s.userId === meId ? "You" : (p?.name ?? "Someone")}</span>
                      <span className="num font-mono text-fg-2">{formatMoney(s.amount, expense.currency)}</span>
                    </li>
                  );
                })}
              </ul>
              {canDelete &&
                (confirming ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-xs text-fg-2">Delete this expense? Balances will be reversed.</span>
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
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}
