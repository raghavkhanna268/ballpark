import { addUtcDays, matchAccepted, playToday } from "@ballpark/shared";
import { scoreStage, type PlayQuestion, type StageOptions } from "./classic-score.js";
import type { Guess } from "@ballpark/shared";

type Submission = { device_id: string; question_id: string; guess_json: string; boost: number; nudged: number };
type Report = { device_id: string; question_id: string; text: string };

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
    .prepare("SELECT device_id, question_id, guess_json, boost, nudged FROM submissions WHERE puzzle_date = ? AND mode = 'classic'")
    .bind(date)
    .all<Submission>();
  const reports = await db
    .prepare("SELECT device_id, question_id, text FROM answer_reports WHERE puzzle_date = ?")
    .bind(date)
    .all<Report>();
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
    const options = group.map((row): StageOptions => ({ boost: row.boost === 1, nudged: row.nudged === 1 }));
    // A name sent in with "Should this count?" that is now on the list takes the place of what the player
    // locked in instead, when it scores more. Rarity is judged against everyone's answers as they were sent.
    const swapped = new Set<number>();
    for (const report of reports.results ?? []) {
      if (report.question_id !== question.id || !matchAccepted(report.text, question.accepted ?? [])) continue;
      const index = group.findIndex((row) => row.device_id === report.device_id);
      if (index < 0 || swapped.has(index)) continue;
      const others = guesses.filter((_, other) => other !== index);
      const instead: Guess = { type: "name_one", text: report.text };
      if (scoreStage(question, instead, others, options[index]).points > scoreStage(question, guesses[index]!, others, options[index]).points) {
        guesses[index] = instead;
        swapped.add(index);
      }
    }
    for (let index = 0; index < group.length; index += 1) {
      const row = group[index]!;
      const guess = guesses[index]!;
      const others = guesses.filter((_, other) => other !== index);
      const scored = scoreStage(question, guess, others, options[index]);
      await db
        .prepare(
          `UPDATE submissions SET points = ?, band = ?, guess_json = ?
           WHERE device_id = ? AND puzzle_date = ? AND mode = 'classic' AND question_id = ?`,
        )
        .bind(scored.points, scored.band, JSON.stringify(guess), row.device_id, date, question.id)
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
