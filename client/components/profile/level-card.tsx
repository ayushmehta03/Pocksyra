import type { Level } from "@/lib/api";
import { levelProgress, xpToNext } from "@/lib/level";

/** A level with a progress bar toward the next one. */
export function LevelCard({ level, compact = false }: { level: Level; compact?: boolean }) {
  const pct = Math.round(levelProgress(level) * 100);
  const left = xpToNext(level);
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-semibold tracking-tight text-ivory-50 ${compact ? "text-base" : "text-xl"}`}>
          Level {level.level} <span className="font-normal text-ink-300">· {level.title}</span>
        </p>
        <p className="font-mono text-xs text-ink-300">{level.xp} XP</p>
      </div>
      <div
        role="progressbar"
        aria-label={`Progress to level ${level.level + 1}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-white/10"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-jade-400 to-gold-400" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-ink-400">
        {level.nextLevelXp === null ? "Top level reached." : `${left} XP to level ${level.level + 1}`}
      </p>
    </div>
  );
}
