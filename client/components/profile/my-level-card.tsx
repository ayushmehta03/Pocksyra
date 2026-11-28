"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { LevelCard } from "@/components/profile/level-card";
import { profilesApi, type Profile } from "@/lib/api";

/** Dashboard card: my level, linking to my profile. Shows nothing if it can't load. */
export function MyLevelCard() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    profilesApi
      .get("me")
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        /* a missing level card is better than an error on the home page */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile) return null;
  return (
    <Link
      href="/dashboard/people/me"
      className="surface group block space-y-3 p-5 transition hover:bg-white/[0.06] sm:p-6"
    >
      <LevelCard level={profile.level} compact />
      <p className="flex items-center gap-1.5 text-xs font-medium text-jade-300">
        View your profile and badges
        <ArrowRightIcon width={14} height={14} className="transition group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
