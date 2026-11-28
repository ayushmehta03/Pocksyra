import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_FLASH_SCRIPT, THEME_COLORS, THEME_KEY, parsePreference, resolveTheme } from "./theme.ts";

test("parsePreference only accepts known choices", () => {
  assert.equal(parsePreference("light"), "light");
  assert.equal(parsePreference("dark"), "dark");
  assert.equal(parsePreference("system"), "system");
  for (const bad of [null, undefined, "", "Dark", "blue", "1"]) assert.equal(parsePreference(bad), "system");
});

test("resolveTheme follows the device only for system", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("the no-flash script is valid JavaScript that uses the same key and colours", () => {
  assert.doesNotThrow(() => new Function(NO_FLASH_SCRIPT));
  assert.ok(NO_FLASH_SCRIPT.includes(JSON.stringify(THEME_KEY)));
  assert.ok(NO_FLASH_SCRIPT.includes(THEME_COLORS.dark));
  assert.ok(NO_FLASH_SCRIPT.includes(THEME_COLORS.light));
});

test("the no-flash script sets the dark class from the stored choice or the device", () => {
  function run(stored: string | null, systemDark: boolean) {
    const classes = new Set<string>();
    const meta = { content: "", setAttribute(_k: string, v: string) { this.content = v; } };
    const doc = {
      documentElement: {
        classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
        style: { colorScheme: "" },
      },
      querySelector: () => meta,
    };
    const win = { matchMedia: () => ({ matches: systemDark }) };
    const ls = { getItem: () => stored };
    new Function("document", "window", "localStorage", NO_FLASH_SCRIPT)(doc, win, ls);
    return { dark: classes.has("dark"), scheme: doc.documentElement.style.colorScheme, color: meta.content };
  }
  assert.deepEqual(run(null, true), { dark: true, scheme: "dark", color: THEME_COLORS.dark });
  assert.deepEqual(run(null, false), { dark: false, scheme: "light", color: THEME_COLORS.light });
  assert.deepEqual(run("light", true), { dark: false, scheme: "light", color: THEME_COLORS.light });
  assert.deepEqual(run("dark", false), { dark: true, scheme: "dark", color: THEME_COLORS.dark });
});
