"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, Field, FormError } from "@/components/ui";
import { errorMessage, newIdempotencyKey, settlementsApi, type FriendBalance } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { minorToInput, parseMinor } from "@/lib/money";

/** A friend I have an open balance with, plus the inline settle-up form. */
export function SettleRow({ balance, onSettled }: { balance: FriendBalance; onSettled: () => Promise<void> }) {
  const { friend, currency, amount } = balance;
  const theyOweMe = amount > 0;
  const outstanding = Math.abs(amount);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(minorToInput(outstanding, currency));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(newIdempotencyKey());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const minor = parseMinor(text, currency);
    if (!minor) return setError("Enter a valid amount.");
    setBusy(true);
    setError("");
    try {
      await settlementsApi.create(
        {
          withUserId: friend.id,
          // They owe me => they paid me ("received"); I owe them => I paid ("paid").
          direction: theyOweMe ? "received" : "paid",
          amount: minor,
          currency,
          note: note.trim() || undefined,
        },
        key.current,
      );
      key.current = newIdempotencyKey(); // next settlement is a new intent
      setOpen(false);
      await onSettled();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-4">
        <Avatar user={friend} className="h-11 w-11 shrink-0 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ivory-50">{friend.name}</p>
          <p className="truncate text-xs text-ink-400">{theyOweMe ? "owes you" : "you owe them"}</p>
        </div>
        <p className={`font-mono text-sm font-medium ${theyOweMe ? "text-jade-300" : "text-gold-400"}`}>
          {formatMoney(outstanding, currency)}
        </p>
        <Button size="sm" variant={open ? "ghost" : "primary"} onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Settle up"}
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl bg-white/[0.03] p-4" noValidate>
          <p className="text-xs text-ink-300">
            {theyOweMe
              ? `Record that ${friend.name} paid you back.`
              : `Record that you paid ${friend.name}.`}{" "}
            Partial payments are fine.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`Amount (${currency})`}
              inputMode="decimal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="font-mono"
            />
            <Field label="Note (optional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="UPI, cash…" />
          </div>
          <FormError message={error} />
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              Record payment
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
