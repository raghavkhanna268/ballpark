import { AFTERBURNER, addUtcDays, nameTier, priorShare } from "@ballpark/shared";
import type { PlayQuestion } from "./classic-score.js";

/*
 * Bot rivals. A crew of bots plays every day, every pack chapter and every past day, so a player has a rank,
 * a board, a curve and a league table from their very first game, instead of waiting for other people.
 *
 * Bots are always shown as bots: a 🤖 and a bot name on every board and table, and counted apart from people
 * wherever a number of players is shown. Their answers never touch the rarity of real answers. Each bot picks a
 * listed answer by its prior, some going with the crowd and some hunting rare ones, and scores it by the tier
 * that prior falls in. Everything is worked out from a seed, so a bot's run is the same on every request and
 * nothing is stored.
 */

export type CrewBot = {
  id: string;
  name: string;
  /** How a bot weighs a listed answer's prior: 1.6 goes with the crowd, 0 picks any answer, below 0 hunts rare ones. */
  lean: number;
  /** The chance of missing a stage: not on the list, or out of time. */
  miss: number;
  /** The chance of playing on a given day or chapter. */
  turnout: number;
};

const NAMES = ["Sprocket", "Gizmo", "Pixel", "Servo", "Rivet", "Widget", "Dynamo", "Tinker", "Piston", "Ratchet", "Volt", "Turbo", "Bleep", "Chip", "Flux", "Nano", "Spark", "Zippy", "Echo", "Axle", "Cog", "Bolt", "Gadget", "Byte"];

/** The crew, from crowd followers to rare-answer hunters, with steadier and shakier players at every lean. */
export const CREW: CrewBot[] = NAMES.map((name, index) => ({
  id: `bot:${name.toLowerCase()}`,
  name,
  lean: Math.round((1.6 - (index % 8) * 0.3) * 100) / 100,
  miss: 0.04 + ((index * 7) % 6) * 0.04,
  turnout: 0.75 + ((index * 5) % 6) * 0.05,
}));

export type BotRun = {
  id: string;
  name: string;
  /** Points per question, in question order, before the Afterburner. */
  points: number[];
  /** The question the bot doubled with an Afterburner, or null. */
  boosted: number | null;
  score: number;
};

/**
 * The bots that played one set of questions, identified by `seed` (a date, or a pack chapter's key). A past day
 * replays with the same seed, so its bots match the ones on that day's board.
 */
export function crewRuns(seed: string, questions: PlayQuestion[], options: { afterburner: boolean }): BotRun[] {
  const runs: BotRun[] = [];
  for (const bot of CREW) {
    const random = seeded(`${seed}|${bot.id}`);
    if (random() > bot.turnout) continue;
    const points = questions.map((question) => botStage(question, bot, random));
    const boosted = options.afterburner && questions.length > 0 && random() < 0.6 ? Math.floor(random() * questions.length) : null;
    const score = points.reduce((sum, value, index) => sum + (index === boosted ? value * AFTERBURNER : value), 0);
    runs.push({ id: bot.id, name: bot.name, points, boosted, score });
  }
  return runs;
}

function botStage(question: PlayQuestion, bot: CrewBot, random: () => number): number {
  if (random() < bot.miss) return 0;
  const accepted = question.accepted ?? [];
  if (question.type !== "name_one" || accepted.length === 0) return [0, 10, 20][Math.floor(random() * 3)]!;
  const weights = accepted.map((item) => Math.max(0.2, item.prior) ** bot.lean);
  const total = weights.reduce((sum, value) => sum + value, 0);
  let pick = random() * total;
  let index = 0;
  while (index < weights.length - 1 && pick >= weights[index]!) {
    pick -= weights[index]!;
    index += 1;
  }
  return nameTier(priorShare(accepted[index]!, accepted)).points;
}

/** Bots in every league group, whatever its size, so each table is open from the first game. */
export const LEAGUE_BOTS = 20;

/**
 * A league group's bots and their points from Monday through `through`. Bots in higher leagues score more, and
 * each has its own form, so the top five takes a good week to reach.
 */
export function leagueBots(week: string, tier: number, grp: number, through: string): Array<{ id: string; name: string; points: number }> {
  const group = `league|${week}|${tier}|${grp}`;
  const offset = Math.floor(seeded(group)() * NAMES.length);
  const bots = [];
  for (let index = 0; index < LEAGUE_BOTS; index += 1) {
    const name = NAMES[(offset + index) % NAMES.length]!;
    const skill = 0.55 + seeded(`${group}|${index}`)() * 0.75;
    let points = 0;
    for (let day = 0; day < 7; day += 1) {
      const date = addUtcDays(week, day);
      if (date > through) break;
      const random = seeded(`${group}|${index}|${date}`);
      if (random() > 0.85) continue;
      // Roughly normal around the bot's form: the sum of three draws.
      const spread = (random() + random() + random() - 1.5) * 2;
      const mean = (190 + 35 * tier) * skill;
      points += Math.round(Math.max(20, Math.min(760, mean + spread * 70)) / 5) * 5;
    }
    bots.push({ id: `bot:${name.toLowerCase()}`, name, points });
  }
  return bots;
}

/** A repeatable stream of numbers in [0, 1) from a string. */
export function seeded(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
