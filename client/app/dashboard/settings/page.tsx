"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Button, Field, FormError, SelectField } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { LogoutIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { UPI_HINT, isValidUpi, normalizeUpi } from "@/lib/upi";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [tz, setTz] = useState("");
  const [upi, setUpi] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setCurrency(user.defaultCurrency);
      setTz(user.tz);
      setUpi(user.upiId ?? "");
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

  const dirty =
    name.trim() !== user.name ||
    currency !== user.defaultCurrency ||
    tz !== user.tz ||
    normalizeUpi(upi) !== (user.upiId ?? "");

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!name.trim()) {
      setError("Name can't be empty");
      return;
    }
    if (upi.trim() && !isValidUpi(upi)) {
      setError("That doesn't look like a UPI ID. " + UPI_HINT);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), defaultCurrency: currency, tz, upiId: normalizeUpi(upi) });
      setMessage("Changes saved");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Settings"
        title="Your account"
        subtitle="Manage how you appear and how Pocksyra shows your money."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={onSave} className="surface space-y-6 p-6 sm:p-8 lg:col-span-3">
          <h2 className="text-lg font-semibold tracking-tight text-ivory-50">Profile</h2>
          <FormError message={error} />
          {message && (
            <div role="status" className="rounded-xl border border-jade-400/30 bg-jade-400/10 px-4 py-3 text-sm text-jade-300">
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

          <Field
            label="UPI ID"
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="name@okhdfcbank"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            hint={user.upiId ? UPI_HINT : `${UPI_HINT}. Friends will use it to pay you back.`}
          />

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </form>

        <aside className="lg:col-span-2">
          <div className="surface relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-jade-500/25 blur-[70px]" />
            <div className="relative flex items-center gap-4">
              <Avatar user={user} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-ivory-50">{user.name}</p>
                <p className="truncate text-sm text-ink-400">@{user.username}</p>
              </div>
            </div>
            <dl className="relative mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Email</dt>
                <dd className="truncate text-ivory-100">{user.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Member since</dt>
                <dd className="text-ivory-100">{formatDate(user.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Sign-in</dt>
                <dd className="text-ivory-100">Google</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
              className="relative mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-ink-300 transition hover:bg-white/[0.06] hover:text-ivory-50"
            >
              <LogoutIcon width={16} height={16} />
              Log out
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
