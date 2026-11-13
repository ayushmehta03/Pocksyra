"use client";

import { useEffect, useState } from "react";
import { Button, FormError } from "@/components/ui";
import { errorMessage, friendsApi, type InviteLink } from "@/lib/api";
import { formatDate } from "@/lib/format";

export function InviteCard() {
  const [link, setLink] = useState<InviteLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // navigator.share only exists in the browser (mostly phones), so decide after mount.
  useEffect(() => setCanShare(typeof navigator !== "undefined" && !!navigator.share), []);

  async function create() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      setLink(await friendsApi.createInvite());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically. Select the link and copy it manually.");
    }
  }

  async function share() {
    if (!link) return;
    try {
      await navigator.share({
        title: "Join me on Pocksyra",
        text: "Let's split expenses on Pocksyra.",
        url: link.url,
      });
    } catch {
      /* user closed the share sheet */
    }
  }

  return (
    <div className="surface relative flex h-full flex-col overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15 blur-[60px]" />
      <h2 className="relative text-base font-semibold tracking-tight text-ivory-50">Invite with a link</h2>
      <p className="relative mt-1 text-xs leading-relaxed text-ink-400">
        For friends who aren&apos;t on Pocksyra yet. Each link works once and expires in 7 days.
      </p>

      <div className="relative mt-5 flex-1 space-y-4">
        <FormError message={error} />
        {link ? (
          <>
            <div className="flex gap-2">
              <input
                readOnly
                value={link.url}
                onFocus={(e) => e.target.select()}
                aria-label="Invite link"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 font-mono text-xs text-ivory-100 outline-none focus:border-jade-400/70"
              />
              <Button variant="ghost" size="sm" onClick={copy} className="shrink-0">
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-ink-400">Expires {formatDate(link.expiresAt)}</p>
          </>
        ) : null}
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        <Button variant={link ? "ghost" : "primary"} size="sm" loading={busy} onClick={create}>
          {link ? "New link" : "Create invite link"}
        </Button>
        {link && canShare && (
          <Button size="sm" onClick={share}>
            Share
          </Button>
        )}
      </div>
    </div>
  );
}
