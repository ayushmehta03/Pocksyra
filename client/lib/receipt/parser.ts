// Turns OCR output into a structured receipt. Pure functions with no imports,
// so it is easy to test and the OCR engine can be swapped without touching it.

/** One recognized line of text with the engine's confidence (0-100). */
export type OcrLine = { text: string; confidence: number };

/** A parsed value plus how much to trust it (0-1). Below LOW_CONFIDENCE the UI flags it. */
export type Field<T> = { value: T; confidence: number };

export type ReceiptItem = { name: string; amount: string };

export type ParsedReceipt = {
  merchant?: Field<string>;
  /** a suggested expense category (only ever set by the AI fallback) */
  category?: Field<string>;
  /** yyyy-mm-dd */
  date?: Field<string>;
  /** plain decimal text like "1234.50", ready for the amount input */
  total?: Field<string>;
  currency?: string;
  items: ReceiptItem[];
  rawText: string;
};

export const LOW_CONFIDENCE = 0.7;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const conf = (line: OcrLine) => clamp01(line.confidence / 100);

// ---------- amounts ----------

// 1,234.50 | 1.234,50 | 1 234.50 | 12.5 is NOT an amount (needs 2 decimals) | 120 alone is not either
const AMOUNT_RE = /(?<![\d.,])(\d{1,3}(?:[ ,.]\d{3})+[.,]\d{2}|\d+[.,]\d{2})(?![\d])/g;

/** "1.234,50" / "1,234.50" / "1 234.50" -> "1234.50". Returns null if it isn't a clean amount. */
export function normalizeAmount(raw: string): string | null {
  const s = raw.trim();
  const m = /^(.*?)[.,](\d{2})$/.exec(s);
  if (!m) return null;
  const whole = m[1]!.replace(/[ ,.]/g, "");
  if (!/^\d+$/.test(whole)) return null;
  const n = Number(whole);
  if (!Number.isSafeInteger(n)) return null;
  return `${whole.replace(/^0+(?=\d)/, "")}.${m[2]}`;
}

export function amountsIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const a = normalizeAmount(m[1]!);
    
    if (a) out.push(a);
  }
  return out;
}

export function detectCurrency(text: string): string | undefined {
  if (/₹|\brs\.?\s*\d|\binr\b/i.test(text)) return "INR";
  if (/€|\beur\b/i.test(text)) return "EUR";
  if (/£|\bgbp\b/i.test(text)) return "GBP";
  if (/\bAED\b|د\.إ/i.test(text)) return "AED";
  if (/\$|\busd\b/i.test(text)) return "USD";
  return undefined;
}

// ---------- total ----------

const NOT_TOTAL = /sub\s*-?\s*total|tax|gst|vat|cgst|sgst|discount|saving|change|cash|tender|round|tip|points/i;

// Higher rank wins; ties go to the line lowest on the receipt.
const TOTAL_RANKS: { re: RegExp; rank: number }[] = [
  { re: /grand\s*total/i, rank: 4 },
  { re: /(amount|balance)\s*(due|payable)|total\s*(due|payable)|net\s*(amount|total|payable)|to\s*pay/i, rank: 3 },
  { re: /\btotal\b/i, rank: 2 },
];

function findTotal(lines: OcrLine[]): Field<string> | undefined {
  let best: { rank: number; index: number; value: string; confidence: number } | undefined;

  lines.forEach((line, index) => {
    if (NOT_TOTAL.test(line.text)) return;
    const hit = TOTAL_RANKS.find((r) => r.re.test(line.text));
    if (!hit) return;
    // Amount on the same line, otherwise on the line right after the label.
    let amounts = amountsIn(line.text);
    let c = conf(line);
    if (amounts.length === 0 && lines[index + 1]) {
      amounts = amountsIn(lines[index + 1]!.text);
      c = Math.min(c, conf(lines[index + 1]!));
    }
    if (amounts.length === 0) return;
    const value = amounts[amounts.length - 1]!;
    if (!best || hit.rank > best.rank || (hit.rank === best.rank && index >= best.index)) {
      best = { rank: hit.rank, index, value, confidence: c };
    }
  });
  if (best) return { value: best.value, confidence: best.confidence };

  // No labelled total: guess the largest amount, but say we're unsure.
  let max: { n: number; value: string; confidence: number } | undefined;
  for (const line of lines) {
    if (NOT_TOTAL.test(line.text)) continue;
    for (const a of amountsIn(line.text)) {
      const n = Number(a);
      if (!max || n > max.n) max = { n, value: a, confidence: conf(line) * 0.5 };
    }
  }
  return max ? { value: max.value, confidence: max.confidence } : undefined;
}

