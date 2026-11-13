"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/auth-shell";
import { Button, FormError, Spinner } from "@/components/ui";
import { ApiError, errorMessage, friendsApi, type InvitePreview } from "@/lib/api";
import { PENDING_INVITE_KEY } from "@/lib/invite";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (loading) return;

    // Not signed in: remember the invite, sign in, then the dashboard brings us back.
    if (!user) {
      try {
        sessionStorage.setItem(PENDING_INVITE_KEY, token);
      } catch {
        /* storage blocked: the user can reopen the link after signing in */
      }
      router.replace("/login");
      return;
    }

    let cancelled = false;
    friendsApi
      .previewInvite(token)
      .then((p) => !cancelled && setPreview(p))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setInvalid(true);
        else setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, token, router]);

  async function accept() {
    setAccepting(true);
    setError("");
    try {
      await friendsApi.acceptInvite(token);
      router.replace("/dashboard/friends");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setInvalid(true);
      else setError(errorMessage(err));
      setAccepting(false);
    }
  }

  if (loading || !user || (!preview && !invalid && !error)) return <Spinner />;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-fade-up space-y-8">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="surface space-y-6 p-8 text-center">
          {invalid ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-ivory-50">This invite isn&apos;t valid</h1>
              <p className="text-sm leading-relaxed text-ink-300">
                It may have expired or already been used. Ask your friend for a new link.
              </p>
              <Button onClick={() => router.replace("/dashboard")} className="w-full">
                Go to dashboard
              </Button>
            </>
          ) : preview?.own ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-ivory-50">This is your own link</h1>
              <p className="text-sm leading-relaxed text-ink-300">
                Share it with a friend. When they open it and accept, you&apos;ll be connected.
              </p>
              <Button onClick={() => router.replace("/dashboard/friends")} className="w-full">
                Back to friends
              </Button>
            </>
          ) : preview ? (
            <>
              <div className="flex justify-center">
                <Avatar user={preview.inviter} className="h-20 w-20 text-2xl" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-ivory-50">
                  {preview.inviter.name} invited you
                </h1>
                <p className="text-sm leading-relaxed text-ink-300">
                  @{preview.inviter.username} wants to connect on Pocksyra so you can split expenses together.
                </p>
              </div>
              <FormError message={error} />
              <div className="flex flex-col gap-3">
                <Button onClick={accept} loading={accepting} arrow className="w-full">
                  Accept invite
                </Button>
                <Button variant="ghost" disabled={accepting} onClick={() => router.replace("/dashboard")} className="w-full">
                  Not now
                </Button>
              </div>
            </>
          ) : (
            <>
              <FormError message={error} />
              <Button variant="ghost" onClick={() => router.replace("/dashboard")} className="w-full">
                Go to dashboard
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
