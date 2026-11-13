import { groupTextItems, type PdfTextItem } from "./pdf-lines";
import type { OcrLine } from "./parser";

// pdf.js is large, so it is only loaded when someone actually picks a PDF.
// Minimal shapes of the parts of pdf.js we use (keeps us independent of its type exports).
type PdfViewport = { width: number; height: number };
type PdfPage = {
  getViewport(o: { scale: number }): PdfViewport;
  getTextContent(): Promise<{ items: unknown[] }>;
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): { promise: Promise<void> };
};
type PdfDoc = { numPages: number; getPage(n: number): Promise<PdfPage>; destroy(): Promise<void> };

const MAX_TEXT_PAGES = 5;
/** Below this many characters we assume a scanned PDF (no real text layer) and fall back to OCR. */
const MIN_TEXT_CHARS = 30;

async function openPdf(file: Blob): Promise<PdfDoc> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const data = new Uint8Array(await file.arrayBuffer());
  return (await pdfjs.getDocument({ data }).promise) as unknown as PdfDoc;
}

/** Pages worth reading: all of a short document, otherwise the first and last (totals are usually last). */
function pageNumbers(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i + 1);
  return [1, n];
}

/**
 * Digital PDFs (e-invoices, emailed receipts) carry their text, so we read it
 * directly: exact, instant, no OCR. Returns null for scanned PDFs.
 */
export async function readPdfText(file: Blob): Promise<OcrLine[] | null> {
  const doc = await openPdf(file);
  try {
    const lines: OcrLine[] = [];
    for (const n of pageNumbers(doc.numPages, MAX_TEXT_PAGES)) {
      const page = await doc.getPage(n);
      const { items } = await page.getTextContent();
      const frags: PdfTextItem[] = [];
      for (const raw of items) {
        const it = raw as { str?: string; transform?: number[]; width?: number };
        if (typeof it.str === "string" && it.transform) {
          frags.push({ str: it.str, x: it.transform[4]!, y: it.transform[5]!, width: it.width });
        }
      }
      for (const l of groupTextItems(frags)) lines.push({ text: l.text, confidence: 98 });
    }
    const chars = lines.reduce((a, l) => a + l.text.length, 0);
    return chars >= MIN_TEXT_CHARS ? lines : null;
  } finally {
    void doc.destroy();
  }
}

/** Renders pages of a scanned PDF to images so they can go through OCR. */
export async function renderPdfPages(file: Blob, maxPages = 2): Promise<Blob[]> {
  const doc = await openPdf(file);
  try {
    const out: Blob[] = [];
    for (const n of pageNumbers(doc.numPages, maxPages)) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(3, 2000 / Math.max(base.width, base.height)); // ~2000px on the long side
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available in this browser.");
      ctx.fillStyle = "#fff"; // PDFs are transparent by default; OCR needs a white page
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      out.push(
        await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render the PDF page."))), "image/png"),
        ),
      );
    }
    return out;
  } finally {
    void doc.destroy();
  }
}

export function isPdf(file: Blob & { name?: string }): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name ?? "");
}
