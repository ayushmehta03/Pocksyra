"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Button, Field, FormError, SelectField } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { Avatar } from "@/components/avatar";
import { formatDate } from "@/lib/format";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [tz, setTz] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      /* older browsers */
    }
    if (user?.tz && !list.includes(user.tz)) list = [user.tz, ...list];
    return list;
  }, [user?.tz]);

  if (!user) return null;

  const dirty = name.trim() !== user.name || currency !== user.defaultCurrency || tz !== user.tz;

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
      setMessage("Changes saved");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Settings" title="Your account" subtitle="Manage how you appear and how Pocksyra shows your money." />

      <div className="grid gap-6 lg:grid-cols-5">
        <form
          onSubmit={onSave}
          className="space-y-6 rounded-3xl border border-ivory-300 bg-paper p-6 sm:p-8 lg:col-span-3"
        >
          <h2 className="font-display text-2xl text-ink-900">Profile</h2>
          <FormError message={error} />
          {message && (
            <div role="status" className="rounded-xl border border-jade-500/30 bg-jade-500/10 px-4 py-3 text-sm text-jade-700">
              {message}
            </div>
          )}

          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField label="Default currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectField>
            <SelectField label="Timezone" value={tz} onChange={(e) => setTz(e.target.value)}>
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </SelectField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </form>

        <aside className="space-y-6 lg:col-span-2">
          <div className="grain relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-ivory-50">
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-jade-600/40 blur-[70px]" />
            <div className="relative flex items-center gap-4">
              <Avatar user={user} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-2xl">{user.name}</p>
                <p className="truncate text-sm text-ink-300">@{user.username}</p>
              </div>
            </div>
            <dl className="relative mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Email</dt>
                <dd className="truncate">{user.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Member since</dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
