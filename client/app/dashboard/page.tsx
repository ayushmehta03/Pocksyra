"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  DownloadIcon,
  PlusIcon,
  ReceiptIcon,
  ScanIcon,
  UserPlusIcon,
  WalletIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { MyLevelCard } from "@/components/profile/my-level-card";
import { InstallCard } from "@/components/pwa/install-card";
import { usePwa } from "@/components/pwa/pwa-provider";
import { PendingNotice } from "@/components/settle/pending-notice";
import { UpiCard } from "@/components/upi/upi-card";
import { formatMoney, greeting } from "@/lib/format";
import { useBalances } from "@/lib/use-balances";
import { useExpenses } from "@/lib/use-expenses";
import { useFriends } from "@/lib/use-friends";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

function StatCard({
  label,
  amount,
  note,
  icon: Icon,
  featured = false,
}: {
  label: string;
  amount: string;
  note: string;
  icon: IconType;
  featured?: boolean;
}) {
  return (
    <div
      className={`surface relative overflow-hidden p-6 ${
        featured ? "ring-1 ring-jade-400/25" : ""
      }`}
    >
      {featured && (
        <>
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-jade-500/30 blur-[60px]" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-gold-500/15 blur-[60px]" />
        </>
      )}
      <div className="relative flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-2">{label}</p>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            featured ? "bg-jade-400/15 text-accent-text" : "bg-wash/[0.06] text-fg-2"
          }`}
        >
          <Icon width={18} height={18} />
        </span>
      </div>
      <p
        className={`relative mt-5 font-mono text-3xl font-medium tracking-tight ${
          featured ? "text-gradient" : "text-fg"
        }`}
      >
        {amount}
      </p>
      <p className="relative mt-2 text-xs text-fg-3">{note}</p>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  text,
  href,
}: {
  icon: IconType;
  title: string;
  text: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-jade-400/20 to-gold-400/10 text-accent-text ring-1 ring-wash/10">
        <Icon width={20} height={20} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="truncate text-xs text-fg-3">{text}</p>
      </div>
      {href ? (
        <ArrowRightIcon width={16} height={16} className="ml-auto text-fg-3 transition group-hover:translate-x-0.5 group-hover:text-accent-text" />
      ) : (
        <span className="ml-auto rounded-full border border-wash/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-fg-3">
          Soon
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="surface group relative flex items-center gap-4 p-4 outline-none transition hover:ring-1 hover:ring-jade-400/30 focus-visible:ring-2 focus-visible:ring-jade-400/50"
      >
        {body}
      </Link>
    );
  }
  return (
    <div aria-disabled className="surface group relative flex cursor-not-allowed items-center gap-4 p-4 opacity-70">
      {body}
    </div>
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
  // Currencies are never mixed: headline numbers use my default currency.
  const totals = balanceData?.totals.find((t) => t.currency === cur);
  const owe = totals?.owe ?? 0;
  const owed = totals?.owed ?? 0;
  const net = totals?.net ?? 0;
  const otherCurrencies = (balanceData?.totals ?? []).filter((t) => t.currency !== cur && t.net !== 0).length;
  const steps = [
    { label: "Sign in with Google", done: true },
    { label: "Set up your profile", done: !!user.name },
    { label: "Add your first friend", done: friendCount > 0 },
    { label: "Log your first expense", done: recent.length > 0 },
    { label: "Install Pocksyra on your phone", done: standalone, install: true },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title={
          <>
            {greeting()}, <span className="text-gradient">{user.name.split(" ")[0]}</span>
          </>
        }
        subtitle="Here's where you stand with everyone."
      />

      {incomingCount > 0 && (
        <Link
          href="/dashboard/friends"
          className="surface group flex items-center gap-3 px-5 py-4 text-sm text-fg outline-none ring-1 ring-jade-400/25 transition hover:ring-jade-400/50"
        >
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-jade-400 px-2 font-mono text-xs font-bold text-accent-ink">
            {incomingCount}
          </span>
          {incomingCount === 1 ? "friend request is" : "friend requests are"} waiting for you
          <ArrowRightIcon width={16} height={16} className="ml-auto text-accent-text transition group-hover:translate-x-0.5" />
        </Link>
      )}

      <PendingNotice />

      <UpiCard />
      <MyLevelCard />

      <InstallCard />

      <section className="grid gap-4 md:grid-cols-3" aria-label="Balances">
        <StatCard label="You owe" amount={formatMoney(owe, cur)} note={owe > 0 ? "Across your friends" : "Nothing to pay back"} icon={ArrowUpRightIcon} />
        <StatCard label="You're owed" amount={formatMoney(owed, cur)} note={owed > 0 ? "Waiting to come back" : "No one owes you yet"} icon={ArrowDownLeftIcon} />
        <StatCard
          label="Net balance"
          amount={`${net > 0 ? "+" : net < 0 ? "−" : ""}${formatMoney(Math.abs(net), cur)}`}
          note={otherCurrencies > 0 ? `Plus balances in ${otherCurrencies} other currenc${otherCurrencies > 1 ? "ies" : "y"}` : net === 0 ? "All square" : net > 0 ? "You're ahead" : "You're behind"}
          icon={WalletIcon}
          featured
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Quick actions">
        <QuickAction icon={PlusIcon} title="Add expense" text="Split a bill" href="/dashboard/expenses/new" />
        <QuickAction icon={UserPlusIcon} title="Add friend" text="By email, username or link" href="/dashboard/friends" />
        <QuickAction icon={ScanIcon} title="Scan receipt" text="Read it on-device" href="/dashboard/expenses/new" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          {!recentLoading && recent.length > 0 ? (
            <div className="surface h-full">
              <div className="flex items-baseline justify-between px-6 pt-6">
                <h2 className="text-lg font-semibold tracking-tight text-fg">Recent expenses</h2>
                <Link href="/dashboard/expenses" className="text-xs font-medium text-accent-text hover:underline">
                  See all
                </Link>
              </div>
              <ul className="mt-3 divide-y divide-wash/[0.06]">
                {recent.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-6 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{e.description}</p>
                      <p className="truncate text-xs text-fg-3">
                        {e.paidBy === user.id ? "You" : (recentPeople[e.paidBy]?.name ?? "Someone")} paid
                      </p>
                    </div>
                    <p className="font-mono text-sm text-fg-2">{formatMoney(e.amount, e.currency)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="surface flex h-full min-h-[320px] flex-col items-center justify-center p-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-jade-400/25 to-gold-400/10 text-accent-text ring-1 ring-wash/10">
                <ReceiptIcon width={28} height={28} />
              </span>
              <h2 className="mt-6 text-xl font-semibold tracking-tight text-fg">Nothing here yet</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-2">
                Your shared expenses will appear here, newest first.
              </p>
            </div>
          )}
        </section>

        <section className="lg:col-span-2">
          <div className="surface p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-fg">Getting started</h2>
              <span className="font-mono text-xs text-fg-3">
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
              <div
                className="h-full rounded-full bg-gradient-to-r from-jade-400 to-gold-300 transition-all duration-700"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
            <ul className="mt-5 space-y-3.5">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      s.done ? "bg-jade-400 text-accent-ink" : "border border-wash/15 text-transparent"
                    }`}
                  >
                    <CheckIcon width={14} height={14} strokeWidth={2.6} />
                  </span>
                  <span className={s.done ? "text-fg-3 line-through decoration-fg-4" : "text-fg"}>
                    {s.label}
                  </span>
                  {s.install && <DownloadIcon width={16} height={16} className="ml-auto text-fg-3" />}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
