"use client";

import { useEffect, useState } from "react";
import { UpiQr } from "@/components/settle/upi-qr";
import { buildAppLinks, buildUpiLink, payPlatformFrom, type PayPlatform, type UpiLinkOptions } from "@/lib/upi";

const BUTTON =
  "flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-jade-400 to-jade-500 px-5 py-3 text-sm font-semibold text-ink-950 shadow-[0_10px_30px_-10px_rgba(63,214,163,0.55)] transition hover:from-jade-300 hover:to-jade-400";

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
        <p className="text-xs font-medium text-ivory-50">Pay {amountLabel} with</p>
        <div className="grid grid-cols-3 gap-2">
          {buildAppLinks(opts).map((app) => (
            <a key={app.id} href={app.link} className={`${BUTTON} px-2`}>
              {app.label}
            </a>
          ))}
        </div>
        <p className="text-xs text-ink-400">
          Tap the app you use. If nothing opens, that app isn&apos;t installed: copy the UPI ID above and pay from any app.
        </p>
      </div>
    );
  }

  if (platform === "desktop") {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
        <UpiQr link={link} />
        <div className="space-y-1 text-center sm:text-left">
          <p className="text-sm font-medium text-ivory-50">Scan to pay {amountLabel}</p>
          <p className="text-xs text-ink-400">
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
      <p className="text-xs text-ink-400">Opens a list of your UPI apps with the amount filled in.</p>
    </div>
  );
}
