import { climbCurve, dayBots, fieldClimbs, stageStep, todayStats } from "./field.js";
import { joinLeague } from "./league.js";
import {
  beatPercent,
  classicShareText,
  climbShareLine,
  climbedPhrase,
  fieldStats,
  formatFactValue,
  formatFactor,
  normalizeAnswer,
  placement,
  raceCode,
  puzzleNumber,
  puzzleSlot,
  SEED_SLOTS,
  sliderRange,
  playToday,
  type AcceptedAnswer,
  type Band,
  type Confidence,
  type CrowdStat,
  type DayResult,
  type FactItem,
  type Guess,
  type Polarity,
  type PublicQuestion,
  type PuzzleResponse,
  type QuestionType,
  type Reveal,
  type ServerQuestion,
  type SliderScale,
} from "@ballpark/shared";
import { RETRY_LIMIT, checkName, isUnlistedName, nameRejection, scoreStage, suggestionsForQuestion, type PlayQuestion, type StageOptions } from "./classic-score.js";
import { finalizeDay } from "./finalize.js";
import { BAND_EMOJI, BAND_LABEL, correctOrder, estimateScore } from "@ballpark/shared/scoring";
import { HttpError } from "./http.js";
import { enforceRateLimit } from "./rate-limit.js";

const MODE = "classic";

/** Where a set of answers lives: a day's Classic (key = the date), a pack chapter, a past day, an Unlimited round. */
export type AnswerScope = { key: string; mode: string };
/**
 * Whose answers set the rarity: one stored set, or every answer to the question in the given modes, on any day.
 * Unlimited uses the second, so a question asked on many days counts all of its players.
 */
export type CrowdScope = AnswerScope | { key: null; modes: string[] };

function crowdWhere(scope: CrowdScope): { sql: string; binds: string[] } {
  if (scope.key !== null) return { sql: "puzzle_date = ? AND mode = ?", binds: [scope.key, scope.mode] };
  return { sql: `mode IN (${placeholders(scope.modes.length)})`, binds: scope.modes };
}

function classicScope(date: string): AnswerScope {
  return { key: date, mode: MODE };
}
const SCALES = new Set<SliderScale>([
  "distance-km",
  "length-m",
  "speed-ms",
  "mass-kg",
  "years",
  "days",
  "area-km2",
  "count",
  "celsius",
  "area-m2",
]);

type FactRow = {
  id: string;
  label: string;
  value: number;
  unit: string;
  context: string;
  source_url: string;
  source_name: string;
  retrieved_at: string;
  license: string;
  topic: string;
  difficulty: number;
  verified: number;
};

type QuestionRow = {
  id: string;
  prompt: string;
  type: QuestionType;
  unit: string | null;
  polarity: Polarity;
  scale: string | null;
  fact_ids: string;
  display_ids: string;
  context: string;
  source_url: string;
  source_name: string;
  retrieved_at: string;
  license: string;
  topic: string;
  difficulty: number;
  verified: number;
  accepted_json: string | null;
  entity_set: string | null;
  nudge: string | null;
};

type SubmissionRow = {
  question_id: string;
  guess_json: string;
  band: Band;
  points: number;
  boost: number;
  nudged: number;
  cruise: number;
};

/** How a stage was played, from its stored answer. */
function stageOptions(row: SubmissionRow): StageOptions {
  return { boost: row.boost === 1, nudged: row.nudged === 1 };
}

export async function loadPuzzleResponse(
  db: D1Database,
  date: string,
  deviceId: string,
  epoch: string,
  shareHost: string,
  devDate: boolean,
): Promise<PuzzleResponse> {
  const { questions, theme, blurb, nextTheme } = await loadPuzzle(db, date, epoch);
  // A closed day is recounted first, so the reveals below show the final points.
  await finalizeDay(db, date, (day) => questionsForDate(db, day, epoch));
  const submissions = await submissionsFor(db, date, deviceId);
  const publicQuestions: PublicQuestion[] = [];
  for (const question of questions) {
    const existing = submissions.get(question.id);
    const reveal = existing ? await revealFor(db, classicScope(date), question, parseGuess(existing.guess_json), stageOptions(existing)) : null;
    publicQuestions.push(toPublic(question, reveal, true));
  }
  const number = puzzleNumber(date, epoch);
  const climbs = await fieldClimbs(db, date, questions);
  return {
    date,
    puzzleNumber: number,
    theme,
    blurb,
    nextTheme,
    mode: MODE,
    shareHost,
    devDate,
    questions: publicQuestions,
    result: await dayResult(db, date, deviceId, number, shareHost, epoch, questions),
    field: fieldStats([...climbs.values()]),
    today: await todayStats(db, date, deviceId, climbs, dayBots(date, questions)),
    cruise: submissions.size > 0 ? [...submissions.values()].some((row) => row.cruise === 1) : null,
  };
}

