"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { UserPlusIcon } from "@/components/icons";
import { AnimatePresence } from "@/components/motion";
import { Button } from "@/components/ui";
import { FriendRow } from "@/components/friends/friend-row";
import type { FriendEntry } from "@/lib/api";
import { formatDate } from "@/lib/format";

function SectionLabel({ children, count }: { children: string; count: number }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
      {children}
      <span className="rounded-full bg-wash/[0.07] px-2 py-0.5 font-mono text-[10px] text-fg-2">{count}</span>
    </h3>
  );
}

export function RequestsPanel({
  incoming,
  outgoing,
  onAccept,
  onDecline,
  onCancel,
}: {
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  // Only one request is acted on at a time, so a double-click can't fire twice.
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, fn: (id: string) => Promise<void>) {
    setBusyId(id);
    try {
      await fn(id);
    } finally {
      setBusyId(null);
    }
  }

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <EmptyState
        icon={UserPlusIcon}
        title="No pending requests"
        text="When someone sends you a friend request it shows up here, and so do the ones you've sent."
      />
    );
  }

  return (
    <div className="space-y-8">
      {incoming.length > 0 && (
        <section>
          <SectionLabel count={incoming.length}>Waiting for you</SectionLabel>
          <ul className="surface divide-y divide-wash/[0.06] overflow-hidden">
            <AnimatePresence initial={false}>
            {incoming.map((e) => (
              <FriendRow key={e.id} entry={e} note={`sent ${formatDate(e.createdAt)}`}>
                <Button size="sm" loading={busyId === e.id} disabled={busyId !== null} onClick={() => act(e.id, onAccept)}>
                  Accept
                </Button>
                <Button variant="ghost" size="sm" disabled={busyId !== null} onClick={() => act(e.id, onDecline)}>
                  Decline
                </Button>
              </FriendRow>
            ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <SectionLabel count={outgoing.length}>Sent by you</SectionLabel>
          <ul className="surface divide-y divide-wash/[0.06] overflow-hidden">
            <AnimatePresence initial={false}>
            {outgoing.map((e) => (
              <FriendRow key={e.id} entry={e} note={`waiting since ${formatDate(e.createdAt)}`}>
                <Button variant="ghost" size="sm" loading={busyId === e.id} disabled={busyId !== null} onClick={() => act(e.id, onCancel)}>
                  Cancel
                </Button>
              </FriendRow>
            ))}
            </AnimatePresence>
          </ul>
        </section>
      )}
    </div>
  );
}
