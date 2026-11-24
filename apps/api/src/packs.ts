import {
  NAME_CAP,
  PACK_QUESTIONS,
  classicStep,
  climbShareLine,
  climbedPhrase,
  placement,
  type Band,
  type Guess,
  type PackGuessResponse,
  type PackResponse,
  type PackResult,
  type PackSummary,
} from "@ballpark/shared";
import { BAND_EMOJI } from "@ballpark/shared/scoring";
import { RETRY_LIMIT, isUnlistedName, scoreClassicQuestion } from "./classic-score.js";
import { HttpError } from "./http.js";
import { enforceRateLimit } from "./rate-limit.js";
import { hasPlus } from "./plus.js";
import { loadQuestions, otherGuesses, parseGuess, parseStringArray, revealFor, toPublic, validateGuess, type AnswerScope } from "./puzzle.js";

/**
 * Ballpark+ themed packs. A pack is a round of five name-one questions, played any day, once per device.
 * Rarity is counted among everyone who has played that pack. Pack answers never reach daily_results,
 * so packs add nothing to the weekly league.
 */

const PACK_MODE = "pack";

type PackRow = { id: string; title: string; emoji: string; blurb: string; question_ids: string };

function scopeFor(id: string): AnswerScope {
  return { key: `pack:${id}`, mode: PACK_MODE };
}

async function packRow(db: D1Database, id: string): Promise<PackRow> {
  if (!/^[a-z0-9-]{2,24}$/.test(id)) throw new HttpError(404, "unknown_pack");
  const row = await db.prepare("SELECT id, title, emoji, blurb, question_ids FROM packs WHERE id = ?").bind(id).first<PackRow>();
  if (!row) throw new HttpError(404, "unknown_pack");
  return row;
}

async function mine(db: D1Database, id: string, deviceId: string) {
  const scope = scopeFor(id);
  const rows = await db
    .prepare("SELECT question_id, guess_json, band, points FROM submissions WHERE device_id = ? AND puzzle_date = ? AND mode = ?")
    .bind(deviceId, scope.key, scope.mode)
    .all<{ question_id: string; guess_json: string; band: Band; points: number }>();
  return new Map((rows.results ?? []).map((row) => [row.question_id, row]));
}

function summary(row: PackRow, answered: Map<string, { points: number }>, locked: boolean): PackSummary {
  const ids = parseStringArray(row.question_ids);
  const done = ids.filter((id) => answered.has(id)).length;
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    blurb: row.blurb,
    questions: ids.length,
    answered: done,
    score: done === ids.length ? ids.reduce((sum, id) => sum + (answered.get(id)?.points ?? 0), 0) : null,
    locked,
  };
}

/** Everyone sees the pack list. Without a pass the packs show as locked and their questions stay on the server. */
export async function listPacks(db: D1Database, deviceId: string): Promise<{ plus: boolean; packs: PackSummary[] }> {
  const plus = await hasPlus(db, deviceId);
  const rows = await db.prepare("SELECT id, title, emoji, blurb, question_ids FROM packs ORDER BY sort").all<PackRow>();
  const packs: PackSummary[] = [];
  for (const row of rows.results ?? []) packs.push(summary(row, plus ? await mine(db, row.id, deviceId) : new Map(), !plus));
  return { plus, packs };
}

export async function loadPack(db: D1Database, id: string, deviceId: string, shareHost: string): Promise<PackResponse> {
  const row = await packRow(db, id);
  const questions = await loadQuestions(db, parseStringArray(row.question_ids));
  const answered = await mine(db, id, deviceId);
  const scope = scopeFor(id);
  const shown = [];
  for (const question of questions) {
    const existing = answered.get(question.id);
    shown.push(toPublic(question, existing ? await revealFor(db, scope, question, parseGuess(existing.guess_json)) : null));
  }
  return {
    pack: summary(row, answered, false),
    questions: shown,
    result: await packResult(db, row, deviceId, shareHost),
  };
}

export async function submitPackGuess(
  db: D1Database,
  id: string,
  deviceId: string,
  shareHost: string,
  questionId: string,
  guess: Guess,
): Promise<PackGuessResponse> {
  const row = await packRow(db, id);
  const questions = await loadQuestions(db, parseStringArray(row.question_ids));
  const question = questions.find((candidate) => candidate.id === questionId);
  if (!question) throw new HttpError(404, "unknown_question");
  validateGuess(question, guess);
  const scope = scopeFor(id);
  if (isUnlistedName(question, guess)) {
    await enforceRateLimit(db, `try:${deviceId}:${scope.key}:${question.id}`, RETRY_LIMIT);
    throw new HttpError(422, "not_listed");
  }
  const scored = scoreClassicQuestion(question, guess, await otherGuesses(db, scope, question.id, null));
  try {
    await db
      .prepare(
        `INSERT INTO submissions (id, device_id, puzzle_date, mode, question_id, guess_json, band, points, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), deviceId, scope.key, scope.mode, question.id, JSON.stringify(guess), scored.band, scored.points, new Date().toISOString())
      .run();
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) throw new HttpError(409, "already_submitted");
    throw error;
  }
  console.log(JSON.stringify({ level: "info", event: "pack_guess_scored", pack: id, questionId: question.id, band: scored.band, points: scored.points }));
  return {
    reveal: await revealFor(db, scope, question, guess),
    result: await packResult(db, row, deviceId, shareHost),
  };
}

async function packResult(db: D1Database, row: PackRow, deviceId: string, shareHost: string): Promise<PackResult | null> {
  const ids = parseStringArray(row.question_ids);
  const answered = await mine(db, row.id, deviceId);
  if (ids.some((id) => !answered.has(id))) return null;
  const ordered = ids.map((id) => answered.get(id)!);
  const score = ordered.reduce((sum, item) => sum + item.points, 0);
  const bands = ordered.map((item) => item.band);
  const emojis = bands.map((band) => BAND_EMOJI[band]);
  const climbed = ordered.reduce((sum, item) => sum + classicStep(item.points, NAME_CAP, PACK_QUESTIONS), 0);
  const scope = scopeFor(row.id);
  const board = await db
    .prepare(
      `SELECT SUM(points) AS score FROM submissions WHERE puzzle_date = ? AND mode = ?
       GROUP BY device_id HAVING COUNT(*) = ?`,
    )
    .bind(scope.key, scope.mode, ids.length)
    .all<{ score: number }>();
  const scores = (board.results ?? []).map((item) => item.score);
  return {
    score,
    bands,
    emojis,
    reached: climbedPhrase(climbed),
    place: placement(score, scores),
    shareText: `Ballpark+ · ${row.emoji} ${row.title}\n${emojis.join("")} ${score} pts\n${climbShareLine(climbed)}\n${shareHost}`,
  };
}
