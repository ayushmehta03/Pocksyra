"use client";

import { useAuth } from "@/components/auth-provider";
import { CheckIcon, DownloadIcon, PlusIcon, ReceiptIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { formatMoney, greeting } from "@/lib/format";

function StatCard({
  label,
  amount,
  note,
  tone,
}: {
  label: string;
  amount: string;
  note: string;
  tone: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 ${
        dark
          ? "grain bg-ink-950 text-ivory-50 shadow-[0_24px_48px_-24px_rgba(6,16,13,0.7)]"
          : "border border-ivory-300 bg-paper shadow-[0_1px_2px_rgba(6,16,13,0.04)]"
      }`}
    >
      {dark && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/30 blur-[60px]" />
      )}
      <p className={`relative text-[11px] font-semibold uppercase tracking-[0.18em] ${dark ? "text-gold-300" : "text-ink-400"}`}>
        {label}
      </p>
      <p className={`relative mt-4 font-mono text-3xl font-medium tracking-tight ${dark ? "text-ivory-50" : "text-ink-900"}`}>
        {amount}
      </p>
      <p className={`relative mt-2 text-xs ${dark ? "text-ink-300" : "text-ink-400"}`}>{note}</p>
    </div>
  );
}

export default function OverviewPage() {
  const { user } = useAuth();
  if (!user) return null; // layout guarantees a user; this narrows the type

  const cur = user.defaultCurrency;
  const steps = [
    { label: "Create your account", done: true },
    { label: "Set up your profile", done: !!user.name },
    { label: "Add your first friend", done: false },
    { label: "Log your first expense", done: false },
    { label: "Install Pocksyra on your phone", done: false },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title={
          <>
            {greeting()}, <em className="text-jade-700">{user.name.split(" ")[0]}</em>
          </>
        }
        subtitle="Here's where you stand with everyone. Friends and expenses are on the way."
      />

      <section className="grid gap-4 md:grid-cols-3" aria-label="Balances">
        <StatCard label="You owe" amount={formatMoney(0, cur)} note="Nothing to pay back" tone="light" />
        <StatCard label="You're owed" amount={formatMoney(0, cur)} note="No one owes you yet" tone="light" />
        <StatCard label="Net balance" amount={formatMoney(0, cur)} note="All square" tone="dark" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Activity */}
        <section className="lg:col-span-3">
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-ivory-400 bg-paper/60 p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-900 text-gold-300 shadow-[0_14px_30px_-12px_rgba(6,16,13,0.6)]">
              <ReceiptIcon width={28} height={28} />
            </span>
            <h2 className="mt-6 font-display text-3xl text-ink-900">Nothing here yet</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
              Your shared expenses and settle-ups will appear here, newest first.
            </p>
            <button
              disabled
              className="mt-6 inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-ivory-50 opacity-50"
            >
              <PlusIcon width={16} height={16} />
              Add expense
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider">Soon</span>
            </button>
          </div>
        </section>

        {/* Getting started */}
        <section className="lg:col-span-2">
          <div className="rounded-3xl border border-ivory-300 bg-paper p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl text-ink-900">Getting started</h2>
              <span className="font-mono text-xs text-ink-400">
                {doneCount}/{steps.length}
              </span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ivory-200" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-jade-500 to-gold-400 transition-all duration-700"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
            <ul className="mt-5 space-y-3">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      s.done ? "bg-jade-500 text-white" : "border border-ivory-400 text-transparent"
                    }`}
                  >
                    <CheckIcon width={14} height={14} strokeWidth={2.4} />
                  </span>
                  <span className={s.done ? "text-ink-400 line-through decoration-ink-300" : "text-ink-800"}>
                    {s.label}
                  </span>
                  {!s.done && s.label.startsWith("Install") && (
                    <DownloadIcon width={16} height={16} className="ml-auto text-ink-300" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
