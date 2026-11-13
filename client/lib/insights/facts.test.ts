import assert from "node:assert/strict";
import { test } from "node:test";
import type { Expense } from "../api.ts";
import { buildSections, numbersMatchFacts } from "./facts.ts";
import { buildSummary } from "./summary.ts";

const NOW = new Date(2026, 10, 13, 12); // 13 Nov 2026, local
const day = (back: number) => new Date(2026, 10, 13 - back, 13).toISOString();

function exp(id: string, back: number, amount: number, category: string, extra: Partial<Expense> = {}): Expense {
  return {
    id, description: id, category, amount, currency: "INR", method: "equal", paidBy: "me", createdBy: "me",
    splits: [{ userId: "me", amount, value: 0 }], date: day(back), createdAt: "", updatedAt: "", ...extra,
  } as Expense;
}

const data: Expense[] = [
  exp("Dinner", 1, 86100, "food", { merchant: "Spice Route Kitchen" }),
  exp("Lunch", 3, 25000, "food", { merchant: "Spice Route Kitchen" }),
  exp("Cab", 5, 40000, "transport"),
  // shared: total 90000, my share 30000
  exp("Trip snacks", 8, 90000, "groceries", { splits: [{ userId: "me", amount: 30000, value: 0 }, { userId: "a", amount: 60000, value: 0 }] }),
  // previous window
  exp("Old", 40, 100000, "food"),
  // not mine
  exp("Not me", 2, 99999, "food", { splits: [{ userId: "a", amount: 99999, value: 0 }], paidBy: "a" }),
  // too old
  exp("Ancient", 100, 5000, "food"),
];

test("summary uses my share, the window and the previous window", () => {
  const s = buildSummary(data, "me", 30, NOW)!;
  assert.equal(s.total, 86100 + 25000 + 40000 + 30000);
  assert.equal(s.count, 4);
  assert.equal(s.previousTotal, 100000);
  assert.equal(s.changePct, Math.round(((s.total - 100000) / 100000) * 100));
  assert.equal(s.categories[0]!.id, "food");
  assert.equal(s.categories[0]!.amount, 111100);
  assert.equal(s.merchants[0]!.name, "Spice Route Kitchen");
  assert.equal(s.merchants[0]!.count, 2);
  assert.equal(s.biggest!.description, "Dinner");
  assert.equal(s.soloCount, 3);
  assert.equal(s.splitCount, 1);
  assert.equal(s.paid, 86100 + 25000 + 40000 + 90000);
});

test("no expenses in the window gives null", () => {
  assert.equal(buildSummary([exp("Old", 90, 100, "food")], "me", 30, NOW), null);
});

test("sections never mention a number that is not in the facts", () => {
  const s = buildSummary(data, "me", 30, NOW)!;
  for (const sec of buildSections(s)) {
    assert.ok(numbersMatchFacts(sec.plain, sec.facts), `plain text of ${sec.id} drifted from its facts:\n${sec.plain}\n---\n${sec.facts}`);
  }
});

test("the number check rejects invented figures and accepts copied ones", () => {
  const facts = "Total: ₹1,822.50. Share 61% of the total. 12 expenses.";
  assert.ok(numbersMatchFacts("You burned ₹1,822.50, that's 61% of it over 12 swipes.", facts));
  assert.ok(numbersMatchFacts("Top 3 offenders, twice as bad.", facts));
  assert.ok(!numbersMatchFacts("You burned ₹2,000 this month.", facts));
  assert.ok(!numbersMatchFacts("That's 75% of it.", facts));
});
