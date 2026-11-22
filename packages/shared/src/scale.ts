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

/** Five name-one questions at up to 100 points each. Keep in step with NAME_CAP in rarity.ts. */
export const CLASSIC_SCORE_SPAN = 500;

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

/**
 * Visual stops, in order. A correct answer advances one stop. A miss advances a third,
 * so a finished 5/10 and a finished 10/10 do not land on the same world.
 */
const JOURNEY_STOP_IDS = ["atom", "cell", "ant", "human", "city", "country", "earth", "moon", "solar", "stars", "galaxy", "universe"] as const;

/** Distance along the illustrated path. Correct answers count as 1, misses as 1/3. */
export function journeyProgress(correct: number, answered: number): number {
  const safeCorrect = Math.max(0, correct);
  const misses = Math.max(0, answered - safeCorrect);
  return safeCorrect + misses / 3;
}

/**
 * Classic: how far one answer flies. A miss hops a little. Any scored answer flies at least 0.6 of a world,
 * and a full-marks answer flies two, so five perfect answers reach the Milky Way.
 */
export function classicStep(points: number, max: number): number {
  if (points <= 0 || max <= 0) return 0.28;
  return 0.6 + 1.4 * Math.min(1, points / max);
}

/** Today's field, as distances along the journey, so the client can fly ghosts for the average and the best. */
export type FieldStats = { players: number; averageProgress: number | null; bestProgress: number | null };

export function fieldStats(progresses: number[]): FieldStats {
  if (progresses.length === 0) return { players: 0, averageProgress: null, bestProgress: null };
  const total = progresses.reduce((sum, value) => sum + value, 0);
  return {
    players: progresses.length,
    averageProgress: Math.round((total / progresses.length) * 100) / 100,
    bestProgress: Math.round(Math.max(...progresses) * 100) / 100,
  };
}

/** The world at a distance along the journey, as the scene draws it. */
export function levelForProgress(progress: number): ScaleLevel {
  const index = Math.max(0, Math.min(JOURNEY_STOP_IDS.length - 1, Math.round(progress)));
  const id = JOURNEY_STOP_IDS[index]!;
  return SCALE_LEVELS.find((item) => item.id === id) ?? SCALE_LEVELS[0]!;
}

/** The world a finished run is standing in, including the short hops from misses. */
export function levelForJourney(correct: number, answered: number): ScaleLevel {
  return levelForProgress(journeyProgress(correct, answered));
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
