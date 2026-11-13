import assert from "node:assert/strict";
import { test } from "node:test";
import { groupTextItems } from "./pdf-lines.ts";

test("joins fragments on one baseline and orders lines top to bottom", () => {
  const lines = groupTextItems([
    { str: "1510.00", x: 400, y: 600, width: 50 },
    { str: "Total", x: 40, y: 500, width: 30 },
    { str: "Subtotal", x: 40, y: 600, width: 45 },
    { str: "1585.50", x: 400, y: 500.8, width: 50 }, // slightly off baseline, same line
    { str: "ACME Cafe", x: 40, y: 700, width: 80 },
  ]);
  assert.deepEqual(
    lines.map((l) => l.text),
    ["ACME Cafe", "Subtotal 1510.00", "Total 1585.50"],
  );
});

test("fragments that touch are not split by a space", () => {
  const [line] = groupTextItems([
    { str: "Rs.", x: 10, y: 10, width: 12 },
    { str: "250.00", x: 22.5, y: 10, width: 36 },
  ]);
  assert.equal(line!.text, "Rs.250.00");
});

test("ignores empty fragments and handles no input", () => {
  assert.deepEqual(groupTextItems([]), []);
  assert.deepEqual(groupTextItems([{ str: "   ", x: 0, y: 0 }]), []);
});
