"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

/** Google profile photo when available, gradient initials otherwise. */
export function Avatar({
  user,
  className = "h-10 w-10 text-sm",
}: {
  user: { name: string; avatarUrl?: string };
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (user.avatarUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer" // Google's CDN can 403 requests with a foreign referrer
        onError={() => setFailed(true)}
        className={`rounded-full object-cover ring-2 ring-white/10 ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-jade-300 to-gold-300 font-bold text-ink-950 ring-2 ring-white/10 ${className}`}
    >
      {initials(user.name)}
    </span>
  );
}
