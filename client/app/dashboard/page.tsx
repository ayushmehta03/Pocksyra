"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/auth-shell";
import { Button, Field, FormError, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/api";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default function DashboardPage() {
  const { user, loading, logout, updateProfile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [tz, setTz] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Guard: not logged in -> /login
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Seed the form once the user is known
  useEffect(() => {
    if (user) {
      setName(user.name);
      setCurrency(user.defaultCurrency);
      setTz(user.tz);
    }
  }, [user]);

  const zones = useMemo(() => {
    let list: string[] = [];
    try {
      list = Intl.supportedValuesOf("timeZone");
    } catch {
      /* older browsers: fall back to just the user's zone */
    }
    if (user?.tz && !list.includes(user.tz)) list = [user.tz, ...list];
    return list;
  }, [user?.tz]);

  if (loading || !user) return <Spinner />;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!name.trim()) {
      setError("Name can't be empty");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), defaultCurrency: currency, tz });
      setMessage("Saved");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">@{user.username}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
              {initials(user.name)}
            </span>
            <Button variant="ghost" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi, {user.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-slate-500">
            You&apos;re logged in as {user.email}. Friends and expenses are coming next.
          </p>
        </div>

        <form onSubmit={onSave} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Profile</h2>
          <FormError message={error} />
          {message && (
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              {message}
            </div>
          )}

          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="currency" className="block text-sm font-medium text-slate-700">
                Default currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              >
                {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tz" className="block text-sm font-medium text-slate-700">
                Timezone
              </label>
              <select
                id="tz"
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              >
                {zones.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
