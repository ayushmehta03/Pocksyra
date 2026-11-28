"use client";

import { EASE, m } from "@/components/motion";
import type { Level } from "@/lib/api";
import { levelProgress, xpToNext } from "@/lib/level";

/** A level with a progress bar toward the next one. The bar fills in when it first shows. */
export function LevelCard({ level, compact = false }: { level: Level; compact?: boolean }) {
  const pct = Math.round(levelProgress(level) * 100);
  const left = xpToNext(level);
  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {!compact && (
            <span className="num flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent font-mono text-2xl font-semibold text-accent-ink">
              {level.level}
            </span>
          )}
          <p className={`min-w-0 truncate font-semibold tracking-tight text-fg ${compact ? "text-base" : "text-xl"}`}>
            Level {level.level} <span className="font-normal text-fg-2">· {level.title}</span>
          </p>
        </div>
        <p className="num shrink-0 font-mono text-xs text-fg-2">{level.xp} XP</p>
      </div>
      <div
        role="progressbar"
        aria-label={`Progress to level ${level.level + 1}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-wash/10"
      >
        <m.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
        />
      </div>
      <p className="text-xs text-fg-3">
        {level.nextLevelXp === null ? "Top level reached." : `${left} XP to level ${level.level + 1}`}
      </p>
    </div>
  );
}
