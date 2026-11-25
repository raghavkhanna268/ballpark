/**
 * Shared fact and question shapes.
 *
 * `ServerQuestion` is the full record, including numeric values. It stays on
 * the API. `PublicQuestion` is the only shape the browser is allowed to see
 * before a guess is submitted.
 *
 * Head-to-head (mode 2) can pair any two `items` by `value` without a new
 * fact model: a run is a sequence of compare picks over this same table.
 */

export type QuestionType = "estimate" | "compare" | "rank" | "name_one";

export type Confidence = "narrow" | "medium" | "wide";

export type Band = "green" | "yellow" | "blue" | "brown" | "black";

export type Polarity = "higher" | "lower";

export type Mode = "classic" | "head-to-head";

/** Coarse slider span shared by every estimate that uses that scale. Not centered on the answer. */
export type SliderScale =
  | "distance-km"
  | "length-m"
  | "speed-ms"
  | "mass-kg"
  | "years"
  | "days"
  | "area-km2"
  | "count"
  | "celsius"
  | "area-m2";

export type FactItem = {
  id: string;
  label: string;
  /** Server-only until reveal. */
  value: number;
  unit: string;
};

/**
 * Canonical question record. Mode 1 renders `prompt`. Mode 2 can ignore the
 * prompt and compare `items` directly.
 */
export type ServerQuestion = {
  id: string;
  prompt: string;
  type: QuestionType;
  unit: string | null;
  polarity: Polarity;
  /** Estimate: one value. Compare and rank: one value per item, same order as `items`. */
  values: number[];
  items: FactItem[];
  /** Ids in the order that scores as correct. Never sent to the client before submit. */
  correctOrder: string[];
  /** Ids in the order the client should display. */
  displayOrder: string[];
  context: string;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
  license: string;
  topic: string;
  difficulty: number;
  verified: boolean;
  slider: SliderScale | null;
};

export type PublicItem = {
  id: string;
  label: string;
};

export type PublicQuestion = {
  id: string;
  prompt: string;
  type: QuestionType;
  unit: string | null;
  items: PublicItem[];
  topic: string;
  difficulty: number;
  slider: { min: number; max: number } | null;
  /** Empty unless the question is name-one. A broad list, not the scoring key. */
  suggestions: string[];
  /** True when a stuck player can ask for a nudge on this question. The nudge itself comes from the API on request. */
  hasNudge: boolean;
  reveal: Reveal | null;
};

export type EstimateGuess = {
  type: "estimate";
  value: number;
  confidence: Confidence;
};

export type CompareGuess = {
  type: "compare";
  choiceId: string;
};

export type RankGuess = {
  type: "rank";
  order: string[];
};

export type NameGuess = {
  type: "name_one";
  text: string;
  /** The 25-second timer ran out. Scores zero. */
  timedOut?: boolean;
};

export type Guess = EstimateGuess | CompareGuess | RankGuess | NameGuess;

export type CrowdStat =
  | { kind: "median"; value: number; unit: string; submissions: number }
  | { kind: "percentCorrect"; percent: number; submissions: number }
  | {
      kind: "named";
      /** Live share of players who gave `answer`. Same integer as that name's row in `top`. */
      answer: string | null;
      percent: number;
      /** How many players gave `answer`, you included. */
      count: number;
      submissions: number;
      top: { label: string; percent: number }[];
      rare: string[];
      /**
       * Share used for rarity points. Equals `percent` once 20 answers exist.
       * Below that it blends the seed prior, and the reveal says so.
       */
      blendedPercent: number | null;
      fromPrior: boolean;
    };

export type Reveal = {
  band: Band;
  emoji: string;
  label: string;
  points: number;
  answerText: string;
  detail: string;
  /** Present for estimates. */
  confidence: Confidence | null;
  basePoints: number;
  confidenceDelta: number;
  /** Extra points from the crowd. Zero when the guess was not close, or the question is not an estimate. */
  bonusPoints: number;
  /** True until the reset at midnight India time freezes the day's points. */
  provisional: boolean;
  /** The Afterburner was on for this stage: its points and its climb are doubled. */
  boosted: boolean;
  /** The player asked for a nudge before answering, so this stage scores at most a Moonshot. */
  nudged: boolean;
  context: string;
  sourceUrl: string;
  sourceName: string;
  sources: { sourceName: string; sourceUrl: string }[];
  crowd: CrowdStat;
  /** Ordered reveal rows. Values are included only after scoring. */
  rows: { id: string; label: string; valueText: string; chosen?: boolean }[];
  /** Estimate track, so the client can animate the pin. Null otherwise. */
  track: { min: number; max: number; guess: number; answer: number; unit: string; crowd: number[] } | null;
};

export type DayResult = {
  score: number;
  bands: Band[];
  emojis: string[];
  beatPercent: number;
  players: number;
  shareText: string;
  reached: string;
  provisional: boolean;
  /** Your rank among today's finishers, and the gap to the next rank up. Null for a Cruise run, which is not ranked. */
  place: import("./compete.js").Placement | null;
  /** Played in Cruise: no clock, kept out of the rank, the board and the league. */
  cruise: boolean;
  /** The race code in the share link, so the client can show it. */
  race: string;
  /** The stage that used today's Afterburner, by index, or null. */
  boosted: number | null;
  /** Today's finished climbs as a histogram of heights with yours marked. Null below 20 finishers. */
  curve: ClimbCurve | null;
};

export type ClimbCurve = {
  /** Finished climbs per height band, lowest first. Each band is `top / bins.length` tall. */
  bins: number[];
  top: number;
  /** Your height. */
  you: number;
  /** The share of other finishers you climbed higher than, 0 to 100. */
  higherThan: number;
};

/** One finished climb on today's board. */
export type BoardRow = { rank: number; callsign: string; progress: number; score: number; skin: string | null; you: boolean; bot: boolean };

export type TodayStats = {
  /**
   * People who have answered at least one question today, from PEOPLE_SHOWN_FROM of them. Below that the count
   * is left out instead of saying how few, and today's bots keep the board full.
   */
  climbing: number | null;
  /** Today's bots on the board. */
  bots: number;
  /** The ten highest finished climbs, bots included. */
  board: BoardRow[];
  /** Your row when you finished outside the top ten. */
  you: BoardRow | null;
};

export type PuzzleResponse = {
  date: string;
  puzzleNumber: number;
  theme: string;
  blurb: string;
  nextTheme: string;
  mode: "classic";
  shareHost: string;
  devDate: boolean;
  questions: PublicQuestion[];
  result: DayResult | null;
  /** Finished Classic runs today, as distances along the journey. */
  field: import("./scale.js").FieldStats;
  /** How many are climbing today and the top ten, once 20 have played. */
  today: TodayStats;
  /** How today is being played once the first answer is in: true for Cruise (no clock), null before any answer. */
  cruise: boolean | null;
};

export type GuessResponse = {
  reveal: Reveal;
  result: DayResult | null;
};

export type Stats = {
  deviceId: string;
  played: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
  /** Buckets: 0–20, 21–40, 41–60, 61–80, 81–100. */
  distribution: [number, number, number, number, number];
};
