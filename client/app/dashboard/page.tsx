"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { useAuth } from "@/components/auth-provider";
import { CategoryTile } from "@/components/category-icon";
import { CountUp } from "@/components/count-up";
import { ArrowRightIcon, CheckIcon, DownloadIcon, PlusIcon, ReceiptIcon, ScanIcon, SwapIcon, UserPlusIcon } from "@/components/icons";
import { m, Stagger, StaggerItem } from "@/components/motion";
import { MyLevelCard } from "@/components/profile/my-level-card";
import { InstallCard } from "@/components/pwa/install-card";
import { usePwa } from "@/components/pwa/pwa-provider";
import { PendingNotice } from "@/components/settle/pending-notice";
import { UpiCard } from "@/components/upi/upi-card";
import { formatMoney, formatShortDate, greeting } from "@/lib/format";
import { useBalances } from "@/lib/use-balances";
import { useExpenses } from "@/lib/use-expenses";
import { useFriends } from "@/lib/use-friends";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

function QuickAction({ icon: Icon, title, href }: { icon: IconType; title: string; href: string }) {
  return (
    <Link
      href={href}
      className="surface group flex flex-col items-start gap-3 p-4 outline-none transition hover:border-wash/20 focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.98]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-wash/[0.06] text-fg transition group-hover:bg-accent group-hover:text-accent-ink">
        <Icon width={20} height={20} />
      </span>
      <span className="text-sm font-semibold text-fg">{title}</span>
    </Link>
  );
}

