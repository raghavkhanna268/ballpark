import {
  beatPercentRuns,
  blendShare,
  buildHeadToHeadSequence,
  formatFactValue,
  h2hPickPoints,
  h2hPriorWrongShare,
  headToHeadShareText,
  levelForCorrectCount,
  puzzleNumber,
  puzzleSlot,
  scoreHeadToHead,
  toPublicRound,
  utcToday,
  zoomShareLine,
  type H2HFact,
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
    points: number;
    reached: string;
    provisional: boolean;
  } | null;
};

export async function loadHeadToHead(
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
  choice: { choiceId?: string; direction?: "higher" | "lower" },
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
  if (round.kind === "higher-lower") {
    if (choice.direction !== "higher" && choice.direction !== "lower") throw new HttpError(400, "invalid_guess");
  } else if (!round.items.some((item) => item.id === choice.choiceId)) {
    throw new HttpError(400, "invalid_guess");
  }

  const correct = scoreHeadToHead(round, choice);
  const correctCount = run.correct_count + (correct ? 1 : 0);
  const finished = !correct || index === sequence.length - 1;
  const pickPoints = await rarityPoints(db, date, index, correct);
  const totalPoints = run.points + pickPoints;
  const updated = await db
    .prepare(
      `UPDATE h2h_runs
       SET next_index = ?, correct_count = ?, finished = ?, points = ?
       WHERE id = ? AND next_index = ? AND finished = 0`,
    )
    .bind(index + 1, correctCount, finished ? 1 : 0, totalPoints, run.id, index)
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

  const nextRound = !finished ? sequence[index + 1] : undefined;
  let result: HeadToHeadState["result"] = null;
  if (finished && run.kind === "scored") {
    await db
      .prepare(
        `INSERT OR IGNORE INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        deviceId,
        date,
        MODE,
        correctCount,
        totalPoints,
        JSON.stringify(Array.from({ length: correctCount }, () => "green")),
        new Date().toISOString(),
      )
      .run();
    result = await officialResult(db, date, deviceId, puzzleNumber(date, epoch), shareHost, epoch, finished && correct);
  } else if (finished) {
    const reached = levelForCorrectCount(correctCount);
    result = {
      official: false,
      score: correctCount,
      beatPercent: null,
      players: null,
      bestToday: null,
      shareText: "",
      cleared: finished && correct,
      points: totalPoints,
      reached: reached.name,
      provisional: false,
    };
  }

  const winner = round.items.find((item) => item.id === round.answer) ?? round.items[0];
  return {
    correct,
    correctCount,
    points: pickPoints,
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

async function rarityPoints(db: D1Database, date: string, index: number, correct: boolean): Promise<number> {
  if (!correct) return 0;
  const stats = await db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END), 0) AS wrongs
       FROM h2h_picks
       WHERE puzzle_date = ? AND kind = 'scored' AND step_index = ?`,
    )
    .bind(date, index)
    .first<{ n: number; wrongs: number }>();
  const sample = Number(stats?.n ?? 0) + 1;
  const wrongs = Number(stats?.wrongs ?? 0);
  const share = blendShare(wrongs / sample, sample, h2hPriorWrongShare(index));
  return h2hPickPoints(share);
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
    .prepare("SELECT device_id, score, points FROM daily_results WHERE puzzle_date = ? AND mode = ?")
    .bind(date, MODE)
    .all<{ device_id: string; score: number; points: number }>();
  const runs = board.results.map((row) => ({ length: row.score, points: row.points }));
  const mine = runs.find((row, index) => board.results[index]?.device_id === deviceId) ?? runs[0] ?? { length: 0, points: 0 };
  const best = runs.length === 0 ? mine.length : Math.max(...runs.map((row) => row.length));
  const level = levelForCorrectCount(mine.length);
  return {
    official: true,
    score: mine.length,
    beatPercent: beatPercentRuns(mine, runs.length === 0 ? [mine] : runs),
    players: Math.max(runs.length, 1),
    bestToday: best,
    shareText: headToHeadShareText(number, mine.length, shareHost, zoomShareLine(level)),
    cleared,
    points: mine.points,
    reached: level.name,
    provisional: date >= utcToday(),
  };
}

function base(
  date: string,
  puzzleNumberValue: number,
  shareHost: string,
  devDate: boolean,
  rest: Omit<HeadToHeadState, "date" | "puzzleNumber" | "shareHost" | "devDate">,
): HeadToHeadState {
  return { date, puzzleNumber: puzzleNumberValue, shareHost, devDate, ...rest };
}
