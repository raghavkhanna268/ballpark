import {
  AFTERBURNER,
  CLASSIC_QUESTIONS,
  NAME_CAP,
  callsign,
  classicStep,
  fieldStats,
  journeyProgress,
  type BoardRow,
  type ClimbCurve,
  type FieldStats,
  type TodayStats,
} from "@ballpark/shared";
import { crewRuns, type BotRun } from "./bots.js";
import type { PlayQuestion } from "./classic-score.js";

/** How many height bands the end screen's curve of today's climbs has. */
const CURVE_BINS = 12;
/** How many climbs the Today board lists. */
const BOARD_SIZE = 10;
/** The home card says how many people are climbing once there are this many. Bots are never in that count. */
export const PEOPLE_SHOWN_FROM = 20;

/** The most a question of this type can score before the Afterburner: 100 for naming one, 20 for the others. */
export function maxFor(question: Pick<PlayQuestion, "type">): number {
  return question.type === "name_one" ? NAME_CAP : 20;
}

/** One stage's share of the climb, the same sum the client's scene flies. */
export function stageStep(question: Pick<PlayQuestion, "type">, points: number, boost: boolean): number {
  return classicStep(points, maxFor(question), CLASSIC_QUESTIONS, boost ? AFTERBURNER : 1);
}

/** Everyone who finished today's Classic, as how high each climbed. */
export async function classicClimbs(db: D1Database, date: string, questions: PlayQuestion[]): Promise<Map<string, number>> {
  const rows = await db
    .prepare(
      `SELECT s.device_id AS device_id, s.question_id AS question_id, s.points AS points, s.boost AS boost
       FROM submissions s
       JOIN daily_results r ON r.device_id = s.device_id AND r.puzzle_date = s.puzzle_date AND r.mode = 'classic' AND r.cruise = 0
       WHERE s.puzzle_date = ? AND s.mode = 'classic'`,
    )
    .bind(date)
    .all<{ device_id: string; question_id: string; points: number; boost: number }>();
  const byId = new Map(questions.map((question) => [question.id, question]));
  const climbs = new Map<string, number>();
  for (const row of rows.results ?? []) {
    const question = byId.get(row.question_id);
    const step = question ? stageStep(question, row.points, row.boost === 1) : 0;
    climbs.set(row.device_id, (climbs.get(row.device_id) ?? 0) + step);
  }
  return climbs;
}

/** Today's bots: the same crew and the same answers on every request, and on that day's archive page later. */
export function dayBots(date: string, questions: PlayQuestion[]): Array<BotRun & { progress: number }> {
  return crewRuns(date, questions, { afterburner: true }).map((run) => ({
    ...run,
    progress: run.points.reduce((sum, points, index) => sum + (questions[index] ? stageStep(questions[index], points, index === run.boosted) : 0), 0),
  }));
}

/** Today's finished climbs, players' and bots', keyed by device id or bot id. */
export async function fieldClimbs(db: D1Database, date: string, questions: PlayQuestion[]): Promise<Map<string, number>> {
  const climbs = await classicClimbs(db, date, questions);
  for (const bot of dayBots(date, questions)) climbs.set(bot.id, bot.progress);
  return climbs;
}

/** Finished Classic runs today, bots included, as distances along the journey. */
export async function classicField(db: D1Database, date: string, questions: PlayQuestion[]): Promise<FieldStats> {
  return fieldStats([...(await fieldClimbs(db, date, questions)).values()]);
}

/** Today's climbs, bots included, as a histogram with yours marked. Null until you have finished. */
export function climbCurve(climbs: Map<string, number>, deviceId: string): ClimbCurve | null {
  const mine = climbs.get(deviceId);
  if (mine === undefined) return null;
  const all = [...climbs.values()];
  const top = Math.max(1, Math.ceil(Math.max(...all)));
  const bins = Array.from({ length: CURVE_BINS }, () => 0);
  for (const value of all) bins[Math.min(CURVE_BINS - 1, Math.floor((value / top) * CURVE_BINS))] += 1;
  const others = all.length - 1;
  const below = all.filter((value) => value < mine - 1e-9).length;
  return { bins, top, you: round(mine), higherThan: others > 0 ? Math.round((100 * below) / others) : 0 };
}

/** How many are climbing today, and the ten highest finished climbs. `climbs` comes from fieldClimbs, bots included. */
export async function todayStats(db: D1Database, date: string, deviceId: string, climbs: Map<string, number>, bots: BotRun[]): Promise<TodayStats> {
  const started = await db
    .prepare("SELECT COUNT(DISTINCT device_id) AS players FROM submissions WHERE puzzle_date = ? AND mode = 'classic'")
    .bind(date)
    .first<{ players: number }>();
  const names = new Map(bots.map((bot) => [bot.id, bot]));

  const results = await db
    .prepare("SELECT device_id, score, skin FROM daily_results WHERE puzzle_date = ? AND mode = 'classic' AND cruise = 0")
    .bind(date)
    .all<{ device_id: string; score: number; skin: string | null }>();
  const extra = new Map((results.results ?? []).map((row) => [row.device_id, row]));
  const ordered = [...climbs.entries()]
    .map(([id, progress]) => {
      const bot = names.get(id);
      return { id, bot, progress: round(progress), score: bot ? bot.score : (extra.get(id)?.score ?? 0), skin: bot ? null : (extra.get(id)?.skin ?? null) };
    })
    .sort((left, right) => right.progress - left.progress || right.score - left.score || Number(Boolean(left.bot)) - Number(Boolean(right.bot)) || left.id.localeCompare(right.id));
  const rows: BoardRow[] = ordered.map((row) => ({
    rank: ordered.filter((other) => other.progress > row.progress).length + 1,
    callsign: row.bot ? row.bot.name : callsign(row.id),
    progress: row.progress,
    score: row.score,
    skin: row.skin,
    you: row.id === deviceId,
    bot: Boolean(row.bot),
  }));
  const board = rows.slice(0, BOARD_SIZE);
  const you = board.some((row) => row.you) ? null : (rows.find((row) => row.you) ?? null);
  const people = started?.players ?? 0;
  return { climbing: people >= PEOPLE_SHOWN_FROM ? people : null, bots: bots.length, board, you };
}

/** Finished scored Head-to-head runs today. Every run answers all ten. */
export async function headToHeadField(db: D1Database, date: string, length: number): Promise<FieldStats> {
  const rows = await db
    .prepare(`SELECT correct_count FROM h2h_runs WHERE puzzle_date = ? AND kind = 'scored' AND finished = 1`)
    .bind(date)
    .all<{ correct_count: number }>();
  return fieldStats((rows.results ?? []).map((row) => journeyProgress(row.correct_count, length)));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
