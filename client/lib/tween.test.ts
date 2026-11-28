import assert from "node:assert/strict";
import { test } from "node:test";
import { easeOutCubic, lerp } from "./tween.ts";

test("easeOutCubic runs from 0 to 1 and never overshoots", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(-3), 0);
  assert.equal(easeOutCubic(7), 1);
  let prev = 0;
  for (let i = 1; i <= 20; i++) {
    const v = easeOutCubic(i / 20);
    assert.ok(v >= prev && v <= 1, `step ${i}`);
    prev = v;
  }
});

test("easeOutCubic is quick at the start", () => {
  assert.ok(easeOutCubic(0.5) > 0.5);
});

test("lerp moves between two values, up or down", () => {
  assert.equal(lerp(0, 100, 0), 0);
  assert.equal(lerp(0, 100, 0.25), 25);
  assert.equal(lerp(100, 40, 0.5), 70);
  assert.equal(lerp(5, 5, 0.9), 5);
});
