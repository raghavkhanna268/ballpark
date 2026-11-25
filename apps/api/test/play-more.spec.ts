import { exports } from "cloudflare:workers";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { ARCHIVE_FREE_DAYS, addUtcDays, puzzleSlot, type ArchiveResponse, type DayResult, type GuessResponse, type PuzzleResponse, type RoundGuessResponse, type RoundResponse, type UnlimitedStatus } from "@ballpark/shared";
import { puzzles, questions, type SeedQuestion } from "../seed/content.ts";
import { correctGuess, resetAndSeed, spaceDay } from "./seed-db.ts";

const DEVICE = "55555555-5555-4555-8555-555555555555";
const OTHER = "66666666-6666-4666-8666-666666666666";
const EPOCH = "2026-01-01";
// Day 8 is the first Space day.
const DAY = "2026-01-08";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

function call(path: string, deviceId: string, date: string, body?: unknown) {
  return exports.default.fetch(`http://localhost${path}${path.includes("?") ? "&" : "?"}date=${date}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function playDaily(deviceId: string, date: string, extras: Record<string, unknown> = {}): Promise<DayResult> {
  let last: GuessResponse | null = null;
  for (const question of spaceDay()) {
    const response = await call("/api/guess", deviceId, date, { questionId: question.id, guess: correctGuess(question), ...extras });
    expect(response.status).toBe(200);
    last = (await response.json()) as GuessResponse;
  }
  return last!.result!;
}

function dayQuestions(date: string): SeedQuestion[] {
  const puzzle = puzzles.find((item) => item.slot === puzzleSlot(date, EPOCH))!;
  return puzzle.questionIds.map((id) => questions.find((item) => item.id === id)!);
}

async function unlock(deviceId: string, date: string) {
  expect((await call("/api/plus/test-unlock", deviceId, date, { plan: "month" })).status).toBe(200);
}

describe("Cruise", () => {
  it("keeps the day but stays off the board", async () => {
    const ranked = await playDaily(OTHER, DAY);
    expect(ranked.cruise).toBe(false);
    expect(ranked.place?.players).toBe(1);

    const cruise = await playDaily(DEVICE, DAY, { cruise: true });
    expect(cruise.cruise).toBe(true);
    expect(cruise.place).toBeNull();
    expect(cruise.shareText).toContain("Cruise");
    expect(cruise.shareText).not.toContain("Classic");

    // The day is saved for the streak, flagged so the board, the curve and the league leave it out.
    const row = await env.DB.prepare("SELECT cruise FROM daily_results WHERE device_id = ? AND puzzle_date = ?").bind(DEVICE, DAY).first<{ cruise: number }>();
    expect(row?.cruise).toBe(1);
    const theirs = (await (await call("/api/puzzle", OTHER, DAY)).json()) as PuzzleResponse;
    expect(theirs.result?.place?.players).toBe(1);
    expect(theirs.cruise).toBe(false);
    const mine = (await (await call("/api/puzzle", DEVICE, DAY)).json()) as PuzzleResponse;
    expect(mine.cruise).toBe(true);
    const league = await env.DB.prepare("SELECT COUNT(*) AS n FROM league_members WHERE device_id = ?").bind(DEVICE).first<{ n: number }>();
    expect(league?.n).toBe(0);
  });

  it("cannot be switched on or off halfway through a day", async () => {
    const [first, second] = spaceDay();
    expect((await call("/api/guess", DEVICE, DAY, { questionId: first!.id, guess: correctGuess(first!), cruise: true })).status).toBe(200);
    const switched = await call("/api/guess", DEVICE, DAY, { questionId: second!.id, guess: correctGuess(second!) });
    expect(switched.status).toBe(409);
    expect(await switched.json()).toEqual({ error: "mode_locked" });
  });
});

describe("the archive", () => {
  const TODAY = addUtcDays(DAY, 3);

  it("lists past days with the last week free and older days in Ballpark+", async () => {
    const today = addUtcDays(DAY, 20);
    const list = (await (await call("/api/archive", DEVICE, today)).json()) as ArchiveResponse;
    expect(list.plus).toBe(false);
    expect(list.days[0]!.date).toBe(addUtcDays(today, -1));
    expect(list.days.at(-1)!.date).toBe(EPOCH);
    expect(list.older).toBeNull();
    expect(list.days.filter((day) => !day.locked)).toHaveLength(ARCHIVE_FREE_DAYS);
    expect(list.days.find((day) => day.date === DAY)).toMatchObject({ number: 8, theme: "Space", locked: true, played: null });

    const locked = await call(`/api/archive/${DAY}`, DEVICE, today);
    expect(locked.status).toBe(402);
    await unlock(DEVICE, today);
    expect((await call(`/api/archive/${DAY}`, DEVICE, today)).status).toBe(200);
    expect((await call(`/api/archive/${today}`, DEVICE, today)).status).toBe(404);
    expect((await call("/api/archive/2025-12-31", DEVICE, today)).status).toBe(404);
  });

  it("pages back through older days", async () => {
    const today = addUtcDays(EPOCH, 40);
    const first = (await (await call("/api/archive", DEVICE, today)).json()) as ArchiveResponse;
    expect(first.days).toHaveLength(28);
    expect(first.older).toBe(first.days.at(-1)!.date);
    const next = (await (await call(`/api/archive?before=${first.older}`, DEVICE, today)).json()) as ArchiveResponse;
    expect(next.days[0]!.date).toBe(addUtcDays(first.older!, -1));
    expect(next.days.at(-1)!.date).toBe(EPOCH);
    expect(next.older).toBeNull();
  });

  it("plays a past day against the players who had it live, and counts for nothing", async () => {
    const live = await playDaily(OTHER, DAY);
    let last: RoundGuessResponse | null = null;
    for (const question of spaceDay()) {
      const response = await call(`/api/archive/${DAY}/guess`, DEVICE, TODAY, { questionId: question.id, guess: correctGuess(question) });
      expect(response.status).toBe(200);
      last = (await response.json()) as RoundGuessResponse;
    }
    // Same answers as the one live player, so none of them is rare any more.
    expect(last!.result!.score).toBeLessThan(live.score);
    expect(last!.result!.hypothetical).toBe(true);
    expect(last!.result!.place).toMatchObject({ rank: 2, players: 2 });
    expect(last!.result!.shareText).toContain("Ballpark #8 · Archive");

    // Nothing reached the day's results, so the live player's board still has one player.
    const results = await env.DB.prepare("SELECT COUNT(*) AS n FROM daily_results WHERE device_id = ?").bind(DEVICE).first<{ n: number }>();
    expect(results?.n).toBe(0);
    const theirs = (await (await call("/api/puzzle", OTHER, DAY)).json()) as PuzzleResponse;
    expect(theirs.result?.place?.players).toBe(1);

    const list = (await (await call("/api/archive", DEVICE, TODAY)).json()) as ArchiveResponse;
    expect(list.days.find((day) => day.date === DAY)).toMatchObject({ played: "archive", answered: 7, score: last!.result!.score });
    const again = await call(`/api/archive/${DAY}/guess`, DEVICE, TODAY, { questionId: spaceDay()[0]!.id, guess: correctGuess(spaceDay()[0]!) });
    expect(again.status).toBe(409);
  });

  it("never replays a day you played live", async () => {
    await playDaily(DEVICE, DAY);
    const list = (await (await call("/api/archive", DEVICE, TODAY)).json()) as ArchiveResponse;
    expect(list.days.find((day) => day.date === DAY)).toMatchObject({ played: "daily", answered: 7 });
    const response = await call(`/api/archive/${DAY}`, DEVICE, TODAY);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "played_that_day" });
  });
});

describe("Unlimited", () => {
  const TODAY = addUtcDays(EPOCH, 40);

  it("is a Ballpark+ mode", async () => {
    const status = (await (await call("/api/unlimited", DEVICE, TODAY)).json()) as UnlimitedStatus;
    expect(status).toMatchObject({ plus: false, played: 0, best: null, open: null });
    expect((await call("/api/unlimited", DEVICE, TODAY, {})).status).toBe(402);
  });

  it("deals fresh questions, keeps an open round, and never shows today's or a day still to come", async () => {
    await unlock(DEVICE, TODAY);
    const todays = new Set(dayQuestions(TODAY).map((question) => question.id));
    const { id } = (await (await call("/api/unlimited", DEVICE, TODAY, {})).json()) as { id: string };
    // Starting again before finishing hands back the same round.
    expect(((await (await call("/api/unlimited", DEVICE, TODAY, {})).json()) as { id: string }).id).toBe(id);

    const round = (await (await call(`/api/unlimited/${id}`, DEVICE, TODAY)).json()) as RoundResponse;
    expect(round.round).toMatchObject({ kind: "unlimited", title: "Unlimited · Round 1", questions: 7, answered: 0 });
    expect(round.questions.some((question) => todays.has(question.id))).toBe(false);
    expect(JSON.stringify(round)).not.toContain("\"accepted\"");

    let last: RoundGuessResponse | null = null;
    for (const question of round.questions) {
      const seed = questions.find((item) => item.id === question.id)!;
      const response = await call(`/api/unlimited/${id}/guess`, DEVICE, TODAY, { questionId: question.id, guess: correctGuess(seed) });
      expect(response.status).toBe(200);
      last = (await response.json()) as RoundGuessResponse;
    }
    expect(last!.result!.place).toBeNull();
    expect(last!.result!.shareText).toContain("Ballpark+ · ♾️ Unlimited");

    const status = (await (await call("/api/unlimited", DEVICE, TODAY)).json()) as UnlimitedStatus;
    expect(status).toMatchObject({ plus: true, played: 1, best: last!.result!.score, open: null });
    const next = (await (await call("/api/unlimited", DEVICE, TODAY, {})).json()) as { id: string };
    expect(next.id).not.toBe(id);
    const second = (await (await call(`/api/unlimited/${next.id}`, DEVICE, TODAY)).json()) as RoundResponse;
    const firstIds = new Set(round.questions.map((question) => question.id));
    expect(second.questions.some((question) => firstIds.has(question.id))).toBe(false);
    expect(second.round.title).toBe("Unlimited · Round 2");

    // Early on, only the days that have run are in the pool.
    const early = addUtcDays(EPOCH, 3);
    const earlyStatus = (await (await call("/api/unlimited", OTHER, early)).json()) as UnlimitedStatus;
    expect(earlyStatus.pool).toBe(21);
    expect(status.pool).toBe(questions.filter((item) => puzzles.some((puzzle) => puzzle.questionIds.includes(item.id))).length - 7);
  });

  it("keeps rounds to the device that started them", async () => {
    await unlock(DEVICE, TODAY);
    await unlock(OTHER, TODAY);
    const { id } = (await (await call("/api/unlimited", DEVICE, TODAY, {})).json()) as { id: string };
    expect((await call(`/api/unlimited/${id}`, OTHER, TODAY)).status).toBe(404);
    expect((await call("/api/unlimited/not-a-round", DEVICE, TODAY)).status).toBe(404);
  });
});
