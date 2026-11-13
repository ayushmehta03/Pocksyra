"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AuthShell } from "@/components/auth-shell";
import { FormError, Spinner } from "@/components/ui";

const ERRORS: Record<string, string> = {
  access_denied: "Sign-in was cancelled. Try again whenever you're ready.",
  email_unverified: "Your Google email isn't verified, so we can't sign you in with it.",
  oauth_failed: "Something went wrong signing you in with Google. Please try again.",
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.3A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.3V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.09C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  );
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  // The backend sends failures back as /login?error=<code>
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) {
      setError(ERRORS[code] ?? ERRORS.oauth_failed);
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  // Back button from Google restores this page from bfcache with the spinner on.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setRedirecting(false);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (loading || user) return <Spinner />;

  function signIn() {
    setRedirecting(true);
    window.location.assign("/auth/google");
  }

  return (
    <AuthShell
      title="Welcome to Pocksyra"
      subtitle="Sign in with Google. No passwords to remember, ever."
      footer="We only read your name, email and profile photo."
    >
      <div className="space-y-5">
        <FormError message={error} />
        <button
          onClick={signIn}
          disabled={redirecting}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-[15px] font-semibold text-ink-900 shadow-[0_12px_30px_-12px_rgba(255,255,255,0.35)] outline-none transition hover:bg-ivory-100 focus-visible:ring-4 focus-visible:ring-white/30 disabled:cursor-wait disabled:opacity-70"
        >
          {redirecting ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-300 border-t-ink-900" />
          ) : (
            <GoogleLogo />
          )}
          {redirecting ? "Redirecting to Google…" : "Continue with Google"}
        </button>
        <p className="text-center text-xs leading-relaxed text-ink-400">
          New here? Signing in creates your account automatically.
        </p>
      </div>
    </AuthShell>
  );
}
