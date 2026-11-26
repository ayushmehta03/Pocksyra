"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { Button, Field, FormError } from "@/components/ui";
import { errorMessage, newIdempotencyKey, settlementsApi, type FriendBalance } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { minorToInput, parseMinor } from "@/lib/money";
import { buildUpiLink } from "@/lib/upi";

/** A friend I have an open balance with, plus the inline settle-up form. */
export function SettleRow({ balance, onSettled }: { balance: FriendBalance; onSettled: () => Promise<void> }) {
  const { user } = useAuth();
  const { friend, currency, amount, friendUpiId } = balance;
  const theyOweMe = amount > 0;
  const outstanding = Math.abs(amount);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(minorToInput(outstanding, currency));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(newIdempotencyKey());
  const [copied, setCopied] = useState(false);

  // UPI only moves rupees, so the pay button is for INR balances where I owe them.
  const canPayByUpi = !theyOweMe && currency === "INR";
  const payMinor = parseMinor(text, currency);
  const upiLink =
    canPayByUpi && friendUpiId && payMinor
      ? buildUpiLink({
          upiId: friendUpiId,
          name: friend.name,
          amount: minorToInput(payMinor, currency),
          note: note || "Pocksyra settle up",
        })
      : "";

  const copyUpi = async () => {
    if (!friendUpiId) return;
    try {
      await navigator.clipboard.writeText(friendUpiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the ID is on screen to copy by hand */
    }
  };

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
          {canPayByUpi &&
            (friendUpiId ? (
              <div className="space-y-3 rounded-xl border border-jade-400/20 bg-jade-400/[0.06] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-300">
                      {friend.name}&apos;s UPI ID
                    </p>
                    <p className="truncate font-mono text-sm text-ivory-50">{friendUpiId}</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={copyUpi}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                {upiLink ? (
                  <a
                    href={upiLink}
                    className="flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-jade-400 to-jade-500 px-5 py-3 text-sm font-semibold text-ink-950 shadow-[0_10px_30px_-10px_rgba(63,214,163,0.55)] transition hover:from-jade-300 hover:to-jade-400"
                  >
                    Pay {formatMoney(payMinor ?? 0, currency)} with UPI
                  </a>
                ) : (
                  <p className="text-xs text-ink-400">Enter an amount below to get a payment link.</p>
                )}
                <p className="text-xs text-ink-400">
                  The button opens your UPI app on your phone. On a computer, copy the ID and pay from your phone. When
                  the payment goes through, tap Record payment here.
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-white/10 px-4 py-3 text-xs text-ink-300">
                {friend.name} hasn&apos;t added a UPI ID yet. Ask them to add one in Settings, or pay them another way and
                record it here.
              </p>
            ))}
          {theyOweMe && !user?.upiId && (
            <p className="rounded-xl border border-gold-400/25 bg-gold-400/[0.06] px-4 py-3 text-xs text-ink-300">
              Add your UPI ID in{" "}
              <Link href="/dashboard/settings" className="font-medium text-gold-300 underline underline-offset-2">
                Settings
              </Link>{" "}
              so {friend.name} can pay you straight from Pocksyra.
            </p>
          )}
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
