"use client";

import { useState } from "react";
import { AddFriendForm } from "@/components/friends/add-friend-form";
import { FriendsPanel } from "@/components/friends/friends-panel";
import { InviteCard } from "@/components/friends/invite-card";
import { ListSkeleton } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { FormError } from "@/components/ui";
import { errorMessage, friendsApi } from "@/lib/api";
import { useFriends } from "@/lib/use-friends";

export default function FriendsPage() {
  const { data, loading, error, reload } = useFriends();
  const [actionError, setActionError] = useState("");

  async function removeFriend(id: string) {
    setActionError("");
    try {
      await friendsApi.remove(id);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

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

      <FormError message={actionError || error} />

      {loading && !data ? (
        <ListSkeleton />
      ) : (
        <FriendsPanel friends={data?.friends ?? []} onRemove={removeFriend} />
      )}
    </div>
  );
}
