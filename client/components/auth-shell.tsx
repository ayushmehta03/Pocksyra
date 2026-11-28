"use client";

import type { ReactNode } from "react";
import { CategoryTile } from "@/components/category-icon";
import { CountUp } from "@/components/count-up";
import { LockIcon, ReceiptIcon, ScanIcon, SwapIcon } from "@/components/icons";
import { EASE, FadeUp, m } from "@/components/motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatMoney } from "@/lib/format";

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

/** Drifts up and down a few pixels, forever. Stays still for people who asked for less motion. */
function Float({ children, className, seconds = 7 }: { children: ReactNode; className?: string; seconds?: number }) {
  return (
    <m.div
      className={className}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: seconds, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </m.div>
  );
}

const FEATURES = [
  { icon: ReceiptIcon, label: "Split any bill" },
  { icon: ScanIcon, label: "Scan receipts" },
  { icon: SwapIcon, label: "Settle with UPI" },
];

/** A sample of the product, built from the real components. Decorative, so hidden from assistive tech. */
function Preview() {
  return (
    <div className="relative mt-10 max-w-sm" aria-hidden>
      <m.div
        className="surface p-5"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
      >
        <p className="text-xs font-medium text-fg-3">Net balance</p>
        <CountUp
          value={425000}
          format={(n) => `+${formatMoney(n, "INR")}`}
          durationMs={1100}
          className="num mt-1 block font-mono text-4xl font-semibold tracking-tight text-accent-text"
        />
        <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-wash/10">
          <m.div
            className="rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: "82%" }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
          />
          <m.div
            className="rounded-full bg-warn"
            initial={{ width: 0 }}
            animate={{ width: "18%" }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.6 }}
          />
        </div>

        <ul className="mt-5 divide-y divide-wash/[0.08]">
          <li className="flex items-center gap-3 py-3">
            <CategoryTile id="food" className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">Dinner at Toit</p>
              <p className="text-xs text-fg-3">You paid ₹3,120.00</p>
            </div>
            <span className="num font-mono text-sm font-semibold text-accent-text">+₹2,080.00</span>
          </li>
          <li className="flex items-center gap-3 pt-3">
            <CategoryTile id="transport" className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">Cab to the airport</p>
              <p className="text-xs text-fg-3">Rohan paid ₹900.00</p>
            </div>
            <span className="num font-mono text-sm font-semibold text-warn">−₹450.00</span>
          </li>
        </ul>
      </m.div>

      <m.div
        className="absolute -bottom-5 -right-3 sm:-right-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.9 }}
      >
        <Float seconds={6}>
          <div className="flex items-center gap-2.5 rounded-full border border-wash/10 bg-panel py-2 pl-2 pr-4 text-xs text-fg shadow-lg">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
              ✓
            </span>
            Rohan settled <span className="num font-mono font-semibold text-accent-text">₹850</span>
          </div>
        </Float>
      </m.div>

      <m.div
        className="absolute -left-3 -top-4 sm:-left-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 1.1 }}
      >
        <Float seconds={8}>
          <div className="flex items-center gap-2 rounded-full border border-wash/10 bg-panel px-3.5 py-2 text-xs text-fg shadow-lg">
            <ScanIcon width={14} height={14} className="text-accent-text" />
            Receipt scanned <span className="num font-mono font-semibold text-accent-text">98%</span>
          </div>
        </Float>
      </m.div>
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
      <aside className="relative hidden border-r border-wash/10 bg-panel-2 p-12 text-fg lg:flex lg:flex-col lg:justify-between xl:p-16">
        <Logo />

        <div>
          <FadeUp>
            <h2 className="text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
              Split the bill,
              <br />
              <span className="text-accent-text">not the friendship.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-fg-2">
              Shared expenses, receipt scanning and settle-ups, beautifully simple. Built so the awkward part of money
              between friends disappears.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-full bg-wash/[0.06] px-3.5 py-1.5 text-xs font-medium text-fg-2"
                >
                  <Icon width={14} height={14} className="text-accent-text" />
                  {label}
                </li>
              ))}
            </ul>
          </FadeUp>
          <Preview />
        </div>

        <div className="flex items-center gap-2 text-xs text-fg-3">
          <LockIcon width={14} height={14} />
          Receipts are read on your device. They never leave it.
        </div>
      </aside>

      {/* Form */}
      <main className="relative flex items-center justify-center px-6 py-12">
        <ThemeToggle className="absolute right-4 top-4" />
        <FadeUp className="w-full max-w-[420px] space-y-8">
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
        </FadeUp>
      </main>
    </div>
  );
}
