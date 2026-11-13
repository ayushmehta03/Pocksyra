import { parseReceipt, type OcrLine, type ParsedReceipt } from "./parser";
import { preprocessImage } from "./preprocess";

export type ScanProgress = { status: string; progress: number };
export type ScanResult = ParsedReceipt & {
  /** engine's average confidence for the whole page, 0-1 */
  ocrConfidence: number;
};

// tesseract.js runs recognition in its own Web Worker, so the UI never blocks.
// One worker is kept for the session: loading the engine and language data is the slow part.
type TessWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;
let workerPromise: Promise<TessWorker> | null = null;
let onProgress: ((p: ScanProgress) => void) | undefined;

function getWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js")
      .then(({ createWorker }) =>
        createWorker("eng", 1, {
          logger: (m: { status: string; progress: number }) => onProgress?.({ status: m.status, progress: m.progress }),
        }),
      )
      .catch((err) => {
        workerPromise = null; // let the next attempt retry (e.g. the model download failed offline)
        throw err;
      });
  }
  return workerPromise;
}

type RawLine = { text: string; confidence: number };
type RawData = {
  text?: string;
  confidence?: number;
  lines?: RawLine[];
  blocks?: { paragraphs?: { lines?: RawLine[] }[] }[];
};

/** tesseract.js moved `lines` under blocks/paragraphs in v6; accept either shape. */
function linesOf(data: RawData): OcrLine[] {
  const raw: RawLine[] =
    data.lines ?? data.blocks?.flatMap((b) => b.paragraphs?.flatMap((p) => p.lines ?? []) ?? []) ?? [];
  if (raw.length > 0) return raw.map((l) => ({ text: l.text, confidence: l.confidence }));
  // Last resort: plain text with the page-level confidence.
  return (data.text ?? "").split("\n").map((text) => ({ text, confidence: data.confidence ?? 0 }));
}

/**
 * Reads a receipt photo and returns the merchant, date, total and line items,
 * each with a confidence. The image never leaves the device.
 *
 * Kept behind this one function so a cloud OCR engine could replace it later
 * without touching the form.
 */
export async function extractReceipt(image: Blob, progress?: (p: ScanProgress) => void): Promise<ScanResult> {
  onProgress = progress;
  try {
    progress?.({ status: "preparing image", progress: 0 });
    const prepared = await preprocessImage(image);
    const worker = await getWorker();
    const { data } = await worker.recognize(prepared, {}, { blocks: true, text: true });
    const raw = data as unknown as RawData;
    const parsed = parseReceipt(linesOf(raw));
    return { ...parsed, ocrConfidence: Math.max(0, Math.min(1, (raw.confidence ?? 0) / 100)) };
  } finally {
    onProgress = undefined;
  }
}

/** Frees the engine's memory (a few tens of MB). Call when the scanner is no longer needed. */
export async function disposeOcr(): Promise<void> {
  const p = workerPromise;
  workerPromise = null;
  if (p) await (await p).terminate();
}
