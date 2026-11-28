import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
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
    <li className="flex items-center gap-4 px-5 py-4">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-jade-400/50">
          <Person friend={friend} note={note} />
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Person friend={friend} note={note} />
        </div>
      )}
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </li>
  );
}

function Person({ friend, note }: { friend: FriendEntry["friend"]; note?: string }) {
  return (
    <>
      <Avatar user={friend} className="h-11 w-11 shrink-0 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ivory-50">{friend.name}</p>
        <p className="truncate text-xs text-ink-400">
          @{friend.username}
          {note && <span className="text-ink-500"> · {note}</span>}
        </p>
      </div>
    </>
  );
}
