"use client";

import { useEffect, useState } from "react";
import { UpiQr } from "@/components/settle/upi-qr";
import { buildAppLinks, buildUpiLink, payPlatformFrom, type PayPlatform, type UpiLinkOptions } from "@/lib/upi";

const BUTTON =
  "flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-110 active:scale-[0.98]";
// One of several apps to pick from: outlined, so the choice isn't three loud green buttons.
const APP =
  "flex w-full items-center justify-center rounded-xl border border-wash/15 bg-panel px-2 py-3 text-sm font-semibold text-fg transition hover:border-accent hover:text-accent-text active:scale-[0.98]";

/**
 * How to pay a friend by UPI on this device: a chooser link on Android, one
 * button per app on iPhone (which has no chooser), and a QR code on a computer.
 */
export function UpiPayActions({ opts, amountLabel }: { opts: UpiLinkOptions; amountLabel: string }) {
  // Until the page is running in the browser the device is unknown, so start with the Android-style link.
  const [platform, setPlatform] = useState<PayPlatform | null>(null);
  useEffect(() => {
    setPlatform(payPlatformFrom(navigator.userAgent, navigator.maxTouchPoints));
  }, []);

  const link = buildUpiLink(opts);

  if (platform === "ios") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-fg">Pay {amountLabel} with</p>
        <div className="grid grid-cols-3 gap-2">
          {buildAppLinks(opts).map((app) => (
            <a key={app.id} href={app.link} className={APP}>
              {app.label}
            </a>
          ))}
        </div>
        <p className="text-xs text-fg-3">
          Tap the app you use. If nothing opens, that app isn&apos;t installed: copy the UPI ID above and pay from any app.
        </p>
      </div>
    );
  }

  if (platform === "desktop") {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
        <span className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5"><UpiQr link={link} className="h-40 w-40" /></span>
        <div className="space-y-1 text-center sm:text-left">
          <p className="text-sm font-medium text-fg">Scan to pay {amountLabel}</p>
          <p className="text-xs text-fg-3">
            Open any UPI app on your phone (Google Pay, PhonePe, Paytm and others) and scan this code. The amount and
            payee are filled in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <a href={link} className={BUTTON}>
        Pay {amountLabel} with UPI
      </a>
      <p className="text-xs text-fg-3">Opens a list of your UPI apps with the amount filled in.</p>
    </div>
  );
}
