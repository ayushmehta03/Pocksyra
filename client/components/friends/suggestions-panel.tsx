"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, FormError } from "@/components/ui";
import { errorMessage, friendsApi, type Suggestion } from "@/lib/api";

const DISMISSED_KEY = "pocksyra.suggestions.dismissed";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** "People you may know": friends of friends, one tap to send a request. Hides itself when there are none. */
export function SuggestionsPanel({ onSent }: { onSent: () => Promise<void> | void }) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    friendsApi
      .suggestions()
      .then((all) => {
        if (cancelled) return;
        const hidden = new Set(readDismissed());
        setItems(all.filter((s) => !hidden.has(s.user.id)));
      })
      .catch(() => {
        /* suggestions are a nicety: stay quiet if they can't load */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((cur) => cur.filter((s) => s.user.id !== id));
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), id].slice(-200)));
    } catch {
      /* storage blocked: it just comes back next visit */
    }
  }, []);

  const add = async (s: Suggestion) => {
    setBusy(s.user.id);
    setError("");
    try {
      await friendsApi.sendRequest({ username: s.user.username });
      setSent((cur) => new Set(cur).add(s.user.id));
      await onSent();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="People you may know">
      <h2 className="text-sm font-semibold text-fg">People you may know</h2>
      <FormError message={error} />
      <ul className="surface divide-y divide-wash/[0.06]">
        {items.map((s) => {
          const requested = sent.has(s.user.id);
          return (
            <li key={s.user.id} className="flex items-center gap-4 px-5 py-4">
              <Avatar user={s.user} className="h-11 w-11 shrink-0 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{s.user.name}</p>
                <p className="truncate text-xs text-fg-3">
                  @{s.user.username} · {s.mutualFriends} mutual {s.mutualFriends === 1 ? "friend" : "friends"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {requested ? (
                  <Button size="sm" variant="ghost" disabled>
                    Requested
                  </Button>
                ) : (
                  <>
                    <Button size="sm" loading={busy === s.user.id} onClick={() => add(s)}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Hide ${s.user.name}`} onClick={() => dismiss(s.user.id)}>
                      Hide
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
