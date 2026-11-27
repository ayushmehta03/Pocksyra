"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { EmptyState, ListSkeleton } from "@/components/empty-state";
import { CheckIcon, SwapIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { PendingPayments } from "@/components/settle/pending-payments";
import { SettleRow } from "@/components/settle/settle-row";
import { FormError } from "@/components/ui";
import { errorMessage, settlementsApi, type SettlementPage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { useBalances } from "@/lib/use-balances";

export default function SettlePage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useBalances();
  const [history, setHistory] = useState<SettlementPage | null>(null);
  const [historyError, setHistoryError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await settlementsApi.list());
      setHistoryError("");
    } catch (err) {
      setHistoryError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (!user) return null;

  // Payments with one friend that still wait for an answer. "Out" is what I said I paid them;
  // "in" is what they say they paid me.
  const pendingWith = (friendId: string, currency: string) => {
    const mine = (history?.settlements ?? []).filter((s) => s.status === "pending" && s.currency === currency);
    const sum = (list: typeof mine) => list.reduce((total, s) => total + s.amount, 0);
    return {
      out: sum(mine.filter((s) => s.from === user.id && s.to === friendId)),
      in: sum(mine.filter((s) => s.from === friendId && s.to === user.id)),
    };
  };

  const onSettled = async () => {
    await Promise.all([reload(), loadHistory()]);
  };

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Settle up" title="Square things away" subtitle="Paid someone back, or got paid? Record it here and the balance updates." />

      <FormError message={error || historyError} />

      {history && (
        <PendingPayments
          page={history}
          meId={user.id}
          confirm={settlementsApi.confirm}
          decline={settlementsApi.decline}
          cancel={settlementsApi.cancel}
          onChanged={onSettled}
        />
      )}

      <section className="space-y-3" aria-label="Open balances">
        <h2 className="text-sm font-semibold text-ivory-50">Open balances</h2>
        {loading ? (
          <ListSkeleton />
        ) : !data || data.balances.length === 0 ? (
          <EmptyState icon={CheckIcon} title="All settled up" text="Nobody owes anybody anything. Enjoy it while it lasts." />
        ) : (
          <ul className="surface divide-y divide-white/[0.06]">
            {data.balances.map((b) => (
              <SettleRow
                key={`${b.friend.id}-${b.currency}`}
                balance={b}
                pendingOut={pendingWith(b.friend.id, b.currency).out}
                pendingIn={pendingWith(b.friend.id, b.currency).in}
                onSettled={onSettled}
              />
            ))}
          </ul>
        )}
      </section>

      {history && history.settlements.some((s) => s.status !== "pending") && (
        <section className="space-y-3" aria-label="History">
          <h2 className="text-sm font-semibold text-ivory-50">History</h2>
          <ul className="surface divide-y divide-white/[0.06]">
            {history.settlements.filter((s) => s.status !== "pending").map((s) => {
              const iPaid = s.from === user.id;
              const dead = s.status === "declined" || s.status === "cancelled";
              const other = history.people[iPaid ? s.to : s.from];
              return (
                <li key={s.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-ink-300">
                    <SwapIcon width={18} height={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ivory-50">
                      {iPaid ? `You paid ${other?.name ?? "someone"}` : `${other?.name ?? "Someone"} paid you`}
                    </p>
                    <p className="truncate text-xs text-ink-400">
                      {formatDate(s.date)}
                      {s.note && ` · ${s.note}`}
                      {dead && ` · ${s.status === "declined" ? "not received" : "cancelled"}`}
                    </p>
                  </div>
                  <p
                    className={`font-mono text-sm ${
                      dead ? "text-ink-400 line-through" : iPaid ? "text-gold-400" : "text-jade-300"
                    }`}
                  >
                    {formatMoney(s.amount, s.currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
