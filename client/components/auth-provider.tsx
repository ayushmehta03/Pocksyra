"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type ProfileUpdate, type SignupInput, type User } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  /** true until the first /me check finishes */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on load. api.me() transparently refreshes an expired
  // access token using the refresh cookie.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((r) => !cancelled && setUser(r.user))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password);
    setUser(r.user);
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const r = await api.signup(input);
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (patch: ProfileUpdate) => {
    const r = await api.updateMe(patch);
    setUser(r.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, updateProfile }),
    [user, loading, login, signup, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
