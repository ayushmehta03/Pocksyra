// Checks what a language model claims about a receipt against the OCR text it
// was given. Small models invent plausible-looking numbers, so nothing the
// model says is kept unless it can be found in the text. Pure functions with
// no browser or model code, so they are easy to test.

import { amountsIn, normalizeAmount, parseDate, LOW_CONFIDENCE, type ParsedReceipt, type ReceiptItem } from "./parser.ts";

/** Fields the model recovered, already verified. Shown as confident but not certain. */
export const LLM_CONFIDENCE = 0.75;
/** Category is only a suggestion. */
const CATEGORY_CONFIDENCE = 0.6;

export const LLM_CATEGORIES = [
  "food", "groceries", "transport", "rent", "utilities", "entertainment", "travel", "shopping", "health", "other",
] as const;

export type LlmReceipt = Pick<ParsedReceipt, "merchant" | "category" | "date" | "total" | "items">;

const alnum = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** "1,585.5", "1585", 1585.5 -> "1585.50" (or null). */
function toAmount(v: unknown): string | null {
  const s = asString(v)?.replace(/[^\d.,]/g, "");
  if (!s) return null;
  if (/^\d+$/.test(s)) return `${s.replace(/^0+(?=\d)/, "")}.00`;
  if (/^\d+[.,]\d$/.test(s)) return normalizeAmount(`${s}0`);
  return normalizeAmount(s);
}

/** True if the model's amount really appears in the OCR text (as decimal or whole number). */
function amountInText(amount: string, text: string, known: Set<string>): boolean {
  if (known.has(amount)) return true;
  if (amount.endsWith(".00")) {
    const whole = amount.slice(0, -3);
    return new RegExp(`(?<![\\d.,])${whole}(?![\\d]|[.,]\\d)`).test(text.replace(/(\d)[ ,](?=\d{3}\b)/g, "$1"));
  }
  return false;
}

function merchantInText(merchant: string, text: string): boolean {
  const m = alnum(merchant);
  const t = alnum(text);
  if (m.length < 3) return false;
  if (t.includes(m)) return true;
  // OCR often garbles one word of a name; accept if most of its words are present.
  const words = merchant.toLowerCase().split(/\s+/).map(alnum).filter((w) => w.length >= 3);
  if (words.length === 0) return false;
  return words.filter((w) => t.includes(w)).length / words.length >= 0.6;
}

export function verifyLlmReceipt(raw: unknown, ocrText: string, today = new Date()): LlmReceipt {
  const out: LlmReceipt = { items: [] };

  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return out;
    }
  }
  if (typeof obj !== "object" || obj === null) return out;
  const o = obj as Record<string, unknown>;
  const known = new Set(amountsIn(ocrText));

  const total = toAmount(o.total);
  if (total && Number(total) > 0 && amountInText(total, ocrText, known)) {
    out.total = { value: total, confidence: LLM_CONFIDENCE };
  }

  const merchant = asString(o.merchant);
  if (merchant && merchant.length <= 80 && merchantInText(merchant, ocrText)) {
    out.merchant = { value: merchant, confidence: LLM_CONFIDENCE };
  }

  const date = asString(o.date);
  if (date && parseDate(date) === date) {
    const [y] = date.split("-");
    const yearSeen = ocrText.includes(y!) || ocrText.includes(y!.slice(2));
    const notFuture = new Date(`${date}T00:00:00Z`).getTime() <= today.getTime() + 36 * 3600 * 1000;
    if (yearSeen && notFuture) out.date = { value: date, confidence: LLM_CONFIDENCE };
  }

  const category = asString(o.category)?.toLowerCase();
  if (category && (LLM_CATEGORIES as readonly string[]).includes(category)) {
    out.category = { value: category, confidence: CATEGORY_CONFIDENCE };
  }

  if (Array.isArray(o.items)) {
    const items: ReceiptItem[] = [];
    for (const it of o.items.slice(0, 50)) {
      if (typeof it !== "object" || it === null) continue;
      const name = asString((it as Record<string, unknown>).name);
      const amount = toAmount((it as Record<string, unknown>).amount);
      if (name && name.length <= 60 && amount && amountInText(amount, ocrText, known)) items.push({ name, amount });
    }
    out.items = items;
  }
  return out;
}

/**
 * Fills gaps in the rule-based result with the model's verified answers:
 * missing fields, and fields the rules were unsure about.
 */
export function mergeFallback(primary: ParsedReceipt, llm: LlmReceipt): ParsedReceipt {
  const pick = <T>(a: { value: T; confidence: number } | undefined, b: { value: T; confidence: number } | undefined) =>
    b && (!a || a.confidence < LOW_CONFIDENCE) ? b : a;
  return {
    ...primary,
    merchant: pick(primary.merchant, llm.merchant),
    date: pick(primary.date, llm.date),
    total: pick(primary.total, llm.total),
    // a vague "other" from the model must not override a keyword match
    category: llm.category && !(llm.category.value === "other" && primary.category) ? llm.category : primary.category,
    items: primary.items.length > 0 ? primary.items : llm.items,
  };
}

/** Whether the rules left enough gaps that asking the model is worthwhile. */
export function needsHelp(r: ParsedReceipt): boolean {
  return !r.total || r.total.confidence < LOW_CONFIDENCE || !r.merchant || !r.date;
}
