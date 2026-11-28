import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { EASE, m } from "@/components/motion";
import type { FriendEntry } from "@/lib/api";

/** One person in a list: avatar, name, @username, optional note, action slot. */
export function FriendRow({
  entry,
  note,
  href,
  children,
}: {
  entry: FriendEntry;
  note?: string;
  /** Where tapping the person goes, e.g. their profile. */
  href?: string;
  children?: ReactNode;
}) {
  const { friend } = entry;
  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="flex items-center gap-4 px-5 py-4"
    >
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/50">
          <Person friend={friend} note={note} />
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Person friend={friend} note={note} />
        </div>
      )}
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </m.li>
  );
}

function Person({ friend, note }: { friend: FriendEntry["friend"]; note?: string }) {
  return (
    <>
      <Avatar user={friend} className="h-11 w-11 shrink-0 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{friend.name}</p>
        <p className="truncate text-xs text-fg-3">
          @{friend.username}
          {note && <span className="text-fg-3"> · {note}</span>}
        </p>
      </div>
    </>
  );
}
