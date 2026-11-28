"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, FormError } from "@/components/ui";
import { errorMessage, type Settlement, type SettlementPage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";

type Action = (id: string) => Promise<unknown>;

/** One pending payment with its buttons. Handles its own busy and error state. */
function PendingRow({
  s,
  page,
  incoming,
  actions,
  onChanged,
}: {
  s: Settlement;
  page: SettlementPage;
  incoming: boolean;
  actions: { label: string; run: Action; variant?: "primary" | "ghost" }[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const other = page.people[incoming ? s.from : s.to];

  const run = async (label: string, fn: Action) => {
    setBusy(label);
    setError("");
    try {
      await fn(s.id);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
      setBusy("");
    }
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        {other && <Avatar user={other} className="h-11 w-11 shrink-0 text-sm" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">
            {incoming
              ? `${other?.name ?? "A friend"} says they paid you`
              : `Waiting for ${other?.name ?? "your friend"} to confirm`}
          </p>
          <p className="truncate text-xs text-fg-3">
            {formatDate(s.date)}
            {s.note && ` · ${s.note}`}
          </p>
        </div>
        <p className="font-mono text-sm font-medium text-fg">{formatMoney(s.amount, s.currency)}</p>
        <div className="flex gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.variant ?? "primary"}
              loading={busy === a.label}
              disabled={!!busy}
              onClick={() => run(a.label, a.run)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}
    </li>
  );
}

/**
 * Payments that don't count yet. The ones where I'm the receiver need my answer;
 * the ones I made are waiting on the other person and I can withdraw them.
 */
export function PendingPayments({
  page,
  meId,
  confirm,
  decline,
  cancel,
  onChanged,
}: {
  page: SettlementPage;
  meId: string;
  confirm: Action;
  decline: Action;
  cancel: Action;
  onChanged: () => Promise<void>;
}) {
  const pending = page.settlements.filter((s) => s.status === "pending");
  const incoming = pending.filter((s) => s.to === meId);
  const outgoing = pending.filter((s) => s.from === meId);
  if (pending.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Payments waiting for confirmation">
      <h2 className="text-sm font-semibold text-fg">Waiting for confirmation</h2>
      <ul className="surface divide-y divide-wash/[0.06]">
        {incoming.map((s) => (
          <PendingRow
            key={s.id}
            s={s}
            page={page}
            incoming
            onChanged={onChanged}
            actions={[
              { label: "Got it", run: confirm },
              { label: "Not received", run: decline, variant: "ghost" },
            ]}
          />
        ))}
        {outgoing.map((s) => (
          <PendingRow
            key={s.id}
            s={s}
            page={page}
            incoming={false}
            onChanged={onChanged}
            actions={[{ label: "Cancel", run: cancel, variant: "ghost" }]}
          />
        ))}
      </ul>
      {incoming.length > 0 && (
        <p className="text-xs text-fg-3">
          Tap Got it only once the money is in your account. The balance changes when you do.
        </p>
      )}
    </section>
  );
}
