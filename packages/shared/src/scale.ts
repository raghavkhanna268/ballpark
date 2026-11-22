export type ScaleLevel = {
  id: string;
  name: string;
  emoji: string;
  /** How high this stop is, rounded on purpose so it never repeats a quiz answer. */
  altitude: string;
  /** Rough altitude as the exponent in 10^n metres (0 for the launch pad). */
  exponent: number;
};

/**
 * The climb, from the launch pad straight up. Index 0 is the start and index 10 is a perfect run.
 * A correct answer climbs one stop. Above the edge of space the climber is an astronaut.
 */
export const SCALE_LEVELS: ScaleLevel[] = [
  { id: "launch", name: "Launch pad", emoji: "🏁", altitude: "0 m", exponent: 0 },
  { id: "rooftops", name: "Rooftops", emoji: "🏠", altitude: "≈ 20 m", exponent: 1.3 },
  { id: "skyscrapers", name: "Skyscrapers", emoji: "🏙️", altitude: "≈ 500 m", exponent: 2.7 },
  { id: "clouds", name: "Clouds", emoji: "☁️", altitude: "≈ 2 km", exponent: 3.3 },
  { id: "peaks", name: "Mountain peaks", emoji: "🏔️", altitude: "≈ 9 km", exponent: 4 },
  { id: "stratosphere", name: "Stratosphere", emoji: "🎈", altitude: "≈ 30 km", exponent: 4.5 },
  { id: "space", name: "Edge of space", emoji: "🚀", altitude: "100 km", exponent: 5 },
  { id: "station", name: "Space station", emoji: "🛰️", altitude: "≈ 400 km", exponent: 5.6 },
  { id: "moon", name: "Moon", emoji: "🌕", altitude: "≈ 400,000 km", exponent: 8.6 },
  { id: "planets", name: "Planets", emoji: "🪐", altitude: "≈ 1 billion km", exponent: 12 },
  { id: "galaxy", name: "Milky Way", emoji: "🌌", altitude: "≈ 30,000 light years", exponent: 20.4 },
];

/** The first stop where the climber wears a space suit. */
export const SPACE_STOP = 6;

/** Five name-one questions at up to 100 points each. Keep in step with NAME_CAP in rarity.ts. */
export const CLASSIC_SCORE_SPAN = 500;

const PHRASE: Record<string, string> = {
  launch: "the launch pad",
  rooftops: "the rooftops",
  skyscrapers: "the tops of the skyscrapers",
  clouds: "the clouds",
  peaks: "the mountain peaks",
  stratosphere: "the stratosphere",
  space: "the edge of space",
  station: "the space station",
  moon: "the Moon",
  planets: "the planets",
  galaxy: "the Milky Way",
};

/** Head-to-head: the stop depends on how many picks were right, not how many were answered. */
export function levelForCorrectCount(correct: number): ScaleLevel {
  return levelForProgress(correct);
}

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

/** The stop at a height along the climb, as the scene draws it. */
export function levelForProgress(progress: number): ScaleLevel {
  const index = Math.max(0, Math.min(SCALE_LEVELS.length - 1, Math.round(progress)));
  return SCALE_LEVELS[index]!;
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

/** The climb for the share card, with no answers in it: "🏁→☁️→🚀 reached the edge of space". */
export function zoomShareLine(level: ScaleLevel): string {
  const index = Math.max(0, SCALE_LEVELS.findIndex((item) => item.id === level.id));
  const mid = Math.floor(index / 2);
  const parts = [SCALE_LEVELS[0]!.emoji];
  if (mid > 0 && mid < index) parts.push(SCALE_LEVELS[mid]!.emoji);
  if (index > 0) parts.push(SCALE_LEVELS[index]!.emoji);
  return `${parts.join("→")} reached ${reachedPhrase(level)}`;
}
