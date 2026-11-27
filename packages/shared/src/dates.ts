/** Puzzle #1 is this date. Later days count forward from here. */
export const DEFAULT_EPOCH = "2026-01-01";

/** The first 17 days. Until NEW_DAYS_FROM they were the whole rotation, and dates before it keep that cycle. */
export const LEGACY_SLOTS = 17;

/** Every daily slot. Slots from LEGACY_SLOTS up are the days added later. */
export const SEED_SLOTS = 31;

/**
 * The first date that plays the added days. Each date before it keeps the 17-day cycle it was played with, so past
 * results, the archive and recounts still match their questions. It must stay after the deploy that adds the days.
 */
export const NEW_DAYS_FROM = "2026-12-01";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return false;
  return new Date(time).toISOString().slice(0, 10) === value;
}

export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The game's day turns over at midnight India time (UTC+5:30), for everyone. Most players are in India, so a late
 * evening there is still today's puzzle, and the new one arrives at midnight instead of 5:30 in the morning.
 */
export const DAY_OFFSET_MINUTES = 330;

/** Today's game date: the calendar date in India time. */
export function playToday(now: Date = new Date()): string {
  return new Date(now.getTime() + DAY_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/** The moment the next game day starts: the next midnight India time. */
export function nextDayStart(now: Date = new Date()): Date {
  const offset = DAY_OFFSET_MINUTES * 60_000;
  const dayStart = Math.floor((now.getTime() + offset) / 86_400_000) * 86_400_000;
  return new Date(dayStart + 86_400_000 - offset);
}

export function puzzleNumber(date: string, epoch: string = DEFAULT_EPOCH): number {
  if (!isIsoDate(date) || !isIsoDate(epoch)) {
    throw new Error("Invalid puzzle date");
  }
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${epoch}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** The seed slot a date plays: the 17-day cycle before NEW_DAYS_FROM, then the added days, then every slot in turn. */
export function puzzleSlot(date: string, epoch: string = DEFAULT_EPOCH): number {
  const number = puzzleNumber(date, epoch);
  const switchNumber = puzzleNumber(NEW_DAYS_FROM, epoch);
  if (number < switchNumber) return modulo(number - 1, LEGACY_SLOTS);
  return modulo(LEGACY_SLOTS + number - switchNumber, SEED_SLOTS);
}

/** The puzzle number of the first date that plays a slot. */
export function firstPlayOf(slot: number, epoch: string = DEFAULT_EPOCH): number {
  return slot < LEGACY_SLOTS ? slot + 1 : puzzleNumber(NEW_DAYS_FROM, epoch) + slot - LEGACY_SLOTS;
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export function addUtcDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Share of other finishers with a strictly lower score.
 * A single finisher has beaten everyone else who played, so the result is 100.
 * Ties are not counted as beaten.
 */
export function beatPercent(myScore: number, allScores: number[]): number {
  if (allScores.length <= 1) return 100;
  const lower = allScores.filter((score) => score < myScore).length;
  return Math.round((100 * lower) / (allScores.length - 1));
}

/** Classic scores run 0 to 700 (seven answers at up to 100), so each of the five buckets is 140 points wide. */
export function distributionBucket(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 140) return 0;
  if (score <= 280) return 1;
  if (score <= 420) return 2;
  if (score <= 560) return 3;
  return 4;
}
