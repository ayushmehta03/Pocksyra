"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CheckIcon } from "@/components/icons";
import { ListSkeleton } from "@/components/empty-state";
import { LevelCard } from "@/components/profile/level-card";
import { FormError } from "@/components/ui";
import { ApiError, errorMessage, profilesApi, type Profile } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setMissing(false);
    setError("");
    profilesApi
      .get(id)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) {
    return (
      <div className="surface space-y-3 p-8 text-center">
        <p className="text-lg font-semibold text-ivory-50">Profile not available</p>
        <p className="text-sm text-ink-300">You can only see the profiles of your friends.</p>
        <Link href="/dashboard/friends" className="text-sm font-medium text-jade-300 underline underline-offset-2">
          Back to friends
        </Link>
      </div>
    );
  }
  if (error) return <FormError message={error} />;
  if (!profile) return <ListSkeleton />;

  const { user, level, badges } = profile;
  const earned = badges.filter((b) => b.earned);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/friends" className="text-xs font-medium text-ink-300 hover:text-ivory-50">
        ← Friends
      </Link>

      <section className="surface flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <Avatar user={user} className="h-20 w-20 shrink-0 text-2xl" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-jade-300">
            {profile.isSelf ? "Your profile" : "Profile"}
          </p>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ivory-50 sm:text-3xl">{user.name}</h1>
          <p className="truncate text-sm text-ink-400">@{user.username}</p>
          <p className="pt-1 text-xs text-ink-300">
            Member since {formatDate(profile.memberSince)} · {profile.friends} {profile.friends === 1 ? "friend" : "friends"}
            {profile.mutualFriends !== undefined &&
              ` · ${profile.mutualFriends} mutual ${profile.mutualFriends === 1 ? "friend" : "friends"}`}
          </p>
        </div>
      </section>

      <section className="surface p-6 sm:p-8" aria-label="Level">
        <LevelCard level={level} />
      </section>

      <section className="space-y-3" aria-label="Badges">
        <h2 className="text-sm font-semibold text-ivory-50">
          Badges <span className="font-normal text-ink-400">· {earned.length} of {badges.length}</span>
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {badges.map((b) => (
            <li
              key={b.id}
              className={`flex items-start gap-3 rounded-2xl border p-4 ${
                b.earned ? "border-jade-400/30 bg-jade-400/[0.06]" : "border-white/10 bg-white/[0.02] opacity-60"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  b.earned ? "bg-jade-400 text-ink-950" : "bg-white/10 text-ink-400"
                }`}
              >
                {b.earned ? <CheckIcon width={14} height={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ivory-50">{b.label}</p>
                <p className="text-xs leading-relaxed text-ink-300">{b.description}</p>
                {!b.earned && <p className="mt-1 text-[11px] text-ink-500">Not earned yet</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
