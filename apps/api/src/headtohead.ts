import { headToHeadBots } from "./bots.js";
import { headToHeadField } from "./field.js";
import { joinLeague } from "./league.js";
import {
  type FieldStats,
  H2H_LENGTH,
  beatPercent,
  buildHeadToHeadSequence,
  formatFactValue,
  headToHeadShareText,
  journeyProgress,
  levelForJourney,
  placement,
  raceCode,
  reachedPhrase,
  puzzleNumber,
  puzzleSlot,
  scoreHeadToHead,
  toPublicRound,
  playToday,
  type H2HFact,
  type Placement,
  type H2HRound,
  type PublicH2HRound,
} from "@ballpark/shared";
import { finalizeDay } from "./finalize.js";
import { HttpError } from "./http.js";
import { questionsForDate } from "./puzzle.js";

const MODE = "head-to-head";

type RunRow = {
  id: string;
  kind: "scored" | "practice";
  attempt: number;
  next_index: number;
  correct_count: number;
  finished: number;
  points: number;
};

export type HeadToHeadState = {
  date: string;
  puzzleNumber: number;
  shareHost: string;
  devDate: boolean;
  status: "ready" | "in-progress" | "finished";
  runKind: "scored" | "practice" | null;
  correct: number;
  round: PublicH2HRound | null;
  result: {
    official: boolean;
    score: number;
    beatPercent: number | null;
    players: number | null;
    bestToday: number | null;
    shareText: string;
    cleared: boolean;
    marks: string;
    reached: string;
    provisional: boolean;
    /** Scored runs only: your rank today and the gap to the next rank up. */
    place: Placement | null;
    race: string | null;
  } | null;
  field: FieldStats;
};

export async function loadHeadToHead(
  db: D1Database,
  date: string,
  deviceId: string,
  epoch: string,
  shareHost: string,
  devDate: boolean,
): Promise<HeadToHeadState> {
  const state = await loadHeadToHeadState(db, date, deviceId, epoch, shareHost, devDate);
  return { ...state, field: await headToHeadField(db, date, H2H_LENGTH) };
}

async function loadHeadToHeadState(
  db: D1Database,
  date: string,
  deviceId: string,
  epoch: string,
  shareHost: string,
  devDate: boolean,
): Promise<HeadToHeadState> {
  const number = puzzleNumber(date, epoch);
  const active = await activeRun(db, date, deviceId);
  if (active && active.finished === 0) {
    const round = await roundAt(db, date, deviceId, active, epoch);
    return base(date, number, shareHost, devDate, {
      status: "in-progress",
      runKind: active.kind,
      correct: active.correct_count,
      round: round ? toPublicRound(round) : null,
      result: null,
    });
  }
  const scored = await scoredRun(db, date, deviceId);
  if (scored?.finished === 1) {
    return base(date, number, shareHost, devDate, {
      status: "finished",
      runKind: "scored",
      correct: scored.correct_count,
      round: null,
      result: await officialResult(db, date, deviceId, number, shareHost, epoch, await clearedDeck(db, date, scored, epoch)),
    });
  }
  const round = (await sequenceFor(db, date, `head-to-head:${date}`, epoch))[0] ?? null;
  return base(date, number, shareHost, devDate, {
    status: "ready",
    runKind: null,
    correct: 0,
    round: round ? toPublicRound(round) : null,
    result: null,
  });
}

