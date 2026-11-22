/** Puzzle #1 is this UTC date. Later days count forward from here. */
export const DEFAULT_EPOCH = "2026-01-01";

/** Sample seed length. Every UTC date maps onto one of these slots until a real calendar replaces it. */
export const SEED_SLOTS = 10;

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

export function puzzleNumber(date: string, epoch: string = DEFAULT_EPOCH): number {
  if (!isIsoDate(date) || !isIsoDate(epoch)) {
    throw new Error("Invalid puzzle date");
  }
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${epoch}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export function puzzleSlot(date: string, epoch: string = DEFAULT_EPOCH): number {
  const number = puzzleNumber(date, epoch);
  return ((number - 1) % SEED_SLOTS + SEED_SLOTS) % SEED_SLOTS;
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

/** Classic scores run 0 to 500 (five answers at up to 100), so each bucket is 100 points wide. */
export function distributionBucket(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 100) return 0;
  if (score <= 200) return 1;
  if (score <= 300) return 2;
  if (score <= 400) return 3;
  return 4;
}
