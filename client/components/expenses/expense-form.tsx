"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { CategoryIcon } from "@/components/category-icon";
import { CheckIcon } from "@/components/icons";
import { AnimatePresence, EASE, FadeUp, m } from "@/components/motion";
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
  const methodId = useId();
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
    <form onSubmit={submit} className="space-y-6" noValidate>
      <ScanReceipt onResult={applyScan} />

      <FadeUp>
        <section className="surface overflow-hidden" aria-label="Amount and details">
          <div className={`px-6 pb-7 pt-6 text-center transition-colors ${unsure.amount ? "bg-warn/[0.07]" : ""}`}>
            <label htmlFor="expense-amount" className="text-xs font-medium text-fg-3">
              How much was it?
            </label>
            <div className="mt-3 flex items-center justify-center gap-3">
              <select
                aria-label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-full border-0 bg-wash/[0.07] py-1.5 pl-3 pr-2 text-base font-semibold text-fg outline-none transition hover:bg-wash/10 sm:text-sm focus:ring-4 focus:ring-accent/20"
              >
                {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input
                id="expense-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountText}
                aria-invalid={amountText.trim() !== "" && amountMinor === null}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  edited("amount");
                }}
                className="num w-full min-w-0 max-w-[13rem] bg-transparent text-center font-mono text-4xl font-semibold sm:text-5xl tracking-tight text-fg outline-none placeholder:text-fg-4"
              />
            </div>
            {amountText.trim() && amountMinor === null ? (
              <p className="mt-2 text-xs font-medium text-danger">Invalid amount</p>
            ) : unsure.amount ? (
              <p className="mt-2 text-xs font-medium text-warn">Please double-check this total.</p>
            ) : null}
          </div>

          <div className="space-y-5 border-t border-wash/[0.08] p-6">
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
            <div className="grid gap-5 sm:grid-cols-2">
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
              <Field
                label="Merchant (optional)"
                placeholder="Toscana Bistro"
                value={merchant}
                maxLength={80}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p id="expense-category-label" className="text-[13px] font-medium tracking-wide text-fg-2">
                Category
              </p>
              <div
                role="radiogroup"
                aria-labelledby="expense-category-label"
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
              >
                {CATEGORIES.map((c) => {
                  const on = category === c.id;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-accent/25 ${
                        on
                          ? "border-accent bg-accent/10 text-fg"
                          : "border-wash/10 bg-transparent text-fg-2 hover:bg-wash/5"
                      }`}
                    >
                      <CategoryIcon id={c.id} width={14} height={14} />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </FadeUp>

      <section className="surface space-y-4 p-6" aria-label="Who is sharing">
        <div>
          <h2 className="text-sm font-semibold text-fg">
            Split with <span className="font-normal text-fg-3">(optional)</span>
          </h2>
          <p className="mt-1 text-xs text-fg-3">Leave everyone unselected to log it as just your own expense.</p>
        </div>
        {friendsLoading ? (
          <p className="text-sm text-fg-3">Loading friends…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-fg-2">
            No friends yet, so this will be just your own expense.{" "}
            <Link href="/dashboard/friends" className="text-accent-text underline underline-offset-4">
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
                  className={`flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-sm font-medium outline-none transition active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-accent/25 ${
                    on ? "border-accent bg-accent/10 text-fg" : "border-wash/10 bg-transparent text-fg-2 hover:bg-wash/5"
                  }`}
                >
                  <Avatar user={f} className="h-7 w-7 text-[10px]" />
                  {f.name}
                  <AnimatePresence initial={false}>
                    {on && (
                      <m.span
                        key="tick"
                        initial={{ scale: 0, width: 0 }}
                        animate={{ scale: 1, width: 16 }}
                        exit={{ scale: 0, width: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="flex h-4 items-center justify-center text-accent-text"
                      >
                        <CheckIcon width={16} height={16} />
                      </m.span>
                    )}
                  </AnimatePresence>
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

      <AnimatePresence initial={false}>
        {selected.size > 0 && (
          <m.section
            key="split"
            className="surface space-y-5 p-6"
            aria-label="How to split"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div>
              <h2 className="text-sm font-semibold text-fg">How to split</h2>
              <div role="tablist" className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-wash/[0.06] p-1">
                {METHODS.map((opt) => (
                  <button
                    type="button"
                    role="tab"
                    key={opt.id}
                    aria-selected={method === opt.id}
                    onClick={() => setMethod(opt.id)}
                    className={`relative rounded-lg px-2 py-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
                      method === opt.id ? "text-fg" : "text-fg-2 hover:text-fg"
                    }`}
                  >
                    {method === opt.id && (
                      <m.span
                        layoutId={`${methodId}-method`}
                        className="absolute inset-0 rounded-lg bg-panel shadow-sm ring-1 ring-wash/10"
                        transition={{ duration: 0.3, ease: EASE }}
                      />
                    )}
                    <span className="relative">{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-fg-3">{METHODS.find((opt) => opt.id === method)?.hint}</p>
            </div>

            <ul className="divide-y divide-wash/[0.06]">
              {participantIds.map((id) => {
                const person = everyone.find((p) => p.id === id)!;
                const share = result?.ok ? result.shares.get(id) : undefined;
                return (
                  <li key={id} className="flex items-center gap-3 py-3">
                    <Avatar user={person} className="h-9 w-9 shrink-0 text-xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{person.name}</span>
                    {method !== "equal" && (
                      <input
                        aria-label={`${person.name}: ${method}`}
                        inputMode="decimal"
                        value={values[id] ?? (method === "shares" ? "1" : "")}
                        placeholder={method === "percent" ? "0 %" : method === "shares" ? "1" : "0.00"}
                        onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
                        className="w-24 rounded-lg border border-wash/10 bg-panel-2 px-3 py-2 text-right font-mono text-base text-fg sm:text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
                      />
                    )}
                    <span className="num w-28 text-right font-mono text-sm font-medium text-fg">
                      {share !== undefined ? formatMoney(share, currency) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {splitError && amountText.trim() ? (
              <p className="text-xs font-medium text-warn">{splitError}</p>
            ) : result?.ok && amountMinor ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent-text">
                <CheckIcon width={14} height={14} />
                Adds up to {formatMoney(amountMinor, currency)}
              </p>
            ) : null}
          </m.section>
        )}
      </AnimatePresence>

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
