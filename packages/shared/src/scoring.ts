import type { Band, Confidence, FactItem, Polarity } from "./types.js";

/**
 * Estimate bands use log distance so a factor of two is the same miss at 80
 * or at 80 million.
 *
 *   d = |log10(guess) − log10(answer)|
 *
 * Published cutoffs, from the product rules:
 *   green  d ≤ 0.0414   within about 10%
 *   yellow d ≤ 0.3010   within 2×
 *   blue   d ≤ 1        within 10×
 *   brown  d ≤ 2        within 100×
 *   black  otherwise
 *
 * 0.3010 is log10(2) rounded to four decimals (the true value is ≈ 0.30103).
 * Distances are rounded to four decimals before the yellow and green checks
 * so an exact factor of two still counts as "within 2×".
 */

export const BAND_EMOJI: Record<Band, string> = {
  green: "🟩",
  yellow: "🟨",
  blue: "🟦",
  brown: "🟤",
  black: "⬛",
};

export const BAND_LABEL: Record<Band, string> = {
  green: "Within 10%",
  yellow: "Within 2×",
  blue: "Within 10×",
  brown: "Within 100×",
  black: "Way off",
};

export const QUESTION_MAX_POINTS = 20;

const BASE_POINTS: Record<Band, number> = {
  green: 16,
  yellow: 12,
  blue: 8,
  brown: 4,
  black: 0,
};

/**
 * Narrow is a bigger reward inside 2× and a penalty outside it.
 * Wide does not change the band score. Each question still caps at 20,
 * and points never drop below 0, so a day stays inside 0–100.
 */
const CONFIDENCE_DELTA: Record<Confidence, { right: number; wrong: number }> = {
  wide: { right: 0, wrong: 0 },
  medium: { right: 2, wrong: -2 },
  narrow: { right: 4, wrong: -4 },
};

export function logDistance(guess: number, answer: number): number {
  if (!(guess > 0) || !(answer > 0)) {
    throw new Error("Estimate scoring requires positive numbers");
  }
  return Math.abs(Math.log10(guess) - Math.log10(answer));
}

export function estimateBand(guess: number, answer: number): Band {
  // Compare on four decimal places so 0.3010 (log10(2), rounded) includes an exact 2× guess.
  const tenThousandths = Math.round(logDistance(guess, answer) * 10_000);
  if (tenThousandths <= 414) return "green";
  if (tenThousandths <= 3010) return "yellow";
  const raw = logDistance(guess, answer);
  if (raw <= 1) return "blue";
  if (raw <= 2) return "brown";
  return "black";
}

export function isWithinTwoTimes(band: Band): boolean {
  return band === "green" || band === "yellow";
}

export function estimateScore(
  guess: number,
  answer: number,
  confidence: Confidence,
): { band: Band; points: number; basePoints: number; confidenceDelta: number } {
  const band = estimateBand(guess, answer);
  const basePoints = BASE_POINTS[band];
  const side = isWithinTwoTimes(band) ? "right" : "wrong";
  const confidenceDelta = CONFIDENCE_DELTA[confidence][side];
  const points = clamp(basePoints + confidenceDelta, 0, QUESTION_MAX_POINTS);
  return { band, points, basePoints, confidenceDelta };
}

export function correctOrder(items: FactItem[], polarity: Polarity): string[] {
  const sorted = [...items].sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
  if (polarity === "higher") sorted.reverse();
  return sorted.map((item) => item.id);
}

/** Number of pairs that are in the wrong relative order. */
export function kendallDistance(order: string[], correct: string[]): number {
  if (order.length !== correct.length) {
    throw new Error("Rank order length does not match");
  }
  const rank = new Map(correct.map((id, index) => [id, index]));
  const sequence: number[] = [];
  for (const id of order) {
    const position = rank.get(id);
    if (position === undefined) throw new Error("Unknown item in rank order");
    sequence.push(position);
  }
  if (new Set(order).size !== order.length) throw new Error("Duplicate item in rank order");
  let inversions = 0;
  for (let i = 0; i < sequence.length; i += 1) {
    for (let j = i + 1; j < sequence.length; j += 1) {
      if (sequence[i] > sequence[j]) inversions += 1;
    }
  }
  return inversions;
}

/**
 * Exact order is green (20). A single adjacent swap is yellow (12).
 * Anything further off is black (0).
 */
export function rankScore(order: string[], correct: string[]): { band: Band; points: number } {
  const distance = kendallDistance(order, correct);
  if (distance === 0) return { band: "green", points: QUESTION_MAX_POINTS };
  if (distance === 1) return { band: "yellow", points: 12 };
  return { band: "black", points: 0 };
}

export function compareScore(choiceId: string, correctId: string): { band: Band; points: number } {
  if (choiceId === correctId) return { band: "green", points: QUESTION_MAX_POINTS };
  return { band: "black", points: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
