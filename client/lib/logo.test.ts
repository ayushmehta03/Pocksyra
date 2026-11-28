import assert from "node:assert/strict";
import { test } from "node:test";
import { badgeSvg, logoInner, logoSvg } from "./logo.ts";

// Every id that is referenced as url(#x) must be defined once, or the logo renders blank.
function check(svg: string) {
  const defined = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(new Set(defined).size, defined.length, "ids are unique");
  for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(defined.includes(m[1]!), `${m[1]} is defined`);
  assert.ok(!svg.includes("NaN") && !svg.includes("undefined"));
  const open = (svg.match(/<(?!\/|\?|!)[a-zA-Z][^>]*[^/]>/g) ?? []).length;
  const close = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length;
  assert.equal(open, close, "tags are balanced");
}

test("the logo is a well-formed SVG at the requested size", () => {
  const svg = logoSvg(192);
  assert.match(svg, /^<svg [^>]*width="192" height="192" viewBox="0 0 512 512">/);
  check(svg);
  check(logoSvg(512, true));
});

test("maskable art fills the square and keeps the P smaller than the rounded one", () => {
  const rounded = logoSvg(512, false);
  const bleed = logoSvg(512, true);
  assert.ok(rounded.includes('rx="112"'));
  assert.ok(!bleed.includes('rx="112"'));
  assert.ok(bleed.includes("scale(0.84)"));
  assert.ok(rounded.includes("scale(1)"));
});

test("two logos on one page do not share gradient ids", () => {
  const a = logoInner("a");
  const b = logoInner("b");
  const ids = (s: string) => [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids(a).filter((i) => ids(b).includes(i)).length, 0);
});

test("the notification badge is a plain white shape with no background", () => {
  const svg = badgeSvg(96);
  assert.ok(svg.includes('stroke="#ffffff"'));
  assert.ok(!svg.includes("<rect"));
  check(svg);
});
