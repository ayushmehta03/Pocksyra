/** The switches shown in Settings. The keys match the groups on the server. */
export const NOTIFICATION_GROUPS = [
  { key: "friends", label: "Friends", hint: "Friend requests and accepted requests" },
  { key: "expenses", label: "Expenses", hint: "When a friend adds an expense that includes you" },
  { key: "payments", label: "Payments", hint: "When someone says they paid you, and the answer to yours" },
  { key: "reminders", label: "Reminders", hint: "A weekly nudge when you owe a friend and nothing has changed" },
] as const;

export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number]["key"];

/** Returns the muted list with one group switched on (not muted) or off (muted). */
export function withGroup(muted: readonly string[], group: string, enabled: boolean): string[] {
  const rest = muted.filter((g) => g !== group);
  return enabled ? rest : [...rest, group];
}

export function isEnabled(muted: readonly string[], group: string): boolean {
  return !muted.includes(group);
}
