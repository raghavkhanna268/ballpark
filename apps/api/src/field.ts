import { CLASSIC_QUESTIONS, NAME_CAP, classicStep, fieldStats, journeyProgress, type FieldStats } from "@ballpark/shared";
import type { PlayQuestion } from "./classic-score.js";

/** Finished Classic runs today, as distances along the journey. */
export async function classicField(db: D1Database, date: string, questions: PlayQuestion[]): Promise<FieldStats> {
  const rows = await db
    .prepare(
      `SELECT s.device_id AS device_id, s.question_id AS question_id, s.points AS points
       FROM submissions s
       JOIN daily_results r ON r.device_id = s.device_id AND r.puzzle_date = s.puzzle_date AND r.mode = 'classic'
       WHERE s.puzzle_date = ? AND s.mode = 'classic'`,
    )
    .bind(date)
    .all<{ device_id: string; question_id: string; points: number }>();
  const maxFor = new Map(questions.map((question) => [question.id, question.type === "name_one" ? NAME_CAP : 20]));
  const byDevice = new Map<string, number>();
  for (const row of rows.results ?? []) {
    const step = classicStep(row.points, maxFor.get(row.question_id) ?? 20, CLASSIC_QUESTIONS);
    byDevice.set(row.device_id, (byDevice.get(row.device_id) ?? 0) + step);
  }
  return fieldStats([...byDevice.values()]);
}

/** Finished scored Head-to-head runs today. Every run answers all ten. */
export async function headToHeadField(db: D1Database, date: string, length: number): Promise<FieldStats> {
  const rows = await db
    .prepare(`SELECT correct_count FROM h2h_runs WHERE puzzle_date = ? AND kind = 'scored' AND finished = 1`)
    .bind(date)
    .all<{ correct_count: number }>();
  return fieldStats((rows.results ?? []).map((row) => journeyProgress(row.correct_count, length)));
}
