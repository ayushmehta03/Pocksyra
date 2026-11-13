"use client";

import { useEffect, useRef, useState } from "react";
import { ScanIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { modelDownloadLabel } from "@/lib/llm/engine";
import { LOW_CONFIDENCE } from "@/lib/receipt/parser";
import type { ScanProgress, ScanResult } from "@/lib/receipt/ocr";

type State =
  | { kind: "idle" }
  | { kind: "scanning"; progress: ScanProgress }
  | { kind: "done"; result: ScanResult }
  | { kind: "error"; message: string };

// The on-device AI step that rescues receipts the rules couldn't fully read.
type Ai =
  | { kind: "none" }
  | { kind: "unsupported" }
  | { kind: "offer"; result: ScanResult }
  | { kind: "running"; text: string; progress: number }
  | { kind: "done"; filled: string[] }
  | { kind: "failed"; message: string; result: ScanResult };

const MAX_BYTES = 15 * 1024 * 1024;

function friendly(p: ScanProgress): string {
  if (/recogniz/i.test(p.status)) return "Reading your receipt…";
  if (/pdf/i.test(p.status)) return "Reading the PDF…";
  if (/load|initializ/i.test(p.status)) return "Getting ready (the first scan downloads ~10 MB, then it's cached)…";
  return "Preparing the photo…";
}

const FIELDS = ["merchant", "date", "total", "category"] as const;

/** Which fields the AI added or replaced, for the "AI filled in…" note. */
function filledBy(before: ScanResult, after: ScanResult): string[] {
  return FIELDS.filter((k) => after[k] && after[k]?.value !== before[k]?.value);
}

/**
 * Pick or take a photo of a receipt (or choose a PDF); the text is read on this
 * device and handed to the form to pre-fill. If the rules can't make sense of
 * the layout, an on-device language model can have a go. Nothing is uploaded.
 */
export function ScanReceipt({ onResult }: { onResult: (r: ScanResult) => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [ai, setAi] = useState<Ai>({ kind: "none" });
  const input = useRef<HTMLInputElement>(null);

  // Release the OCR engine's and the model's memory when leaving the page.
  useEffect(
    () => () => {
      void import("@/lib/receipt/ocr").then((m) => m.disposeOcr()).catch(() => {});
      void import("@/lib/llm/engine").then((m) => m.disposeEngine()).catch(() => {});
    },
    [],
  );

  const runAi = async (result: ScanResult) => {
    setAi({ kind: "running", text: "Starting the on-device model…", progress: 0 });
    try {
      const { improveWithLlm } = await import("@/lib/receipt/llm-parse");
      const improved = await improveWithLlm(result, (p) => setAi({ kind: "running", text: p.text, progress: p.progress }));
      const merged: ScanResult = { ...improved, ocrConfidence: result.ocrConfidence };
      setState({ kind: "done", result: merged });
      onResult(merged);
      setAi({ kind: "done", filled: filledBy(result, merged) });
    } catch (err) {
      setAi({
        kind: "failed",
        message: err instanceof Error ? err.message : "The on-device model couldn't run.",
        result,
      });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = ""; // allow picking the same file again
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf && !file.type.startsWith("image/")) {
      return setState({ kind: "error", message: "Please choose a photo or a PDF." });
    }
    if (file.size > MAX_BYTES) return setState({ kind: "error", message: "That file is too large (15 MB max)." });

    setAi({ kind: "none" });
    setState({ kind: "scanning", progress: { status: "preparing", progress: 0 } });
    try {
      const { extractReceipt } = await import("@/lib/receipt/ocr");
      const result = await extractReceipt(file, (progress) => setState({ kind: "scanning", progress }));

      // Nothing readable at all: there is no text for the AI to work with either.
      if (result.rawText.trim().length < 8) {
        return setState({
          kind: "error",
          message: "Couldn't read any text. Try a flatter, brighter photo (or a clearer PDF) with the whole receipt in frame.",
        });
      }

      setState({ kind: "done", result });
      onResult(result);

      const { needsHelp } = await import("@/lib/receipt/llm-verify");
      if (!needsHelp(result)) return;
      const { webGpuAvailable, modelCached } = await import("@/lib/llm/engine");
      if (!webGpuAvailable()) return setAi({ kind: "unsupported" });
      // Already downloaded: just use it. Otherwise ask first, it's a big download.
      if (await modelCached()) void runAi(result);
      else setAi({ kind: "offer", result });
    } catch {
      setState({
        kind: "error",
        message: "Scanning failed. The first scan needs a connection to download the reader; check yours and try again.",
      });
    }
  };

  const scanning = state.kind === "scanning";
  const pct = scanning ? Math.round(state.progress.progress * 100) : 0;
  const aiBusy = ai.kind === "running";

  return (
    <div className="surface space-y-4 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-jade-400/25 to-gold-400/10 text-jade-300 ring-1 ring-white/10">
          <ScanIcon width={20} height={20} />
        </span>

        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-sm font-semibold text-ivory-50">Scan a receipt</p>
          {state.kind === "idle" && (
            <p className="text-xs leading-relaxed text-ink-300">
              Choose a photo or a PDF and we&apos;ll fill in the details. It&apos;s read on your device; the file is never uploaded.
            </p>
          )}
          {scanning && (
            <div className="mt-1 space-y-2">
              <p className="text-xs text-ink-300">{friendly(state.progress)}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-gradient-to-r from-jade-400 to-gold-300 transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
              </div>
            </div>
          )}
          {state.kind === "done" && (
            <p className="text-xs leading-relaxed text-ink-300">
              Filled in{" "}
              {[
                state.result.merchant?.value,
                state.result.total && `total ${state.result.total.value}`,
                state.result.date && formatDate(state.result.date.value),
              ]
                .filter(Boolean)
                .join(" · ") || "what we could read"}
              .{" "}
              {[state.result.merchant, state.result.total, state.result.date].some((f) => f && f.confidence < LOW_CONFIDENCE) && (
                <span className="font-medium text-gold-400">Yellow fields need a quick check.</span>
              )}
            </p>
          )}
          {state.kind === "error" && <p className="text-xs font-medium text-red-300">{state.message}</p>}
        </div>

        <input
          ref={input}
          type="file"
          accept="image/*,application/pdf,.pdf"
          className="sr-only"
          aria-label="Receipt photo or PDF"
          tabIndex={-1}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button type="button" variant="ghost" size="sm" loading={scanning} disabled={aiBusy} onClick={() => input.current?.click()}>
          {state.kind === "done" ? "Scan another" : "Photo or PDF"}
        </Button>
      </div>

      {ai.kind !== "none" && (
        <div className="rounded-xl bg-white/[0.04] p-4 text-xs leading-relaxed text-ink-300" aria-live="polite">
          {ai.kind === "unsupported" && (
            <p>Some fields couldn&apos;t be read. This browser can&apos;t run on-device AI (it needs WebGPU), so please fill them in by hand.</p>
          )}
          {ai.kind === "offer" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="flex-1">
                Some fields couldn&apos;t be read. An on-device AI can try again. It downloads once ({modelDownloadLabel()}), then works offline, and your receipt never leaves this device.
              </p>
              <Button type="button" size="sm" onClick={() => void runAi(ai.result)}>
                Use on-device AI
              </Button>
            </div>
          )}
          {ai.kind === "running" && (
            <div className="space-y-2">
              <p>{ai.progress < 1 ? "Getting the AI ready…" : "Reading the receipt…"} {ai.text && <span className="text-ink-400">{ai.text}</span>}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(ai.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-gradient-to-r from-jade-400 to-gold-300 transition-all" style={{ width: `${Math.max(Math.round(ai.progress * 100), 4)}%` }} />
              </div>
            </div>
          )}
          {ai.kind === "done" && (
            <p>
              {ai.filled.length > 0 ? (
                <>
                  AI filled in <span className="font-medium text-jade-300">{ai.filled.join(", ")}</span>. Please check it against the receipt.
                </>
              ) : (
                "The AI couldn't find anything more in this receipt. Please fill in the rest by hand."
              )}
            </p>
          )}
          {ai.kind === "failed" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-red-300">{ai.message}</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => void runAi(ai.result)}>
                Try again
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
