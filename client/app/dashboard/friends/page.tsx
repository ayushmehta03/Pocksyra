"use client";

import { useState } from "react";
import { FriendsPanel } from "@/components/friends/friends-panel";
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

      <FormError message={actionError || error} />

      {loading && !data ? (
        <ListSkeleton />
      ) : (
        <FriendsPanel friends={data?.friends ?? []} onRemove={removeFriend} />
      )}
    </div>
  );
}
