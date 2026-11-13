import { complete, getEngine, type LlmProgress } from "@/lib/llm/engine";
import { numbersMatchFacts, type Section } from "./facts";

const SYSTEM = `You are a witty friend who roasts the user's spending habits. Be playful, never cruel. Joke about the spending, never about the person.

Rules:
- Write 2 or 3 short sentences, at most 60 words, in English.
- Use ONLY the facts you are given. Copy numbers and amounts exactly as written.
- Do not calculate, estimate or add any number that is not in the facts.
- Do not use lists, headings or emojis.`;

export type RoastResult = { text: string; source: "ai" | "plain" };

/**
 * Asks the on-device model to word one section. If it invents a number, or
 * says nothing useful, the plain-code version is used instead, so what the
 * user reads is always consistent with their data.
 */
export async function roastSection(section: Section, onText: (text: string) => void): Promise<RoastResult> {
  let text = "";
  try {
    text = (
      await complete(
        [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Facts:\n${section.facts}\n\nTask: ${section.task}` },
        ],
        { temperature: 0.8, maxTokens: 160, onToken: (chunk) => onText((text += chunk)) },
      )
    ).trim();
  } catch {
    return { text: section.plain, source: "plain" };
  }
  if (text.length < 20 || !numbersMatchFacts(text, section.facts)) return { text: section.plain, source: "plain" };
  return { text, source: "ai" };
}

export const prepareModel = (onProgress: (p: LlmProgress) => void) => getEngine(onProgress);
