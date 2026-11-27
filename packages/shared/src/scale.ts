import { canCompare } from "./compete.js";

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

/** Questions in a Classic day. */
export const CLASSIC_QUESTIONS = 7;
/** Questions in a Ballpark+ pack. */
export const PACK_QUESTIONS = 5;
/** Seven name-one questions at up to 100 points each. Keep in step with NAME_CAP in rarity.ts. */
export const CLASSIC_SCORE_SPAN = CLASSIC_QUESTIONS * 100;

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
 * Classic and packs: how far one answer flies in a run of `questions`. Height follows points with no base amount,
 * so a Supernova (100) climbs ten times as far as a Liftoff (10), and a miss or a timeout does not climb at all.
 * A perfect run reaches the centre of the Milky Way (10) however many questions it has.
 */
export function classicStep(points: number, max: number, questions: number, boost = 1): number {
  if (points <= 0 || max <= 0) return 0;
  // An Afterburner stage scores double and climbs double, so it may go up to `boost` times the usual top step.
  const lift = Math.max(1, boost);
  return (10 * lift * Math.min(1, points / (max * lift))) / Math.max(1, questions);
}

/** Afterburner: once a day, one stage of the daily Classic scores double and climbs double. */
export const AFTERBURNER = 2;

/**
 * Real landmarks along the climb. `at` is the progress (0 to 10) where the climb passes it, and `km` its real height
 * or distance. Between two landmarks the height grows on a log scale, so each point moves the camera about as far.
 * 700 Classic points reach the Milky Way. Only an Afterburner on top of that reaches Andromeda.
 */
export type Milestone = { id: string; name: string; phrase: string; at: number; km: number };

export const MILESTONES: Milestone[] = [
  { id: "pad", name: "Launch pad", phrase: "the launch pad", at: 0, km: 0 },
  { id: "qutub", name: "Qutub Minar", phrase: "the top of the Qutub Minar", at: 0.125, km: 0.073 },
  { id: "burj", name: "Top of the Burj Khalifa", phrase: "the top of the Burj Khalifa", at: 0.275, km: 0.828 },
  { id: "monsoon", name: "Monsoon clouds", phrase: "the monsoon clouds", at: 0.625, km: 2 },
  { id: "everest", name: "Everest summit", phrase: "the summit of Everest", at: 1.3, km: 8.849 },
  { id: "jets", name: "Where jets cruise", phrase: "the height where jets cruise", at: 1.65, km: 11 },
  { id: "balloons", name: "Weather balloons pop", phrase: "where weather balloons pop", at: 2.3, km: 35 },
  { id: "meteors", name: "Meteors burn up", phrase: "where meteors burn up", at: 3, km: 80 },
  { id: "space", name: "Space begins", phrase: "the edge of space", at: 3.4, km: 100 },
  { id: "station", name: "Space station", phrase: "the space station", at: 4.2, km: 400 },
  { id: "satellites", name: "TV satellites", phrase: "the TV satellites", at: 5.2, km: 35_786 },
  // Rounded from 384,400 km: the client bundle must not carry numbers that a seeded question has as its answer.
  { id: "moon", name: "The Moon", phrase: "the Moon", at: 6.3, km: 384_000 },
  { id: "mars", name: "Mars", phrase: "Mars", at: 7.5, km: 2.25e8 },
  { id: "saturn", name: "Saturn", phrase: "Saturn", at: 8.7, km: 1.43e9 },
  { id: "galaxy", name: "Centre of the Milky Way", phrase: "the centre of the Milky Way", at: 10, km: 2.4599e17 },
  // Only a perfect run with its Afterburner on a Supernova gets here: 10 + 10/7.
  { id: "andromeda", name: "Andromeda", phrase: "the Andromeda galaxy", at: 11.4, km: 2.4e19 },
];

/** The highest a Classic run can climb: every stage a Supernova, one of them with the Afterburner. */
export const MAX_PROGRESS = 10 + 10 / 7;

/** How high a progress value is, in km. Linear up to the first landmark, then log-scaled between landmarks. */
export function altitudeKm(progress: number): number {
  if (progress <= 0) return 0;
  for (let index = 0; index < MILESTONES.length - 1; index += 1) {
    const low = MILESTONES[index]!;
    const high = MILESTONES[index + 1]!;
    if (progress < high.at) {
      const share = (progress - low.at) / (high.at - low.at);
      if (low.km <= 0) return high.km * share;
      return Math.exp(Math.log(low.km) + (Math.log(high.km) - Math.log(low.km)) * share);
    }
  }
  return MILESTONES[MILESTONES.length - 1]!.km;
}

const KM_PER_LIGHT_YEAR = 9.461e12;

/** "73 m", "9.6 km", "384,400 km", "225 million km", "1.4 billion km", "26,000 light years". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  if (km < 1e6) return `${Math.round(km).toLocaleString("en-US")} km`;
  if (km < 1e9) return `${(km / 1e6).toFixed(km < 1e7 ? 1 : 0)} million km`;
  if (km < KM_PER_LIGHT_YEAR / 10) return `${(km / 1e9).toFixed(1)} billion km`;
  const years = km / KM_PER_LIGHT_YEAR;
  return `${years < 10 ? years.toFixed(2) : Math.round(years).toLocaleString("en-US")} light years`;
}

/** The height of a progress value, written out: "9.6 km". */
export function formatAltitude(progress: number): string {
  return formatDistance(altitudeKm(progress));
}

/** The last landmark at or below a progress value. */
export function milestoneAt(progress: number): Milestone {
  let found = MILESTONES[0]!;
  for (const milestone of MILESTONES) if (milestone.at <= progress + 1e-6) found = milestone;
  return found;
}

/** The next landmark above a progress value, or null past the last one. */
export function nextMilestone(progress: number): Milestone | null {
  return MILESTONES.find((milestone) => milestone.at > progress + 1e-6) ?? null;
}

/** How many landmarks a progress value has reached, not counting the launch pad. */
export function milestonesReached(progress: number): number {
  return MILESTONES.filter((milestone) => milestone.at > 0 && milestone.at <= progress + 1e-6).length;
}

/** For the end screen: "9.6 km, past the summit of Everest", or "0 m" on the launch pad. */
export function climbedPhrase(progress: number): string {
  const height = formatAltitude(progress);
  const passed = milestoneAt(progress);
  return passed.at > 0 ? `${height}, past ${passed.phrase}` : height;
}

/** For the share card, with no answers in it: "🚀 9.6 km · past Everest summit". */
export function climbShareLine(progress: number): string {
  if (progress <= 0) return "🚀 still on the launch pad";
  const passed = milestoneAt(progress);
  return passed.at > 0 ? `🚀 ${formatAltitude(progress)} · past ${passed.name}` : `🚀 ${formatAltitude(progress)} up`;
}

/** Today's field, as distances along the journey, so the client can fly ghosts for the average and the best. */
export type FieldStats = { players: number; averageProgress: number | null; bestProgress: number | null };

export function fieldStats(progresses: number[]): FieldStats {
  if (!canCompare(progresses.length)) return { players: progresses.length, averageProgress: null, bestProgress: null };
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
