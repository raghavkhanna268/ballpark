export type ScaleLevel = {
  id: string;
  name: string;
  emoji: string;
  /** Rough size of this rung, as the exponent in 10^n metres. */
  exponent: number;
  beyond?: boolean;
  extra?: number;
};

export const SCALE_LEVELS: ScaleLevel[] = [
  { id: "atom", name: "Atom", emoji: "⚛️", exponent: -10 },
  { id: "cell", name: "Cell", emoji: "🔬", exponent: -5 },
  { id: "ant", name: "Ant", emoji: "🐜", exponent: -3 },
  { id: "human", name: "Human", emoji: "🧍", exponent: 0 },
  { id: "building", name: "Building", emoji: "🏠", exponent: 2 },
  { id: "city", name: "City", emoji: "🏙️", exponent: 4 },
  { id: "country", name: "Country", emoji: "🗺️", exponent: 6 },
  { id: "earth", name: "Earth", emoji: "🌍", exponent: 7 },
  { id: "moon", name: "Moon orbit", emoji: "🌕", exponent: 9 },
  { id: "solar", name: "Solar system", emoji: "☀️", exponent: 13 },
  { id: "stars", name: "Nearby stars", emoji: "✨", exponent: 17 },
  { id: "galaxy", name: "Milky Way", emoji: "🌌", exponent: 21 },
  { id: "universe", name: "Observable universe", emoji: "🌀", exponent: 26 },
];

const BEYOND: ScaleLevel = { id: "beyond", name: "Beyond the universe", emoji: "🔭", exponent: 30, beyond: true };

/** Head-to-head: one zoom-out per correct pick. Past the last rung, the bonus tier keeps counting. */
export function levelForCorrectCount(correct: number): ScaleLevel {
  if (correct <= 0) return SCALE_LEVELS[0]!;
  if (correct < SCALE_LEVELS.length) return SCALE_LEVELS[correct]!;
  return { ...BEYOND, extra: correct - (SCALE_LEVELS.length - 1) };
}

/** Classic: the day's points slide along the same path. 0 stays on the atom. 100 reaches the last rung. */
export function levelIndexForClassicScore(score: number): number {
  const last = SCALE_LEVELS.length - 1;
  if (score <= 0) return 0;
  return Math.min(last, Math.round((score / 100) * last));
}

export function levelForClassicScore(score: number): ScaleLevel {
  return SCALE_LEVELS[levelIndexForClassicScore(score)]!;
}

export function zoomShareLine(level: ScaleLevel): string {
  const index = level.beyond ? SCALE_LEVELS.length - 1 : SCALE_LEVELS.findIndex((item) => item.id === level.id);
  const mid = Math.floor(Math.max(0, index) / 2);
  const end = level.beyond ? BEYOND.emoji : SCALE_LEVELS[index]!.emoji;
  const parts = [SCALE_LEVELS[0]!.emoji];
  if (mid > 0 && mid < index) parts.push(SCALE_LEVELS[mid]!.emoji);
  if (index > 0) parts.push(end);
  return `${parts.join("→")} reached ${level.name}`;
}
