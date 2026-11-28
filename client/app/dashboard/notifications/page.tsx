"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ComponentType, type SVGProps } from "react";
import { EmptyState, ListSkeleton } from "@/components/empty-state";
import { BellIcon, ReceiptIcon, SwapIcon, UserPlusIcon } from "@/components/icons";
import { AnimatePresence, EASE, m } from "@/components/motion";
import { useNotifications } from "@/components/notifications/notifications-provider";
import { PageHeader } from "@/components/page-header";
import { Button, FormError } from "@/components/ui";
import { errorMessage, notificationsApi, type AppNotification } from "@/lib/api";
import { timeAgo } from "@/lib/time-ago";

/** An icon that hints at what the notification is about. */
function iconFor(type: string): ComponentType<SVGProps<SVGSVGElement>> {
  if (type.startsWith("friend_")) return UserPlusIcon;
  if (type === "expense_added") return ReceiptIcon;
  if (type === "payment_reminder") return BellIcon;
  return SwapIcon;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { setUnread, refresh } = useNotifications();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await notificationsApi.list();
      setItems(r.notifications);
      setUnread(r.unread);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
      setItems((cur) => cur ?? []);
    }
  }, [setUnread]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (n: AppNotification) => {
    if (!n.read) {
      // Mark it read on screen straight away; the server catches up behind it.
      setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? cur);
      notificationsApi
        .markRead(n.id)
        .then(() => refresh())
        .catch(() => load());
    }
    if (n.link) router.push(n.link);
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await notificationsApi.markAllRead();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const hasUnread = items?.some((n) => !n.read) ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="Inbox" title="Notifications" subtitle="Friend requests, new expenses and payments that involve you." />
        {hasUnread && (
          <Button variant="ghost" size="sm" loading={busy} onClick={markAll}>
            Mark all as read
          </Button>
        )}
      </div>

      <FormError message={error} />

      {items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={BellIcon} title="Nothing yet" text="When a friend adds an expense, sends a request or pays you, it shows up here." />
      ) : (
        <ul className="surface divide-y divide-wash/[0.06] overflow-hidden">
          <AnimatePresence initial={false}>
            {items.map((n, i) => {
              const Icon = iconFor(n.type);
              return (
                <m.li
                  key={n.id}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE, delay: Math.min(i, 8) * 0.04 }}
                  className={n.read ? "" : "bg-accent/[0.05]"}
                >
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left outline-none transition hover:bg-wash/[0.04] focus-visible:bg-wash/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                  >
                    <span
                      aria-hidden
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        n.read ? "bg-wash/[0.06] text-fg-3" : "bg-accent/10 text-accent-text"
                      }`}
                    >
                      <Icon width={18} height={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-relaxed ${n.read ? "text-fg-2" : "font-medium text-fg"}`}>
                        {n.message}
                      </span>
                      <span className="mt-0.5 block text-xs text-fg-3">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && (
                      <span className="mt-2 flex items-center" role="img" aria-label="Unread">
                        <span className="h-2 w-2 rounded-full bg-accent" />
                      </span>
                    )}
                  </button>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
