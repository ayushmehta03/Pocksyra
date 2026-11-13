"use client";

import { useEffect, useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { usePwa } from "./pwa-provider";

const DISMISS_KEY = "pocksyra.install.dismissed";

export function InstallCard() {
  const { standalone, canInstall, isIOS, install } = usePwa();
  const [dismissed, setDismissed] = useState(true); // hidden until storage is read (no flash)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (standalone || dismissed || (!canInstall && !isIOS)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked */
    }
  };

  return (
    <div className="surface relative flex flex-col gap-4 p-5 ring-1 ring-jade-400/25 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-jade-400/25 to-gold-400/10 text-jade-300 ring-1 ring-white/10">
        <DownloadIcon width={20} height={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ivory-50">Install Pocksyra</p>
        <p className="text-xs leading-relaxed text-ink-300">
          {canInstall
            ? "Add it to your home screen for a full-screen app that opens instantly."
            : "In Safari, tap the Share button, then “Add to Home Screen”."}
        </p>
      </div>
      <div className="flex gap-2">
        {canInstall && (
          <Button size="sm" onClick={() => void install()}>
            Install
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
