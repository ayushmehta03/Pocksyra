"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { Button, Field, FormError } from "@/components/ui";
import { errorMessage, newIdempotencyKey, settlementsApi, type FriendBalance } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { minorToInput, parseMinor } from "@/lib/money";
import { UpiPayActions } from "@/components/settle/upi-pay-actions";

/** A friend I have an open balance with, plus the inline settle-up form. */
export function SettleRow({
  balance,
  pendingOut = 0,
  pendingIn = 0,
  onSettled,
}: {
  balance: FriendBalance;
  /** Amount I've said I paid this friend that is still waiting for their confirmation. */
  pendingOut?: number;
  /** Amount this friend says they paid me that is still waiting for my confirmation. */
  pendingIn?: number;
  onSettled: () => Promise<void>;
}) {
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
  const waiting = pendingOut > 0 || pendingIn > 0;

  // UPI only moves rupees, so the pay button is for INR balances where I owe them.
  const canPayByUpi = !theyOweMe && currency === "INR";
  const payMinor = parseMinor(text, currency);
  const upiOpts =
    canPayByUpi && friendUpiId && payMinor
      ? {
          upiId: friendUpiId,
          name: friend.name,
          amount: minorToInput(payMinor, currency),
          note: note || "Pocksyra settle up",
        }
      : null;

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
          // A payment I made only counts once they confirm they received it.
          needsConfirmation: !theyOweMe,
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
          <p className="truncate text-sm font-semibold text-fg">{friend.name}</p>
          <p className="truncate text-xs text-fg-3">{theyOweMe ? "owes you" : "you owe them"}</p>
          {pendingOut > 0 && (
            <p className="truncate text-xs text-warn">
              {formatMoney(pendingOut, currency)} waiting for {friend.name} to confirm
            </p>
          )}
          {pendingIn > 0 && (
            <p className="truncate text-xs text-warn">
              {friend.name} says they paid {formatMoney(pendingIn, currency)}. Confirm it above.
            </p>
          )}
        </div>
        <p className={`font-mono text-sm font-medium ${theyOweMe ? "text-accent-text" : "text-warn"}`}>
          {formatMoney(outstanding, currency)}
        </p>
        {waiting ? (
          // A payment between us is waiting for an answer. Settling again now would double-count it,
          // so this stays off until it is confirmed, declined or cancelled.
          <Button size="sm" variant="ghost" disabled>
            Pending
          </Button>
        ) : (
          <Button size="sm" variant={open ? "ghost" : "primary"} onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Settle up"}
          </Button>
        )}
      </div>

      {open && !waiting && (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl bg-wash/[0.03] p-4" noValidate>
          <p className="text-xs text-fg-2">
            {theyOweMe
              ? `Record that ${friend.name} paid you back.`
              : `Tell ${friend.name} you've paid. They'll be asked to confirm, and your balance changes once they do.`}{" "}
            Partial payments are fine.
          </p>
          {canPayByUpi &&
            (friendUpiId ? (
              <div className="space-y-3 rounded-xl border border-jade-400/20 bg-jade-400/[0.06] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-2">
                      {friend.name}&apos;s UPI ID
                    </p>
                    <p className="truncate font-mono text-sm text-fg">{friendUpiId}</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={copyUpi}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                {upiOpts ? (
                  <UpiPayActions opts={upiOpts} amountLabel={formatMoney(payMinor ?? 0, currency)} />
                ) : (
                  <p className="text-xs text-fg-3">Enter an amount below to get a payment link.</p>
                )}
                <p className="text-xs text-fg-3">When the payment goes through, tap I&apos;ve paid below.</p>
              </div>
            ) : (
              <p className="rounded-xl border border-wash/10 px-4 py-3 text-xs text-fg-2">
                {friend.name} hasn&apos;t added a UPI ID yet. Ask them to add one in Settings, or pay them another way and
                record it here.
              </p>
            ))}
          {theyOweMe && !user?.upiId && (
            <p className="rounded-xl border border-gold-400/25 bg-gold-400/[0.06] px-4 py-3 text-xs text-fg-2">
              Add your UPI ID in{" "}
              <Link href="/dashboard/settings" className="font-medium text-warn underline underline-offset-2">
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
              {theyOweMe ? "Record payment" : "I've paid"}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
