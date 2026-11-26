import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUpiLink, isValidUpi, normalizeUpi } from "./upi.ts";

test("accepts common UPI IDs", () => {
  for (const v of ["ayush@okhdfcbank", "Ayush.M@YBL", "9876543210@paytm", "first_last-1@oksbi", "  me@axl  "]) {
    assert.equal(isValidUpi(v), true, v);
  }
});

test("rejects malformed UPI IDs", () => {
  for (const v of ["", "ayush", "@ybl", "a@ybl", "ayush@", "ayush@1bank", "ay ush@ybl", "ayush@yb.l", "a@@ybl"]) {
    assert.equal(isValidUpi(v), false, v);
  }
});

test("normalizeUpi trims and lowercases", () => {
  assert.equal(normalizeUpi("  Ayush@YBL "), "ayush@ybl");
});

test("buildUpiLink builds a upi://pay deep link", () => {
  const link = buildUpiLink({ upiId: "Ayush@OkHdfcBank", name: "Ayush Mehta", amount: "250.50", note: "Dinner & drinks" });
  assert.equal(link, "upi://pay?pa=ayush@okhdfcbank&pn=Ayush%20Mehta&am=250.50&cu=INR&tn=Dinner%20%26%20drinks");
});

test("buildUpiLink leaves out an empty note and falls back to a name", () => {
  const link = buildUpiLink({ upiId: "me@ybl", name: " ", amount: "10.00", note: "  " });
  assert.equal(link, "upi://pay?pa=me@ybl&pn=Pocksyra%20friend&am=10.00&cu=INR");
});
