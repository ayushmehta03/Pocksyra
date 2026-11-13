"use client";

import type { ComponentType, SVGProps } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  ArrowDownLeftIcon,
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
import { formatMoney, greeting } from "@/lib/format";

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
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-300">{label}</p>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            featured ? "bg-jade-400/15 text-jade-300" : "bg-white/[0.06] text-ink-300"
          }`}
        >
          <Icon width={18} height={18} />
        </span>
      </div>
      <p
        className={`relative mt-5 font-mono text-3xl font-medium tracking-tight ${
          featured ? "text-gradient" : "text-ivory-50"
        }`}
      >
        {amount}
      </p>
      <p className="relative mt-2 text-xs text-ink-400">{note}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, title, text }: { icon: IconType; title: string; text: string }) {
  return (
    <div
      aria-disabled
      className="surface group relative flex cursor-not-allowed items-center gap-4 p-4 opacity-70 transition hover:opacity-90"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-jade-400/20 to-gold-400/10 text-jade-300 ring-1 ring-white/10">
        <Icon width={20} height={20} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ivory-50">{title}</p>
        <p className="truncate text-xs text-ink-400">{text}</p>
      </div>
      <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
        Soon
      </span>
    </div>
  );
}

export default function OverviewPage() {
  const { user } = useAuth();
  if (!user) return null; // layout guarantees a user; this narrows the type

  const cur = user.defaultCurrency;
  const steps = [
    { label: "Sign in with Google", done: true },
    { label: "Set up your profile", done: !!user.name },
    { label: "Add your first friend", done: false },
    { label: "Log your first expense", done: false },
    { label: "Install Pocksyra on your phone", done: false, install: true },
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
        subtitle="Here's where you stand with everyone. Friends and expenses are on the way."
      />

      <section className="grid gap-4 md:grid-cols-3" aria-label="Balances">
        <StatCard label="You owe" amount={formatMoney(0, cur)} note="Nothing to pay back" icon={ArrowUpRightIcon} />
        <StatCard label="You're owed" amount={formatMoney(0, cur)} note="No one owes you yet" icon={ArrowDownLeftIcon} />
        <StatCard label="Net balance" amount={formatMoney(0, cur)} note="All square" icon={WalletIcon} featured />
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Quick actions">
        <QuickAction icon={PlusIcon} title="Add expense" text="Split a bill" />
        <QuickAction icon={UserPlusIcon} title="Add friend" text="By email or link" />
        <QuickAction icon={ScanIcon} title="Scan receipt" text="Read it on-device" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="surface flex h-full min-h-[320px] flex-col items-center justify-center p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-jade-400/25 to-gold-400/10 text-jade-300 ring-1 ring-white/10">
              <ReceiptIcon width={28} height={28} />
            </span>
            <h2 className="mt-6 text-xl font-semibold tracking-tight text-ivory-50">Nothing here yet</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-300">
              Your shared expenses and settle-ups will appear here, newest first.
            </p>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="surface p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-ivory-50">Getting started</h2>
              <span className="font-mono text-xs text-ink-400">
                {doneCount}/{steps.length}
              </span>
            </div>
            <div
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"
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
                      s.done ? "bg-jade-400 text-ink-950" : "border border-white/15 text-transparent"
                    }`}
                  >
                    <CheckIcon width={14} height={14} strokeWidth={2.6} />
                  </span>
                  <span className={s.done ? "text-ink-400 line-through decoration-ink-500" : "text-ivory-100"}>
                    {s.label}
                  </span>
                  {s.install && <DownloadIcon width={16} height={16} className="ml-auto text-ink-400" />}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
