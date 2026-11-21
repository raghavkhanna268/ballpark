import { addUtcDays, distributionBucket, type Stats } from "@ballpark/shared";

const KEY = "ballpark.stats.v1";

export type StoredStats = Stats & { completedDates: string[] };

function empty(): StoredStats {
  return {
    deviceId: crypto.randomUUID(),
    played: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
    distribution: [0, 0, 0, 0, 0],
    completedDates: [],
  };
}

export function loadStats(): StoredStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<StoredStats>;
    if (!parsed.deviceId || !Array.isArray(parsed.distribution) || parsed.distribution.length !== 5) {
      return empty();
    }
    return {
      deviceId: parsed.deviceId,
      played: parsed.played ?? 0,
      currentStreak: parsed.currentStreak ?? 0,
      maxStreak: parsed.maxStreak ?? 0,
      lastPlayedDate: parsed.lastPlayedDate ?? null,
      distribution: parsed.distribution as StoredStats["distribution"],
      completedDates: parsed.completedDates ?? [],
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
  let currentStreak = current.currentStreak;
  let lastPlayedDate = current.lastPlayedDate;
  if (!current.lastPlayedDate || date > current.lastPlayedDate) {
    currentStreak = current.lastPlayedDate && addUtcDays(current.lastPlayedDate, 1) === date ? current.currentStreak + 1 : 1;
    lastPlayedDate = date;
  }
  const next: StoredStats = {
    ...current,
    played: current.played + 1,
    currentStreak,
    maxStreak: Math.max(current.maxStreak, currentStreak),
    lastPlayedDate,
    distribution,
    completedDates: [...current.completedDates, date],
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
