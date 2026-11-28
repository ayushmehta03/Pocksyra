import type { ReactNode } from "react";
import { LockIcon } from "@/components/icons";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-base font-bold text-accent-ink">
        P
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-fg">Pocksyra</span>
    </div>
  );
}

function Avatar({ children, tone }: { children: string; tone: string }) {
  return (
    <span
      className={`-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-page text-[10px] font-bold first:ml-0 ${tone}`}
    >
      {children}
    </span>
  );
}

/** Decorative product preview. Hidden from assistive tech. */
function HeroCards() {
  return (
    <div className="relative mt-10 h-[330px]" aria-hidden>
      <div
        className="absolute right-0 top-0 w-72 animate-float rounded-2xl border border-wash/10 bg-wash/[0.07] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl"
        style={{ ["--r" as string]: "3deg" }}
      >
        <div className="flex items-center justify-between text-xs text-fg-2">
          <span>Goa trip 🌴</span>
          <span className="rounded-full bg-jade-400/15 px-2 py-0.5 font-medium text-accent-text">4 friends</span>
        </div>
        <p className="mt-4 text-xs uppercase tracking-widest text-fg-3">You&apos;re owed</p>
        <p className="mt-1 font-mono text-3xl font-medium text-accent-text">₹4,250.00</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex">
            <Avatar tone="bg-gold-300 text-accent-ink">A</Avatar>
            <Avatar tone="bg-jade-400 text-accent-ink">R</Avatar>
            <Avatar tone="bg-gold-200 text-accent-ink">S</Avatar>
          </div>
          <span className="text-xs text-fg-2">3 unsettled</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-wash/10">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-jade-500 to-gold-300" />
        </div>
      </div>

      <div
        className="absolute bottom-6 left-0 w-64 animate-float-slow rounded-2xl border border-wash/10 bg-wash/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl"
        style={{ ["--r" as string]: "-3deg" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-fg">Receipt scanned</span>
          <span className="h-2 w-2 rounded-full bg-jade-400 shadow-[0_0_12px_2px_rgba(63,214,163,0.7)]" />
        </div>
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between text-fg-2">
            <span>Toit Brewpub</span>
            <span className="rounded bg-jade-400/15 px-1.5 font-mono text-accent-text">98%</span>
          </div>
          <div className="flex justify-between text-fg-2">
            <span>12 Nov 2026</span>
            <span className="rounded bg-gold-400/15 px-1.5 font-mono text-warn">72%</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-wash/10 pt-2 font-mono text-sm text-fg">
            <span>Total</span>
            <span>₹3,120.00</span>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 right-6 flex animate-float items-center gap-2.5 rounded-full border border-wash/10 bg-panel/70 py-2 pl-2 pr-4 text-xs text-fg shadow-xl backdrop-blur-xl"
        style={{ ["--r" as string]: "1deg" }}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-jade-400 text-[11px] font-bold text-accent-ink">
          ✓
        </span>
        Rohan settled <span className="font-mono text-accent-text">₹850</span>
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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Hero */}
      <aside className="grain relative hidden overflow-hidden border-r border-wash/10 p-12 text-fg lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[520px] w-[520px] animate-aurora rounded-full bg-jade-600/35 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[460px] w-[460px] animate-aurora rounded-full bg-gold-500/20 blur-[120px] [animation-delay:-6s]" />
        <div className="grid-lines pointer-events-none absolute inset-0" />

        <div className="relative">
          <Logo />
        </div>

        <div className="relative">
          <h2 className="text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
            Split the bill,
            <br />
            <span className="text-gradient">not the friendship.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-fg-2">
            Shared expenses, receipt scanning and settle-ups, beautifully simple. Built so the
            awkward part of money between friends disappears.
          </p>
          <HeroCards />
        </div>

        <div className="relative flex items-center gap-2 text-xs text-fg-3">
          <LockIcon width={14} height={14} />
          Receipts are read on your device. They never leave it.
        </div>
      </aside>

      {/* Form */}
      <main className="relative flex items-center justify-center px-6 py-12">
        <div className="relative w-full max-w-[420px] animate-fade-up space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="surface space-y-8 p-7 sm:p-9">
            <div className="space-y-2.5">
              <h1 className="text-3xl font-semibold tracking-tight text-fg">{title}</h1>
              <p className="text-[15px] leading-relaxed text-fg-2">{subtitle}</p>
            </div>
            {children}
          </div>
          <p className="text-center text-xs text-fg-3">{footer}</p>
        </div>
      </main>
    </div>
  );
}