// ---------- date ----------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function iso(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // e.g. 31 Feb
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** Day-first by default (India/UK/EU); flips to month-first only when the numbers force it. */
export function parseDate(text: string): string | null {
  let m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/.exec(text);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = fullYear(Number(m[3]));
    return b > 12 && a <= 12 ? iso(y, a, b) : iso(y, b, a);
  }

  const mon = MONTHS.join("|");
  m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s-]+(${mon})[a-z]*\\.?,?[\\s-]+(\\d{2}|\\d{4})\\b`, "i").exec(text);
  if (m) return iso(fullYear(Number(m[3])), MONTHS.indexOf(m[2]!.toLowerCase()) + 1, Number(m[1]));

  m = new RegExp(`\\b(${mon})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "i").exec(text);
  if (m) return iso(Number(m[3]), MONTHS.indexOf(m[1]!.toLowerCase()) + 1, Number(m[2]));

  return null;
}

function findDate(lines: OcrLine[], today: Date): Field<string> | undefined {
  const limit = today.getTime() + 36 * 3600 * 1000; // tolerate timezone skew, reject far-future misreads
  for (const line of lines) {
    const d = parseDate(line.text);
    if (d && new Date(`${d}T00:00:00Z`).getTime() <= limit) return { value: d, confidence: conf(line) };
  }
  return undefined;
}

// ---------- merchant ----------

const NOT_MERCHANT = /receipt|invoice|tax|gst|vat|bill|tel|phone|mob|www\.|http|@|date|time|table|order|cashier|thank|welcome/i;

function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s;
}

function findMerchant(lines: OcrLine[]): Field<string> | undefined {
  for (const line of lines.slice(0, 6)) {
    const text = line.text.replace(/[^\p{L}\p{N}&'.,\- ]/gu, " ").replace(/\s+/g, " ").trim();
    const letters = (text.match(/\p{L}/gu) ?? []).length;
    if (letters < 3 || letters / text.length < 0.6) continue;
    if (NOT_MERCHANT.test(text) || amountsIn(text).length > 0 || parseDate(text)) continue;
    return { value: titleCase(text), confidence: conf(line) };
  }
  return undefined;
}

// ---------- line items ----------

const NOT_ITEM = /total|tax|gst|vat|discount|change|cash|tender|round|tip|card|visa|upi|balance|qty|amount|invoice|date/i;

function findItems(lines: OcrLine[]): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  for (const line of lines) {
    if (NOT_ITEM.test(line.text)) continue;
    const amounts = amountsIn(line.text);
    if (amounts.length === 0) continue;
    const name = line.text
      .replace(AMOUNT_RE, " ")
      .replace(/^\s*\d+\s*[xX@]?\s+/, "") // leading quantity
      .replace(/[^\p{L}\p{N}&'\- ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if ((name.match(/\p{L}/gu) ?? []).length < 2) continue;
    items.push({ name, amount: amounts[amounts.length - 1]! });
  }
  return items;
}

// ---------- entry point ----------

export function parseReceipt(input: OcrLine[], today = new Date()): ParsedReceipt {
  const lines = input.map((l) => ({ ...l, text: l.text.trim() })).filter((l) => l.text.length > 0);
  const rawText = lines.map((l) => l.text).join("\n");
  return {
    merchant: findMerchant(lines),
    date: findDate(lines, today),
    total: findTotal(lines),
    currency: detectCurrency(rawText),
    items: findItems(lines),
    rawText,
  };
}
