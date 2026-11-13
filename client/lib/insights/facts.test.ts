import assert from "node:assert/strict";
import { test } from "node:test";
import type { Expense } from "../api.ts";
import { buildSections, checkJoke, numbersMatchFacts } from "./facts.ts";
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

const sectionsOf = (list: Expense[]) => buildSections(buildSummary(list, "me", 30, NOW)!);

test("every fallback joke passes the same check the model's jokes have to pass", () => {
  const shapes: Record<string, Expense[]> = {
    normal: data,
    single: [exp("Lunch", 2, 25000, "food", { merchant: "Cafe Zed" })],
    twoThin: [exp("A", 1, 1000, "food"), exp("B", 2, 2000, "food")],
    oneCategory: [1, 2, 3, 4, 5, 6].map((i) => exp(`Meal ${i}`, i, 10000 * i, "food")),
    manyDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => exp(`Thing ${i}`, i * 2, 5000 + i, i % 2 ? "shopping" : "transport", { merchant: i < 4 ? "Metro Card" : undefined })),
  };
  for (const [name, list] of Object.entries(shapes)) {
    for (const sec of sectionsOf(list)) {
      const v = checkJoke(sec.fallback, sec.facts);
      assert.ok(v.ok, `${name}/${sec.id}: ${v.ok ? "" : v.reason}\n${sec.fallback}\n---\n${sec.facts}`);
    }
  }
});

test("thin data says so and makes no habit claims", () => {
  const [overview, , habits] = sectionsOf([exp("Lunch", 2, 25000, "food")]);
  assert.match(overview!.facts, /very small sample/);
  assert.match(habits!.facts, /Too little data/);
  assert.doesNotMatch(habits!.facts, /weekend|Saturday|Sunday/i);
});

test("weekday only shows up when there is enough data, and never as an absence", () => {
  const few = sectionsOf(data)[2]!; // 4 expenses
  assert.doesNotMatch(few.facts, /Most spending happened on/);
  const many = sectionsOf([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => exp(`T${i}`, i, 1000, "food")))[2]!;
  assert.match(many.facts, /Most spending happened on/);
  assert.doesNotMatch(many.facts, /no spending|never/i);
});

test("repeat merchants are named with their visit count, shared expenses mention friends", () => {
  const habits = sectionsOf(data)[2]!;
  assert.match(habits.facts, /Spice Route Kitchen: 2 visits/);
  assert.match(habits.facts, /shared with friends/);
});

test("jokes that invent things are rejected", () => {
  const facts = sectionsOf(data)[0]!.facts;
  const bad = [
    "With ₹2,000 in expenses you could almost afford a car.", // unrelated comparison
    "You never spend on weekends, how disciplined.", // absence inferred
    "That's a lot for someone on your salary.", // income
    "Your friends probably spent more than you did.", // friends' spending
    "You spent ₹99,999 in total, impressive.", // invented number
    "Sunday brunch really cost you this month.", // day not in facts
    "Blue Tokai got most of your money.", // merchant not in facts
    "You always overspend on Dinner.", // sweeping habit
  ];
  for (const j of bad) assert.equal(checkJoke(j, facts).ok, false, j);
});

test("a grounded joke is accepted and trimmed to two sentences", () => {
  const facts = sectionsOf(data)[0]!.facts;
  const total = /Total spent: ([^ ]+) /.exec(facts)![1]!;
  const v = checkJoke(`"Joke: ${total} gone, and Dinner took most of it. The rest just watched. A third sentence nobody asked for."`, facts);
  assert.ok(v.ok);
  if (v.ok) {
    assert.ok(!v.text.includes("third sentence"));
    assert.ok(!v.text.includes('"'));
  }
});

test("the number check rejects invented figures and accepts copied ones", () => {
  const facts = "Total: ₹1,822.50. Share 61% of the total. 12 expenses.";
  assert.ok(numbersMatchFacts("You burned ₹1,822.50, that's 61% of it over 12 swipes.", facts));
  assert.ok(numbersMatchFacts("Top 3 offenders, twice as bad.", facts));
  assert.ok(!numbersMatchFacts("You burned ₹2,000 this month.", facts));
  assert.ok(!numbersMatchFacts("That's 75% of it.", facts));
});