export async function pickHeadToHead(
  db: D1Database,
  date: string,
  deviceId: string,
  epoch: string,
  shareHost: string,
  index: number,
  choice: { choiceId?: string; direction?: "higher" | "lower"; timedOut?: boolean },
): Promise<{
  correct: boolean;
  correctCount: number;
  points: number;
  reveal: { prompt: string; rows: { label: string; valueText: string }[]; context: string; sourceName: string; sourceUrl: string };
  next: PublicH2HRound | null;
  finished: boolean;
  result: HeadToHeadState["result"];
}> {
  if (!Number.isInteger(index) || index < 0) throw new HttpError(400, "invalid_guess");
  let run = await activeRun(db, date, deviceId);
  if (!run) {
    const scored = await scoredRun(db, date, deviceId);
    if (scored?.finished === 1) throw new HttpError(409, "run_finished");
    if (index !== 0) throw new HttpError(409, "out_of_order");
    try {
      run = await insertRun(db, date, deviceId, "scored", 1);
    } catch (error) {
      if (error instanceof Error && /UNIQUE/i.test(error.message)) throw new HttpError(409, "out_of_order");
      throw error;
    }
  }
  if (run.finished === 1) throw new HttpError(409, "run_finished");
  if (run.next_index !== index) throw new HttpError(409, "out_of_order");

  const sequence = await sequenceFor(db, date, seedKey(date, deviceId, run), epoch);
  const round = sequence[index];
  if (!round) throw new HttpError(400, "invalid_guess");
  if (choice.timedOut) {
    // The 25-second timer ran out. It counts as a miss.
  } else if (round.kind === "higher-lower") {
    if (choice.direction !== "higher" && choice.direction !== "lower") throw new HttpError(400, "invalid_guess");
  } else if (!round.items.some((item) => item.id === choice.choiceId)) {
    throw new HttpError(400, "invalid_guess");
  }

  const correct = choice.timedOut ? false : scoreHeadToHead(round, choice);
  const correctCount = run.correct_count + (correct ? 1 : 0);
  const finished = index === sequence.length - 1;
  const updated = await db
    .prepare(
      `UPDATE h2h_runs
       SET next_index = ?, correct_count = ?, finished = ?, points = ?
       WHERE id = ? AND next_index = ? AND finished = 0`,
    )
    .bind(index + 1, correctCount, finished ? 1 : 0, correctCount, run.id, index)
    .run();
  if ((updated.meta.changes ?? 0) !== 1) throw new HttpError(409, "out_of_order");
  await db
    .prepare(
      `INSERT INTO h2h_picks (device_id, puzzle_date, kind, attempt, step_index, correct)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(deviceId, date, run.kind, run.attempt, index, correct ? 1 : 0)
    .run();

  console.log(JSON.stringify({ level: "info", event: "h2h_pick", date, index, kind: round.kind, correct, official: run.kind === "scored" }));

  const { marks, bands } = await marksFor(db, date, deviceId, run.kind, run.attempt);
  const nextRound = !finished ? sequence[index + 1] : undefined;
  let result: HeadToHeadState["result"] = null;
  if (finished && run.kind === "scored") {
    await db
      .prepare(
        `INSERT OR IGNORE INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(deviceId, date, MODE, correctCount, correctCount, JSON.stringify(bands), new Date().toISOString())
      .run();
    await joinLeague(db, deviceId, date);
    result = await officialResult(db, date, deviceId, puzzleNumber(date, epoch), shareHost, epoch, correctCount >= sequence.length);
  } else if (finished) {
    const reached = levelForJourney(correctCount, sequence.length);
    result = {
      official: false,
      score: correctCount,
      beatPercent: null,
      players: null,
      bestToday: null,
      shareText: "",
      cleared: correctCount >= sequence.length,
      marks,
      reached: reachedPhrase(reached),
      provisional: false,
      place: null,
      race: null,
    };
  }

  const winner = round.items.find((item) => item.id === round.answer) ?? round.items[0];
  return {
    correct,
    correctCount,
    points: 0,
    reveal: {
      prompt: round.prompt,
      rows: round.items.map((item) => ({ label: item.label, valueText: formatFactValue(item.value, item.unit) })),
      context: winner.context,
      sourceName: winner.sourceName,
      sourceUrl: winner.sourceUrl,
    },
    next: nextRound ? toPublicRound(nextRound) : null,
    finished,
    result,
  };
}

