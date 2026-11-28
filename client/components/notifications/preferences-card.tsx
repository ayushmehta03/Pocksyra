"use client";

import { useEffect, useState } from "react";
import { FormError } from "@/components/ui";
import { notificationsApi } from "@/lib/api";
import { NOTIFICATION_GROUPS, isEnabled, withGroup } from "@/lib/notification-prefs";

/** Settings card: choose which kinds of notification you get (inbox and push). */
export function NotificationPreferencesCard() {
  const [muted, setMuted] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    notificationsApi
      .preferences()
      .then((r) => {
        if (!cancelled) setMuted(r.muted);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your notification settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (group: string) => {
    if (muted === null || saving) return;
    const before = muted;
    const next = withGroup(before, group, !isEnabled(before, group));
    setMuted(next); // show the change straight away, undo it if saving fails
    setSaving(true);
    setError("");
    try {
      const saved = await notificationsApi.setPreferences(next);
      setMuted(saved.muted);
    } catch {
      setMuted(before);
      setError("Couldn't save that change. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (muted === null && !error) return null;

  return (
    <div className="surface space-y-4 p-6 sm:p-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-fg">What to notify me about</h2>
        <p className="mt-1 text-sm leading-relaxed text-fg-2">
          Turning one off hides it from your inbox and stops the push alert too.
        </p>
      </div>
      <FormError message={error} />
      {muted !== null && (
        <ul className="divide-y divide-wash/10">
          {NOTIFICATION_GROUPS.map((g) => {
            const on = isEnabled(muted, g.key);
            return (
              <li key={g.key} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{g.label}</p>
                  <p className="text-xs leading-relaxed text-fg-2">{g.hint}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={g.label}
                  disabled={saving}
                  onClick={() => toggle(g.key)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                    on ? "bg-jade-400" : "bg-wash/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      on ? "left-[1.375rem]" : "left-0.5"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
