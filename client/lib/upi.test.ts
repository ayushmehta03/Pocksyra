import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAppLinks, buildUpiLink, isValidUpi, normalizeUpi, payPlatformFrom } from "./upi.ts";

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

test("buildAppLinks gives each iPhone app the same payment request", () => {
  const opts = { upiId: "Ayush@OkHdfcBank", name: "Ayush Mehta", amount: "250.50", note: "Dinner" };
  const query = "pa=ayush@okhdfcbank&pn=Ayush%20Mehta&am=250.50&cu=INR&tn=Dinner";
  assert.deepEqual(buildAppLinks(opts), [
    { id: "gpay", label: "Google Pay", link: `gpay://upi/pay?${query}` },
    { id: "phonepe", label: "PhonePe", link: `phonepe://pay?${query}` },
    { id: "paytm", label: "Paytm", link: `paytmmp://pay?${query}` },
  ]);
  // The generic link carries the identical query, so the QR code and the buttons agree.
  assert.equal(buildUpiLink(opts), `upi://pay?${query}`);
});

test("payPlatformFrom tells iPhone, Android and computers apart", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
  assert.equal(payPlatformFrom(iphone), "ios");
  assert.equal(payPlatformFrom(android, 5), "android");
  assert.equal(payPlatformFrom(mac, 0), "desktop");
  assert.equal(payPlatformFrom(mac, 5), "ios"); // iPadOS in desktop mode
  assert.equal(payPlatformFrom(windows), "desktop");
});
