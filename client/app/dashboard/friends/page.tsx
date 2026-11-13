"use client";

import { useState } from "react";
import { AddFriendForm } from "@/components/friends/add-friend-form";
import { FriendsPanel } from "@/components/friends/friends-panel";
import { InviteCard } from "@/components/friends/invite-card";
import { RequestsPanel } from "@/components/friends/requests-panel";
import { ListSkeleton } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button, FormError } from "@/components/ui";
import { ApiError, errorMessage, friendsApi } from "@/lib/api";
import { useFriends } from "@/lib/use-friends";

type Tab = "friends" | "requests";

export default function FriendsPage() {
  const { data, loading, error, reload } = useFriends();
  const [tab, setTab] = useState<Tab>("friends");
  const [actionError, setActionError] = useState("");
  // Set when unfriending was refused because money is still owed.
  const [forceId, setForceId] = useState<string | null>(null);

  // Run an action, then refresh. Errors show in the banner instead of throwing.
  async function run(action: () => Promise<unknown>) {
    setActionError("");
    try {
      await action();
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  // Unfriending with an open balance is refused (409); offer to override explicitly.
  async function removeFriend(id: string) {
    setActionError("");
    setForceId(null);
    try {
      await friendsApi.remove(id);
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setForceId(id);
        setActionError("You still have an unsettled balance with this friend. Settle up first, or remove them anyway.");
      } else {
        setActionError(errorMessage(err));
      }
    }
  }

  const friends = data?.friends ?? [];
  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const requestCount = incoming.length + outgoing.length;

  const tabs: { id: Tab; label: string; count: number; highlight?: boolean }[] = [
    { id: "friends", label: "Friends", count: friends.length },
    { id: "requests", label: "Requests", count: requestCount, highlight: incoming.length > 0 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Friends"
        title="Your people"
        subtitle="The friends you split expenses with."
      />

      <section className="grid gap-4 lg:grid-cols-5" aria-label="Add friends">
        <div className="lg:col-span-3">
          <AddFriendForm onSent={reload} />
        </div>
        <div className="lg:col-span-2">
          <InviteCard />
        </div>
      </section>

      <div role="tablist" aria-label="Friends and requests" className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-jade-400/50 ${
              tab === t.id ? "bg-white/10 text-ivory-50" : "text-ink-300 hover:text-ivory-50"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                t.highlight ? "bg-jade-400 text-ink-950" : "bg-white/[0.08] text-ink-300"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <FormError message={actionError || error} />
      {forceId && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              const id = forceId;
              setForceId(null);
              run(() => friendsApi.remove(id, true));
            }}
          >
            Remove anyway
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setForceId(null)}>
            Keep friend
          </Button>
        </div>
      )}

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {loading && !data ? (
          <ListSkeleton />
        ) : tab === "friends" ? (
          <FriendsPanel friends={friends} onRemove={removeFriend} />
        ) : (
          <RequestsPanel
            incoming={incoming}
            outgoing={outgoing}
            onAccept={(id) => run(() => friendsApi.accept(id))}
            onDecline={(id) => run(() => friendsApi.decline(id))}
            onCancel={(id) => run(() => friendsApi.remove(id))}
          />
        )}
      </div>
    </div>
  );
}
