import {
  blendShare,
  estimateCrowdBonus,
  estimatePriorFarther,
  matchAccepted,
  nameOnePoints,
  priorShare,
  suggestionsFor,
  type AcceptedAnswer,
  type Band,
  type CrowdStat,
  type Guess,
  type ServerQuestion,
} from "@ballpark/shared";
import { compareScore, estimateScore, logDistance, rankScore } from "@ballpark/shared/scoring";

export type PlayQuestion = ServerQuestion & {
  accepted: AcceptedAnswer[] | null;
  entitySet: string | null;
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
};

export function scoreClassicQuestion(question: PlayQuestion, guess: Guess, others: Guess[]): ClassicScore {
  if (question.type === "estimate" && guess.type === "estimate") {
    const answer = question.items[0]?.value ?? 0;
    const full = estimateScore(guess.value, answer, guess.confidence);
    const guesses = others.filter((item): item is Extract<Guess, { type: "estimate" }> => item.type === "estimate" && item.value > 0);
    const mine = logDistance(guess.value, answer);
    const farther = guesses.filter((item) => logDistance(item.value, answer) > mine).length;
    const live = guesses.length === 0 ? 0 : farther / guesses.length;
    const bonusPoints = estimateCrowdBonus(full.band, blendShare(live, guesses.length, estimatePriorFarther(question.difficulty)));
    return {
      band: full.band,
      points: full.points + bonusPoints,
      basePoints: full.basePoints,
      confidenceDelta: full.confidenceDelta,
      bonusPoints,
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
    return scoreName(question, guess.text, others);
  }

  return plain("black", 0);
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
  };
}

function scoreName(question: PlayQuestion, text: string, others: Guess[]): ClassicScore {
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
  const top = ranked.slice(0, 3).map(([label, count]) => ({ label, percent: Math.round((100 * count) / total) }));
  const topNames = new Set(top.map((item) => item.label));
  const rare = [...accepted]
    .filter((item) => !topNames.has(item.canonical) && item.canonical !== mine?.canonical)
    .sort((left, right) => left.prior - right.prior || left.canonical.localeCompare(right.canonical))
    .slice(0, 3)
    .map((item) => item.canonical);

  if (!mine) {
    return {
      ...plain("black", 0),
      answerText: "Not on the list",
      detail: "That answer is not accepted.",
      named: { kind: "named", answer: null, percent: 0, submissions: total, top, rare },
    };
  }

  const liveShare = (counts.get(mine.canonical) ?? 1) / total;
  const share = blendShare(liveShare, total, priorShare(mine, accepted));
  const points = nameOnePoints(share);
  return {
    ...plain("green", points),
    answerText: mine.canonical,
    detail: `Only ${Math.round(share * 100)}% of players said ${mine.canonical}.`,
    named: { kind: "named", answer: mine.canonical, percent: Math.round(share * 100), submissions: total, top, rare },
  };
}
