"use client";

import { usePwa } from "./pwa-provider";

export function OfflineBanner() {
  const { online } = usePwa();
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 border-b border-gold-500/30 bg-gold-500/10 px-4 py-2 text-center text-xs font-medium text-gold-400 backdrop-blur"
    >
      You&apos;re offline. Showing what&apos;s saved on this device; changes need a connection.
    </div>
  );
}
