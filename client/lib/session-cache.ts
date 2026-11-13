import type { User } from "@/lib/api";

// The last known profile, kept so the installed app can open offline.
// This is a display hint only: it grants no access, since every API call is
// still authenticated by the HTTP-only cookies.
const KEY = "pocksyra.session.user";

export function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function writeCachedUser(user: User): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* storage blocked or full */
  }
}

export function clearCachedUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}
