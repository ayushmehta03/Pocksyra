import { complete, getEngine, type LlmProgress } from "@/lib/llm/engine";
import { checkJoke, type Section } from "./facts";

const SYSTEM = `You write one-liner jokes about a person's spending, like a clever friend. Slightly savage, never insulting. Joke about the numbers and the places, never about the person.

Hard rules:
- 1 or 2 short sentences, under 30 words in total.
- Use only the facts you are given. Copy numbers, names and amounts exactly as written.
- Never mention income, jobs, family, friends' spending, lifestyle, wealth, or what the person could buy or afford.
- Never say "always", "never", "every" or "usually": you only see a few weeks of data.
- Do not mention days, categories or places that are not in the facts.
- No emojis, no lists, no headings.`;

export type RoastResult = { text: string; source: "ai" | "plain" };

const ATTEMPTS = 2;

/**
 * Asks the on-device model for one joke about one section and checks it
 * against the facts. A rejected joke gets one retry with the reason; if that
 * also fails, the hand-written fallback is used, so what the user reads never
 * claims more than their data shows.
 */
export async function roastSection(section: Section, onText: (text: string) => void): Promise<RoastResult> {
  let feedback = "";
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let text = "";
    try {
      text = await complete(
        [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content:
              `Facts:\n${section.facts}\n\nAngle: ${section.angle}\n` +
              `Example of the style (different data, never copy it): ${section.example}\n` +
              (feedback ? `Your last try was rejected because ${feedback}. Fix that.\n` : "") +
              "Write the joke now.",
          },
        ],
        { temperature: attempt === 0 ? 0.8 : 0.5, maxTokens: 90, onToken: (chunk) => onText((text += chunk)) },
      );
    } catch {
      break;
    }
    const verdict = checkJoke(text, section.facts);
    if (verdict.ok) return { text: verdict.text, source: "ai" };
    feedback = verdict.reason;
  }
  return { text: section.fallback, source: "plain" };
}

export const prepareModel = (onProgress: (p: LlmProgress) => void) => getEngine(onProgress);
