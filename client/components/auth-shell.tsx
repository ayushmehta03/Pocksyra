import type { ReactNode } from "react";
import { LockIcon } from "@/components/icons";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl font-display text-2xl leading-none ${
          light
            ? "bg-gradient-to-br from-jade-300 to-jade-600 text-ink-950"
            : "bg-ink-900 text-gold-300"
        }`}
      >
        P
      </span>
      <span
        className={`font-display text-2xl tracking-tight ${light ? "text-ivory-50" : "text-ink-900"}`}
      >
        Pocksyra
      </span>
    </div>
  );
}

function Avatar({ children, tone }: { children: string; tone: string }) {
  return (
    <span
      className={`-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink-800 text-[10px] font-bold first:ml-0 ${tone}`}
    >
      {children}
    </span>
  );
}

/** Decorative product preview. Hidden from assistive tech. */
function HeroCards() {
  return (
    <div className="relative mt-10 h-[330px]" aria-hidden>
      {/* balance card */}
      <div
        className="absolute right-0 top-0 w-72 animate-float rounded-2xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl"
        style={{ ["--r" as string]: "3deg" }}
      >
        <div className="flex items-center justify-between text-xs text-ink-300">
          <span>Goa trip 🌴</span>
          <span className="rounded-full bg-jade-400/15 px-2 py-0.5 font-medium text-jade-300">4 friends</span>
        </div>
        <p className="mt-4 text-xs uppercase tracking-widest text-ink-400">You&apos;re owed</p>
        <p className="mt-1 font-mono text-3xl font-medium text-jade-300">₹4,250.00</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex">
            <Avatar tone="bg-gold-300 text-ink-950">A</Avatar>
            <Avatar tone="bg-jade-400 text-ink-950">R</Avatar>
            <Avatar tone="bg-ivory-200 text-ink-950">S</Avatar>
          </div>
          <span className="text-xs text-ink-300">3 unsettled</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-jade-500 to-gold-300" />
        </div>
      </div>

      {/* receipt card */}
      <div
        className="absolute bottom-6 left-0 w-64 animate-float-slow rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl"
        style={{ ["--r" as string]: "-3deg" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ivory-200">Receipt scanned</span>
          <span className="h-2 w-2 rounded-full bg-jade-400 shadow-[0_0_12px_2px_rgba(63,214,163,0.7)]" />
        </div>
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between text-ink-300">
            <span>Toit Brewpub</span>
            <span className="rounded bg-jade-400/15 px-1.5 font-mono text-jade-300">98%</span>
          </div>
          <div className="flex justify-between text-ink-300">
            <span>12 Nov 2026</span>
            <span className="rounded bg-gold-400/15 px-1.5 font-mono text-gold-300">72%</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-mono text-sm text-ivory-50">
            <span>Total</span>
            <span>₹3,120.00</span>
          </div>
        </div>
      </div>

      {/* settled pill */}
      <div
        className="absolute bottom-0 right-6 flex animate-float items-center gap-2.5 rounded-full border border-white/10 bg-ink-900/70 py-2 pl-2 pr-4 text-xs text-ivory-200 shadow-xl backdrop-blur-xl"
        style={{ ["--r" as string]: "1deg" }}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-jade-400 text-[11px] font-bold text-ink-950">
          ✓
        </span>
        Rohan settled <span className="font-mono text-jade-300">₹850</span>
      </div>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Hero */}
      <aside className="grain relative hidden overflow-hidden bg-ink-950 p-12 text-ivory-50 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[520px] w-[520px] animate-aurora rounded-full bg-jade-600/40 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[460px] w-[460px] animate-aurora rounded-full bg-gold-500/25 blur-[120px] [animation-delay:-6s]" />
        <div className="grid-lines pointer-events-none absolute inset-0" />

        <div className="relative">
          <Logo light />
        </div>

        <div className="relative">
          <h2 className="font-display text-5xl leading-[1.04] tracking-tight xl:text-6xl">
            Split the bill,
            <br />
            <em className="text-gold-300">not the friendship.</em>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-300">
            Shared expenses, receipt scanning and settle-ups, beautifully simple. Built so the
            awkward part of money between friends disappears.
          </p>
          <HeroCards />
        </div>

        <div className="relative flex items-center gap-2 text-xs text-ink-400">
          <LockIcon width={14} height={14} />
          Receipts are read on your device. They never leave it.
        </div>
      </aside>

      {/* Form */}
      <main className="relative flex items-center justify-center bg-ivory-100 px-6 py-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-ivory-200/70 to-transparent" />
        <div className="relative w-full max-w-[400px] animate-fade-up space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-2.5">
            <h1 className="font-display text-4xl tracking-tight text-ink-900">{title}</h1>
            <p className="text-[15px] text-ink-500">{subtitle}</p>
          </div>
          {children}
          <p className="text-center text-sm text-ink-500">{footer}</p>
        </div>
      </main>
    </div>
  );
}