export default function OverviewPage() {
  const { user } = useAuth();
  const { data: friendData } = useFriends();
  const { standalone } = usePwa();
  const { data: balanceData } = useBalances();
  const { expenses: recent, people: recentPeople, loading: recentLoading } = useExpenses({ pageSize: 5 });
  if (!user) return null; // layout guarantees a user; this narrows the type

  const friendCount = friendData?.friends.length ?? 0;
  const incomingCount = friendData?.incoming.length ?? 0;

  const cur = user.defaultCurrency;
  // Currencies are never mixed: the headline uses my default currency.
  const totals = balanceData?.totals.find((t) => t.currency === cur);
  const owe = totals?.owe ?? 0;
  const owed = totals?.owed ?? 0;
  const net = totals?.net ?? 0;
  const otherCurrencies = (balanceData?.totals ?? []).filter((t) => t.currency !== cur && t.net !== 0).length;
  const loaded = balanceData !== null;

  const heroNote = !loaded
    ? "Loading your balances"
    : otherCurrencies > 0
      ? `Plus balances in ${otherCurrencies} other currenc${otherCurrencies > 1 ? "ies" : "y"}`
      : net === 0
        ? "All square"
        : net > 0
          ? "You're ahead overall"
          : "You owe more than you're owed";
  const heroTone = net > 0 ? "text-accent-text" : net < 0 ? "text-warn" : "text-fg";
  const sign = net > 0 ? "+" : net < 0 ? "−" : "";
  // Share of the bar that is "owed to you"; the rest is "you owe".
  const owedShare = owed + owe > 0 ? (owed / (owed + owe)) * 100 : 0;

  const steps = [
    { label: "Sign in with Google", done: true },
    { label: "Set up your profile", done: !!user.name },
    { label: "Add your first friend", done: friendCount > 0 },
    { label: "Log your first expense", done: recent.length > 0 },
    { label: "Install Pocksyra on your phone", done: standalone, install: true },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Stagger className="space-y-8">
      <StaggerItem>
        <p className="text-sm font-medium text-fg-2">{greeting()}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{user.name.split(" ")[0]}</h1>
      </StaggerItem>

      {/* Things that need an answer come first. */}
      <div className="space-y-4 empty:hidden">
        {incomingCount > 0 && (
          <Link
            href="/dashboard/friends"
            className="surface group flex items-center gap-3 px-5 py-4 text-sm text-fg outline-none ring-1 ring-accent/30 transition hover:ring-accent/60 focus-visible:ring-2"
          >
            <span className="num flex h-7 min-w-7 items-center justify-center rounded-full bg-accent px-2 text-xs font-bold text-accent-ink">
              {incomingCount}
            </span>
            {incomingCount === 1 ? "friend request is" : "friend requests are"} waiting for you
            <ArrowRightIcon width={16} height={16} className="ml-auto text-accent-text transition group-hover:translate-x-0.5" />
          </Link>
        )}
        <PendingNotice />
        <UpiCard />
      </div>

      <StaggerItem>
        <section className="surface p-6 sm:p-8" aria-label="Net balance">
          <p className="text-sm font-medium text-fg-2">Net balance</p>
          <p className={`num mt-2 text-5xl font-semibold tracking-tight sm:text-6xl ${heroTone}`}>
            {sign}
            <CountUp value={Math.abs(net)} format={(n) => formatMoney(n, cur)} />
          </p>
          <p className="mt-2 text-sm text-fg-3">{heroNote}</p>

          <div className="mt-7 space-y-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-warn/25" role="presentation">
              <m.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${owedShare}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="flex items-start justify-between gap-4 text-sm">
              <div>
                <p className="flex items-center gap-2 text-fg-2">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  You&apos;re owed
                </p>
                <p className="num mt-1 text-lg font-semibold text-fg">{formatMoney(owed, cur)}</p>
              </div>
              <div className="text-right">
                <p className="flex items-center justify-end gap-2 text-fg-2">
                  You owe
                  <span className="h-2 w-2 rounded-full bg-warn/60" />
                </p>
                <p className="num mt-1 text-lg font-semibold text-fg">{formatMoney(owe, cur)}</p>
              </div>
            </div>
          </div>
        </section>
      </StaggerItem>

      <StaggerItem>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Quick actions">
          <QuickAction icon={PlusIcon} title="Add expense" href="/dashboard/expenses/new" />
          <QuickAction icon={SwapIcon} title="Settle up" href="/dashboard/settle" />
          <QuickAction icon={UserPlusIcon} title="Add friend" href="/dashboard/friends" />
          <QuickAction icon={ScanIcon} title="Scan receipt" href="/dashboard/expenses/new" />
        </section>
      </StaggerItem>

      <StaggerItem>
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-3">
            {!recentLoading && recent.length > 0 ? (
              <div className="surface h-full">
                <div className="flex items-baseline justify-between px-6 pt-6">
                  <h2 className="text-base font-semibold tracking-tight text-fg">Recent expenses</h2>
                  <Link href="/dashboard/expenses" className="text-xs font-medium text-accent-text hover:underline">
                    See all
                  </Link>
                </div>
                <ul className="mt-3 divide-y divide-wash/[0.06]">
                  {recent.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-6 py-3.5">
                      <CategoryTile id={e.category} className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{e.description}</p>
                        <p className="truncate text-xs text-fg-3">
                          {e.paidBy === user.id ? "You" : (recentPeople[e.paidBy]?.name ?? "Someone")} paid · {formatShortDate(e.date)}
                        </p>
                      </div>
                      <p className="num text-sm font-medium text-fg">{formatMoney(e.amount, e.currency)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="surface flex h-full min-h-[280px] flex-col items-center justify-center p-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wash/[0.06] text-fg-2">
                  <ReceiptIcon width={26} height={26} />
                </span>
                <h2 className="mt-5 text-lg font-semibold tracking-tight text-fg">
                  {recentLoading ? "Loading expenses" : "No expenses yet"}
                </h2>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-2">
                  {recentLoading ? "One moment." : "Shared expenses will show up here, newest first."}
                </p>
              </div>
            )}
          </section>

          <div className="space-y-6 lg:col-span-2">
            <MyLevelCard />

            {doneCount < steps.length && (
              <section className="surface p-6" aria-label="Getting started">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base font-semibold tracking-tight text-fg">Getting started</h2>
                  <span className="num text-xs text-fg-3">
                    {doneCount}/{steps.length}
                  </span>
                </div>
                <div
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-wash/10"
                  role="progressbar"
                  aria-valuenow={doneCount}
                  aria-valuemin={0}
                  aria-valuemax={steps.length}
                >
                  <m.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${(doneCount / steps.length) * 100}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <ul className="mt-5 space-y-3.5">
                  {steps.map((s) => (
                    <li key={s.label} className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          s.done ? "bg-accent text-accent-ink" : "border border-wash/20 text-transparent"
                        }`}
                      >
                        <CheckIcon width={14} height={14} strokeWidth={2.6} />
                      </span>
                      <span className={s.done ? "text-fg-3 line-through decoration-fg-4" : "text-fg"}>{s.label}</span>
                      {s.install && <DownloadIcon width={16} height={16} className="ml-auto text-fg-3" />}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <InstallCard />
          </div>
        </div>
      </StaggerItem>
    </Stagger>
  );
}
