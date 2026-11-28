import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Reads the real tokens from globals.css and checks the text and accent
// pairs stay readable (WCAG AA, 4.5:1 for text) in day and night mode.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} block not found`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2];
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = { day: block(":root"), night: block(".dark") };

for (const [name, t] of Object.entries(themes)) {
  test(`${name} mode: text is readable on the page and on cards`, () => {
    for (const bg of ["page", "panel", "panel-2"]) {
      for (const fg of ["fg", "fg-2", "fg-3", "accent-text", "warn", "danger"]) {
        const ratio = contrast(t[fg], t[bg]);
        assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs 4.5:1`);
      }
    }
  });

  test(`${name} mode: text on the accent fill is readable`, () => {
    const ratio = contrast(t["accent-ink"], t["accent"]);
    assert.ok(ratio >= 4.5, `accent-ink on accent is ${ratio.toFixed(2)}:1`);
  });
}

test("both modes define the same tokens", () => {
  assert.deepEqual(Object.keys(themes.day).sort(), Object.keys(themes.night).sort());
});
