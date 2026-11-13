"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { categoryTone } from "@/components/category-icon";
import { EmptyState, ListSkeleton } from "@/components/empty-state";
import { ReceiptIcon, SparkIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Button, FormError } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { categoryLabel } from "@/lib/categories";
import { formatMoney } from "@/lib/format";
import { buildSections, type SectionId } from "@/lib/insights/facts";
import { loadWindow } from "@/lib/insights/load";
import { buildSummary, type Summary } from "@/lib/insights/summary";
import { modelDownloadLabel, modelCached, webGpuAvailable, disposeEngine } from "@/lib/llm/engine";

const DAYS = 30;

type Shown = { text: string; source: "ai" | "plain"; writing?: boolean };
type Phase = "idle" | "loading-model" | "writing" | "done" | "failed";

export default function InsightsPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [shown, setShown] = useState<Partial<Record<SectionId, Shown>>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ text: "", value: 0 });
  const [gpu, setGpu] = useState<boolean | null>(null);
  const [cached, setCached] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    setGpu(webGpuAvailable());
    void modelCached().then(setCached);
    return () => void disposeEngine().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    loadWindow(DAYS)
      .then((all) => setSummary(buildSummary(all, user.id, DAYS)))
      .catch((err) => setError(errorMessage(err)));
  }, [user]);

  const sections = useMemo(() => (summary ? buildSections(summary) : []), [summary]);
  if (!user) return null;

  const roast = async () => {
    if (!summary || running.current) return;
    running.current = true;
    setPhase("loading-model");
    try {
      const { prepareModel, roastSection } = await import("@/lib/insights/roast");
      await prepareModel((p) => setProgress({ text: p.text, value: p.progress }));
      setPhase("writing");
      for (const sec of sections) {
        setShown((s) => ({ ...s, [sec.id]: { text: "", source: "ai", writing: true } }));
        const res = await roastSection(sec, (text) => setShown((s) => ({ ...s, [sec.id]: { text, source: "ai", writing: true } })));
        setShown((s) => ({ ...s, [sec.id]: res }));
      }
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The on-device model couldn't run.");
      setShown({});
      setPhase("failed");
    } finally {
      running.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insights" title="Your month, roasted" subtitle={`The last ${DAYS} days of your spending, with the numbers worked out first and the jokes second.`} />
      <FormError message={error} />

      {summary === undefined && !error ? (
        <ListSkeleton />
      ) : summary === null ? (
        <EmptyState icon={ReceiptIcon} title="Nothing to roast yet" text={`No expenses in the last ${DAYS} days. Add a few and come back.`}>
          <Link href="/dashboard/expenses/new">
            <Button>Add an expense</Button>
          </Link>
        </EmptyState>
      ) : summary ? (
        <>
          <Stats s={summary} />

          <section className="surface space-y-4 p-5" aria-label="Where it went">
            <div className="flex h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label="Spending by category">
              {summary.categories.map((c) => (
                <div key={c.id} className={categoryTone(c.id).bar} style={{ width: `${c.pct}%` }} />
              ))}
            </div>
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {summary.categories.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${categoryTone(c.id).dot}`} />
                  <span className="flex-1 text-ivory-100">{categoryLabel(c.id)}</span>
                  <span className="font-mono text-ink-300">{formatMoney(c.amount, summary.currency)}</span>
                  <span className="w-10 text-right font-mono text-xs text-ink-400">{c.pct}%</span>
                </li>
              ))}
            </ul>
            {summary.skipped > 0 && (
              <p className="text-xs text-ink-400">
                {summary.skipped} expense{summary.skipped === 1 ? " was" : "s were"} in another currency and left out.
              </p>
            )}
          </section>

          <div className="space-y-3">
            {sections.map((sec) => {
              const cur = shown[sec.id];
              return (
                <article key={sec.id} className="surface space-y-2 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-jade-300">{sec.title}</h2>
                    {cur && !cur.writing && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-300">{cur.source === "ai" ? "AI roast" : "quick take"}</span>
                    )}
                  </div>
                  <p className="text-[15px] leading-relaxed text-ivory-100">
                    {cur?.text || (cur?.writing ? "…" : sec.fallback)}
                    {cur?.writing && cur.text && <span className="ml-0.5 animate-pulse">▍</span>}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="surface space-y-3 p-5">
            {gpu === false ? (
              <p className="text-sm text-ink-300">This browser can&apos;t run on-device AI (it needs WebGPU), so you&apos;re seeing the quick takes. Chrome or Edge on a laptop will do the full roast.</p>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <p className="flex-1 text-sm leading-relaxed text-ink-300">
                    {cached
                      ? "Your on-device AI is ready. Nothing leaves this device."
                      : `The AI runs on this device. The first time it downloads once (${modelDownloadLabel()}), then it works offline. Nothing leaves this device.`}
                  </p>
                  <Button onClick={roast} loading={phase === "loading-model" || phase === "writing"} disabled={gpu === null}>
                    <SparkIcon width={16} height={16} />
                    {phase === "done" ? "Roast me again" : "Roast me"}
                  </Button>
                </div>
                {phase === "loading-model" && (
                  <div className="space-y-2" aria-live="polite">
                    <p className="text-xs text-ink-400">{progress.text || "Starting…"}</p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress.value * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-gradient-to-r from-jade-400 to-gold-300 transition-all" style={{ width: `${Math.max(Math.round(progress.value * 100), 4)}%` }} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stats({ s }: { s: Summary }) {
  const money = (n: number) => formatMoney(n, s.currency);
  const trend =
    s.changePct === null ? "first month" : s.changePct === 0 ? "same as before" : `${s.changePct > 0 ? "+" : ""}${s.changePct}% vs before`;
  const tiles: { label: string; value: string; note?: string; tone?: string }[] = [
    { label: "You spent", value: money(s.total), note: trend, tone: s.changePct !== null && s.changePct > 0 ? "text-gold-400" : "text-jade-300" },
    { label: "Per day", value: money(s.perDay) },
    { label: "Expenses", value: String(s.count), note: `${s.splitCount} shared` },
    { label: "Top category", value: s.categories[0] ? categoryLabel(s.categories[0].id) : "—", note: s.categories[0] ? `${s.categories[0].pct}%` : undefined },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="surface p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-ink-400">{t.label}</p>
          <p className="mt-1 truncate font-mono text-xl font-semibold text-ivory-50">{t.value}</p>
          {t.note && <p className={`mt-0.5 text-xs ${t.tone ?? "text-ink-400"}`}>{t.note}</p>}
        </div>
      ))}
    </div>
  );
}
