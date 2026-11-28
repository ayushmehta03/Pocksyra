"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CheckIcon } from "@/components/icons";
import { ListSkeleton } from "@/components/empty-state";
import { Stagger, StaggerItem } from "@/components/motion";
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
        <p className="text-lg font-semibold text-fg">Profile not available</p>
        <p className="text-sm text-fg-2">You can only see the profiles of your friends.</p>
        <Link href="/dashboard/friends" className="text-sm font-medium text-accent-text underline underline-offset-2">
          Back to friends
        </Link>
      </div>
    );
  }
  if (error) return <FormError message={error} />;
  if (!profile) return <ListSkeleton />;

  const { user, level, badges } = profile;
  const earned = badges.filter((b) => b.earned);

  const stats: { label: string; value: string }[] = [
    { label: "Friends", value: String(profile.friends) },
    ...(profile.mutualFriends !== undefined ? [{ label: "Mutual", value: String(profile.mutualFriends) }] : []),
    { label: "Member since", value: formatDate(profile.memberSince) },
  ];

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <Link href="/dashboard/friends" className="text-xs font-medium text-fg-2 transition hover:text-fg">
          ← Friends
        </Link>
      </StaggerItem>

      <StaggerItem>
        <section className="surface flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
          <Avatar user={user} className="h-20 w-20 shrink-0 text-2xl" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
              {profile.isSelf ? "Your profile" : "Profile"}
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{user.name}</h1>
            <p className="truncate text-sm text-fg-3">@{user.username}</p>
          </div>
        </section>
      </StaggerItem>

      <StaggerItem>
        <dl className={`grid gap-3 ${stats.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {stats.map((st) => (
            <div key={st.label} className="surface p-4">
              <dd className="num font-mono text-lg font-semibold text-fg sm:text-xl">{st.value}</dd>
              <dt className="mt-0.5 text-xs text-fg-3">{st.label}</dt>
            </div>
          ))}
        </dl>
      </StaggerItem>

      <StaggerItem>
        <section className="surface p-6 sm:p-8" aria-label="Level">
          <LevelCard level={level} />
        </section>
      </StaggerItem>

      <StaggerItem>
        <section className="space-y-3" aria-label="Badges">
          <h2 className="text-sm font-semibold text-fg">
            Badges <span className="font-normal text-fg-3">· {earned.length} of {badges.length}</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {badges.map((b) => (
              <li
                key={b.id}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${
                  b.earned ? "border-accent/30 bg-accent/[0.06]" : "border-wash/10 bg-wash/[0.02] opacity-60"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    b.earned ? "bg-accent text-accent-ink" : "bg-wash/10 text-fg-3"
                  }`}
                >
                  {b.earned ? <CheckIcon width={14} height={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{b.label}</p>
                  <p className="text-xs leading-relaxed text-fg-2">{b.description}</p>
                  {!b.earned && <p className="mt-1 text-[11px] text-fg-3">Not earned yet</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </StaggerItem>
    </Stagger>
  );
}
