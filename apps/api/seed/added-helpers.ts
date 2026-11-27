import type { AcceptedSeed, NameOneSeed } from "./name-one.ts";

/**
 * Helpers for the days added after the first 17 (see LEGACY_SLOTS). The prompts follow the plain, broad style of
 * the best rarity games: a short "Name a ..." over a big everyday category, sometimes with a scope in brackets, so the
 * common answer is easy and the rare one is a real find. Priors are rough editorial guesses at how often players give
 * each answer, and the lists are pending editorial verification, like the rest of the sample.
 */

export type AddedQuestion = NameOneSeed & { nudge: string };

export type AddedDay = { theme: string; blurb: string; items: AddedQuestion[] };

export function a(canonical: string, prior: number, aliases: string[] = []): AcceptedSeed {
  return { canonical, prior, aliases };
}

export function q(
  id: string,
  prompt: string,
  nudge: string,
  accepted: AcceptedSeed[],
  context: string,
  page: string,
  topic: string,
  difficulty: 1 | 2 | 3,
): AddedQuestion {
  return {
    id,
    prompt,
    entitySet: null,
    accepted,
    context,
    sourceName: `Wikipedia: ${decodeURIComponent(page).replaceAll("_", " ")}`,
    sourceUrl: `https://en.wikipedia.org/wiki/${page}`,
    license: "CC BY-SA 4.0",
    topic,
    difficulty,
    nudge,
  };
}
