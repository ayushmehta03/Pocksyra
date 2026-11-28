"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { EmptyState, ListSkeleton } from "@/components/empty-state";
import { ArrowDownLeftIcon, ArrowUpRightIcon, CheckIcon } from "@/components/icons";
import { Stagger, StaggerItem } from "@/components/motion";
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

  const cur = user.defaultCurrency;
  const totals = data?.totals.find((t) => t.currency === cur);

  const onSettled = async () => {
    await Promise.all([reload(), loadHistory()]);
  };

  return (
    <Stagger className="space-y-8">
      <StaggerItem>
        <PageHeader eyebrow="Settle up" title="Square things away" subtitle="Paid someone back, or got paid? Record it here and the balance updates." />
      </StaggerItem>

      <FormError message={error || historyError} />

      {totals && (totals.owe > 0 || totals.owed > 0) && (
        <StaggerItem>
          <div className="grid grid-cols-2 gap-3">
            <div className="surface p-4">
              <p className="text-xs font-medium text-fg-3">You owe</p>
              <p className="num mt-1 font-mono text-xl font-semibold text-warn sm:text-2xl">{formatMoney(totals.owe, cur)}</p>
            </div>
            <div className="surface p-4">
              <p className="text-xs font-medium text-fg-3">You&apos;re owed</p>
              <p className="num mt-1 font-mono text-xl font-semibold text-accent-text sm:text-2xl">{formatMoney(totals.owed, cur)}</p>
            </div>
          </div>
        </StaggerItem>
      )}

      {history && history.settlements.some((x) => x.status === "pending") && (
        <StaggerItem>
          <PendingPayments
            page={history}
            meId={user.id}
            confirm={settlementsApi.confirm}
            decline={settlementsApi.decline}
            cancel={settlementsApi.cancel}
            onChanged={onSettled}
          />
        </StaggerItem>
      )}

      <StaggerItem>
      <section className="space-y-3" aria-label="Open balances">
        <h2 className="text-sm font-semibold text-fg">Open balances</h2>
        {loading ? (
          <ListSkeleton />
        ) : !data || data.balances.length === 0 ? (
          <EmptyState icon={CheckIcon} title="All settled up" text="Nobody owes anybody anything. Enjoy it while it lasts." />
        ) : (
          <ul className="surface divide-y divide-wash/[0.06] overflow-hidden">
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
      </StaggerItem>

      {history && history.settlements.some((s) => s.status !== "pending") && (
        <StaggerItem>
        <section className="space-y-3" aria-label="History">
          <h2 className="text-sm font-semibold text-fg">History</h2>
          <ul className="surface divide-y divide-wash/[0.06]">
            {history.settlements.filter((s) => s.status !== "pending").map((s) => {
              const iPaid = s.from === user.id;
              const dead = s.status === "declined" || s.status === "cancelled";
              const other = history.people[iPaid ? s.to : s.from];
              return (
                <li key={s.id} className="flex items-center gap-4 px-5 py-4">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      dead ? "bg-wash/[0.06] text-fg-3" : iPaid ? "bg-warn/10 text-warn" : "bg-accent/10 text-accent-text"
                    }`}
                  >
                    {iPaid ? <ArrowUpRightIcon width={18} height={18} /> : <ArrowDownLeftIcon width={18} height={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">
                      {iPaid ? `You paid ${other?.name ?? "someone"}` : `${other?.name ?? "Someone"} paid you`}
                    </p>
                    <p className="truncate text-xs text-fg-3">
                      {formatDate(s.date)}
                      {s.note && ` · ${s.note}`}
                      {dead && ` · ${s.status === "declined" ? "not received" : "cancelled"}`}
                    </p>
                  </div>
                  <p
                    className={`num font-mono text-sm font-medium ${
                      dead ? "text-fg-3 line-through" : iPaid ? "text-warn" : "text-accent-text"
                    }`}
                  >
                    {formatMoney(s.amount, s.currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
        </StaggerItem>
      )}
    </Stagger>
  );
}
