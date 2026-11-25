import {
  H2H_LEAGUE_POINTS,
  LEAGUES,
  LEAGUE_DEMOTION_MIN_GROUP,
  LEAGUE_GROUP_SIZE,
  LEAGUE_MOVE_DOWN,
  LEAGUE_MOVE_UP,
  addUtcDays,
  callsign,
  leagueName,
  nextTier,
  weekStart,
  type LeagueResponse,
  type LeagueStanding,
} from "@ballpark/shared";
import { leagueBots } from "./bots.js";

/**
 * Weekly leagues. A device joins the week's league the first time it finishes a game that week (Monday to
 * Sunday, UTC). Groups hold up to 30 players of the same rank, and 20 bots play in every group, so each table
 * is open from the first game. League points are Classic points plus 50 per right Head-to-head pick. Last week's
 * finish decides this week's league: top five up, bottom five down.
 */

type Member = { tier: number; grp: number; moved: number };
type Row = { device_id: string; points: number; bot: string | null };

export async function joinLeague(db: D1Database, deviceId: string, date: string): Promise<Member | null> {
  const week = weekStart(date);
  const existing = await memberFor(db, week, deviceId);
  if (existing) return existing;
  const played = await db
    .prepare("SELECT 1 AS hit FROM daily_results WHERE device_id = ? AND puzzle_date BETWEEN ? AND ? AND cruise = 0 LIMIT 1")
    .bind(deviceId, week, addUtcDays(week, 6))
    .first<{ hit: number }>();
  if (!played) return null;

  const previous = await db
    .prepare("SELECT week, tier, grp FROM league_members WHERE device_id = ? AND week < ? ORDER BY week DESC LIMIT 1")
    .bind(deviceId, week)
    .first<{ week: string; tier: number; grp: number }>();
  let tier = 0;
  let moved = 0;
  if (previous) {
    tier = previous.tier;
    if (previous.week === addUtcDays(week, -7)) {
      const table = await standings(db, previous.week, previous.tier, previous.grp, addUtcDays(previous.week, 6));
      const mine = table.find((row) => row.device_id === deviceId)?.points ?? 0;
      const rank = table.filter((row) => row.points > mine).length + 1;
      tier = nextTier(previous.tier, rank, table.length, mine);
      moved = Math.sign(tier - previous.tier);
    }
  }

  const groups = await db
    .prepare("SELECT grp, COUNT(*) AS size FROM league_members WHERE week = ? AND tier = ? GROUP BY grp ORDER BY grp")
    .bind(week, tier)
    .all<{ grp: number; size: number }>();
  const open = (groups.results ?? []).find((group) => group.size < LEAGUE_GROUP_SIZE);
  const grp = open ? open.grp : (groups.results ?? []).length;
  await db
    .prepare("INSERT OR IGNORE INTO league_members (week, device_id, tier, grp, moved, joined_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(week, deviceId, tier, grp, moved, new Date().toISOString())
    .run();
  return (await memberFor(db, week, deviceId)) ?? { tier, grp, moved };
}

export async function loadLeague(db: D1Database, deviceId: string, date: string): Promise<LeagueResponse> {
  const week = weekStart(date);
  const member = await joinLeague(db, deviceId, date);
  const base = {
    week,
    endsOn: addUtcDays(week, 6),
    moveUp: LEAGUE_MOVE_UP,
  };
  if (!member) {
    return { ...base, joined: false, tier: 0, name: leagueName(0), above: leagueName(1), moveDown: 0, players: 0, bots: 0, moved: null, you: null, standings: [] };
  }
  const table = await standings(db, week, member.tier, member.grp, date);
  const rows: LeagueStanding[] = table.map((row) => ({
    rank: table.filter((other) => other.points > row.points).length + 1,
    callsign: row.bot ?? callsign(row.device_id),
    points: row.points,
    you: row.device_id === deviceId,
    bot: row.bot !== null,
  }));
  const hadPrevious = await db
    .prepare("SELECT 1 AS hit FROM league_members WHERE device_id = ? AND week < ? LIMIT 1")
    .bind(deviceId, week)
    .first<{ hit: number }>();
  return {
    ...base,
    joined: true,
    tier: member.tier,
    name: leagueName(member.tier),
    above: member.tier < LEAGUES.length - 1 ? leagueName(member.tier + 1) : null,
    moveDown: member.tier > 0 && table.length >= LEAGUE_DEMOTION_MIN_GROUP ? LEAGUE_MOVE_DOWN : 0,
    players: table.length,
    bots: table.filter((row) => row.bot !== null).length,
    moved: hadPrevious ? (member.moved > 0 ? "up" : member.moved < 0 ? "down" : "same") : null,
    you: rows.find((row) => row.you) ?? null,
    standings: rows,
  };
}

async function memberFor(db: D1Database, week: string, deviceId: string): Promise<Member | null> {
  return db
    .prepare("SELECT tier, grp, moved FROM league_members WHERE week = ? AND device_id = ?")
    .bind(week, deviceId)
    .first<Member>();
}

/** A group's table for one week up to `through`, bots included, highest first. Players, then earlier joiners, break ties. */
async function standings(db: D1Database, week: string, tier: number, grp: number, through: string): Promise<Row[]> {
  const rows = await db
    .prepare(
      `SELECT m.device_id AS device_id,
              COALESCE(SUM(CASE WHEN r.mode = 'head-to-head' THEN r.score * ? ELSE r.score END), 0) AS points
       FROM league_members m
       LEFT JOIN daily_results r ON r.device_id = m.device_id AND r.puzzle_date BETWEEN ? AND ? AND r.cruise = 0
       WHERE m.week = ? AND m.tier = ? AND m.grp = ?
       GROUP BY m.device_id, m.joined_at
       ORDER BY points DESC, m.joined_at ASC`,
    )
    .bind(H2H_LEAGUE_POINTS, week, addUtcDays(week, 6), week, tier, grp)
    .all<{ device_id: string; points: number }>();
  const players: Row[] = (rows.results ?? []).map((row) => ({ ...row, bot: null }));
  const bots: Row[] = leagueBots(week, tier, grp, through).map((bot) => ({ device_id: bot.id, points: bot.points, bot: bot.name }));
  // A stable sort keeps players ahead of bots on the same points.
  return [...players, ...bots].sort((left, right) => right.points - left.points);
}
