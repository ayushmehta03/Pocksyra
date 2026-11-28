"use client";

import { useId, useState } from "react";
import { AddFriendForm } from "@/components/friends/add-friend-form";
import { FriendsPanel } from "@/components/friends/friends-panel";
import { InviteCard } from "@/components/friends/invite-card";
import { RequestsPanel } from "@/components/friends/requests-panel";
import { SuggestionsPanel } from "@/components/friends/suggestions-panel";
import { ListSkeleton } from "@/components/empty-state";
import { EASE, FadeUp, m } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { Button, FormError } from "@/components/ui";
import { ApiError, errorMessage, friendsApi } from "@/lib/api";
import { useFriends } from "@/lib/use-friends";

type Tab = "friends" | "requests";

export default function FriendsPage() {
  const { data, loading, error, reload } = useFriends();
  const [tab, setTab] = useState<Tab>("friends");
  const pillId = useId();
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

      <FadeUp>
      <section className="grid gap-4 lg:grid-cols-5" aria-label="Add friends">
        <div className="lg:col-span-3">
          <AddFriendForm onSent={reload} />
        </div>
        <div className="lg:col-span-2">
          <InviteCard />
        </div>
      </section>
      </FadeUp>

      <SuggestionsPanel onSent={reload} />

      <div role="tablist" aria-label="Friends and requests" className="inline-flex rounded-xl bg-wash/[0.06] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
              tab === t.id ? "text-fg" : "text-fg-2 hover:text-fg"
            }`}
          >
            {tab === t.id && (
              <m.span
                layoutId={`${pillId}-tab`}
                className="absolute inset-0 rounded-lg bg-panel shadow-sm ring-1 ring-wash/10"
                transition={{ duration: 0.3, ease: EASE }}
              />
            )}
            <span className="relative">{t.label}</span>
            <span
              className={`relative rounded-full px-2 py-0.5 font-mono text-[10px] ${
                t.highlight ? "bg-accent text-accent-ink" : "bg-wash/[0.08] text-fg-2"
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

      <m.div
        key={tab}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
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
      </m.div>
    </div>
  );
}
