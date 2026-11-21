import { addUtcDays, utcToday } from "@ballpark/shared";
import { blendShare, h2hPickPoints, h2hPriorWrongShare } from "@ballpark/shared";
import { scoreClassicQuestion, type PlayQuestion } from "./classic-score.js";
import type { Guess } from "@ballpark/shared";

type Submission = { device_id: string; question_id: string; guess_json: string };

/**
 * Recompute a closed UTC day from every stored guess.
 * Safe to run more than once. Today's board stays provisional.
 */
export async function finalizeDay(db: D1Database, date: string, loadQuestions: (date: string) => Promise<PlayQuestion[]>): Promise<void> {
  if (date >= utcToday()) return;
  await finalizeClassic(db, date, loadQuestions);
  await finalizeHeadToHead(db, date);
}

export async function finalizeYesterday(db: D1Database, when: Date, loadQuestions: (date: string) => Promise<PlayQuestion[]>): Promise<void> {
  await finalizeDay(db, addUtcDays(utcToday(when), -1), loadQuestions);
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
  const picks = await db
    .prepare("SELECT device_id, step_index, correct FROM h2h_picks WHERE puzzle_date = ? AND kind = 'scored'")
    .bind(date)
    .all<{ device_id: string; step_index: number; correct: number }>();
  const byStep = new Map<number, { device_id: string; correct: number }[]>();
  for (const pick of picks.results) {
    const list = byStep.get(pick.step_index) ?? [];
    list.push(pick);
    byStep.set(pick.step_index, list);
  }
  const points = new Map<string, number>();
  for (const [index, group] of byStep) {
    const wrongs = group.filter((pick) => pick.correct === 0).length;
    const share = blendShare(wrongs / group.length, group.length, h2hPriorWrongShare(index));
    for (const pick of group) {
      const award = pick.correct === 1 ? h2hPickPoints(share) : 0;
      points.set(pick.device_id, (points.get(pick.device_id) ?? 0) + award);
    }
  }
  for (const [deviceId, total] of points) {
    await db
      .prepare("UPDATE h2h_runs SET points = ? WHERE device_id = ? AND puzzle_date = ? AND kind = 'scored'")
      .bind(total, deviceId, date)
      .run();
    await db
      .prepare("UPDATE daily_results SET points = ?, finalized = 1 WHERE device_id = ? AND puzzle_date = ? AND mode = 'head-to-head'")
      .bind(total, deviceId, date)
      .run();
  }
}
