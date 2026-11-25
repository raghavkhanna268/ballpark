import { addUtcDays } from "./dates.js";

/* ---------- rank after every game ---------- */

export type Placement = {
  /** 1 is the top. Players on the same score share a rank. */
  rank: number;
  /** Everyone ranked, bots included. */
  players: number;
  /** How many of `players` are bots. */
  bots: number;
  /** The next rank up and how many points it is ahead, or null when you are at the top. */
  next: { rank: number; gap: number } | null;
};

/** Where `mine` sits among today's finished scores (`all` includes `mine`, and `bots` of them are bots). */
export function placement(mine: number, all: number[], bots = 0): Placement {
  const scores = all.length === 0 ? [mine] : all;
  const above = scores.filter((score) => score > mine);
  const rank = above.length + 1;
  if (above.length === 0) return { rank, players: scores.length, bots, next: null };
  const nextScore = Math.min(...above);
  const nextRank = scores.filter((score) => score > nextScore).length + 1;
  return { rank, players: scores.length, bots, next: { rank: nextRank, gap: nextScore - mine } };
}

/* ---------- race a friend ---------- */

export type RaceMode = "classic" | "h2h";
/** `skin` is the rocket paint job the friend flew, from the Hangar, so their ghost looks like their rocket. */
export type Race = { mode: RaceMode; puzzleNumber: number; progress: number; skin?: string };

/** "c326-735": Classic puzzle #326, climbed 7.35 stops; "c326-735.gold" in the gold paint job. Carries no answers. */
export function raceCode(mode: RaceMode, puzzleNumber: number, progress: number, skin?: string | null): string {
  const height = Math.max(0, Math.min(1200, Math.round(progress * 100)));
  const paint = skin && SKIN_CODE.test(skin) ? `.${skin}` : "";
  return `${mode === "classic" ? "c" : "h"}${puzzleNumber}-${height}${paint}`;
}

const SKIN_CODE = /^[a-z0-9]{1,12}$/;

export function parseRace(code: string | null | undefined): Race | null {
  if (!code) return null;
  const match = /^([ch])(\d{1,6})-(\d{1,4})(?:\.([a-z0-9]{1,12}))?$/.exec(code.trim());
  if (!match) return null;
  const progress = Number(match[3]) / 100;
  if (progress > 12) return null;
  const race: Race = { mode: match[1] === "c" ? "classic" : "h2h", puzzleNumber: Number(match[2]), progress };
  if (match[4]) race.skin = match[4];
  return race;
}

export function raceUrl(host: string, code: string): string {
  return `${host}/?race=${code}`;
}

/* ---------- weekly league ---------- */

/** Astronaut ranks, lowest first. Everyone starts as a Cadet. */
export const LEAGUES = ["Cadet", "Pilot", "Navigator", "Commander", "Captain"] as const;
export const LEAGUE_GROUP_SIZE = 30;
/** The top five of a group move up a league at the end of the week. */
export const LEAGUE_MOVE_UP = 5;
/** The bottom five move down, but only in a group big enough that the two zones never touch. */
export const LEAGUE_MOVE_DOWN = 5;
export const LEAGUE_DEMOTION_MIN_GROUP = 15;
/** A right Head-to-head pick is worth this many league points, so a perfect run (500) matches a perfect Classic day. */
export const H2H_LEAGUE_POINTS = 50;

/** Monday of the UTC week that `date` falls in. League weeks run Monday to Sunday. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const sinceMonday = (day + 6) % 7;
  return addUtcDays(date, -sinceMonday);
}

export function weekEnd(date: string): string {
  return addUtcDays(weekStart(date), 6);
}

export function leagueName(tier: number): string {
  return `${LEAGUES[Math.max(0, Math.min(LEAGUES.length - 1, tier))]} league`;
}

/** Next week's tier for someone who finished `rank` of `size` with `points` this week. */
export function nextTier(tier: number, rank: number, size: number, points: number): number {
  if (points > 0 && rank <= LEAGUE_MOVE_UP) return Math.min(LEAGUES.length - 1, tier + 1);
  if (size >= LEAGUE_DEMOTION_MIN_GROUP && rank > size - LEAGUE_MOVE_DOWN) return Math.max(0, tier - 1);
  return tier;
}

const CALL_FIRST = ["Swift", "Silent", "Bright", "Bold", "Lucky", "Cosmic", "Solar", "Lunar", "Stellar", "Rapid", "Quiet", "Brave", "Polar", "Golden", "Iron", "Neon"];
const CALL_SECOND = ["Comet", "Nova", "Pulsar", "Quasar", "Rocket", "Meteor", "Nebula", "Photon", "Falcon", "Voyager", "Rover", "Orbiter", "Lander", "Probe", "Shuttle", "Star"];

/** A stable, anonymous name for a player, so a league table has names without accounts. */
export function callsign(seed: string): string {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const first = CALL_FIRST[hash % CALL_FIRST.length]!;
  const second = CALL_SECOND[(hash >>> 8) % CALL_SECOND.length]!;
  const number = ((hash >>> 16) % 90) + 10;
  return `${first} ${second} ${number}`;
}

/** One row of a league table. `bot` marks a bot rival, shown as one and never counted as a person. */
export type LeagueStanding = { rank: number; callsign: string; points: number; you: boolean; bot: boolean };

export type LeagueResponse = {
  /** Monday and Sunday of this league week. */
  week: string;
  endsOn: string;
  /** False until you finish a game this week. */
  joined: boolean;
  tier: number;
  name: string;
  /** The league above, or null at the top. */
  above: string | null;
  moveUp: number;
  /** 0 when this group is too small to send anyone down. */
  moveDown: number;
  /** Everyone in your group this week, bots included. */
  players: number;
  /** How many of `players` are bots. */
  bots: number;
  /** Where last week sent you: up a league, down one, or the same. Null on your first week. */
  moved: "up" | "down" | "same" | null;
  you: LeagueStanding | null;
  standings: LeagueStanding[];
};

/* ---------- streak shield ---------- */

export type StreakState = { currentStreak: number; lastPlayedDate: string | null; shieldWeek: string | null };

/**
 * Today's streak after playing on `date`. Missing exactly one day keeps the streak alive once per league
 * week (the week of the missed day): the shield. Missing more breaks it.
 */
export function advanceStreak(state: StreakState, date: string): StreakState & { shielded: boolean } {
  const last = state.lastPlayedDate;
  if (last && date <= last) return { ...state, shielded: false };
  if (last && addUtcDays(last, 1) === date) return { ...state, currentStreak: state.currentStreak + 1, lastPlayedDate: date, shielded: false };
  if (last && addUtcDays(last, 2) === date && state.currentStreak > 0) {
    const missedWeek = weekStart(addUtcDays(last, 1));
    if (state.shieldWeek !== missedWeek) {
      return { currentStreak: state.currentStreak + 1, lastPlayedDate: date, shieldWeek: missedWeek, shielded: true };
    }
  }
  return { ...state, currentStreak: 1, lastPlayedDate: date, shielded: false };
}

/** Whether a shield is still free for a day missed in the week of `date`. */
export function shieldReady(state: StreakState, date: string): boolean {
  return state.shieldWeek !== weekStart(date);
}

/** The streak as it stands on `today`, before playing: it survives one missed day if the shield is free. */
export function liveStreak(state: StreakState, today: string): number {
  const last = state.lastPlayedDate;
  if (!last) return 0;
  if (last >= addUtcDays(today, -1)) return state.currentStreak;
  if (addUtcDays(last, 2) === today && shieldReady(state, addUtcDays(last, 1))) return state.currentStreak;
  return 0;
}
