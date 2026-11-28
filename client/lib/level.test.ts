import assert from "node:assert/strict";
import { test } from "node:test";
import { levelProgress, xpToNext } from "./level.ts";

test("levelProgress is the share of the way to the next level", () => {
  // Level 2 runs from 40 to 160 XP.
  assert.equal(levelProgress({ xp: 40, levelXp: 40, nextLevelXp: 160 }), 0);
  assert.equal(levelProgress({ xp: 100, levelXp: 40, nextLevelXp: 160 }), 0.5);
  assert.equal(levelProgress({ xp: 159, levelXp: 40, nextLevelXp: 160 }) < 1, true);
});

test("levelProgress is full at the top level and stays within 0 to 1", () => {
  assert.equal(levelProgress({ xp: 5000, levelXp: 3240, nextLevelXp: null }), 1);
  assert.equal(levelProgress({ xp: 500, levelXp: 40, nextLevelXp: 160 }), 1);
  assert.equal(levelProgress({ xp: 0, levelXp: 40, nextLevelXp: 160 }), 0);
  assert.equal(levelProgress({ xp: 10, levelXp: 50, nextLevelXp: 50 }), 1);
});

test("xpToNext counts down and is 0 at the top", () => {
  assert.equal(xpToNext({ xp: 100, nextLevelXp: 160 }), 60);
  assert.equal(xpToNext({ xp: 200, nextLevelXp: 160 }), 0);
  assert.equal(xpToNext({ xp: 4000, nextLevelXp: null }), 0);
});