export async function questionsForDate(db: D1Database, date: string, epoch: string): Promise<PlayQuestion[]> {
  return (await loadPuzzle(db, date, epoch)).questions;
}

export async function submitGuess(
  db: D1Database,
  date: string,
  deviceId: string,
  epoch: string,
  shareHost: string,
  questionId: string,
  guess: Guess,
  extras: { afterburner?: boolean; skin?: string | null; cruise?: boolean } = {},
): Promise<{ reveal: Reveal; result: DayResult | null }> {
  const { questions } = await loadPuzzle(db, date, epoch);
  const question = questions.find((candidate) => candidate.id === questionId);
  if (!question) throw new HttpError(404, "unknown_question");
  validateGuess(question, guess);

  const existing = await db
    .prepare(
      `SELECT id FROM submissions
       WHERE device_id = ? AND puzzle_date = ? AND mode = ? AND question_id = ?`,
    )
    .bind(deviceId, date, MODE, question.id)
    .first<{ id: string }>();
  if (existing) throw new HttpError(409, "already_submitted");
  // A day is played one way: the first answer sets Cruise or the clock, and the rest must match.
  const cruise = extras.cruise === true;
  const started = await db
    .prepare("SELECT cruise FROM submissions WHERE device_id = ? AND puzzle_date = ? AND mode = ? LIMIT 1")
    .bind(deviceId, date, MODE)
    .first<{ cruise: number }>();
  if (started && started.cruise === 1 !== cruise) throw new HttpError(409, "mode_locked");
  // A name that is not on the list, or only close to one, is not stored: the player tries again while the clock runs.
  const rejection = nameRejection(checkName(question, guess));
  if (rejection) {
    await enforceRateLimit(db, `try:${deviceId}:${date}:${question.id}`, RETRY_LIMIT);
    throw rejection;
  }
  if (extras.afterburner) {
    const used = await db
      .prepare("SELECT 1 AS hit FROM submissions WHERE device_id = ? AND puzzle_date = ? AND mode = ? AND boost = 1 LIMIT 1")
      .bind(deviceId, date, MODE)
      .first<{ hit: number }>();
    if (used) throw new HttpError(409, "afterburner_used");
  }
  const nudged = await db
    .prepare("SELECT 1 AS hit FROM nudges WHERE device_id = ? AND puzzle_date = ? AND question_id = ?")
    .bind(deviceId, date, question.id)
    .first<{ hit: number }>();
  const options: StageOptions = { boost: extras.afterburner === true, nudged: nudged !== null };

  const scored = scoreStage(question, guess, await otherGuesses(db, classicScope(date), question.id, null), options);
  try {
    await db
      .prepare(
        `INSERT INTO submissions
          (id, device_id, puzzle_date, mode, question_id, guess_json, band, points, boost, nudged, cruise, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        deviceId,
        date,
        MODE,
        question.id,
        JSON.stringify(guess),
        scored.band,
        scored.points,
        options.boost ? 1 : 0,
        options.nudged ? 1 : 0,
        cruise ? 1 : 0,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) {
      throw new HttpError(409, "already_submitted");
    }
    throw error;
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "guess_scored",
      date,
      questionId: question.id,
      type: question.type,
      band: scored.band,
      points: scored.points,
      boost: options.boost,
      nudged: options.nudged,
      cruise,
    }),
  );

  await maybeFinish(db, date, deviceId, questions, extras.skin ?? null, cruise);
  const reveal = await revealFor(db, classicScope(date), question, guess, options);
  const number = puzzleNumber(date, epoch);
  return { reveal, result: await dayResult(db, date, deviceId, number, shareHost, epoch, questions) };
}

/**
 * A stuck player's nudge for one of today's questions. Asking for it is recorded, so the answer that follows
 * scores at most a Moonshot. It points at a corner of the answers without naming one.
 */
export async function openNudge(db: D1Database, date: string, deviceId: string, epoch: string, questionId: string): Promise<{ nudge: string }> {
  const { questions } = await loadPuzzle(db, date, epoch);
  const question = questions.find((candidate) => candidate.id === questionId);
  if (!question || question.type !== "name_one" || !question.nudge) throw new HttpError(404, "no_nudge");
  const answered = await db
    .prepare("SELECT 1 AS hit FROM submissions WHERE device_id = ? AND puzzle_date = ? AND mode = ? AND question_id = ?")
    .bind(deviceId, date, MODE, question.id)
    .first<{ hit: number }>();
  if (answered) throw new HttpError(409, "already_submitted");
  await db
    .prepare("INSERT OR IGNORE INTO nudges (device_id, puzzle_date, question_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(deviceId, date, question.id, new Date().toISOString())
    .run();
  return { nudge: question.nudge };
}

/**
 * "Should this count?": a name that was not on the list, sent in for review. If the owner adds it to the list
 * before the day's recount, that recount scores it for the player who sent it.
 */
export async function reportAnswer(db: D1Database, date: string, deviceId: string, epoch: string, questionId: string, text: string): Promise<{ ok: true }> {
  const { questions } = await loadPuzzle(db, date, epoch);
  const question = questions.find((candidate) => candidate.id === questionId);
  if (!question || question.type !== "name_one") throw new HttpError(404, "unknown_question");
  const trimmed = text.trim();
  const normalized = normalizeAnswer(trimmed);
  if (trimmed.length < 1 || trimmed.length > 80 || !normalized) throw new HttpError(400, "invalid_report");
  if (!isUnlistedName(question, { type: "name_one", text: trimmed })) throw new HttpError(400, "already_listed");
  await db
    .prepare(
      `INSERT OR IGNORE INTO answer_reports (id, device_id, puzzle_date, question_id, text, normalized, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), deviceId, date, question.id, trimmed, normalized, new Date().toISOString())
    .run();
  console.log(JSON.stringify({ level: "info", event: "answer_reported", date, questionId: question.id }));
  return { ok: true };
}

export async function loadPuzzle(db: D1Database, date: string, epoch: string): Promise<{
  questions: PlayQuestion[];
  theme: string;
  blurb: string;
  nextTheme: string;
}> {
  const slot = puzzleSlot(date, epoch);
  const puzzle = await db
    .prepare("SELECT theme, blurb, question_ids FROM puzzles WHERE slot = ?")
    .bind(slot)
    .first<{ theme: string; blurb: string; question_ids: string }>();
  if (!puzzle) {
    throw new HttpError(500, "puzzle_missing");
  }
  const next = await db
    .prepare("SELECT theme FROM puzzles WHERE slot = ?")
    .bind((slot + 1) % SEED_SLOTS)
    .first<{ theme: string }>();
  const questionIds = parseStringArray(puzzle.question_ids);
  const questions = await loadQuestions(db, questionIds);
  return { questions, theme: puzzle.theme, blurb: puzzle.blurb, nextTheme: next?.theme ?? puzzle.theme };
}

export async function loadQuestions(db: D1Database, ids: string[]): Promise<PlayQuestion[]> {
  if (ids.length === 0) throw new HttpError(500, "puzzle_missing");
  const questionRows = await db
    .prepare(`SELECT * FROM questions WHERE id IN (${placeholders(ids.length)})`)
    .bind(...ids)
    .all<QuestionRow>();
  const byId = new Map(questionRows.results.map((row) => [row.id, row]));
  const factIds = [...new Set(questionRows.results.flatMap((row) => parseStringArray(row.fact_ids)))];
  const facts = new Map<string, FactRow>();
  if (factIds.length > 0) {
    const factRows = await db
      .prepare(`SELECT * FROM facts WHERE id IN (${placeholders(factIds.length)})`)
      .bind(...factIds)
      .all<FactRow>();
    for (const row of factRows.results) facts.set(row.id, row);
  }

  return ids.map((id) => {
    const row = byId.get(id);
    if (!row) throw new HttpError(500, "puzzle_missing");
    const items = parseStringArray(row.fact_ids).map((factId) => {
      const fact = facts.get(factId);
      if (!fact) throw new HttpError(500, "puzzle_missing");
      const item: FactItem = { id: fact.id, label: fact.label, value: fact.value, unit: fact.unit };
      return item;
    });
    const scale = row.scale && SCALES.has(row.scale as SliderScale) ? (row.scale as SliderScale) : null;
    return {
      id: row.id,
      prompt: row.prompt,
      type: row.type,
      unit: row.unit,
      polarity: row.polarity,
      values: items.map((item) => item.value),
      items,
      correctOrder: correctOrder(items, row.polarity),
      displayOrder: parseStringArray(row.display_ids),
      context: row.context,
      sourceUrl: row.source_url,
      sourceName: row.source_name,
      retrievedAt: row.retrieved_at,
      license: row.license,
      topic: row.topic,
      difficulty: row.difficulty,
      verified: row.verified === 1,
      slider: scale,
      accepted: parseAccepted(row.accepted_json),
      entitySet: row.entity_set,
      nudge: row.nudge ?? null,
    } satisfies PlayQuestion;
  });
}

/** The question as the browser may see it. Only the daily Classic offers nudges; packs do not. */
export function toPublic(question: PlayQuestion, reveal: Reveal | null, nudges = false): PublicQuestion {
  const items =
    question.type === "estimate"
      ? []
      : question.displayOrder.map((id) => {
          const item = question.items.find((candidate) => candidate.id === id);
          if (!item) throw new HttpError(500, "puzzle_missing");
          return { id: item.id, label: item.label };
        });
  return {
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    unit: question.type === "estimate" ? question.unit : null,
    items,
    topic: question.topic,
    difficulty: question.difficulty,
    slider: question.slider ? sliderRange(question.slider) : null,
    suggestions: question.type === "name_one" ? suggestionsForQuestion(question) : [],
    hasNudge: nudges && question.type === "name_one" && Boolean(question.nudge),
    reveal,
  };
}

export function validateGuess(question: PlayQuestion, guess: Guess): void {
  if (guess.type !== question.type) throw new HttpError(400, "wrong_guess_type");
  if (guess.type === "estimate") {
    if (!(guess.value > 0) || !Number.isFinite(guess.value)) throw new HttpError(400, "invalid_guess");
    if (!isConfidence(guess.confidence)) throw new HttpError(400, "invalid_guess");
    return;
  }
  if (guess.type === "name_one") {
    if (guess.timedOut === true) return;
    const text = guess.text.trim();
    if (text.length < 1 || text.length > 80) throw new HttpError(400, "invalid_guess");
    return;
  }
  const ids = new Set(question.items.map((item) => item.id));
  if (guess.type === "compare") {
    if (!ids.has(guess.choiceId)) throw new HttpError(400, "invalid_guess");
    return;
  }
  if (guess.order.length !== ids.size || new Set(guess.order).size !== ids.size || guess.order.some((id) => !ids.has(id))) {
    throw new HttpError(400, "invalid_guess");
  }
}

export async function revealFor(db: D1Database, scope: CrowdScope, question: PlayQuestion, guess: Guess, options: StageOptions = {}): Promise<Reveal> {
  const scored = scoreStage(question, guess, await otherGuesses(db, scope, question.id, guess), options);
  const crowd = scored.named ?? (await crowdFor(db, scope, question));
  const rows = question.correctOrder.map((id) => {
    const item = question.items.find((candidate) => candidate.id === id);
    if (!item) throw new HttpError(500, "puzzle_missing");
    return {
      id,
      label: item.label,
      valueText: formatFactValue(item.value, item.unit),
      chosen: guess.type === "compare" ? guess.choiceId === id : undefined,
    };
  });

  let detail = "";
  let confidence: Confidence | null = null;
  let basePoints = scored.points;
  let confidenceDelta = 0;
  let track: Reveal["track"] = null;
  let answerText = rows.map((row) => row.label).join(", ");

  if (question.type === "estimate" && guess.type === "estimate") {
    const full = estimateScore(guess.value, question.items[0].value, guess.confidence);
    basePoints = full.basePoints;
    confidenceDelta = full.confidenceDelta;
    confidence = guess.confidence;
    detail = formatFactor(guess.value, question.items[0].value).text;
    answerText = formatFactValue(question.items[0].value, question.items[0].unit);
    if (question.slider) {
      const range = sliderRange(question.slider);
      track = {
        min: range.min,
        max: range.max,
        guess: guess.value,
        answer: question.items[0].value,
        unit: question.items[0].unit,
        crowd: scored.crowdGuesses,
      };
    }
  } else if (question.type === "name_one") {
    answerText = scored.answerText;
    detail = scored.detail;
    basePoints = scored.points;
  } else if (question.type === "compare") {
    detail = scored.band === "green" ? "That's the one." : "The other one.";
    answerText = `${rows[0].label} (${rows[0].valueText})`;
  } else if (scored.band === "green") {
    detail = "Exact order.";
  } else if (scored.band === "yellow") {
    detail = "One pair is out of order.";
  } else {
    detail = "More than one pair is out of order.";
  }

  return {
    band: scored.band,
    emoji: BAND_EMOJI[scored.band],
    label: question.type === "estimate" ? BAND_LABEL[scored.band] : question.type === "name_one" ? (scored.tier ?? scored.answerText) : plainLabel(scored.band),
    points: scored.points,
    answerText,
    detail,
    confidence,
    basePoints,
    confidenceDelta,
    bonusPoints: scored.bonusPoints,
    // A pack has no reset: its rarity keeps moving as more players finish it.
    provisional: scope.key !== null && scope.mode === MODE && scope.key >= playToday(),
    boosted: options.boost === true && scored.points > 0,
    nudged: options.nudged === true,
    context: question.context,
    sourceUrl: question.sourceUrl,
    sourceName: question.sourceName,
    sources: [{ sourceName: question.sourceName, sourceUrl: question.sourceUrl }],
    crowd,
    rows,
    track,
  };
}

function plainLabel(band: Band): string {
  if (band === "green") return "Correct";
  if (band === "yellow") return "Close";
  return "Not quite";
}

async function crowdFor(db: D1Database, scope: CrowdScope, question: ServerQuestion): Promise<CrowdStat> {
  const where = crowdWhere(scope);
  const rows = await db
    .prepare(`SELECT guess_json, band FROM submissions WHERE ${where.sql} AND question_id = ?`)
    .bind(...where.binds, question.id)
    .all<{ guess_json: string; band: string }>();
  const submissions = rows.results.length;
  if (question.type === "estimate") {
    const values = rows.results
      .map((row) => {
        const parsed = JSON.parse(row.guess_json) as { value?: unknown };
        return typeof parsed.value === "number" ? parsed.value : null;
      })
      .filter((value): value is number => value !== null && value > 0);
    return {
      kind: "median",
      value: median(values),
      unit: question.unit ?? question.items[0]?.unit ?? "",
      submissions,
    };
  }
  const correct = rows.results.filter((row) => row.band === "green").length;
  return {
    kind: "percentCorrect",
    percent: submissions === 0 ? 0 : Math.round((100 * correct) / submissions),
    submissions,
  };
}

async function maybeFinish(db: D1Database, date: string, deviceId: string, questions: ServerQuestion[], skin: string | null, cruise: boolean): Promise<void> {
  const submissions = await submissionsFor(db, date, deviceId);
  if (questions.some((question) => !submissions.has(question.id))) return;
  const ordered = questions.map((question) => submissions.get(question.id)!);
  const score = ordered.reduce((sum, row) => sum + row.points, 0);
  const bands = ordered.map((row) => row.band);
  await db
    .prepare(
      `INSERT OR IGNORE INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at, skin, cruise)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .bind(deviceId, date, MODE, score, score, JSON.stringify(bands), new Date().toISOString(), skin, cruise ? 1 : 0)
    .run();
  // A Cruise run keeps the streak on the device, but it is not a league week's play.
  if (!cruise) await joinLeague(db, deviceId, date);
}

async function dayResult(
  db: D1Database,
  date: string,
  deviceId: string,
  number: number,
  shareHost: string,
  epoch: string,
  questions: PlayQuestion[],
): Promise<DayResult | null> {
  await finalizeDay(db, date, (day) => questionsForDate(db, day, epoch));
  const mine = await db
    .prepare("SELECT score, bands, skin, cruise FROM daily_results WHERE device_id = ? AND puzzle_date = ? AND mode = ?")
    .bind(deviceId, date, MODE)
    .first<{ score: number; bands: string; skin: string | null; cruise: number }>();
  if (!mine) return null;
  const cruise = mine.cruise === 1;
  // Ranks are among timed runs. A Cruise run sees how the day went, without a rank of its own.
  const board = await db
    .prepare("SELECT score FROM daily_results WHERE puzzle_date = ? AND mode = ? AND cruise = 0")
    .bind(date, MODE)
    .all<{ score: number }>();
  // Today's bots are ranked alongside, so there is a field from the first finish.
  const bots = dayBots(date, questions);
  const scores = [...board.results.map((row) => row.score), ...bots.map((bot) => bot.score)];
  const bands = parseStringArray(mine.bands) as Band[];
  // The height in the result is the one the scene flew to, so it adds up the same per-answer climbs.
  const mineRows = await submissionsFor(db, date, deviceId);
  const boosted = questions.findIndex((question) => mineRows.get(question.id)?.boost === 1);
  // The Afterburner stage gets a flame after its square in the share.
  const emojis = bands.map((band, index) => (index === boosted ? `${BAND_EMOJI[band]}🔥` : BAND_EMOJI[band]));
  const climbed = questions.reduce((sum, question) => {
    const row = mineRows.get(question.id);
    return row ? sum + stageStep(question, row.points, row.boost === 1) : sum;
  }, 0);
  const race = raceCode("classic", number, climbed, mine.skin);
  return {
    score: mine.score,
    bands,
    emojis,
    beatPercent: beatPercent(mine.score, scores),
    players: scores.length,
    shareText: classicShareText(number, emojis, mine.score, shareHost, climbShareLine(climbed), race, cruise),
    reached: climbedPhrase(climbed),
    provisional: date >= playToday(),
    place: cruise ? null : placement(mine.score, scores, bots.length),
    cruise,
    race,
    boosted: boosted >= 0 ? boosted : null,
    curve: climbCurve(await fieldClimbs(db, date, questions), deviceId),
  };
}

export async function otherGuesses(db: D1Database, scope: CrowdScope, questionId: string, exclude: Guess | null): Promise<Guess[]> {
  const where = crowdWhere(scope);
  const rows = await db
    .prepare(`SELECT guess_json FROM submissions WHERE ${where.sql} AND question_id = ?`)
    .bind(...where.binds, questionId)
    .all<{ guess_json: string }>();
  const guesses = rows.results.map((row) => parseGuess(row.guess_json));
  if (!exclude) return guesses;
  const key = JSON.stringify(exclude);
  const index = guesses.findIndex((item) => JSON.stringify(item) === key);
  if (index < 0) return guesses;
  return guesses.filter((_, item) => item !== index);
}

function parseAccepted(raw: string | null): AcceptedAnswer[] | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return null;
  return parsed as AcceptedAnswer[];
}

async function submissionsFor(db: D1Database, date: string, deviceId: string): Promise<Map<string, SubmissionRow>> {
  const rows = await db
    .prepare(
      `SELECT question_id, guess_json, band, points, boost, nudged, cruise FROM submissions
       WHERE device_id = ? AND puzzle_date = ? AND mode = ?`,
    )
    .bind(deviceId, date, MODE)
    .all<SubmissionRow>();
  return new Map(rows.results.map((row) => [row.question_id, row]));
}

export function parseGuess(raw: string): Guess {
  const parsed = JSON.parse(raw) as Guess;
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) throw new HttpError(500, "bad_submission");
  return parsed;
}

export function parseStringArray(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new HttpError(500, "puzzle_missing");
  }
  return parsed;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function isConfidence(value: string): value is Confidence {
  return value === "narrow" || value === "medium" || value === "wide";
}
