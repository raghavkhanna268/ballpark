import type { SliderScale } from "./types.js";

/**
 * Fixed spans for a scale, identical for every question that uses it.
 * They are intentionally wide and are not centered on the true answer.
 */
const RANGES: Record<SliderScale, { min: number; max: number }> = {
  "distance-km": { min: 1, max: 1_000_000_000 },
  "length-m": { min: 0.1, max: 100_000 },
  "speed-ms": { min: 1, max: 1_000_000_000 },
  "mass-kg": { min: 0.001, max: 1_000_000 },
  years: { min: 1, max: 1_000_000 },
  days: { min: 1, max: 10_000 },
  "area-km2": { min: 0.1, max: 1_000_000_000 },
  count: { min: 1, max: 1_000_000_000_000 },
  celsius: { min: 1, max: 10_000 },
  "area-m2": { min: 0.01, max: 10_000 },
};

export function sliderRange(scale: SliderScale): { min: number; max: number } {
  return RANGES[scale];
}

export function sliderToValue(t: number, min: number, max: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const log = Math.log10(min) + clamped * (Math.log10(max) - Math.log10(min));
  return 10 ** log;
}

export function valueToSlider(value: number, min: number, max: number): number {
  if (!(value > 0) || !(min > 0) || !(max > min)) return 0;
  const clamped = Math.min(max, Math.max(min, value));
  return (Math.log10(clamped) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
}
