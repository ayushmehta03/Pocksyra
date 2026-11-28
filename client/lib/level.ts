import type { Level } from "./api";

/** How far through the current level someone is, from 0 to 1. The top level is always full. */
export function levelProgress(l: Pick<Level, "xp" | "levelXp" | "nextLevelXp">): number {
  if (l.nextLevelXp === null) return 1;
  const span = l.nextLevelXp - l.levelXp;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (l.xp - l.levelXp) / span));
}

/** XP still needed for the next level; 0 at the top. */
export function xpToNext(l: Pick<Level, "xp" | "nextLevelXp">): number {
  return l.nextLevelXp === null ? 0 : Math.max(0, l.nextLevelXp - l.xp);
}
