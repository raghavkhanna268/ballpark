import { advanceStreak, distributionBucket, liveStreak, shieldReady, utcToday, type Stats } from "@ballpark/shared";

const KEY = "ballpark.stats.v1";

/** `shieldWeek` is the league week whose streak shield is spent; `shieldedOn` is the last day a shield saved the streak. */
export type StoredStats = Stats & { completedDates: string[]; shieldWeek: string | null; shieldedOn: string | null };

/** One id per page load even when storage is blocked, so every request from this visit agrees. */
let visitId: string | null = null;

function empty(deviceId?: string): StoredStats {
  visitId ??= crypto.randomUUID();
  return {
    deviceId: deviceId ?? visitId,
    played: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
    distribution: [0, 0, 0, 0, 0],
    completedDates: [],
    shieldWeek: null,
    shieldedOn: null,
  };
}

/**
 * A new player's device id is saved straight away. Answers, the league and a Ballpark+ pass all hang off it,
 * so it must not change between the first request and the next.
 */
function saveFresh(deviceId?: string): StoredStats {
  const fresh = empty(deviceId);
  try {
    localStorage.setItem(KEY, JSON.stringify(fresh));
  } catch {
    // Storage is blocked. The id still holds for this visit.
  }
  return fresh;
}

export function loadStats(): StoredStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return saveFresh();
    const parsed = JSON.parse(raw) as Partial<StoredStats>;
    if (!parsed.deviceId || !Array.isArray(parsed.distribution) || parsed.distribution.length !== 5) {
      return saveFresh(parsed.deviceId);
    }
    return {
      deviceId: parsed.deviceId,
      played: parsed.played ?? 0,
      currentStreak: parsed.currentStreak ?? 0,
      maxStreak: parsed.maxStreak ?? 0,
      lastPlayedDate: parsed.lastPlayedDate ?? null,
      distribution: parsed.distribution as StoredStats["distribution"],
      completedDates: parsed.completedDates ?? [],
      shieldWeek: parsed.shieldWeek ?? null,
      shieldedOn: parsed.shieldedOn ?? null,
    };
  } catch {
    return empty();
  }
}

export function recordScore(date: string, score: number): StoredStats {
  const current = loadStats();
  if (current.completedDates.includes(date)) return current;
  const distribution = [...current.distribution] as StoredStats["distribution"];
  distribution[distributionBucket(score)] += 1;
  const streak = advanceStreak(current, date);
  const next: StoredStats = {
    ...current,
    played: current.played + 1,
    currentStreak: streak.currentStreak,
    maxStreak: Math.max(current.maxStreak, streak.currentStreak),
    lastPlayedDate: streak.lastPlayedDate,
    shieldWeek: streak.shieldWeek,
    shieldedOn: streak.shielded ? date : current.shieldedOn,
    distribution,
    completedDates: [...current.completedDates, date],
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

const H2H_KEY = "ballpark.h2h.stats.v1";

export type HeadToHeadStats = {
  played: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
  completedDates: string[];
  bestRun: number;
  shieldWeek: string | null;
  shieldedOn: string | null;
};

function emptyHead(): HeadToHeadStats {
  return { played: 0, currentStreak: 0, maxStreak: 0, lastPlayedDate: null, completedDates: [], bestRun: 0, shieldWeek: null, shieldedOn: null };
}

export function loadHeadToHeadStats(): HeadToHeadStats {
  try {
    const raw = localStorage.getItem(H2H_KEY);
    if (!raw) return emptyHead();
    const parsed = JSON.parse(raw) as Partial<HeadToHeadStats>;
    return {
      played: parsed.played ?? 0,
      currentStreak: parsed.currentStreak ?? 0,
      maxStreak: parsed.maxStreak ?? 0,
      lastPlayedDate: parsed.lastPlayedDate ?? null,
      completedDates: parsed.completedDates ?? [],
      bestRun: parsed.bestRun ?? 0,
      shieldWeek: parsed.shieldWeek ?? null,
      shieldedOn: parsed.shieldedOn ?? null,
    };
  } catch {
    return emptyHead();
  }
}

export function recordHeadToHead(date: string, score: number): HeadToHeadStats {
  const current = loadHeadToHeadStats();
  if (current.completedDates.includes(date)) return current;
  const streak = advanceStreak(current, date);
  const next: HeadToHeadStats = {
    played: current.played + 1,
    currentStreak: streak.currentStreak,
    maxStreak: Math.max(current.maxStreak, streak.currentStreak),
    lastPlayedDate: streak.lastPlayedDate,
    completedDates: [...current.completedDates, date],
    bestRun: Math.max(current.bestRun, score),
    shieldWeek: streak.shieldWeek,
    shieldedOn: streak.shielded ? date : current.shieldedOn,
  };
  localStorage.setItem(H2H_KEY, JSON.stringify(next));
  return next;
}

/** The streak line for a mode on `today`: the streak as it stands, and the shield's state this week. */
export function streakStatus(
  stats: { currentStreak: number; lastPlayedDate: string | null; shieldWeek: string | null; shieldedOn: string | null },
  today: string = utcToday(),
): { streak: number; shield: "ready" | "used" | "saved"; savedToday: boolean } {
  const streak = liveStreak(stats, today);
  const savedToday = stats.shieldedOn === today;
  const shield = savedToday ? "saved" : shieldReady(stats, today) ? "ready" : "used";
  return { streak, shield, savedToday };
}
