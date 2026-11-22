/** Below this many responses, a seed prior still has weight. At this count, the score is live. */
export const COLD_START_RESPONSES = 20;

export const NAME_BASE = 20;
/** A legendary answer. Every name-one question is out of this many points. */
export const NAME_CAP = 100;

export type NameTier = { name: string; points: number; band: "green" | "yellow" | "blue" | "brown"; maxShare: number };

/**
 * Rarity tiers, by the share of players who gave the same answer (blended with the editorial prior
 * until enough people have played). The rarer the answer, the more it scores and the farther you fly.
 */
export const NAME_TIERS: NameTier[] = [
  { name: "Legendary", points: 100, band: "green", maxShare: 0.01 },
  { name: "Deep cut", points: 75, band: "green", maxShare: 0.03 },
  { name: "Rare", points: 50, band: "yellow", maxShare: 0.08 },
  { name: "Uncommon", points: 25, band: "blue", maxShare: 0.2 },
  { name: "Common", points: 10, band: "brown", maxShare: 1 },
];

export function nameTier(share: number): NameTier {
  const value = clamp01(share);
  return NAME_TIERS.find((tier) => value <= tier.maxShare) ?? NAME_TIERS[NAME_TIERS.length - 1]!;
}

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
  return nameTier(share).points;
}

