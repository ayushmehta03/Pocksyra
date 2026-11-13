import { complete, type LlmProgress, getEngine } from "@/lib/llm/engine";
import { LLM_CATEGORIES, mergeFallback, verifyLlmReceipt } from "./llm-verify";
import type { ParsedReceipt } from "./parser";

const SCHEMA = {
  type: "object",
  properties: {
    merchant: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    total: { type: ["string", "null"], description: "final amount payable, digits and decimal point only" },
    category: { type: ["string", "null"], enum: [...LLM_CATEGORIES, null] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, amount: { type: "string" } },
        required: ["name", "amount"],
      },
    },
  },
  required: ["merchant", "date", "total", "category", "items"],
};

const SYSTEM = `You extract data from the text of a receipt or bill. The text came from OCR, so it may contain recognition mistakes, odd spacing and missing lines. Reply with JSON only.

Rules:
- Use null for anything you cannot find clearly. Never guess.
- Copy amounts exactly as written in the text. Never calculate or invent numbers.
- "total" is the final amount the customer pays (after tax and discounts), not the subtotal.
- "date" must be YYYY-MM-DD. Dates are usually day first (13/11/2026 is 13 November 2026).
- "merchant" is the shop or restaurant name, normally near the top.
- "category" is one of: ${LLM_CATEGORIES.join(", ")}.
- "items" are the purchased lines with their amounts; skip tax, totals and payment lines.`;

const MAX_CHARS = 3500; // keeps the prompt small enough for a 1.5B model

/**
 * Asks the on-device model to read the OCR text, then keeps only the answers
 * that can be found in that text. Returns the rule-based result with the gaps
 * filled in.
 */
export async function improveWithLlm(
  receipt: ParsedReceipt,
  onProgress?: (p: LlmProgress) => void,
): Promise<ParsedReceipt> {
  await getEngine(onProgress);
  const text = receipt.rawText.slice(0, MAX_CHARS);
  const raw = await complete(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Receipt text:\n"""\n${text}\n"""` },
    ],
    { temperature: 0, maxTokens: 600, jsonSchema: SCHEMA },
  );
  return mergeFallback(receipt, verifyLlmReceipt(raw, receipt.rawText));
}
