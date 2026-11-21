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

/**
 * Eleven stops for a finished game: index 0 is the start, index 10 is a perfect run.
 * Building is skipped so ten correct answers land on the Milky Way.
 */
const JOURNEY_INDEX = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11] as const;

/** Two name-one questions (36 each) plus three 20-point questions. */
export const CLASSIC_SCORE_SPAN = 132;

const PHRASE: Record<string, string> = {
  atom: "the atom",
  cell: "the cell",
  ant: "the ant",
  human: "the street",
  building: "the building",
  city: "the city",
  country: "the country",
  earth: "Earth",
  moon: "the Moon",
  solar: "the solar system",
  stars: "the nearby stars",
  galaxy: "the Milky Way",
  universe: "the observable universe",
};

/** Head-to-head: the stop depends on how many picks were right, not how many were answered. */
export function levelForCorrectCount(correct: number): ScaleLevel {
  const clamped = Math.max(0, Math.min(10, Math.round(correct)));
  return SCALE_LEVELS[JOURNEY_INDEX[clamped]]!;
}

export function levelIndexForClassicScore(score: number, span = CLASSIC_SCORE_SPAN): number {
  if (score <= 0 || span <= 0) return 0;
  return Math.min(10, Math.round((score / span) * 10));
}

export function levelForClassicScore(score: number, span = CLASSIC_SCORE_SPAN): ScaleLevel {
  return levelForCorrectCount(levelIndexForClassicScore(score, span));
}

export function reachedPhrase(level: ScaleLevel): string {
  return PHRASE[level.id] ?? level.name;
}

export function zoomShareLine(level: ScaleLevel): string {
  const index = Math.max(0, SCALE_LEVELS.findIndex((item) => item.id === level.id));
  const mid = Math.floor(index / 2);
  const parts = [SCALE_LEVELS[0]!.emoji];
  if (mid > 0 && mid < index) parts.push(SCALE_LEVELS[mid]!.emoji);
  if (index > 0) parts.push(SCALE_LEVELS[index]!.emoji);
  return `${parts.join("→")} reached ${level.name}`;
}
