"use client";

import { useState, type FormEvent } from "react";
import { UserPlusIcon } from "@/components/icons";
import { Button, Field, FormError } from "@/components/ui";
import { ApiError, errorMessage, friendsApi } from "@/lib/api";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddFriendForm({ onSent }: { onSent: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const v = value.trim();
    if (!v) {
      setError("Enter an email address or a username");
      return;
    }
    // "a@b.co" is an email; "@ayush" or "ayush" is a username.
    const target = emailRe.test(v) ? { email: v } : { username: v.replace(/^@/, "") };

    setBusy(true);
    try {
      const r = await friendsApi.sendRequest(target);
      setSuccess(
        r.autoAccepted
          ? `You and ${r.friendship.friend.name} are now friends.`
          : `Request sent to ${r.friendship.friend.name}.`,
      );
      setValue("");
      onSent();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Nobody on Pocksyra matches that. You can share an invite link instead.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="surface space-y-5 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-400/15 text-jade-300">
          <UserPlusIcon width={20} height={20} />
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ivory-50">Add a friend</h2>
          <p className="text-xs text-ink-400">They&apos;ll get a request to accept.</p>
        </div>
      </div>

      <Field
        label="Email or username"
        placeholder="friend@example.com or @username"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />

      <FormError message={error} />
      {success && (
        <div role="status" className="rounded-xl border border-jade-400/30 bg-jade-400/10 px-4 py-3 text-sm text-jade-300">
          {success}
        </div>
      )}

      <Button type="submit" loading={busy} arrow className="w-full sm:w-auto">
        Send request
      </Button>
    </form>
  );
}
