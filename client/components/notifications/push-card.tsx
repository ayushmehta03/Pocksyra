"use client";

import { useCallback, useEffect, useState } from "react";
import { BellIcon } from "@/components/icons";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button, FormError } from "@/components/ui";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";

const COPY: Record<PushState, string> = {
  unsupported: "This browser can't receive push notifications.",
  "needs-install": "On iPhone and iPad, add Pocksyra to your Home Screen first, then open it from there to turn this on.",
  unavailable: "Push isn't available right now. It works in the installed or production app once the server has push set up.",
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back.",
  off: "Get an alert on this device when a friend adds an expense, sends a request or pays you, even when Pocksyra is closed.",
  on: "On. This device will get alerts for friend requests, shared expenses and payments.",
};

/** Settings card to turn push notifications on or off for this device. */
export function PushCard() {
  const { isIOS, standalone } = usePwa();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setState(await getPushState({ isIOS, standalone }));
    } catch {
      setState("unavailable");
    }
  }, [isIOS, standalone]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      if (state === "on") await disablePush();
      else await enablePush();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  if (state === null) return null;
  const canToggle = state === "off" || state === "on";

  return (
    <div className="surface space-y-4 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-jade-400/25 to-gold-400/10 text-accent-text ring-1 ring-wash/10">
          <BellIcon width={20} height={20} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-fg">Push notifications</h2>
          <p className="mt-1 text-sm leading-relaxed text-fg-2">{COPY[state]}</p>
        </div>
      </div>
      <FormError message={error} />
      {canToggle && (
        <div className="flex justify-end">
          <Button variant={state === "on" ? "ghost" : "primary"} loading={busy} onClick={toggle}>
            {state === "on" ? "Turn off" : "Turn on"}
          </Button>
        </div>
      )}
    </div>
  );
}
