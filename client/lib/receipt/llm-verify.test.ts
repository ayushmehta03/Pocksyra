import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReceipt } from "./parser.ts";
import { LLM_CONFIDENCE, mergeFallback, needsHelp, verifyLlmReceipt } from "./llm-verify.ts";

const TODAY = new Date("2026-11-13T12:00:00Z");
// A receipt layout the rules don't understand: no "total" keyword at all.
const TEXT = `SHREE GANESH SWEETS
Plot 4, Station Rd
13-Nov-2026
Kaju Katli 1/2kg 520.00
Samosa x6 90.00
Pay 610.00 UPI`;

test("keeps answers that appear in the text and drops invented ones", () => {
  const r = verifyLlmReceipt(
    { merchant: "Shree Ganesh Sweets", date: "2026-11-13", total: "610.00", category: "food",
      items: [{ name: "Kaju Katli", amount: "520.00" }, { name: "Ghost item", amount: "999.00" }] },
    TEXT, TODAY);
  assert.equal(r.total?.value, "610.00");
  assert.equal(r.merchant?.value, "Shree Ganesh Sweets");
  assert.equal(r.date?.value, "2026-11-13");
  assert.equal(r.category?.value, "food");
  assert.deepEqual(r.items.map((i) => i.name), ["Kaju Katli"]); // hallucinated amount rejected
  assert.equal(r.total?.confidence, LLM_CONFIDENCE);
});

test("rejects a hallucinated total, merchant and date", () => {
  const r = verifyLlmReceipt({ merchant: "Burger Palace", date: "2025-01-02", total: "725.50" }, TEXT, TODAY);
  assert.equal(r.total, undefined);
  assert.equal(r.merchant, undefined);
  assert.equal(r.date, undefined);
});

test("accepts a whole-number total written without decimals, as a number or string", () => {
  assert.equal(verifyLlmReceipt({ total: 610 }, TEXT, TODAY).total?.value, "610.00");
  assert.equal(verifyLlmReceipt({ total: "₹610" }, TEXT, TODAY).total?.value, "610.00");
  assert.equal(verifyLlmReceipt({ total: 61 }, TEXT, TODAY).total, undefined); // 61 is not in the text
});

test("tolerates one garbled word in the merchant name", () => {
  const r = verifyLlmReceipt({ merchant: "Shree Ganesh Sweets" }, "SHREE GANE5H SWEETS\nTotal 10.00", TODAY);
  assert.equal(r.merchant?.value, "Shree Ganesh Sweets");
});

test("bad output is harmless", () => {
  assert.deepEqual(verifyLlmReceipt("not json at all", TEXT, TODAY).items, []);
  assert.equal(verifyLlmReceipt(null, TEXT, TODAY).total, undefined);
  assert.equal(verifyLlmReceipt({ category: "crypto" }, TEXT, TODAY).category, undefined);
  assert.equal(verifyLlmReceipt({ date: "2031-01-01" }, "2031", TODAY).date, undefined); // future
});

test("fallback fills what the rules missed and keeps confident rule results", () => {
  const rules = parseReceipt(TEXT.split("\n").map((text) => ({ text, confidence: 90 })), TODAY);
  assert.equal(needsHelp(rules), true);
  const llm = verifyLlmReceipt({ merchant: "Shree Ganesh Sweets", total: "610.00", date: "2026-11-13" }, TEXT, TODAY);
  const merged = mergeFallback(rules, llm);
  assert.equal(merged.total?.value, "610.00");
  assert.equal(merged.merchant?.value, rules.merchant?.value ?? "Shree Ganesh Sweets");
  assert.equal(merged.date?.value, "2026-11-13");

  // A confident rule result is never overwritten.
  const good = parseReceipt(["Cafe Blue", "Total 118.00"].map((text) => ({ text, confidence: 95 })), TODAY);
  const kept = mergeFallback(good, { items: [], total: { value: "999.00", confidence: LLM_CONFIDENCE } });
  assert.equal(kept.total?.value, "118.00");
});
