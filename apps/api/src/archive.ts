import { ARCHIVE_FREE_DAYS, ARCHIVE_PAGE, addUtcDays, isIsoDate, puzzleNumber, puzzleSlot, type ArchiveDay, type ArchiveResponse, type Guess, type RoundGuessResponse, type RoundResponse } from "@ballpark/shared";
import { HttpError } from "./http.js";
import { hasPlus } from "./plus.js";
import { loadPuzzle, parseStringArray } from "./puzzle.js";
import { loadRound, submitRoundGuess, type RoundDef } from "./rounds.js";

/**
 * The archive: any past day's Classic, played after the fact. Rarity is counted against the players who had that
 * day live, and the end screen says where you would have ranked among them. It never counts for the streak, the
 * rank or the league. The last seven days are free; older days are in Ballpark+.
 */

const ARCHIVE_MODE = "archive";

/** The first day of the free window: today minus the free days. Days from it up to yesterday are free. */
function freeFrom(today: string): string {
  return addUtcDays(today, -ARCHIVE_FREE_DAYS);
}

export async function listArchive(db: D1Database, deviceId: string, today: string, epoch: string, before: string | null): Promise<ArchiveResponse> {
  const plus = await hasPlus(db, deviceId);
  const newest = before && isIsoDate(before) && before <= today ? addUtcDays(before, -1) : addUtcDays(today, -1);
  const oldest = [addUtcDays(newest, -(ARCHIVE_PAGE - 1)), epoch].sort().at(-1)!;
  if (newest < epoch) return { plus, days: [], older: null };

  const counts = await db
    .prepare(
      `SELECT puzzle_date AS date, mode, COUNT(*) AS answered, SUM(points) AS score FROM submissions
       WHERE device_id = ? AND mode IN ('classic', 'archive') AND puzzle_date BETWEEN ? AND ?
       GROUP BY puzzle_date, mode`,
    )
    .bind(deviceId, oldest, newest)
    .all<{ date: string; mode: string; answered: number; score: number }>();
  const mine = new Map<string, { mode: string; answered: number; score: number }>();
  for (const row of counts.results ?? []) {
    // A day you played live is yours as it was; the archive never replays it.
    if (row.mode === "classic" || !mine.has(row.date)) mine.set(row.date, row);
  }

  // Days rotate through the seeded slots, so one read of the slots covers the whole page.
  const slots = await db.prepare("SELECT slot, theme, question_ids FROM puzzles").all<{ slot: number; theme: string; question_ids: string }>();
  const bySlot = new Map((slots.results ?? []).map((row) => [row.slot, { theme: row.theme, questions: parseStringArray(row.question_ids).length }]));
  const days: ArchiveDay[] = [];
  for (let date = newest; date >= oldest; date = addUtcDays(date, -1)) {
    const slot = bySlot.get(puzzleSlot(date, epoch));
    if (!slot) throw new HttpError(500, "puzzle_missing");
    const theme = slot.theme;
    const played = mine.get(date);
    const finished = played !== undefined && played.answered >= slot.questions;
    days.push({
      date,
      number: puzzleNumber(date, epoch),
      theme,
      played: played ? (played.mode === "classic" ? "daily" : "archive") : null,
      answered: played?.answered ?? 0,
      score: finished ? played.score : null,
      locked: !plus && date < freeFrom(today),
    });
  }
  return { plus, days, older: oldest > epoch ? oldest : null };
}

async function archiveDef(db: D1Database, date: string, deviceId: string, today: string, epoch: string): Promise<RoundDef> {
  if (!isIsoDate(date) || date >= today || date < epoch) throw new HttpError(404, "unknown_day");
  if (date < freeFrom(today) && !(await hasPlus(db, deviceId))) throw new HttpError(402, "plus_required");
  const live = await db
    .prepare("SELECT 1 AS hit FROM submissions WHERE device_id = ? AND puzzle_date = ? AND mode = 'classic' LIMIT 1")
    .bind(deviceId, date)
    .first<{ hit: number }>();
  if (live) throw new HttpError(409, "played_that_day");
  const { questions, theme, blurb } = await loadPuzzle(db, date, epoch);
  const number = puzzleNumber(date, epoch);
  return {
    kind: "archive",
    id: date,
    chapter: null,
    title: `#${number} · ${theme}`,
    emoji: "🗓️",
    blurb,
    questionIds: questions.map((question) => question.id),
    store: { key: date, mode: ARCHIVE_MODE },
    // Rarity is the day as it was played live, so a rare answer then is a rare answer now.
    crowd: { key: date, mode: "classic" },
    shareTitle: `Ballpark #${number} · Archive`,
    board: {
      what: "that day",
      hypothetical: true,
      scores: async () => {
        const rows = await db
          .prepare("SELECT score FROM daily_results WHERE puzzle_date = ? AND mode = 'classic' AND cruise = 0")
          .bind(date)
          .all<{ score: number }>();
        return (rows.results ?? []).map((row) => row.score);
      },
    },
  };
}

export async function loadArchiveDay(db: D1Database, date: string, deviceId: string, today: string, epoch: string, shareHost: string): Promise<RoundResponse> {
  return loadRound(db, await archiveDef(db, date, deviceId, today, epoch), deviceId, shareHost);
}

export async function submitArchiveGuess(
  db: D1Database,
  date: string,
  deviceId: string,
  today: string,
  epoch: string,
  shareHost: string,
  questionId: string,
  guess: Guess,
): Promise<RoundGuessResponse> {
  return submitRoundGuess(db, await archiveDef(db, date, deviceId, today, epoch), deviceId, shareHost, questionId, guess);
}
