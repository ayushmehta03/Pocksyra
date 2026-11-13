"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { Spinner } from "@/components/ui";
import { PENDING_INVITE_KEY } from "@/lib/invite";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Route guard. The Go API remains the real authority on every request.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Came here from an invite link before signing in? Pick that flow back up.
  useEffect(() => {
    if (!user) return;
    try {
      const token = sessionStorage.getItem(PENDING_INVITE_KEY);
      if (token) {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        router.replace(`/invite/${encodeURIComponent(token)}`);
      }
    } catch {
      /* storage blocked */
    }
  }, [user, router]);

  if (loading || !user) return <Spinner />;
  return (
    <AppShell user={user}>
      <OfflineBanner />
      {children}
    </AppShell>
  );
}
