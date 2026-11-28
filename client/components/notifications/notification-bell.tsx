"use client";

import Link from "next/link";
import { BellIcon } from "@/components/icons";
import { useNotifications } from "./notifications-provider";

/** Bell with an unread badge; opens the notifications page. */
export function NotificationBell({ className = "" }: { className?: string }) {
  const { unread } = useNotifications();
  return (
    <Link
      href="/dashboard/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full text-fg-2 outline-none transition hover:bg-wash/[0.06] hover:text-fg focus-visible:ring-2 focus-visible:ring-jade-400/50 ${className}`}
    >
      <BellIcon width={20} height={20} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-jade-400 px-1 text-[10px] font-bold leading-none text-accent-ink">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
