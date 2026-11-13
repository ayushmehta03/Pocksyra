"use client";

import { useState } from "react";
import { UsersIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui";
import { FriendRow } from "@/components/friends/friend-row";
import type { FriendEntry } from "@/lib/api";
import { formatDate } from "@/lib/format";

/** Two-step remove so a stray click can't unfriend someone. */
function RemoveButton({ onRemove }: { onRemove: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Remove
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-ink-300 sm:inline">Remove friend?</span>
      <Button
        variant="danger"
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onRemove();
          } finally {
            setBusy(false);
            setConfirming(false);
          }
        }}
      >
        Yes, remove
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}

export function FriendsPanel({
  friends,
  onRemove,
}: {
  friends: FriendEntry[];
  onRemove: (id: string) => Promise<void>;
}) {
  if (friends.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No friends yet"
        text="Add someone by email or username, or share an invite link. Once you're connected you can split expenses together."
      />
    );
  }
  return (
    <ul className="surface divide-y divide-white/[0.06]">
      {friends.map((e) => (
        <FriendRow
          key={e.id}
          entry={e}
          note={e.acceptedAt ? `friends since ${formatDate(e.acceptedAt)}` : undefined}
        >
          <RemoveButton onRemove={() => onRemove(e.id)} />
        </FriendRow>
      ))}
    </ul>
  );
}
