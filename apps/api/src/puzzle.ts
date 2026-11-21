import {
  beatPercent,
  classicShareText,
  formatFactValue,
  formatFactor,
  puzzleNumber,
  puzzleSlot,
  sliderRange,
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
import {
  BAND_EMOJI,
  BAND_LABEL,
  compareScore,
  correctOrder,
  estimateScore,
  rankScore,
} from "@ballpark/shared/scoring";
import { HttpError } from "./http.js";

const MODE = "classic";
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
};

type SubmissionRow = {
  question_id: string;
  guess_json: string;
  band: Band;
  points: number;
};

export async function loadPuzzleResponse(
  db: D1Database,
  date: string,
  deviceId: string,
  epoch: string,
  shareHost: string,
  devDate: boolean,
): Promise<PuzzleResponse> {
  const { questions, theme, blurb, nextTheme } = await loadPuzzle(db, date, epoch);
  const submissions = await submissionsFor(db, date, deviceId);
  const publicQuestions: PublicQuestion[] = [];
  for (const question of questions) {
    const existing = submissions.get(question.id);
    const reveal = existing ? await revealFor(db, date, question, parseGuess(existing.guess_json)) : null;
    publicQuestions.push(toPublic(question, reveal));
  }
  const number = puzzleNumber(date, epoch);
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
    result: await dayResult(db, date, deviceId, number, shareHost),
  };
}

export async function submitGuess(
  db: D1Database,
  date: string,
  deviceId: string,
  epoch: string,
  shareHost: string,
  questionId: string,
  guess: Guess,
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

  const scored = scoreGuess(question, guess);
  try {
    await db
      .prepare(
        `INSERT INTO submissions
          (id, device_id, puzzle_date, mode, question_id, guess_json, band, points, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    }),
  );

  await maybeFinish(db, date, deviceId, questions);
  const reveal = await revealFor(db, date, question, guess);
  const number = puzzleNumber(date, epoch);
  return { reveal, result: await dayResult(db, date, deviceId, number, shareHost) };
}

async function loadPuzzle(db: D1Database, date: string, epoch: string): Promise<{
  questions: ServerQuestion[];
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
    .bind((slot + 1) % 10)
    .first<{ theme: string }>();
  const questionIds = parseStringArray(puzzle.question_ids);
  const questions = await loadQuestions(db, questionIds);
  return { questions, theme: puzzle.theme, blurb: puzzle.blurb, nextTheme: next?.theme ?? puzzle.theme };
}

async function loadQuestions(db: D1Database, ids: string[]): Promise<ServerQuestion[]> {
  if (ids.length === 0) throw new HttpError(500, "puzzle_missing");
  const questionRows = await db
    .prepare(`SELECT * FROM questions WHERE id IN (${placeholders(ids.length)})`)
    .bind(...ids)
    .all<QuestionRow>();
  const byId = new Map(questionRows.results.map((row) => [row.id, row]));
  const factIds = [...new Set(questionRows.results.flatMap((row) => parseStringArray(row.fact_ids)))];
  const factRows = await db
    .prepare(`SELECT * FROM facts WHERE id IN (${placeholders(factIds.length)})`)
    .bind(...factIds)
    .all<FactRow>();
  const facts = new Map(factRows.results.map((row) => [row.id, row]));

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
    } satisfies ServerQuestion;
  });
}

function toPublic(question: ServerQuestion, reveal: Reveal | null): PublicQuestion {
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
    reveal,
  };
}

function validateGuess(question: ServerQuestion, guess: Guess): void {
  if (guess.type !== question.type) throw new HttpError(400, "wrong_guess_type");
  if (guess.type === "estimate") {
    if (!(guess.value > 0) || !Number.isFinite(guess.value)) throw new HttpError(400, "invalid_guess");
    if (!isConfidence(guess.confidence)) throw new HttpError(400, "invalid_guess");
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

function scoreGuess(question: ServerQuestion, guess: Guess): { band: Band; points: number } {
  if (question.type === "estimate" && guess.type === "estimate") {
    const scored = estimateScore(guess.value, question.items[0].value, guess.confidence);
    return { band: scored.band, points: scored.points };
  }
  if (question.type === "compare" && guess.type === "compare") {
    return compareScore(guess.choiceId, question.correctOrder[0]);
  }
  if (question.type === "rank" && guess.type === "rank") {
    return rankScore(guess.order, question.correctOrder);
  }
  throw new HttpError(400, "wrong_guess_type");
}

async function revealFor(db: D1Database, date: string, question: ServerQuestion, guess: Guess): Promise<Reveal> {
  const crowd = await crowdFor(db, date, question);
  const scored = scoreGuess(question, guess);
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
      };
    }
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
    label: question.type === "estimate" ? BAND_LABEL[scored.band] : plainLabel(scored.band),
    points: scored.points,
    answerText,
    detail,
    confidence,
    basePoints,
    confidenceDelta,
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

async function crowdFor(db: D1Database, date: string, question: ServerQuestion): Promise<CrowdStat> {
  const rows = await db
    .prepare(
      `SELECT guess_json, band FROM submissions
       WHERE puzzle_date = ? AND mode = ? AND question_id = ?`,
    )
    .bind(date, MODE, question.id)
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

async function maybeFinish(db: D1Database, date: string, deviceId: string, questions: ServerQuestion[]): Promise<void> {
  const submissions = await submissionsFor(db, date, deviceId);
  if (questions.some((question) => !submissions.has(question.id))) return;
  const ordered = questions.map((question) => submissions.get(question.id)!);
  const score = ordered.reduce((sum, row) => sum + row.points, 0);
  const bands = ordered.map((row) => row.band);
  await db
    .prepare(
      `INSERT OR IGNORE INTO daily_results (device_id, puzzle_date, mode, score, bands, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(deviceId, date, MODE, score, JSON.stringify(bands), new Date().toISOString())
    .run();
}

async function dayResult(
  db: D1Database,
  date: string,
  deviceId: string,
  number: number,
  shareHost: string,
): Promise<DayResult | null> {
  const mine = await db
    .prepare("SELECT score, bands FROM daily_results WHERE device_id = ? AND puzzle_date = ? AND mode = ?")
    .bind(deviceId, date, MODE)
    .first<{ score: number; bands: string }>();
  if (!mine) return null;
  const board = await db
    .prepare("SELECT score FROM daily_results WHERE puzzle_date = ? AND mode = ?")
    .bind(date, MODE)
    .all<{ score: number }>();
  const scores = board.results.map((row) => row.score);
  const bands = parseStringArray(mine.bands) as Band[];
  const emojis = bands.map((band) => BAND_EMOJI[band]);
  return {
    score: mine.score,
    bands,
    emojis,
    beatPercent: beatPercent(mine.score, scores),
    players: scores.length,
    shareText: classicShareText(number, emojis, mine.score, shareHost),
  };
}

async function submissionsFor(db: D1Database, date: string, deviceId: string): Promise<Map<string, SubmissionRow>> {
  const rows = await db
    .prepare(
      `SELECT question_id, guess_json, band, points FROM submissions
       WHERE device_id = ? AND puzzle_date = ? AND mode = ?`,
    )
    .bind(deviceId, date, MODE)
    .all<SubmissionRow>();
  return new Map(rows.results.map((row) => [row.question_id, row]));
}

function parseGuess(raw: string): Guess {
  const parsed = JSON.parse(raw) as Guess;
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) throw new HttpError(500, "bad_submission");
  return parsed;
}

function parseStringArray(raw: string): string[] {
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
