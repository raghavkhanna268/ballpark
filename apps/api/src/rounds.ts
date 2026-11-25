import {
  NAME_CAP,
  classicStep,
  climbShareLine,
  climbedPhrase,
  placement,
  type Band,
  type Guess,
  type RoundGuessResponse,
  type RoundKind,
  type RoundResponse,
  type RoundResult,
  type RoundSummary,
} from "@ballpark/shared";
import { BAND_EMOJI } from "@ballpark/shared/scoring";
import { crewRuns } from "./bots.js";
import { RETRY_LIMIT, checkName, nameRejection, scoreClassicQuestion, type PlayQuestion } from "./classic-score.js";
import { HttpError } from "./http.js";
import { enforceRateLimit } from "./rate-limit.js";
import { loadQuestions, otherGuesses, parseGuess, revealFor, toPublic, validateGuess, type AnswerScope, type CrowdScope } from "./puzzle.js";

/**
 * Rounds outside the daily: a pack chapter, a past day, an Unlimited round. Each is a fixed list of name-one
 * questions, played once per device with the second chance, and none of them write daily_results, so nothing
 * here reaches the streak, the rank or the league.
 */

export type RoundDef = {
  kind: RoundKind;
  id: string;
  chapter: number | null;
  title: string;
  emoji: string;
  blurb: string;
  questionIds: string[];
  /** Where this round's answers are stored. */
  store: AnswerScope;
  /** Whose answers set the rarity. */
  crowd: CrowdScope;
  /** The first line of the share card. */
  shareTitle: string;
  /** Who a finished score is ranked among, or null when there is no one to rank against. */
  board: RoundBoard | null;
};

export type RoundBoard = {
  what: string;
  /** A past day: the rank is where you would have been. */
  hypothetical: boolean;
  scores: () => Promise<number[]>;
  /** The bots ranked alongside: a past day's are that day's bots, with their Afterburners; a chapter's play without. */
  bots: { seed: string; afterburner: boolean };
};

type Answer = { question_id: string; guess_json: string; band: Band; points: number };

export async function roundAnswers(db: D1Database, store: AnswerScope, deviceId: string): Promise<Map<string, Answer>> {
  const rows = await db
    .prepare("SELECT question_id, guess_json, band, points FROM submissions WHERE device_id = ? AND puzzle_date = ? AND mode = ?")
    .bind(deviceId, store.key, store.mode)
    .all<Answer>();
  return new Map((rows.results ?? []).map((row) => [row.question_id, row]));
}

function summary(def: RoundDef, answered: Map<string, Answer>): RoundSummary {
  const done = def.questionIds.filter((id) => answered.has(id)).length;
  return {
    kind: def.kind,
    id: def.id,
    chapter: def.chapter,
    title: def.title,
    emoji: def.emoji,
    blurb: def.blurb,
    questions: def.questionIds.length,
    answered: done,
    score: done === def.questionIds.length ? def.questionIds.reduce((sum, id) => sum + (answered.get(id)?.points ?? 0), 0) : null,
  };
}

export async function loadRound(db: D1Database, def: RoundDef, deviceId: string, shareHost: string): Promise<RoundResponse> {
  const questions = await loadQuestions(db, def.questionIds);
  const answered = await roundAnswers(db, def.store, deviceId);
  const shown = [];
  for (const question of questions) {
    const existing = answered.get(question.id);
    shown.push(toPublic(question, existing ? await revealFor(db, def.crowd, question, parseGuess(existing.guess_json)) : null));
  }
  return { round: summary(def, answered), questions: shown, result: await roundResult(db, def, deviceId, shareHost, answered, questions) };
}

export async function submitRoundGuess(
  db: D1Database,
  def: RoundDef,
  deviceId: string,
  shareHost: string,
  questionId: string,
  guess: Guess,
): Promise<RoundGuessResponse> {
  const questions = await loadQuestions(db, def.questionIds);
  const question = questions.find((candidate) => candidate.id === questionId);
  if (!question) throw new HttpError(404, "unknown_question");
  validateGuess(question, guess);
  const rejection = nameRejection(checkName(question, guess));
  if (rejection) {
    await enforceRateLimit(db, `try:${deviceId}:${def.store.key}:${question.id}`, RETRY_LIMIT);
    throw rejection;
  }
  const scored = scoreClassicQuestion(question, guess, await otherGuesses(db, def.crowd, question.id, null));
  try {
    await db
      .prepare(
        `INSERT INTO submissions (id, device_id, puzzle_date, mode, question_id, guess_json, band, points, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), deviceId, def.store.key, def.store.mode, question.id, JSON.stringify(guess), scored.band, scored.points, new Date().toISOString())
      .run();
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) throw new HttpError(409, "already_submitted");
    throw error;
  }
  console.log(JSON.stringify({ level: "info", event: "round_guess_scored", kind: def.kind, round: def.id, questionId: question.id, band: scored.band, points: scored.points }));
  return {
    reveal: await revealFor(db, def.crowd, question, guess),
    result: await roundResult(db, def, deviceId, shareHost, await roundAnswers(db, def.store, deviceId), questions),
  };
}

async function roundResult(
  db: D1Database,
  def: RoundDef,
  deviceId: string,
  shareHost: string,
  answered: Map<string, Answer>,
  questions: PlayQuestion[],
): Promise<RoundResult | null> {
  if (def.questionIds.some((id) => !answered.has(id))) return null;
  const ordered = def.questionIds.map((id) => answered.get(id)!);
  const score = ordered.reduce((sum, item) => sum + item.points, 0);
  const bands = ordered.map((item) => item.band);
  const emojis = bands.map((band) => BAND_EMOJI[band]);
  const climbed = ordered.reduce((sum, item) => sum + classicStep(item.points, NAME_CAP, def.questionIds.length), 0);
  return {
    score,
    bands,
    emojis,
    reached: climbedPhrase(climbed),
    place: def.board ? await boardPlace(def.board, def.questionIds, questions, score) : null,
    placeWhat: def.board?.what ?? "",
    hypothetical: def.board?.hypothetical ?? false,
    shareText: `${def.shareTitle}\n${emojis.join("")} ${score} pts\n${climbShareLine(climbed)}\n${shareHost}`,
  };
}

/** Where a finished round's score sits among the players' scores and the round's bots. */
async function boardPlace(board: RoundBoard, questionIds: string[], questions: PlayQuestion[], score: number) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const ordered = questionIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const bots = crewRuns(board.bots.seed, ordered, { afterburner: board.bots.afterburner }).map((bot) => bot.score);
  // A past day's scores are other players'; yours joins them to say where you would have been.
  const players = board.hypothetical ? [...(await board.scores()), score] : await board.scores();
  return placement(score, [...players, ...bots]);
}

/** Finished scores in one stored set: everyone who answered all of its questions. */
export async function finishedScores(db: D1Database, store: AnswerScope, questions: number): Promise<number[]> {
  const rows = await db
    .prepare(
      `SELECT SUM(points) AS score FROM submissions WHERE puzzle_date = ? AND mode = ?
       GROUP BY device_id HAVING COUNT(*) = ?`,
    )
    .bind(store.key, store.mode, questions)
    .all<{ score: number }>();
  return (rows.results ?? []).map((row) => row.score);
}
