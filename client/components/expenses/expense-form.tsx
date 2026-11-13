"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { ScanReceipt } from "@/components/receipt/scan-receipt";
import { Button, Field, FormError, SelectField } from "@/components/ui";
import {
  ApiError,
  errorMessage,
  expensesApi,
  newIdempotencyKey,
  type ExpenseInput,
  type PublicUser,
  type SplitMethod,
} from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { formatMoney } from "@/lib/format";
import { parseBasisPoints, parseMinor } from "@/lib/money";
import { LOW_CONFIDENCE } from "@/lib/receipt/parser";
import type { ScanResult } from "@/lib/receipt/ocr";
import { computeSplit, type SplitRow } from "@/lib/split";
import { useFriends } from "@/lib/use-friends";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];

const METHODS: { id: SplitMethod; label: string; hint: string }[] = [
  { id: "equal", label: "Equally", hint: "Everyone pays the same." },
  { id: "exact", label: "Amounts", hint: "Type exactly what each person owes." },
  { id: "percent", label: "Percent", hint: "Percentages must add up to 100." },
  { id: "shares", label: "Shares", hint: "2 shares pays double 1 share." },
];

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ExpenseForm({ presetFriendId }: { presetFriendId?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { data: friendData, loading: friendsLoading } = useFriends();

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [currency, setCurrency] = useState(user?.defaultCurrency ?? "INR");
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(presetFriendId ? [presetFriendId] : []),
  );
  const [paidBy, setPaidBy] = useState(user?.id ?? "");
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("other");
  const [receiptConfidence, setReceiptConfidence] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
  // Fields pre-filled by the receipt scanner that the reader wasn't sure about.
  const [unsure, setUnsure] = useState<{ description?: boolean; amount?: boolean; date?: boolean }>({});

  const me = user as NonNullable<typeof user>;
  const friends = useMemo(() => friendData?.friends.map((f) => f.friend) ?? [], [friendData]);
  const everyone: PublicUser[] = useMemo(
    () => (user ? [{ id: user.id, name: "You", username: user.username, avatarUrl: user.avatarUrl }, ...friends] : []),
    [user, friends],
  );

  if (!user) return null;

  const amountMinor = parseMinor(amountText, currency);
  const participantIds = [me.id, ...friends.filter((f) => selected.has(f.id)).map((f) => f.id)];

  const rows: SplitRow[] | null = (() => {
    const out: SplitRow[] = [];
    for (const id of participantIds) {
      const raw = values[id] ?? (method === "shares" ? "1" : "");
      let v: number | null = 0;
      if (method === "exact") v = parseMinor(raw || "0", currency);
      else if (method === "percent") v = parseBasisPoints(raw || "0");
      else if (method === "shares") v = /^\d+$/.test(raw.trim()) ? Number(raw) : null;
      if (v === null) return null;
      out.push({ userId: id, value: v });
    }
    return out;
  })();

  const result = amountMinor && rows ? computeSplit(amountMinor, method, rows) : null;
  const splitError =
    amountMinor === null && amountText.trim() ? "Enter a valid amount." : rows === null ? "Check the values you typed." : result && !result.ok ? result.error : "";

  const applyScan = (r: ScanResult) => {
    const low = (f?: { confidence: number }) => !!f && f.confidence < LOW_CONFIDENCE;
    if (r.merchant) {
      setDescription(r.merchant.value);
      setMerchant(r.merchant.value);
    }
    setReceiptConfidence(r.ocrConfidence);
    if (r.category && CATEGORIES.some((c) => c.id === r.category!.value)) setCategory(r.category.value);
    if (r.total) setAmountText(r.total.value);
    if (r.date) setDate(r.date.value);
    if (r.currency) setCurrency(r.currency);
    setUnsure({ description: low(r.merchant), amount: low(r.total), date: low(r.date) });
  };
  const edited = (k: "description" | "amount" | "date") => setUnsure((u) => ({ ...u, [k]: false }));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (selected.has(id) && paidBy === id) setPaidBy(me.id);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!description.trim()) return setError("What was this for?");
    if (!amountMinor) return setError("Enter a valid amount.");
    if (!rows || !result || !result.ok) return setError(splitError || "Check the split.");

    const input: ExpenseInput = {
      description: description.trim(),
      merchant: merchant.trim() || undefined,
      category,
      receiptMeta: receiptConfidence === null ? undefined : { ocrConfidence: receiptConfidence },
      amount: amountMinor,
      currency,
      paidBy,
      method,
      splits: rows.map((r) => ({ userId: r.userId, value: r.value })),
      date: new Date(`${date}T12:00:00`).toISOString(),
    };

    // Same payload => same key, so a retry can't double-book; edited payload => new key.
    const sig = JSON.stringify(input);
    if (!keyRef.current || keyRef.current.sig !== sig) keyRef.current = { sig, key: newIdempotencyKey() };

    setBusy(true);
    try {
      await expensesApi.create(input, keyRef.current.key);
      router.push("/dashboard/expenses");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? "You can only split with accepted friends." : errorMessage(err));
      setBusy(false);
    }
  };

  const nameOf = (id: string) => everyone.find((p) => p.id === id)?.name ?? "Someone";

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <ScanReceipt onResult={applyScan} />

      <div className="surface space-y-5 p-6">
        <Field
          label="What was it for?"
          placeholder="Dinner at Toscana"
          value={description}
          maxLength={120}
          onChange={(e) => {
            setDescription(e.target.value);
            edited("description");
          }}
          warn={unsure.description}
          hint={unsure.description ? "Read from the receipt; please double-check." : undefined}
        />
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem_10rem]">
          <Field
            label="Amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value);
              edited("amount");
            }}
            warn={unsure.amount}
            hint={unsure.amount ? "Please double-check this total." : undefined}
            error={amountText.trim() && amountMinor === null ? "Invalid amount" : undefined}
            className="font-mono"
          />
          <SelectField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </SelectField>
          <Field
            label="Date"
            type="date"
            value={date}
            max={today()}
            warn={unsure.date}
            onChange={(e) => {
              setDate(e.target.value);
              edited("date");
            }}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <Field
            label="Merchant (optional)"
            placeholder="Toscana Bistro"
            value={merchant}
            maxLength={80}
            onChange={(e) => setMerchant(e.target.value)}
          />
        </div>
      </div>

      <section className="surface space-y-4 p-6" aria-label="Who is sharing">
        <div>
          <h2 className="text-sm font-semibold text-ivory-50">Split with <span className="font-normal text-ink-400">(optional)</span></h2>
          <p className="mt-1 text-xs text-ink-400">Leave everyone unselected to log it as just your own expense.</p>
        </div>
        {friendsLoading ? (
          <p className="text-sm text-ink-400">Loading friends…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-ink-300">
            No friends yet, so this will be just your own expense.{" "}
            <Link href="/dashboard/friends" className="text-jade-300 underline underline-offset-4">
              Add a friend
            </Link>{" "}
            to split bills.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {friends.map((f) => {
              const on = selected.has(f.id);
              return (
                <button
                  type="button"
                  key={f.id}
                  aria-pressed={on}
                  onClick={() => toggle(f.id)}
                  className={`flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-sm font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-jade-400/25 ${
                    on
                      ? "border-jade-400/60 bg-jade-400/15 text-ivory-50"
                      : "border-white/10 bg-white/[0.04] text-ink-300 hover:bg-white/[0.08]"
                  }`}
                >
                  <Avatar user={f} className="h-7 w-7 text-[10px]" />
                  {f.name}
                </button>
              );
            })}
          </div>
        )}

        {selected.size > 0 && (
          <SelectField label="Paid by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {participantIds.map((id) => (
              <option key={id} value={id}>
                {id === me.id ? "You" : nameOf(id)}
              </option>
            ))}
          </SelectField>
        )}
      </section>

      {selected.size > 0 && (
        <section className="surface space-y-5 p-6" aria-label="How to split">
          <div>
            <h2 className="text-sm font-semibold text-ivory-50">How to split</h2>
            <div role="tablist" className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-white/[0.05] p-1">
              {METHODS.map((m) => (
                <button
                  type="button"
                  role="tab"
                  key={m.id}
                  aria-selected={method === m.id}
                  onClick={() => setMethod(m.id)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-jade-400/40 ${
                    method === m.id ? "bg-jade-400 text-ink-950" : "text-ink-300 hover:text-ivory-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-400">{METHODS.find((m) => m.id === method)?.hint}</p>
          </div>

          <ul className="divide-y divide-white/[0.06]">
            {participantIds.map((id) => {
              const person = everyone.find((p) => p.id === id)!;
              const share = result?.ok ? result.shares.get(id) : undefined;
              return (
                <li key={id} className="flex items-center gap-3 py-3">
                  <Avatar user={person} className="h-9 w-9 shrink-0 text-xs" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ivory-50">{person.name}</span>
                  {method !== "equal" && (
                    <input
                      aria-label={`${person.name}: ${method}`}
                      inputMode="decimal"
                      value={values[id] ?? (method === "shares" ? "1" : "")}
                      placeholder={method === "percent" ? "0 %" : method === "shares" ? "1" : "0.00"}
                      onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
                      className="w-24 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-right font-mono text-sm text-ivory-50 outline-none focus:border-jade-400/70"
                    />
                  )}
                  <span className="w-28 text-right font-mono text-sm text-jade-300">
                    {share !== undefined ? formatMoney(share, currency) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          {splitError && amountText.trim() && <p className="text-xs font-medium text-gold-400">{splitError}</p>}
        </section>
      )}

      <FormError message={error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save expense
        </Button>
      </div>
    </form>
  );
}
