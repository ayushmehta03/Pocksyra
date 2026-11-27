"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { notificationsApi } from "@/lib/api";

type Value = {
  unread: number;
  /** Re-reads the unread count now (after marking things read, say). */
  refresh: () => Promise<void>;
  setUnread: (n: number) => void;
};

const NotificationsContext = createContext<Value | null>(null);

const POLL_MS = 30_000;

/** Keeps the bell's unread count fresh: on load, every 30s while the tab is visible, and on focus. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setUnread((await notificationsApi.unread()).unread);
    } catch {
      /* a missed poll is fine; the next one will catch up */
    }
  }, []);

  useEffect(() => {
    refresh();
    const tick = () => document.visibilityState === "visible" && refresh();
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const value = useMemo(() => ({ unread, refresh, setUnread }), [unread, refresh]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): Value {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return ctx;
}
