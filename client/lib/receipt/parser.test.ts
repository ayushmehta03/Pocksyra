import assert from "node:assert/strict";
import { test } from "node:test";
import { LOW_CONFIDENCE, normalizeAmount, parseDate, parseReceipt, type OcrLine } from "./parser.ts";

const lines = (texts: string[], confidence = 90): OcrLine[] => texts.map((text) => ({ text, confidence }));
const TODAY = new Date("2026-11-13T12:00:00Z");

test("normalizeAmount handles Indian/US and EU separators", () => {
  assert.equal(normalizeAmount("1,234.50"), "1234.50");
  assert.equal(normalizeAmount("1.234,50"), "1234.50");
  assert.equal(normalizeAmount("12,34,567.00"), "1234567.00");
  assert.equal(normalizeAmount("1 234.50"), "1234.50");
  assert.equal(normalizeAmount("99.90"), "99.90");
  assert.equal(normalizeAmount("12"), null);
  assert.equal(normalizeAmount("12.5"), null);
});

test("parseDate: formats and day-first default", () => {
  assert.equal(parseDate("Date: 05/11/2026"), "2026-11-05"); // 5 November, not May 11
  assert.equal(parseDate("12/25/2026"), "2026-12-25"); // forced month-first
  assert.equal(parseDate("2026-11-13 19:02"), "2026-11-13");
  assert.equal(parseDate("13 Nov 2026"), "2026-11-13");
  assert.equal(parseDate("Nov 13, 2026"), "2026-11-13");
  assert.equal(parseDate("13-11-26"), "2026-11-13");
  assert.equal(parseDate("31/02/2026"), null); // not a real day
  assert.equal(parseDate("no date here"), null);
});

test("a typical restaurant receipt", () => {
  const r = parseReceipt(
    lines([
      "TOSCANA RISTORANTE",
      "12 MG Road, Bengaluru",
      "GSTIN 29ABCDE1234F1Z5",
      "Date: 13/11/2026   Time 20:41",
      "Margherita Pizza      450.00",
      "2 Garlic Bread        240.00",
      "Subtotal              690.00",
      "CGST 2.5%              17.25",
      "SGST 2.5%              17.25",
      "Grand Total           724.50",
      "Thank you!",
    ]),
    TODAY,
  );
  assert.equal(r.merchant?.value, "Toscana Ristorante");
  assert.equal(r.date?.value, "2026-11-13");
  assert.equal(r.total?.value, "724.50");
  assert.deepEqual(
    r.items.map((i) => i.name),
    ["Margherita Pizza", "Garlic Bread"],
  );
});

test("Total beats Subtotal and Tax; last total wins; amount on next line", () => {
  const r = parseReceipt(lines(["Cafe Blue", "Subtotal 100.00", "Tax 18.00", "Total", "118.00"]), TODAY);
  assert.equal(r.total?.value, "118.00");
});

test("Grand Total outranks a later plain Total", () => {
  const r = parseReceipt(lines(["Shop", "Grand Total 500.00", "Total items 3", "Total 480.00"]), TODAY);
  assert.equal(r.total?.value, "500.00");
});

test("falls back to the largest amount with halved confidence", () => {
  const r = parseReceipt(lines(["Corner Store", "Milk 55.00", "Bread 40.00", "Eggs 120.00"], 80), TODAY);
  assert.equal(r.total?.value, "120.00");
  assert.ok(r.total!.confidence < LOW_CONFIDENCE);
});

test("low OCR confidence is carried through", () => {
  const r = parseReceipt(lines(["Dodgy Diner", "Total 45.00"], 40), TODAY);
  assert.ok(r.total!.confidence < LOW_CONFIDENCE);
  assert.ok(r.merchant!.confidence < LOW_CONFIDENCE);
});

test("rejects far-future dates as OCR misreads", () => {
  const r = parseReceipt(lines(["Shop", "Date 13/11/2031", "Total 10.00"]), TODAY);
  assert.equal(r.date, undefined);
});

test("detects currency", () => {
  assert.equal(parseReceipt(lines(["Shop", "Total ₹ 250.00"]), TODAY).currency, "INR");
  assert.equal(parseReceipt(lines(["Shop", "Total $12.99"]), TODAY).currency, "USD");
  assert.equal(parseReceipt(lines(["Shop", "Total 12.99"]), TODAY).currency, undefined);
});

test("empty input is safe", () => {
  const r = parseReceipt([], TODAY);
  assert.equal(r.total, undefined);
  assert.deepEqual(r.items, []);
});
