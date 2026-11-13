import assert from "node:assert/strict";
import { test } from "node:test";
import { fitSize, stretchContrast, toGrayscale } from "./image-math.ts";

test("toGrayscale weights channels", () => {
  const g = toGrayscale(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 255, 255, 255, 255]));
  assert.deepEqual(Array.from(g), [76, 150, 255]);
});

test("stretchContrast expands a dim, low-contrast image to the full range", () => {
  const px = new Uint8ClampedArray(1000);
  for (let i = 0; i < px.length; i++) px[i] = 100 + (i % 51); // 100..150
  stretchContrast(px);
  assert.ok(Math.min(...px) <= 5);
  assert.ok(Math.max(...px) >= 250);
});

test("stretchContrast leaves a flat image alone", () => {
  const px = new Uint8ClampedArray(100).fill(128);
  stretchContrast(px);
  assert.ok(px.every((v) => v === 128));
});

test("fitSize scales down but never up", () => {
  assert.deepEqual(fitSize(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitSize(800, 600, 1600), { width: 800, height: 600 });
});
