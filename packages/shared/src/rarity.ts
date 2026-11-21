import type { Band } from "./types.js";

/** Below this many responses, a seed prior still has weight. At this count, the score is live. */
export const COLD_START_RESPONSES = 20;

export const NAME_BASE = 20;
export const NAME_CAP = 36;
export const ESTIMATE_BONUS_CAP = 6;
export const H2H_POINT = 1;
export const H2H_RARITY_CAP = 4;

export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Blend a live share toward a prior until `coldStart` responses exist.
 * `sampleSize` 0 returns the prior. `sampleSize` >= coldStart returns the live share.
 */
export function blendShare(liveShare: number, sampleSize: number, priorShare: number, coldStart = COLD_START_RESPONSES): number {
  const sample = Math.max(0, sampleSize);
  const priorWeight = Math.max(0, coldStart - sample);
  const total = priorWeight + sample;
  if (total <= 0) return clamp01(priorShare);
  return clamp01((clamp01(priorShare) * priorWeight + clamp01(liveShare) * sample) / total);
}

/** 0.5× when everyone agrees, 2× when the answer is unique. */
export function rarityMultiplier(uniqueness: number): number {
  return 0.5 + 1.5 * clamp01(uniqueness);
}

export function nameOnePoints(share: number): number {
  const raw = NAME_BASE * rarityMultiplier(1 - share);
  return Math.min(NAME_CAP, Math.max(0, Math.round(raw)));
}

/** Expected share of other players who are farther than a close guess, before anyone has played. */
export function estimatePriorFarther(difficulty: number): number {
  if (difficulty <= 1) return 0.3;
  if (difficulty >= 3) return 0.75;
  return 0.55;
}

/** Extra points for a close estimate when the field was farther off. Way-off guesses get nothing. */
export function estimateCrowdBonus(band: Band, fartherShare: number): number {
  if (band !== "green" && band !== "yellow") return 0;
  return Math.round(ESTIMATE_BONUS_CAP * clamp01(fartherShare));
}

/** Later pairs are expected to be missed more often. */
export function h2hPriorWrongShare(index: number): number {
  if (index < 5) return 0.2;
  if (index < 10) return 0.4;
  return 0.6;
}

export function h2hPickPoints(wrongShare: number): number {
  return H2H_POINT + Math.round(H2H_RARITY_CAP * clamp01(wrongShare));
}

export type RankedRun = { length: number; points: number };

/** Longer run wins. Equal length breaks on rarity points. */
export function beatsRun(mine: RankedRun, other: RankedRun): boolean {
  if (mine.length !== other.length) return mine.length > other.length;
  return mine.points > other.points;
}

/**
 * Percent of other finishers this run beats.
 * A lone finisher is 100. An equal length and equal points does not count as a win.
 */
export function beatPercentRuns(mine: RankedRun, all: RankedRun[]): number {
  if (all.length <= 1) return 100;
  const beaten = all.filter((row) => beatsRun(mine, row)).length;
  return Math.round((100 * beaten) / (all.length - 1));
}
