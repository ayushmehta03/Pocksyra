import assert from "node:assert/strict";
import { test } from "node:test";
import { timeAgo } from "./time-ago.ts";

const now = Date.parse("2026-11-27T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

test("timeAgo picks a sensible unit", () => {
  assert.equal(timeAgo(ago(10_000), now), "just now");
  assert.equal(timeAgo(ago(5 * 60_000), now), "5 min ago");
  assert.equal(timeAgo(ago(3 * 3_600_000), now), "3 h ago");
  assert.equal(timeAgo(ago(2 * 86_400_000), now), "2 d ago");
});

test("timeAgo never goes negative and ignores bad dates", () => {
  assert.equal(timeAgo(new Date(now + 60_000).toISOString(), now), "just now");
  assert.equal(timeAgo("not a date", now), "");
});
