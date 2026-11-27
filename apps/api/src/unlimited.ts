import { UNLIMITED_QUESTIONS, firstPlayOf, puzzleNumber, puzzleSlot, type Guess, type RoundGuessResponse, type RoundResponse, type UnlimitedStatus } from "@ballpark/shared";
import { HttpError } from "./http.js";
import { hasPlus, requirePlus } from "./plus.js";
import { parseStringArray } from "./puzzle.js";
import { loadRound, submitRoundGuess, type RoundDef } from "./rounds.js";

/**
 * Unlimited: Ballpark+ rounds of seven questions, as many as a member likes. Each round draws from the pool,
 * questions this device has not answered first. A daily question joins the pool only once its day has run, and
 * today's never does, so Unlimited cannot give away a daily. Rarity counts every answer the question has ever had,
 * on any day and in any mode, so a question that ran as a daily keeps all of its players.
 */

const UNLIMITED_MODE = "unlimited";
const ID = /^[0-9a-f-]{36}$/;

type RoundRow = { id: string; question_ids: string };

function storeKey(id: string): string {
  return `unlimited:${id}`;
}

/** This device's rounds with how far each got, newest first. */
async function roundsOf(db: D1Database, deviceId: string) {
  const rows = await db
    .prepare(
      `SELECT r.id AS id, r.question_ids AS question_ids, COUNT(s.id) AS answered, COALESCE(SUM(s.points), 0) AS score
       FROM unlimited_rounds r
       LEFT JOIN submissions s ON s.device_id = r.device_id AND s.mode = 'unlimited' AND s.puzzle_date = 'unlimited:' || r.id
       WHERE r.device_id = ?
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
    )
    .bind(deviceId)
    .all<{ id: string; question_ids: string; answered: number; score: number }>();
  return (rows.results ?? []).map((row) => ({ ...row, finished: row.answered >= parseStringArray(row.question_ids).length }));
}

/** The pool, less the questions of today and of any day that has not run yet. */
async function openPool(db: D1Database, today: string, epoch: string): Promise<string[]> {
  const pool = await db.prepare("SELECT question_id FROM unlimited_pool").all<{ question_id: string }>();
  const slots = await db.prepare("SELECT slot, question_ids FROM puzzles").all<{ slot: number; question_ids: string }>();
  const todayNumber = puzzleNumber(today, epoch);
  const todaySlot = puzzleSlot(today, epoch);
  const held = new Set<string>();
  for (const row of slots.results ?? []) {
    if (row.slot === todaySlot || firstPlayOf(row.slot, epoch) >= todayNumber) for (const id of parseStringArray(row.question_ids)) held.add(id);
  }
  return (pool.results ?? []).map((row) => row.question_id).filter((id) => !held.has(id));
}

export async function unlimitedStatus(db: D1Database, deviceId: string, today: string, epoch: string): Promise<UnlimitedStatus> {
  const plus = await hasPlus(db, deviceId);
  const rounds = plus ? await roundsOf(db, deviceId) : [];
  const finished = rounds.filter((round) => round.finished);
  return {
    plus,
    played: finished.length,
    best: finished.length > 0 ? Math.max(...finished.map((round) => round.score)) : null,
    open: rounds.find((round) => !round.finished)?.id ?? null,
    pool: (await openPool(db, today, epoch)).length,
  };
}

/** Starts a round, or hands back the one still open, so leaving mid-round never costs a question. */
export async function startUnlimited(db: D1Database, deviceId: string, today: string, epoch: string): Promise<{ id: string }> {
  await requirePlus(db, deviceId);
  const open = (await roundsOf(db, deviceId)).find((round) => !round.finished);
  if (open) return { id: open.id };
  const all = await openPool(db, today, epoch);
  if (all.length < UNLIMITED_QUESTIONS) throw new HttpError(503, "pool_too_small");
  // Anything you have answered before, live, in the archive or here, waits until the fresh ones run out.
  const seenRows = await db
    .prepare("SELECT DISTINCT question_id FROM submissions WHERE device_id = ? AND mode IN ('classic', 'archive', ?)")
    .bind(deviceId, UNLIMITED_MODE)
    .all<{ question_id: string }>();
  const seen = new Set((seenRows.results ?? []).map((row) => row.question_id));
  // Fresh questions first. Once the pool runs dry, the round tops up with ones you have had before.
  const fresh = shuffle(all.filter((id) => !seen.has(id)));
  const again = shuffle(all.filter((id) => seen.has(id)));
  const picked = [...fresh, ...again].slice(0, UNLIMITED_QUESTIONS);
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO unlimited_rounds (id, device_id, question_ids, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, deviceId, JSON.stringify(picked), new Date().toISOString())
    .run();
  return { id };
}

async function unlimitedDef(db: D1Database, id: string, deviceId: string): Promise<RoundDef> {
  await requirePlus(db, deviceId);
  if (!ID.test(id)) throw new HttpError(404, "unknown_round");
  const row = await db
    .prepare("SELECT id, question_ids FROM unlimited_rounds WHERE id = ? AND device_id = ?")
    .bind(id, deviceId)
    .first<RoundRow>();
  if (!row) throw new HttpError(404, "unknown_round");
  const played = (await roundsOf(db, deviceId)).filter((round) => round.finished || round.id === id).length;
  return {
    kind: "unlimited",
    id,
    chapter: null,
    title: `Unlimited · Round ${played}`,
    emoji: "♾️",
    blurb: "Seven questions from the whole bank. Rarity counts everyone who ever answered them.",
    questionIds: parseStringArray(row.question_ids),
    store: { key: storeKey(id), mode: UNLIMITED_MODE },
    crowd: { key: null, modes: ["classic", "archive", UNLIMITED_MODE] },
    shareTitle: "Ballpark+ · ♾️ Unlimited",
    board: null,
  };
}

export async function loadUnlimited(db: D1Database, id: string, deviceId: string, shareHost: string): Promise<RoundResponse> {
  return loadRound(db, await unlimitedDef(db, id, deviceId), deviceId, shareHost);
}

export async function submitUnlimitedGuess(db: D1Database, id: string, deviceId: string, shareHost: string, questionId: string, guess: Guess): Promise<RoundGuessResponse> {
  return submitRoundGuess(db, await unlimitedDef(db, id, deviceId), deviceId, shareHost, questionId, guess);
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const pick = crypto.getRandomValues(new Uint32Array(1))[0]! % (index + 1);
    [out[index], out[pick]] = [out[pick]!, out[index]!];
  }
  return out;
}
