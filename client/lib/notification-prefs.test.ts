import assert from "node:assert/strict";
import { test } from "node:test";
import { NOTIFICATION_GROUPS, isEnabled, withGroup } from "./notification-prefs.ts";

test("everything is on when nothing is muted", () => {
  for (const g of NOTIFICATION_GROUPS) assert.equal(isEnabled([], g.key), true);
});

test("switching a group off mutes it, and on again unmutes it", () => {
  const off = withGroup([], "reminders", false);
  assert.deepEqual(off, ["reminders"]);
  assert.equal(isEnabled(off, "reminders"), false);
  assert.equal(isEnabled(off, "payments"), true);

  assert.deepEqual(withGroup(off, "reminders", true), []);
});

test("switching off twice does not duplicate, and other groups are kept", () => {
  const once = withGroup(["friends"], "reminders", false);
  assert.deepEqual(once, ["friends", "reminders"]);
  assert.deepEqual(withGroup(once, "reminders", false), ["friends", "reminders"]);
  assert.deepEqual(withGroup(once, "friends", true), ["reminders"]);
});

test("does not change the list it was given", () => {
  const muted = ["friends"];
  withGroup(muted, "expenses", false);
  assert.deepEqual(muted, ["friends"]);
});
