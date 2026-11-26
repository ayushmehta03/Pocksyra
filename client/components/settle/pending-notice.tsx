"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ArrowRightIcon, SwapIcon } from "@/components/icons";
import { settlementsApi } from "@/lib/api";

/** Home-page nudge when friends have said they paid me and I haven't answered yet. */
export function PendingNotice() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    settlementsApi
      .list()
      .then((page) => {
        if (!cancelled) setCount(page.settlements.filter((s) => s.status === "pending" && s.to === user.id).length);
      })
      .catch(() => {
        /* the Settle page shows the real error; this is only a nudge */
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (count === 0) return null;

  return (
    <Link
      href="/dashboard/settle"
      className="surface group relative flex items-center gap-4 p-4 outline-none ring-1 ring-jade-400/25 transition hover:ring-jade-400/50 focus-visible:ring-2 focus-visible:ring-jade-400/60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-jade-400/15 text-jade-300">
        <SwapIcon width={20} height={20} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ivory-50">
          {count === 1 ? "A friend says they paid you" : `${count} friends say they paid you`}
        </p>
        <p className="truncate text-xs text-ink-300">Confirm once the money has arrived.</p>
      </div>
      <ArrowRightIcon width={16} height={16} className="ml-auto text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-jade-300" />
    </Link>
  );
}
