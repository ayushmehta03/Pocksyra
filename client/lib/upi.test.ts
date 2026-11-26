import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidUpi, normalizeUpi } from "./upi.ts";

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
