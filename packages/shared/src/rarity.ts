/** Below this many responses, a seed prior still has weight. At this count, the score is live. */
export const COLD_START_RESPONSES = 20;

export const NAME_BASE = 20;
export const NAME_CAP = 36;

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

