"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/auth-shell";
import { HomeIcon, LogoutIcon, PlusIcon, ReceiptIcon, SlidersIcon, SwapIcon, UsersIcon } from "@/components/icons";
import { m } from "@/components/motion";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationsProvider } from "@/components/notifications/notifications-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import type { User } from "@/lib/api";

type NavItem = { label: string; href: string; icon: typeof HomeIcon };

const NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: HomeIcon },
  { label: "Friends", href: "/dashboard/friends", icon: UsersIcon },
  { label: "Expenses", href: "/dashboard/expenses", icon: ReceiptIcon },
  { label: "Settle up", href: "/dashboard/settle", icon: SwapIcon },
  { label: "Settings", href: "/dashboard/settings", icon: SlidersIcon },
];

// The mobile bar has room for four tabs and the add button between them.
const TABS: NavItem[] = [NAV[0], NAV[1], NAV[3], NAV[4]];

function isActive(href: string, pathname: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

const ADD_HREF = "/dashboard/expenses/new";

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
        active ? "text-fg" : "text-fg-2 hover:text-fg"
      }`}
    >
      {active && (
        <m.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-lg bg-wash/[0.06]"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <span className="relative flex items-center gap-3">
        <Icon width={18} height={18} className={active ? "text-accent-text" : ""} />
        {item.label}
      </span>
    </Link>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-medium outline-none ${
        active ? "text-accent-text" : "text-fg-3"
      }`}
    >
      {active && (
        <m.span
          layoutId="tab-indicator"
          className="absolute -top-2 left-3 right-3 mx-auto h-0.5 w-8 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Icon width={22} height={22} />
      {item.label}
    </Link>
  );
}

export function AppShell(props: { user: User; children: ReactNode }) {
  return (
    <NotificationsProvider>
      <ShellContent {...props} />
    </NotificationsProvider>
  );
}

/**
 * True while a text box has focus. On phones the on-screen keyboard would push the
 * fixed tab bar up over the form, so the bar slides out of the way while typing.
 */
function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") &&
      !["checkbox", "radio", "button", "submit", "file"].includes((el as HTMLInputElement).type);
    const on = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const off = () => setTyping(false);
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    return () => {
      document.removeEventListener("focusin", on);
      document.removeEventListener("focusout", off);
    };
  }, []);
  return typing;
}

function ShellContent({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const typing = useTyping();

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-wash/10 bg-panel px-4 py-5 lg:flex">
        <div className="flex items-center justify-between px-2 pb-6">
          <Logo />
          <div className="flex items-center">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>

        <Link
          href={ADD_HREF}
          className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink outline-none transition hover:brightness-110 focus-visible:ring-4 focus-visible:ring-accent/30 active:scale-[0.98]"
        >
          <PlusIcon width={16} height={16} strokeWidth={2.4} />
          Add expense
        </Link>

        <nav className="flex-1 space-y-1" aria-label="Main">
          {NAV.map((item) => (
            <SideLink key={item.label} item={item} active={isActive(item.href, pathname)} />
          ))}
        </nav>

        <div className="border-t border-wash/10 pt-4">
          <Link
            href="/dashboard/people/me"
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 outline-none transition hover:bg-wash/[0.05] focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <Avatar user={user} className="h-9 w-9 shrink-0 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{user.name}</p>
              <p className="truncate text-xs text-fg-3">@{user.username}</p>
            </div>
          </Link>
          <button
            onClick={onLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-fg-3 outline-none transition hover:bg-wash/[0.05] hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <LogoutIcon width={16} height={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-wash/10 bg-page/80 px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell />
          <Link href="/dashboard/settings" aria-label="Your account" className="rounded-full">
            <Avatar user={user} className="h-9 w-9 text-xs" />
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 min-[400px]:px-5 min-[400px]:pt-8 sm:px-8 lg:ml-64 lg:px-12 lg:pb-16 lg:pt-12">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-wash/10 bg-panel/90 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-xl transition-transform duration-200 lg:hidden ${
          typing ? "translate-y-full" : ""
        }`}
      >
        <ul className="mx-auto flex max-w-md items-end justify-around px-2 pt-2">
          {TABS.slice(0, 2).map((item) => (
            <li key={item.label}>
              <TabLink item={item} active={isActive(item.href, pathname)} />
            </li>
          ))}
          <li className="-mt-6">
            <Link
              href={ADD_HREF}
              aria-label="Add expense"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg shadow-accent/30 ring-4 ring-panel outline-none transition focus-visible:ring-accent/40 active:scale-95"
            >
              <PlusIcon width={26} height={26} strokeWidth={2.2} />
            </Link>
          </li>
          {TABS.slice(2).map((item) => (
            <li key={item.label}>
              <TabLink item={item} active={isActive(item.href, pathname)} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
