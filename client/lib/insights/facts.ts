// Turns a Summary into (a) the facts the model may use, (b) a check that its
// answer only uses numbers from those facts, and (c) a plain-text version that
// needs no model at all.
import { categoryLabel } from "../categories.ts";
import { formatMoney } from "../format.ts";
import type { Summary } from "./summary.ts";

export type SectionId = "overview" | "categories" | "habits";

export type Section = {
  id: SectionId;
  title: string;
  /** everything the model is allowed to mention, one fact per line */
  facts: string;
  /** what this section should do, as an instruction to the model */
  task: string;
  /** the same section written by plain code */
  plain: string;
};

const money = (s: Summary, n: number) => formatMoney(n, s.currency);

export function buildSections(s: Summary): Section[] {
  const m = (n: number) => money(s, n);
  const top = s.categories[0];
  const second = s.categories[1];

  const change =
    s.changePct === null
      ? "There is no earlier month to compare with."
      : s.changePct === 0
        ? "That is the same as the previous 30 days."
        : s.changePct > 0
          ? `That is ${s.changePct}% more than the previous 30 days (${m(s.previousTotal)}).`
          : `That is ${Math.abs(s.changePct)}% less than the previous 30 days (${m(s.previousTotal)}).`;

  const overview: Section = {
    id: "overview",
    title: "The big picture",
    facts: [
      `Total spent by the user in the last ${s.days} days: ${m(s.total)}.`,
      `Number of expenses: ${s.count}.`,
      `Average per day: ${m(s.perDay)}.`,
      change,
      s.biggest ? `Biggest single expense: ${s.biggest.description}, ${m(s.biggest.amount)}.` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    task: "Roast the overall spending: the total, the pace per day and how it compares with before.",
    plain:
      `You spent ${m(s.total)} across ${s.count} expense${s.count === 1 ? "" : "s"} in the last ${s.days} days, about ${m(s.perDay)} a day. ` +
      (s.changePct === null
        ? "That's your first month on record, so there's nothing to compare yet. "
        : s.changePct > 0
          ? `That's ${s.changePct}% more than the month before. `
          : s.changePct < 0
            ? `That's ${Math.abs(s.changePct)}% less than the month before. Nicely done. `
            : "That's exactly what you spent the month before. ") +
      (s.biggest ? `Your biggest hit was ${s.biggest.description} at ${m(s.biggest.amount)}.` : ""),
  };

  const categories: Section = {
    id: "categories",
    title: "Where it went",
    facts: s.categories
      .slice(0, 4)
      .map((c) => `${categoryLabel(c.id)}: ${m(c.amount)}, ${c.pct}% of the total, ${c.count} expense${c.count === 1 ? "" : "s"}.`)
      .join("\n"),
    task: "Roast the biggest spending categories. Start with the top one.",
    plain: top
      ? `${categoryLabel(top.id)} took the biggest bite: ${m(top.amount)}, which is ${top.pct}% of everything.` +
        (second ? ` ${categoryLabel(second.id)} came next at ${m(second.amount)} (${second.pct}%).` : "")
      : "",
  };

  const topMerchant = s.merchants[0];
  const habits: Section = {
    id: "habits",
    title: "Your habits",
    facts: [
      s.busiestWeekday ? `Day of the week with the most spending: ${s.busiestWeekday.day}, ${m(s.busiestWeekday.amount)}.` : "",
      `Share of spending that happened on weekends: ${s.weekendPct}%.`,
      ...s.merchants.map((x) => `Frequent place: ${x.name}, ${m(x.amount)} over ${x.count} visit${x.count === 1 ? "" : "s"}.`),
      `Expenses just for the user: ${s.soloCount}. Expenses split with friends: ${s.splitCount}.`,
    ]
      .filter(Boolean)
      .join("\n"),
    task: "Roast the habits (favourite day, favourite places, solo versus shared), then end with one short, kind tip.",
    plain:
      (s.busiestWeekday ? `${s.busiestWeekday.day} is your most expensive day (${m(s.busiestWeekday.amount)}). ` : "") +
      (topMerchant ? `${topMerchant.name} is your regular: ${m(topMerchant.amount)} over ${topMerchant.count} visit${topMerchant.count === 1 ? "" : "s"}. ` : "") +
      `${s.splitCount} of your ${s.count} expenses were shared with friends.`,
  };

  return [overview, categories, habits].filter((x) => x.plain);
}

// ---------- the number check ----------

const NUM = /\d[\d,]*(?:\.\d+)?/g;
const norm = (n: string) => n.replace(/,/g, "").replace(/\.$/, "");

/** Every number written in `text`, with thousands separators removed. */
export function numbersIn(text: string): string[] {
  return (text.match(NUM) ?? []).map(norm);
}

/**
 * True if every number in the model's text also appears in the facts. Small
 * whole numbers (0-10) are always allowed, so "twice" style phrasing such as
 * "top 3" doesn't trip it. Anything else is treated as invented.
 */
export function numbersMatchFacts(text: string, facts: string): boolean {
  const allowed = new Set(numbersIn(facts));
  return numbersIn(text).every((n) => allowed.has(n) || (/^\d+$/.test(n) && Number(n) <= 10));
}
