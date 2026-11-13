import { guessCategory } from "./category";
import { parseReceipt as parseRaw, type OcrLine, type ParsedReceipt } from "./parser";

/** Rule-based parse plus a keyword-based category guess. */
function parseReceipt(input: OcrLine[]): ParsedReceipt {
  const r = parseRaw(input);
  return { ...r, category: r.category ?? guessCategory(r.rawText) };
}
import { isPdf, readPdfText, renderPdfPages } from "./pdf";
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

/** OCR one image: preprocess, recognize, return lines plus page-level confidence (0-1). */
async function ocrImage(image: Blob): Promise<{ lines: OcrLine[]; confidence: number }> {
  const prepared = await preprocessImage(image);
  const worker = await getWorker();
  const { data } = await worker.recognize(prepared, {}, { blocks: true, text: true });
  const raw = data as unknown as RawData;
  return { lines: linesOf(raw), confidence: Math.max(0, Math.min(1, (raw.confidence ?? 0) / 100)) };
}

/**
 * Reads a receipt (photo or PDF) and returns the merchant, date, total and
 * line items, each with a confidence. Nothing leaves the device.
 *
 * - Photos: preprocessed and OCR'd.
 * - Digital PDFs: the embedded text is read directly (exact, no OCR).
 * - Scanned PDFs: pages are rendered to images, then OCR'd.
 *
 * Kept behind this one function so a cloud OCR engine could replace it later
 * without touching the form.
 */
export async function extractReceipt(file: File | Blob, progress?: (p: ScanProgress) => void): Promise<ScanResult> {
  onProgress = progress;
  try {
    if (isPdf(file as Blob & { name?: string })) {
      progress?.({ status: "reading pdf", progress: 0 });
      const text = await readPdfText(file);
      if (text) return { ...parseReceipt(text), ocrConfidence: 0.98 };

      // Scanned PDF: no text layer, so render and OCR.
      const pages = await renderPdfPages(file);
      const lines: OcrLine[] = [];
      let conf = 0;
      for (const page of pages) {
        const r = await ocrImage(page);
        lines.push(...r.lines);
        conf += r.confidence;
      }
      return { ...parseReceipt(lines), ocrConfidence: pages.length ? conf / pages.length : 0 };
    }

    progress?.({ status: "preparing image", progress: 0 });
    const { lines, confidence } = await ocrImage(file);
    return { ...parseReceipt(lines), ocrConfidence: confidence };
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
