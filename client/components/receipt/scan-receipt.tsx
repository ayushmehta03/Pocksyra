"use client";

import { useEffect, useRef, useState } from "react";
import { ScanIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { LOW_CONFIDENCE } from "@/lib/receipt/parser";
import type { ScanProgress, ScanResult } from "@/lib/receipt/ocr";

type State =
  | { kind: "idle" }
  | { kind: "scanning"; progress: ScanProgress }
  | { kind: "done"; result: ScanResult }
  | { kind: "error"; message: string };

const MAX_BYTES = 15 * 1024 * 1024;

function friendly(p: ScanProgress): string {
  if (/recogniz/i.test(p.status)) return "Reading your receipt…";
  if (/load|initializ/i.test(p.status)) return "Getting ready (the first scan downloads ~10 MB, then it's cached)…";
  return "Preparing the photo…";
}

/**
 * Pick or take a photo of a receipt; the text is read on this device and the
 * result is handed to the form to pre-fill. Nothing is uploaded.
 */
export function ScanReceipt({ onResult }: { onResult: (r: ScanResult) => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);

  // Release the OCR engine's memory when leaving the page.
  useEffect(
    () => () => {
      void import("@/lib/receipt/ocr").then((m) => m.disposeOcr()).catch(() => {});
    },
    [],
  );

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = ""; // allow picking the same file again
    if (!file) return;
    if (!file.type.startsWith("image/")) return setState({ kind: "error", message: "Please choose a photo." });
    if (file.size > MAX_BYTES) return setState({ kind: "error", message: "That photo is too large (15 MB max)." });

    setState({ kind: "scanning", progress: { status: "preparing", progress: 0 } });
    try {
      const { extractReceipt } = await import("@/lib/receipt/ocr");
      const result = await extractReceipt(file, (progress) => setState({ kind: "scanning", progress }));
      if (!result.total && !result.merchant && !result.date) {
        return setState({
          kind: "error",
          message: "Couldn't read anything useful. Try a flatter, brighter photo with the whole receipt in frame.",
        });
      }
      setState({ kind: "done", result });
      onResult(result);
    } catch {
      setState({
        kind: "error",
        message: "Scanning failed. The first scan needs a connection to download the reader; check yours and try again.",
      });
    }
  };

  const scanning = state.kind === "scanning";
  const pct = scanning ? Math.round(state.progress.progress * 100) : 0;

  return (
    <div className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-jade-400/25 to-gold-400/10 text-jade-300 ring-1 ring-white/10">
        <ScanIcon width={20} height={20} />
      </span>

      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-sm font-semibold text-ivory-50">Scan a receipt</p>
        {state.kind === "idle" && (
          <p className="text-xs leading-relaxed text-ink-300">
            Snap or choose a photo and we&apos;ll fill in the details. It&apos;s read on your device; the photo is never uploaded.
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
              .join(" · ")}
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
        accept="image/*"
        className="sr-only"
        aria-label="Receipt photo"
        tabIndex={-1}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button type="button" variant="ghost" size="sm" loading={scanning} onClick={() => input.current?.click()}>
        {state.kind === "done" ? "Scan another" : "Choose photo"}
      </Button>
    </div>
  );
}
