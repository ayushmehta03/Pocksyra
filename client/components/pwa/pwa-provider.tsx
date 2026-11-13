"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Chromium fires this before showing its own install UI; not in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PwaContextValue = {
  online: boolean;
  /** running as an installed app (standalone display mode) */
  standalone: boolean;
  /** the browser offered a native install prompt */
  canInstall: boolean;
  /** iOS Safari has no install prompt; show manual instructions instead */
  isIOS: boolean;
  install: () => Promise<boolean>;
};

const PwaContext = createContext<PwaContextValue | null>(null);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1));

    const mq = window.matchMedia("(display-mode: standalone)");
    const syncStandalone = () =>
      setStandalone(mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    syncStandalone();
    mq.addEventListener("change", syncStandalone);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      deferred.current = null;
      setCanInstall(false);
      syncStandalone();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Only in production: a cached dev server makes HMR very confusing.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* offline support is a progressive enhancement */
      });
    }

    return () => {
      mq.removeEventListener("change", syncStandalone);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const evt = deferred.current;
    if (!evt) return false;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferred.current = null;
    setCanInstall(false);
    return outcome === "accepted";
  }, []);

  const value = useMemo(
    () => ({ online, standalone, canInstall, isIOS, install }),
    [online, standalone, canInstall, isIOS, install],
  );
  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa(): PwaContextValue {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa must be used inside <PwaProvider>");
  return ctx;
}
