import {
  AFTERBURNER,
  COLD_START_RESPONSES,
  NAME_TIERS,
  blendShare,
  matchAccepted,
  nameTier,
  priorShare,
  suggestionsFor,
  type AcceptedAnswer,
  type Band,
  type CrowdStat,
  type Guess,
  type NameTier,
  type ServerQuestion,
} from "@ballpark/shared";
import { compareScore, estimateScore, rankScore } from "@ballpark/shared/scoring";

export type PlayQuestion = ServerQuestion & {
  accepted: AcceptedAnswer[] | null;
  entitySet: string | null;
  /** A line that points a stuck player at a corner of the answers. Null when the question has none. */
  nudge: string | null;
};

export type ClassicScore = {
  band: Band;
  points: number;
  basePoints: number;
  confidenceDelta: number;
  bonusPoints: number;
  answerText: string;
  detail: string;
  named: Extract<CrowdStat, { kind: "named" }> | null;
  crowdGuesses: number[];
  /** Rarity tier name for an accepted name-one answer. */
  tier: string | null;
};

/** How a stage was played: with today's Afterburner on, and whether the player asked for a nudge first. */
export type StageOptions = { boost?: boolean; nudged?: boolean };

/** After a nudge, a name-one answer scores at most this tier. */
export const NUDGE_CAP = "Moonshot";

/**
 * One stage's score with the day's extras applied: a nudge caps a name-one answer at a Moonshot, and the
 * Afterburner doubles whatever is left. Rarity is still worked out from everyone's plain answers.
 */
export function scoreStage(question: PlayQuestion, guess: Guess, others: Guess[], options: StageOptions = {}): ClassicScore {
  const scored = scoreClassicQuestion(question, guess, others, options.nudged === true);
  if (!options.boost || scored.points <= 0) return scored;
  return { ...scored, points: scored.points * AFTERBURNER, basePoints: scored.basePoints * AFTERBURNER };
}

export function scoreClassicQuestion(question: PlayQuestion, guess: Guess, others: Guess[], nudged = false): ClassicScore {
  if (question.type === "estimate" && guess.type === "estimate") {
    const answer = question.items[0]?.value ?? 0;
    const full = estimateScore(guess.value, answer, guess.confidence);
    const guesses = others.filter((item): item is Extract<Guess, { type: "estimate" }> => item.type === "estimate" && item.value > 0);
    return {
      band: full.band,
      points: full.points,
      basePoints: full.basePoints,
      confidenceDelta: full.confidenceDelta,
      bonusPoints: 0,
      tier: null,
      answerText: "",
      detail: "",
      named: null,
      crowdGuesses: guesses.map((item) => item.value).slice(0, 40),
    };
  }

  if (question.type === "compare" && guess.type === "compare") {
    const scored = compareScore(guess.choiceId, question.correctOrder[0] ?? "");
    return plain(scored.band, scored.points);
  }

  if (question.type === "rank" && guess.type === "rank") {
    const scored = rankScore(guess.order, question.correctOrder);
    return plain(scored.band, scored.points);
  }

  if (question.type === "name_one" && guess.type === "name_one") {
    if (guess.timedOut) return { ...scoreName(question, "", others), answerText: "Out of time", detail: "The timer ran out before an answer was locked in.", tier: null };
    return scoreName(question, guess.text, others, nudged);
  }

  return plain("black", 0);
}

/** Wrong tries a player gets on one name-one question, per minute, before the server says to slow down. */
export const RETRY_LIMIT = 10;

/**
 * A typed name-one answer that is not on the accepted list. It is not stored and scores nothing yet: the player
 * tries again while the clock runs. Only an accepted answer, or running out of time, locks the question.
 */
export function isUnlistedName(question: PlayQuestion, guess: Guess): boolean {
  if (question.type !== "name_one" || guess.type !== "name_one" || guess.timedOut) return false;
  return matchAccepted(guess.text, question.accepted ?? []) === null;
}

export function suggestionsForQuestion(question: PlayQuestion): string[] {
  return suggestionsFor(question.entitySet);
}

function plain(band: Band, points: number): ClassicScore {
  return {
    band,
    points,
    basePoints: points,
    confidenceDelta: 0,
    bonusPoints: 0,
    answerText: "",
    detail: "",
    named: null,
    crowdGuesses: [],
    tier: null,
  };
}

function scoreName(question: PlayQuestion, text: string, others: Guess[], nudged = false): ClassicScore {
  const accepted = question.accepted ?? [];
  const mine = matchAccepted(text, accepted);
  const matched = others.map((item) => (item.type === "name_one" ? matchAccepted(item.text, accepted) : null));
  const total = others.length + 1;
  const counts = new Map<string, number>();
  for (const item of matched) {
    if (item) counts.set(item.canonical, (counts.get(item.canonical) ?? 0) + 1);
  }
  if (mine) counts.set(mine.canonical, (counts.get(mine.canonical) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const top = ranked.slice(0, 3).map(([label, count]) => ({ label, percent: livePercent(count, total) }));
  const topNames = new Set(top.map((item) => item.label));
  const rare = [...accepted]
    .filter((item) => !topNames.has(item.canonical) && item.canonical !== mine?.canonical)
    .sort((left, right) => left.prior - right.prior || left.canonical.localeCompare(right.canonical))
    .slice(0, 3)
    .map((item) => item.canonical);

  const fromPrior = total < COLD_START_RESPONSES;
  if (!mine) {
    return {
      ...plain("black", 0),
      answerText: "Not on the list",
      detail: "That answer is not accepted.",
      named: { kind: "named", answer: null, percent: 0, count: 0, submissions: total, top, rare, blendedPercent: null, fromPrior },
    };
  }

  const said = counts.get(mine.canonical) ?? 1;
  const live = livePercent(said, total);
  // Rarity is how many other players gave the same answer. Counting your own answer would stop the first
  // player of the day from ever finding a Supernova.
  const othersSaid = matched.filter((item) => item?.canonical === mine.canonical).length;
  const sample = others.length;
  const share = blendShare(sample > 0 ? othersSaid / sample : 0, sample, priorShare(mine, accepted));
  const tier = nudged ? capTier(nameTier(share)) : nameTier(share);
  const points = tier.points;
  const blendedPercent = Math.round(share * 100);
  const headline =
    live < 50 ? `Only ${live}% of players said ${mine.canonical}.` : `${live}% of players said ${mine.canonical}.`;
  return {
    ...plain(tier.band, points),
    tier: tier.name,
    answerText: mine.canonical,
    detail: headline,
    named: {
      kind: "named",
      answer: mine.canonical,
      percent: live,
      count: said,
      submissions: total,
      top,
      rare,
      blendedPercent,
      fromPrior,
    },
  };
}

function livePercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((100 * count) / total);
}

/** A nudged answer keeps its tier up to a Moonshot. Anything rarer counts as a Moonshot. */
function capTier(tier: NameTier): NameTier {
  const cap = NAME_TIERS.find((item) => item.name === NUDGE_CAP)!;
  return tier.points > cap.points ? cap : tier;
}