export async function startPractice(
  db: D1Database,
  date: string,
  deviceId: string,
  epoch: string,
): Promise<PublicH2HRound> {
  const scored = await scoredRun(db, date, deviceId);
  if (!scored || scored.finished !== 1) throw new HttpError(409, "practice_locked");
  const open = await db
    .prepare(
      `SELECT id, kind, attempt, next_index, correct_count, finished, points FROM h2h_runs
       WHERE device_id = ? AND puzzle_date = ? AND kind = 'practice' AND finished = 0
       ORDER BY attempt DESC LIMIT 1`,
    )
    .bind(deviceId, date)
    .first<RunRow>();
  const run = open ?? (await insertRun(db, date, deviceId, "practice", (await nextAttempt(db, date, deviceId))));
  const round = (await sequenceFor(db, date, seedKey(date, deviceId, run), epoch))[run.next_index];
  if (!round) throw new HttpError(500, "puzzle_missing");
  return toPublicRound(round);
}

async function insertRun(db: D1Database, date: string, deviceId: string, kind: "scored" | "practice", attempt: number): Promise<RunRow> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO h2h_runs (id, device_id, puzzle_date, kind, attempt, next_index, correct_count, finished, points, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, ?)`,
    )
    .bind(id, deviceId, date, kind, attempt, new Date().toISOString())
    .run();
  return { id, kind, attempt, next_index: 0, correct_count: 0, finished: 0, points: 0 };
}

async function nextAttempt(db: D1Database, date: string, deviceId: string): Promise<number> {
  const row = await db
    .prepare("SELECT MAX(attempt) AS attempt FROM h2h_runs WHERE device_id = ? AND puzzle_date = ? AND kind = 'practice'")
    .bind(deviceId, date)
    .first<{ attempt: number | null }>();
  return (row?.attempt ?? 0) + 1;
}

async function activeRun(db: D1Database, date: string, deviceId: string): Promise<RunRow | null> {
  return db
    .prepare(
      `SELECT id, kind, attempt, next_index, correct_count, finished, points FROM h2h_runs
       WHERE device_id = ? AND puzzle_date = ? AND finished = 0
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(deviceId, date)
    .first<RunRow>();
}

async function scoredRun(db: D1Database, date: string, deviceId: string): Promise<RunRow | null> {
  return db
    .prepare(
      `SELECT id, kind, attempt, next_index, correct_count, finished, points FROM h2h_runs
       WHERE device_id = ? AND puzzle_date = ? AND kind = 'scored'
       LIMIT 1`,
    )
    .bind(deviceId, date)
    .first<RunRow>();
}

async function sequenceFor(db: D1Database, date: string, seedKeyValue: string, epoch: string): Promise<H2HRound[]> {
  const facts = await db
    .prepare(
      `SELECT id, label, value, unit, metric, context, source_name, source_url
       FROM facts WHERE metric != '' AND metric != 'unpaired'
       ORDER BY id`,
    )
    .all<{
      id: string;
      label: string;
      value: number;
      unit: string;
      metric: string;
      context: string;
      source_name: string;
      source_url: string;
    }>();
  const exclude = seedKeyValue.startsWith("head-to-head:") && !seedKeyValue.includes(":practice:") ? await classicFactIds(db, date, epoch) : [];
  return buildHeadToHeadSequence(
    facts.results.map(
      (row): H2HFact => ({
        id: row.id,
        label: row.label,
        value: row.value,
        unit: row.unit,
        metric: row.metric,
        context: row.context,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
      }),
    ),
    seedKeyValue,
    exclude,
  );
}

async function classicFactIds(db: D1Database, date: string, epoch: string): Promise<string[]> {
  const puzzle = await db
    .prepare("SELECT question_ids FROM puzzles WHERE slot = ?")
    .bind(puzzleSlot(date, epoch))
    .first<{ question_ids: string }>();
  if (!puzzle) return [];
  const ids = JSON.parse(puzzle.question_ids) as string[];
  if (ids.length === 0) return [];
  const questions = await db
    .prepare(`SELECT fact_ids FROM questions WHERE id IN (${ids.map(() => "?").join(", ")})`)
    .bind(...ids)
    .all<{ fact_ids: string }>();
  return questions.results.flatMap((row) => JSON.parse(row.fact_ids) as string[]);
}

