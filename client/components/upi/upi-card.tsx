"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { WalletIcon } from "@/components/icons";
import { Button, Field, FormError } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { UPI_HINT, isValidUpi, normalizeUpi } from "@/lib/upi";

// "Later" hides the card for this browser session only, so it comes back on the
// next visit until the user has actually added a UPI ID.
const SKIP_KEY = "pocksyra.upi.skipped";

export function UpiCard() {
  const { user, updateProfile } = useAuth();
  const [skipped, setSkipped] = useState(true); // hidden until storage is read (no flash)
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      setSkipped(sessionStorage.getItem(SKIP_KEY) === "1");
    } catch {
      setSkipped(false);
    }
  }, []);

  if (!user || user.upiId || skipped) return null;

  function skip() {
    setSkipped(true);
    try {
      sessionStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* storage blocked */
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidUpi(value)) {
      setError("That doesn't look like a UPI ID. " + UPI_HINT);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ upiId: normalizeUpi(value) });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface relative space-y-4 p-5 ring-1 ring-warn/25">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warn/10 text-warn">
          <WalletIcon width={20} height={20} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">Add your UPI ID</p>
          <p className="text-xs leading-relaxed text-fg-2">
            Friends will be able to pay you back straight from Pocksyra. It only takes a few seconds, and you can change
            it later in Settings.
          </p>
        </div>
      </div>

      <FormError message={error} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field
            label="UPI ID"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="name@okhdfcbank"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            hint={UPI_HINT}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={saving} disabled={!value.trim()}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={skip}>
            Later
          </Button>
        </div>
      </div>
    </form>
  );
}
