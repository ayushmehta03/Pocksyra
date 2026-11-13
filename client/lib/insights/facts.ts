// Everything between the numbers and the words:
//   buildSections  - the facts each joke may use, plus a hand-written joke that
//                    needs no model
//   checkJoke      - rejects any model text that claims something the facts
//                    don't say (invented numbers, places, days, relationships,
//                    finances, habits)
import { categoryLabel } from "../categories.ts";
import { formatMoney } from "../format.ts";
import type { Summary } from "./summary.ts";

export type SectionId = "overview" | "categories" | "habits";

export type Section = {
  id: SectionId;
  title: string;
  /** everything the joke may mention, one fact per line */
  facts: string;
  /** which angle this section takes, so the three jokes don't share a shape */
  angle: string;
  /** a sample in the right style, with invented data (copying it gets rejected) */
  example: string;
  /** a joke written by plain code from the same facts */
  fallback: string;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Same data and same section always give the same variant, different sections differ. */
const pick = <T,>(items: T[], s: Summary, salt: number): T => items[(s.total + s.count * 7 + salt) % items.length]!;

export function buildSections(s: Summary): Section[] {
  const m = (n: number) => formatMoney(n, s.currency);
  const out: Section[] = [];

  // ---------- the big picture: amounts ----------
  {
    const big = s.biggest;
    const pct = big && s.total > 0 ? Math.round((big.amount / s.total) * 100) : 0;
    const lines = [`Total spent: ${m(s.total)} over ${plural(s.count, "expense")}.`, `Average per day: ${m(s.perDay)}.`];
    if (s.thin) lines.push(`Only ${plural(s.count, "expense")} so far, a very small sample.`);
    else if (big) lines.push(`Biggest expense: ${big.description}, ${m(big.amount)}, which is ${pct}% of the total.`);

    const fallback = s.thin
      ? pick(
          [
            `${m(s.total)} across ${plural(s.count, "expense")}. Small sample, so I'll hold my best material.`,
            `Only ${plural(s.count, "expense")} so far, ${m(s.total)} in all. Feed me more receipts.`,
          ],
          s,
          0,
        )
      : pick(
          [
            `${m(s.total)} in ${plural(s.count, "expense")}, and ${big!.description} took ${pct}% of it on its own.`,
            `${big!.description} cost ${m(big!.amount)}. The rest of the ${m(s.total)} total was just along for the ride.`,
            `${m(s.total)} gone, ${pct}% of it to ${big!.description}. The other expenses barely got a word in.`,
          ],
          s,
          0,
        );

    out.push({
      id: "overview",
      title: "The big picture",
      facts: lines.join("\n"),
      angle: s.thin
        ? "There is very little data. Make a light joke about the small total or the small number of expenses. Do not claim anything about habits."
        : "Joke about the total and the single biggest expense: how big it is compared with the whole.",
      example: "₹7,777 in 9 expenses, and Gadget Hub took 61% of it. The other 8 just came along for the ride.",
      fallback,
    });
  }

  // ---------- where it went: categories ----------
  {
    const top = s.categories[0]!;
    const L = categoryLabel(top.id);
    const lines = s.categories
      .slice(0, 3)
      .map((c) => `${categoryLabel(c.id)}: ${m(c.amount)}, ${c.pct}% of the total, ${plural(c.count, "expense")}.`);
    lines.push(
      s.categories.length === 1
        ? "Everything fell in this one category."
        : `Categories used: ${s.categories.length}.`,
    );

    const fallback = s.thin
      ? `${L} leads so far with ${m(top.amount)}. Early days.`
      : s.categories.length === 1
        ? pick(
            [`All of it went to ${L}. Not one other category got a turn.`, `${L}, ${top.pct}% of the money. The other categories filed a complaint.`],
            s,
            1,
          )
        : pick(
            [
              `${top.pct}% went to ${L}. Everything else is supporting cast.`,
              `${L} pulled ${m(top.amount)} out of the total. The other categories are basically extras.`,
              `${L} at ${top.pct}%. It's not a category, it's a main character.`,
            ],
            s,
            1,
          );

    out.push({
      id: "categories",
      title: "Where it went",
      facts: lines.join("\n"),
      angle: s.thin
        ? "There is very little data. Make a light joke about the top category only."
        : "Joke about how the money is spread across categories. Focus on the top one and its share.",
      example: "62% went to Shopping. Everything else is just supporting cast.",
      fallback,
    });
  }

  // ---------- your habits: places and frequency ----------
  {
    const repeat = s.merchants.find((x) => x.count >= 2);
    const lines = [`${plural(s.count, "expense")} across ${plural(s.activeDays, "different day")}.`];
    if (!s.thin) {
      for (const x of s.merchants.filter((x) => x.count >= 2)) lines.push(`${x.name}: ${plural(x.count, "visit")}, ${m(x.amount)} in total.`);
      if (!repeat) lines.push("No place was visited more than once.");
      if (s.splitCount > 0) lines.push(`${plural(s.splitCount, "expense")} ${s.splitCount === 1 ? "was" : "were"} shared with friends.`);
      if (s.weekdayReliable && s.busiestWeekday) lines.push(`Most spending happened on ${s.busiestWeekday.day}: ${m(s.busiestWeekday.amount)}.`);
    } else {
      lines.push("Too little data to say anything about habits.");
    }

    const fallback = s.thin
      ? `${plural(s.count, "expense")} over ${plural(s.activeDays, "day")}. Too early to call it a pattern.`
      : repeat
        ? pick(
            [
              `${repeat.name} again? ${plural(repeat.count, "visit")} and ${m(repeat.amount)} so far.`,
              `${plural(repeat.count, "trip")} to ${repeat.name} for ${m(repeat.amount)}. Loyalty cards exist, you know.`,
              `${repeat.name} has seen you ${repeat.count} times and taken ${m(repeat.amount)}. Nice relationship.`,
            ],
            s,
            2,
          )
        : s.weekdayReliable && s.busiestWeekday
          ? `${s.busiestWeekday.day} is where the money goes: ${m(s.busiestWeekday.amount)}.`
          : `${plural(s.count, "expense")} over ${plural(s.activeDays, "different day")}, and no place got a second visit.`;

    out.push({
      id: "habits",
      title: "Your habits",
      facts: lines.join("\n"),
      angle: s.thin
        ? "There is very little data. Make a light joke about how few expenses there are. Do not claim any habit."
        : "Pick ONE thing: a place visited more than once, or how many expenses fell on how many days. Only mention a weekday if the facts give one.",
      example: "Corner Cafe, 4 visits, ₹1,200 so far. Loyalty cards exist, you know.",
      fallback,
    });
  }

  return out;
}

// ---------- checking model text against the facts ----------

const NUM = /\d[\d,]*(?:\.\d+)?/g;
const norm = (n: string) => n.replace(/,/g, "").replace(/\.$/, "");

/** Every number written in `text`, with thousands separators removed. */
export function numbersIn(text: string): string[] {
  return (text.match(NUM) ?? []).map(norm);
}

/** True if every number in `text` also appears in the facts (0-10 are always fine). */
export function numbersMatchFacts(text: string, facts: string): boolean {
  const allowed = new Set(numbersIn(facts));
  return numbersIn(text).every((n) => allowed.has(n) || (/^\d+$/.test(n) && Number(n) <= 10));
}

// Things a spending roast must never claim: money situation, people, plans,
// and sweeping statements about behaviour that a few weeks of data can't back.
const NOT_ALLOWED =
  /\b(income|salary|paycheck|earn\w*|wages?|rich|wealth\w*|poor|broke|afford\w*|mortgage|loans?|debt|savings?|invest\w*|boss|jobs?|wife|husband|girlfriend|boyfriend|kids?|children|family|lifestyle|cars?|house|flat|apartment|vacation|holiday|diet|buy|bought|worth|equivalent|always|never|every|everyday|usually|typically|tends?|habit|habitual|addict\w*|obsess\w*|constantly|whenever|apparently|clearly)\b/i;

// Words that are only fine if the facts mention them too.
const MUST_BE_IN_FACTS = [
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  /\bweek(?:ends?|days?)\b/gi,
  /\bfriends?\b/gi,
  /\b(food|groceries|transport|rent|utilities|entertainment|travel|shopping|health)\b/gi,
  /\b(breakfast|lunch|dinner|coffee|pizza|biryani|movie|movies|flight|flights)\b/gi,
];

const MAX_WORDS = 45;

export type Verdict = { ok: true; text: string } | { ok: false; reason: string };

const inFacts = (word: string, facts: string) => new RegExp(`\\b${word.replace(/s$/i, "")}s?\\b`, "i").test(facts);

/**
 * Cleans the model's answer and checks every claim in it against the facts.
 * Returns the cleaned text, or the reason it was rejected.
 */
export function checkJoke(raw: string, facts: string): Verdict {
  let text = raw
    .replace(/^\s*(joke|answer|roast)\s*:\s*/i, "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Keep the first two sentences at most.
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 2) text = sentences.slice(0, 2).join(" ");

  if (text.length < 15) return { ok: false, reason: "it was too short" };
  if (text.split(" ").length > MAX_WORDS) return { ok: false, reason: "it was too long" };

  const banned = NOT_ALLOWED.exec(text);
  if (banned) return { ok: false, reason: `it used "${banned[0]}", which the facts don't support` };

  if (!numbersMatchFacts(text, facts)) return { ok: false, reason: "it used a number that is not in the facts" };

  for (const re of MUST_BE_IN_FACTS) {
    for (const hit of text.matchAll(re)) {
      if (!inFacts(hit[0], facts)) return { ok: false, reason: `it mentioned "${hit[0]}", which is not in the facts` };
    }
  }

  // Names (capitalised words inside a sentence) must come from the facts.
  const known = new Set(facts.toLowerCase().match(/[a-zÀ-ɏ]+/g) ?? []);
  for (const sentence of sentences.length > 2 ? sentences.slice(0, 2) : sentences) {
    const words = sentence.split(" ").slice(1);
    for (const w of words) {
      if (/^I(?:['’]|$)/.test(w)) continue; // "I", "I'll"
      const bare = w.replace(/[^A-Za-zÀ-ɏ]/g, "");
      if (bare.length > 1 && /^[A-Z]/.test(bare) && bare !== bare.toUpperCase() && !known.has(bare.toLowerCase())) {
        return { ok: false, reason: `it mentioned "${bare}", which is not in the facts` };
      }
    }
  }

  return { ok: true, text };
}
