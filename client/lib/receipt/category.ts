import type { Field } from "./parser.ts";

// Keyword rules, checked in order. Edit these lists to teach the app new words.
const RULES: [string, RegExp][] = [
  ["groceries", /\b(supermarket|mart|grocery|kirana|bigbasket|blinkit|zepto|dmart|reliance fresh|vegetables|fruits|milk|atta|rice)\b/i],
  ["food", /\b(restaurant|kitchen|cafe|caf[eé]|bistro|dhaba|biryani|pizza|burger|bakery|sweets|hotel|bar|pub|tikka|naan|paneer|dal|chaas|thali|coffee|tea|zomato|swiggy|dine|dining|food|bhojanalay)\b/i],
  ["transport", /\b(uber|ola|rapido|taxi|cab|fuel|petrol|diesel|metro|parking|toll|irctc|railway|bus)\b/i],
  ["travel", /\b(flight|airline|airways|indigo|makemytrip|goibibo|booking|oyo|resort|lodge|visa)\b/i],
  ["health", /\b(pharmacy|chemist|medical|medicine|hospital|clinic|diagnostic|apollo|pathology|doctor)\b/i],
  ["utilities", /\b(electricity|water bill|broadband|recharge|jio|airtel|vodafone|gas|internet|postpaid)\b/i],
  ["entertainment", /\b(cinema|movie|pvr|inox|netflix|spotify|bookmyshow|game|concert|ticket)\b/i],
  ["shopping", /\b(store|mall|fashion|apparel|clothing|shoes|electronics|amazon|flipkart|myntra|ikea)\b/i],
  ["rent", /\b(rent|landlord|lease)\b/i],
];

/** A best-guess category from the receipt text, or undefined when nothing matches. */
export function guessCategory(text: string): Field<string> | undefined {
  for (const [category, re] of RULES) if (re.test(text)) return { value: category, confidence: 0.7 };
  return undefined;
}
