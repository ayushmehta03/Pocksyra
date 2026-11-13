"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/auth-shell";
import {
  HomeIcon,
  LogoutIcon,
  PlusIcon,
  ReceiptIcon,
  SlidersIcon,
  SwapIcon,
  UsersIcon,
} from "@/components/icons";
import type { User } from "@/lib/api";

type NavItem = { label: string; href?: string; icon: typeof HomeIcon };

// Items without an href are on the roadmap and render as "Soon".
const NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: HomeIcon },
  { label: "Friends", href: "/dashboard/friends", icon: UsersIcon },
  { label: "Expenses", icon: ReceiptIcon },
  { label: "Settle up", icon: SwapIcon },
  { label: "Settings", href: "/dashboard/settings", icon: SlidersIcon },
];

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const base = "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition";
  if (!item.href) {
    return (
      <span aria-disabled className={`${base} cursor-not-allowed text-ink-400/60`}>
        <Icon />
        {item.label}
        <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
          Soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${base} ${
        active
          ? "bg-white/[0.07] text-ivory-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          : "text-ink-300 hover:bg-white/[0.04] hover:text-ivory-50"
      }`}
    >
      {active && <span className="absolute left-0 top-2.5 h-[calc(100%-1.25rem)] w-0.5 rounded-full bg-jade-400" />}
      <Icon className={active ? "text-jade-300" : ""} />
      {item.label}
    </Link>
  );
}

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="grain fixed inset-y-0 left-0 z-20 hidden w-72 flex-col overflow-hidden border-r border-white/10 bg-ink-950/70 p-6 backdrop-blur-2xl lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-jade-600/25 blur-[90px]" />
        <div className="relative px-1.5 pb-8 pt-1">
          <Logo />
        </div>

        <nav className="relative flex-1 space-y-1" aria-label="Main">
          {NAV.map((item) => (
            <SideLink key={item.label} item={item} active={item.href === pathname} />
          ))}
        </nav>

        <div className="surface relative !rounded-2xl p-3.5">
          <div className="flex items-center gap-3">
            <Avatar user={user} className="h-10 w-10 shrink-0 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ivory-50">{user.name}</p>
              <p className="truncate text-xs text-ink-400">@{user.username}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-ink-300 transition hover:bg-white/[0.06] hover:text-ivory-50"
          >
            <LogoutIcon width={16} height={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-ink-950/75 px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
        <Logo />
        <button onClick={onLogout} aria-label="Log out" className="rounded-full">
          <Avatar user={user} className="h-9 w-9 text-xs" />
        </button>
      </header>

      <main className="px-5 pb-32 pt-8 sm:px-8 lg:ml-72 lg:px-12 lg:pb-16 lg:pt-12">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-md items-end justify-around px-2 pt-2">
          {[NAV[0], NAV[1], "add" as const, NAV[3], NAV[4]].map((item, i) => {
            if (item === "add") {
              return (
                <li key="add" className="-mt-6">
                  <span
                    aria-disabled
                    aria-label="Add expense (coming soon)"
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-jade-300 to-jade-500 text-ink-950 opacity-60 shadow-[0_10px_30px_-6px_rgba(25,184,135,0.7)] ring-4 ring-ink-950"
                  >
                    <PlusIcon width={26} height={26} strokeWidth={2.2} />
                  </span>
                </li>
              );
            }
            const Icon = item.icon;
            const active = item.href === pathname;
            const cls = `flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-medium ${
              active ? "text-jade-300" : item.href ? "text-ink-300" : "text-ink-400/50"
            }`;
            return (
              <li key={item.label + i}>
                {item.href ? (
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={cls}>
                    <Icon />
                    {item.label}
                  </Link>
                ) : (
                  <span aria-disabled className={cls}>
                    <Icon />
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
