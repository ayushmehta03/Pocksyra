import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import type { FriendEntry } from "@/lib/api";

/** One person in a list: avatar, name, @username, optional note, action slot. */
export function FriendRow({
  entry,
  note,
  children,
}: {
  entry: FriendEntry;
  note?: string;
  children?: ReactNode;
}) {
  const { friend } = entry;
  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <Avatar user={friend} className="h-11 w-11 shrink-0 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ivory-50">{friend.name}</p>
        <p className="truncate text-xs text-ink-400">
          @{friend.username}
          {note && <span className="text-ink-500"> · {note}</span>}
        </p>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </li>
  );
}
