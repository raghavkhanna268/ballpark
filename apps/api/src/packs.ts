import type { ChapterSummary, Guess, JourneyResponse, PackSummary, RoundGuessResponse, RoundResponse } from "@ballpark/shared";
import { HttpError } from "./http.js";
import { hasPlus } from "./plus.js";
import { parseStringArray, type AnswerScope } from "./puzzle.js";
import { finishedScores, loadRound, roundAnswers, submitRoundGuess, type RoundDef } from "./rounds.js";

/**
 * Ballpark+ themed packs, each a journey: a route of chapters of five name-one questions, played in order, any
 * day, once per device. Rarity is counted among everyone who has played that chapter. Pack answers never reach
 * daily_results, so packs add nothing to the weekly league.
 */

const PACK_MODE = "pack";

type PackRow = { id: string; title: string; emoji: string; blurb: string; route: string; question_ids: string };
type ChapterRow = { chapter: number; title: string; blurb: string; question_ids: string };

/** Chapter 1 keeps the pack's original key, so answers from before chapters existed still count. */
function scopeFor(id: string, chapter: number): AnswerScope {
  return { key: chapter === 1 ? `pack:${id}` : `pack:${id}:${chapter}`, mode: PACK_MODE };
}

async function packRow(db: D1Database, id: string): Promise<PackRow> {
  if (!/^[a-z0-9-]{2,24}$/.test(id)) throw new HttpError(404, "unknown_pack");
  const row = await db.prepare("SELECT id, title, emoji, blurb, route, question_ids FROM packs WHERE id = ?").bind(id).first<PackRow>();
  if (!row) throw new HttpError(404, "unknown_pack");
  return row;
}

/** A pack's chapters in order. A pack seeded before chapters existed is one chapter of its own questions. */
async function chaptersOf(db: D1Database, pack: PackRow): Promise<ChapterRow[]> {
  const rows = await db
    .prepare("SELECT chapter, title, blurb, question_ids FROM pack_chapters WHERE pack_id = ? ORDER BY chapter")
    .bind(pack.id)
    .all<ChapterRow>();
  const chapters = rows.results ?? [];
  return chapters.length > 0 ? chapters : [{ chapter: 1, title: pack.title, blurb: pack.blurb, question_ids: pack.question_ids }];
}

/** Each chapter with your progress. A chapter opens once the one before it is finished. */
async function progressOf(db: D1Database, pack: PackRow, deviceId: string): Promise<ChapterSummary[]> {
  const chapters = await chaptersOf(db, pack);
  const out: ChapterSummary[] = [];
  let open = true;
  for (const row of chapters) {
    const ids = parseStringArray(row.question_ids);
    const answered = await roundAnswers(db, scopeFor(pack.id, row.chapter), deviceId);
    const done = ids.filter((id) => answered.has(id)).length;
    const finished = done === ids.length;
    out.push({
      chapter: row.chapter,
      title: row.title,
      blurb: row.blurb,
      questions: ids.length,
      answered: done,
      score: finished ? ids.reduce((sum, id) => sum + (answered.get(id)?.points ?? 0), 0) : null,
      locked: !open,
    });
    open = open && finished;
  }
  return out;
}

/** Everyone sees the pack list. Without a pass the packs show as locked and their questions stay on the server. */
export async function listPacks(db: D1Database, deviceId: string): Promise<{ plus: boolean; packs: PackSummary[] }> {
  const plus = await hasPlus(db, deviceId);
  const rows = await db.prepare("SELECT id, title, emoji, blurb, route, question_ids FROM packs ORDER BY sort").all<PackRow>();
  const packs: PackSummary[] = [];
  for (const row of rows.results ?? []) {
    const chapters = plus ? await progressOf(db, row, deviceId) : (await chaptersOf(db, row)).map(() => null);
    packs.push({
      id: row.id,
      title: row.title,
      emoji: row.emoji,
      blurb: row.blurb,
      route: row.route,
      chapters: chapters.length,
      chaptersDone: chapters.filter((chapter) => chapter !== null && chapter.score !== null).length,
      locked: !plus,
    });
  }
  return { plus, packs };
}

export async function loadJourney(db: D1Database, id: string, deviceId: string): Promise<JourneyResponse> {
  const pack = await packRow(db, id);
  return {
    pack: { id: pack.id, title: pack.title, emoji: pack.emoji, blurb: pack.blurb, route: pack.route },
    chapters: await progressOf(db, pack, deviceId),
  };
}

async function chapterDef(db: D1Database, id: string, chapter: number, deviceId: string): Promise<RoundDef> {
  const pack = await packRow(db, id);
  const progress = await progressOf(db, pack, deviceId);
  const mine = progress.find((item) => item.chapter === chapter);
  if (!mine) throw new HttpError(404, "unknown_chapter");
  if (mine.locked) throw new HttpError(403, "chapter_locked");
  const row = (await chaptersOf(db, pack)).find((item) => item.chapter === chapter)!;
  const store = scopeFor(pack.id, chapter);
  const questionIds = parseStringArray(row.question_ids);
  const many = progress.length > 1;
  return {
    kind: "pack",
    id: pack.id,
    chapter,
    title: many ? `${pack.title} · ${row.title}` : pack.title,
    emoji: pack.emoji,
    blurb: row.blurb,
    questionIds,
    store,
    crowd: store,
    shareTitle: `Ballpark+ · ${pack.emoji} ${pack.title}${many ? ` · Chapter ${chapter}` : ""}`,
    board: { what: many ? "who played this chapter" : "who played this pack", hypothetical: false, scores: () => finishedScores(db, store, questionIds.length) },
  };
}

export async function loadChapter(db: D1Database, id: string, chapter: number, deviceId: string, shareHost: string): Promise<RoundResponse> {
  return loadRound(db, await chapterDef(db, id, chapter, deviceId), deviceId, shareHost);
}

export async function submitChapterGuess(
  db: D1Database,
  id: string,
  chapter: number,
  deviceId: string,
  shareHost: string,
  questionId: string,
  guess: Guess,
): Promise<RoundGuessResponse> {
  return submitRoundGuess(db, await chapterDef(db, id, chapter, deviceId), deviceId, shareHost, questionId, guess);
}