async function roundAt(db: D1Database, date: string, deviceId: string, run: RunRow, epoch: string): Promise<H2HRound | null> {
  const sequence = await sequenceFor(db, date, seedKey(date, deviceId, run), epoch);
  return sequence[run.next_index] ?? null;
}

function seedKey(date: string, deviceId: string, run: RunRow): string {
  if (run.kind === "scored") return `head-to-head:${date}`;
  return `head-to-head:${date}:${deviceId}:practice:${run.attempt}`;
}

async function clearedDeck(db: D1Database, date: string, run: RunRow, epoch: string): Promise<boolean> {
  const sequence = await sequenceFor(db, date, `head-to-head:${date}`, epoch);
  return run.finished === 1 && sequence.length > 0 && run.correct_count >= sequence.length;
}

async function marksFor(
  db: D1Database,
  date: string,
  deviceId: string,
  kind: string,
  attempt: number,
): Promise<{ marks: string; bands: string[] }> {
  const rows = await db
    .prepare(
      `SELECT correct FROM h2h_picks
       WHERE device_id = ? AND puzzle_date = ? AND kind = ? AND attempt = ?
       ORDER BY step_index`,
    )
    .bind(deviceId, date, kind, attempt)
    .all<{ correct: number }>();
  const bands = rows.results.map((row) => (row.correct === 1 ? "green" : "red"));
  return { bands, marks: bands.map((band) => (band === "green" ? "🟩" : "🟥")).join("") };
}

async function officialResult(
  db: D1Database,
  date: string,
  deviceId: string,
  number: number,
  shareHost: string,
  epoch: string,
  cleared: boolean,
): Promise<NonNullable<HeadToHeadState["result"]>> {
  await finalizeDay(db, date, (day) => questionsForDate(db, day, epoch));
  const board = await db
    .prepare("SELECT device_id, score, bands FROM daily_results WHERE puzzle_date = ? AND mode = ?")
    .bind(date, MODE)
    .all<{ device_id: string; score: number; bands: string }>();
  // Today's bots run the same ten picks and count like players.
  const scores = [...board.results.map((row) => row.score), ...headToHeadBots(date, H2H_LENGTH)];
  const mine = board.results.find((row) => row.device_id === deviceId) ?? board.results[0];
  const score = mine?.score ?? 0;
  const stored = mine ? (JSON.parse(mine.bands) as string[]) : [];
  const marks = stored.map((band) => (band === "green" || band === "🟩" ? "🟩" : "🟥")).join("");
  const best = scores.length === 0 ? score : Math.max(...scores);
  const level = levelForJourney(score, H2H_LENGTH);
  const race = raceCode("h2h", number, journeyProgress(score, H2H_LENGTH));
  return {
    official: true,
    score,
    beatPercent: beatPercent(score, scores.length === 0 ? [score] : scores),
    players: Math.max(scores.length, 1),
    bestToday: best,
    shareText: headToHeadShareText(number, marks, score, H2H_LENGTH, shareHost, reachedPhrase(level), race),
    cleared,
    marks,
    reached: reachedPhrase(level),
    provisional: date >= playToday(),
    place: placement(score, scores.length === 0 ? [score] : scores, H2H_LENGTH),
    race,
  };
}

function base(
  date: string,
  puzzleNumberValue: number,
  shareHost: string,
  devDate: boolean,
  rest: Omit<HeadToHeadState, "date" | "puzzleNumber" | "shareHost" | "devDate" | "field">,
): HeadToHeadState {
  return { date, puzzleNumber: puzzleNumberValue, shareHost, devDate, field: { players: 0, averageProgress: null, bestProgress: null }, ...rest };
}
