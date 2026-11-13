"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, api, type ProfileUpdate, type User } from "@/lib/api";
import { clearCachedUser, readCachedUser, writeCachedUser } from "@/lib/session-cache";

type AuthContextValue = {
  user: User | null;
  /** true until the first /me check finishes */
  loading: boolean;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on load. Sign-in itself happens through a full-page
  // redirect to Google, so by the time we're back the cookies are already set.
  // api.me() transparently refreshes an expired access token.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((r) => {
        if (cancelled) return;
        writeCachedUser(r.user);
        setUser(r.user);
      })
      .catch((err) => {
        if (cancelled) return;
        // Only a definitive 401 means "signed out". Offline or a server hiccup
        // keeps the cached profile so the installed app still opens.
        if (err instanceof ApiError && err.status === 401) {
          clearCachedUser();
          setUser(null);
        } else {
          setUser(readCachedUser());
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearCachedUser();
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (patch: ProfileUpdate) => {
    const r = await api.updateMe(patch);
    writeCachedUser(r.user);
    setUser(r.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, logout, updateProfile }),
    [user, loading, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
