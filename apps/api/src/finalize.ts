import { addUtcDays, playToday } from "@ballpark/shared";
import { scoreClassicQuestion, type PlayQuestion } from "./classic-score.js";
import type { Guess } from "@ballpark/shared";

type Submission = { device_id: string; question_id: string; guess_json: string };

/**
 * Recompute a closed game day from every stored guess.
 * Safe to run more than once. Today's board stays provisional.
 */
export async function finalizeDay(db: D1Database, date: string, loadQuestions: (date: string) => Promise<PlayQuestion[]>): Promise<void> {
  if (date >= playToday()) return;
  await finalizeClassic(db, date, loadQuestions);
  await finalizeHeadToHead(db, date);
}

export async function finalizeYesterday(db: D1Database, when: Date, loadQuestions: (date: string) => Promise<PlayQuestion[]>): Promise<void> {
  await finalizeDay(db, addUtcDays(playToday(when), -1), loadQuestions);
}

async function finalizeClassic(db: D1Database, date: string, loadQuestions: (date: string) => Promise<PlayQuestion[]>): Promise<void> {
  const questions = await loadQuestions(date);
  const rows = await db
    .prepare("SELECT device_id, question_id, guess_json FROM submissions WHERE puzzle_date = ? AND mode = 'classic'")
    .bind(date)
    .all<Submission>();
  const byQuestion = new Map<string, Submission[]>();
  for (const row of rows.results) {
    const list = byQuestion.get(row.question_id) ?? [];
    list.push(row);
    byQuestion.set(row.question_id, list);
  }

  const totals = new Map<string, { score: number; bands: string[] }>();
  for (const question of questions) {
    const group = byQuestion.get(question.id) ?? [];
    const guesses = group.map((row) => JSON.parse(row.guess_json) as Guess);
    for (let index = 0; index < group.length; index += 1) {
      const row = group[index]!;
      const guess = guesses[index]!;
      const others = guesses.filter((_, other) => other !== index);
      const scored = scoreClassicQuestion(question, guess, others);
      await db
        .prepare(
          `UPDATE submissions SET points = ?, band = ?
           WHERE device_id = ? AND puzzle_date = ? AND mode = 'classic' AND question_id = ?`,
        )
        .bind(scored.points, scored.band, row.device_id, date, question.id)
        .run();
      const current = totals.get(row.device_id) ?? { score: 0, bands: [] };
      current.score += scored.points;
      current.bands.push(scored.band);
      totals.set(row.device_id, current);
    }
  }

  for (const [deviceId, total] of totals) {
    const finished = questions.every((question) => (byQuestion.get(question.id) ?? []).some((row) => row.device_id === deviceId));
    if (!finished) continue;
    await db
      .prepare(
        `UPDATE daily_results
         SET score = ?, points = ?, bands = ?, finalized = 1
         WHERE device_id = ? AND puzzle_date = ? AND mode = 'classic'`,
      )
      .bind(total.score, total.score, JSON.stringify(total.bands), deviceId, date)
      .run();
  }
}

async function finalizeHeadToHead(db: D1Database, date: string): Promise<void> {
  await db.prepare("UPDATE daily_results SET finalized = 1 WHERE puzzle_date = ? AND mode = 'head-to-head'").bind(date).run();
}
