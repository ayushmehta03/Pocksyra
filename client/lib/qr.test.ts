import assert from "node:assert/strict";
import { test } from "node:test";
import { QR_MAX_BYTES, encodeQr, qrPath, qrViewSize } from "./qr.ts";

// Scanning is checked by decoding the output with OpenCV (see the commit notes);
// these tests cover the structure that is cheap to verify here.

test("picks the smallest version that fits the text", () => {
  assert.equal(encodeQr("a".repeat(14))?.length, 21); // version 1
  assert.equal(encodeQr("a".repeat(15))?.length, 25); // version 2
  assert.equal(encodeQr("a".repeat(106))?.length, 41); // version 6
  assert.equal(encodeQr("a".repeat(107))?.length, 45); // version 7
});

test("returns null when the text is too long", () => {
  assert.notEqual(encodeQr("a".repeat(QR_MAX_BYTES)), null);
  assert.equal(encodeQr("a".repeat(QR_MAX_BYTES + 1)), null);
});

test("counts UTF-8 bytes, not characters", () => {
  // "₹" is 3 bytes, so 5 of them need 15 bytes and move up to version 2.
  assert.equal(encodeQr("₹".repeat(5))?.length, 25);
});

test("draws the three finder patterns and the timing lines", () => {
  const m = encodeQr("https://example.com") as boolean[][];
  const n = m.length;
  for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    for (let d = 0; d < 7; d++) {
      assert.equal(m[y][x + d], true); // top edge of the 7x7 square
      assert.equal(m[y + 6][x + d], true); // bottom edge
      assert.equal(m[y + d][x], true);
      assert.equal(m[y + d][x + 6], true);
    }
    assert.equal(m[y + 3][x + 3], true); // dark centre
    assert.equal(m[y + 1][x + 1], false); // light ring
  }
  for (let i = 8; i < n - 8; i++) {
    assert.equal(m[6][i], i % 2 === 0);
    assert.equal(m[i][6], i % 2 === 0);
  }
  assert.equal(m[n - 8][8], true); // the always-dark module
});

test("is deterministic", () => {
  const link = "upi://pay?pa=ravi@okhdfcbank&pn=Ravi&am=250.00&cu=INR";
  assert.deepEqual(encodeQr(link), encodeQr(link));
});

test("qrPath covers every dark module exactly once", () => {
  const m = encodeQr("hello") as boolean[][];
  const path = qrPath(m, 0);
  let area = 0;
  for (const [, w] of path.matchAll(/h(\d+)v1/g).map((r) => [r[0], Number(r[1])] as const)) area += w;
  const dark = m.flat().filter(Boolean).length;
  assert.equal(area, dark);
  assert.equal(qrViewSize(m, 4), m.length + 8);
});
