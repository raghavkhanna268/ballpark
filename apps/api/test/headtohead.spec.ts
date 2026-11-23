import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { buildHeadToHeadSequence, puzzleSlot, toPublicRound, type H2HFact } from "@ballpark/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { facts, puzzles, questions } from "../seed/content.ts";
import { resetAndSeed } from "./seed-db.ts";

const DEVICE = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const DAY = "2026-01-01";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

function headers(deviceId: string): HeadersInit {
  return { "content-type": "application/json", "x-device-id": deviceId };
}

function h2hFacts(): H2HFact[] {
  return facts
    .filter((item) => item.metric && item.metric !== "unpaired")
    .map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      unit: item.unit,
      metric: item.metric,
      context: item.context,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
    }));
}

function expectedSequence(date: string) {
  const slot = puzzleSlot(date);
  const puzzle = puzzles.find((item) => item.slot === slot);
  const exclude = (puzzle?.questionIds ?? []).flatMap((id) => questions.find((item) => item.id === id)?.factIds ?? []);
  return buildHeadToHeadSequence(h2hFacts(), `head-to-head:${date}`, exclude);
}

async function state(deviceId = DEVICE, date = DAY) {
  return exports.default.fetch(`http://localhost/api/head-to-head?date=${date}`, { headers: headers(deviceId) });
}

async function pick(deviceId: string, body: unknown, date = DAY) {
  return exports.default.fetch(`http://localhost/api/head-to-head/pick?date=${date}`, {
    method: "POST",
    headers: headers(deviceId),
    body: JSON.stringify(body),
  });
}

describe("head-to-head API", () => {
  it("serves today's pair without the hidden values", async () => {
    const sequence = expectedSequence(DAY);
    const opening = sequence[0];
    expect(opening.kind).toBe("which");
    const response = await state();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { round: unknown; status: string };
    expect(body.status).toBe("ready");
    expect(body.round).toEqual(toPublicRound(opening));
    const raw = JSON.stringify(body);
    for (const item of opening.items) {
      expect(raw).not.toContain(String(item.value));
      expect(raw).not.toContain(item.context);
      expect(raw).not.toContain(item.sourceUrl);
    }
  });

  it("rejects a skipped or replayed index and a second scored run", async () => {
    const sequence = expectedSequence(DAY);
    const skipped = await pick(DEVICE, { index: 2, choiceId: sequence[2].answer });
    expect(skipped.status).toBe(409);
    expect(await skipped.json()).toEqual({ error: "out_of_order" });

    const first = await pick(DEVICE, { index: 0, choiceId: sequence[0].answer });
    expect(first.status).toBe(200);
    const opened = (await first.json()) as { correct: boolean; reveal: { sourceUrl: string; context: string }; next: { index: number } };
    expect(opened.correct).toBe(true);
    expect(opened.reveal.sourceUrl.startsWith("https://")).toBe(true);
    expect(opened.reveal.context.length).toBeGreaterThan(10);
    expect(opened.next.index).toBe(1);

    const replay = await pick(DEVICE, { index: 0, choiceId: sequence[0].answer });
    expect(replay.status).toBe(409);

    const leap = await pick(DEVICE, { index: 3, choiceId: sequence[3].answer });
    expect(leap.status).toBe(409);

    const wrongId = sequence[1].items.find((item) => item.id !== sequence[1].answer)?.id ?? "missing";
    const miss = await pick(DEVICE, sequence[1].kind === "higher-lower" ? { index: 1, direction: sequence[1].answer === "higher" ? "lower" : "higher" } : { index: 1, choiceId: wrongId });
    expect(miss.status).toBe(200);
    const missed = (await miss.json()) as { correct: boolean; finished: boolean; next: { index: number } | null };
    expect(missed.correct).toBe(false);
    expect(missed.finished).toBe(false);
    expect(missed.next?.index).toBe(2);

    for (const round of sequence.slice(2)) {
      const response = await answerRound(DEVICE, round, false);
      expect(response.status).toBe(200);
    }
    const done = await state();
    const ended = (await done.json()) as { status: string; result: { official: boolean; score: number; beatPercent: number; shareText: string; marks: string } };
    expect(ended.status).toBe("finished");
    expect(ended.result.official).toBe(true);
    expect(ended.result.score).toBe(1);
    expect(ended.result.marks.match(/🟩|🟥/g)).toHaveLength(10);
    expect(ended.result.shareText).toContain("1/10");
    expect(ended.result.shareText).toContain("🟥");
    expect(ended.result.shareText).toContain("?race=h1-");

    const league = await exports.default.fetch(`http://localhost/api/league?date=${DAY}`, { headers: headers(DEVICE) });
    const table = (await league.json()) as { joined: boolean; name: string; open: boolean; players: number; you: { rank: number; points: number } | null; standings: unknown[] };
    expect(table.joined).toBe(true);
    expect(table.name).toBe("Cadet league");
    expect(table.you).toMatchObject({ rank: 1, points: 50 });
    // One player is too few to compare: the table stays hidden.
    expect(table.open).toBe(false);
    expect(table.players).toBe(1);
    expect(table.standings).toHaveLength(0);

    const again = await pick(DEVICE, { index: 2, choiceId: sequence[2].answer });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "run_finished" });

    const rows = await env.DB.prepare("SELECT COUNT(*) AS count FROM daily_results WHERE mode = 'head-to-head'").first<{ count: number }>();
    expect(rows?.count).toBe(1);

    const other = await state(OTHER);
    expect(other.status).toBe(200);
    expect(((await other.json()) as { status: string }).status).toBe("ready");
  });

  it("keeps practice off the board", async () => {
    const sequence = expectedSequence(DAY);
    for (const round of sequence) {
      expect((await answerRound(DEVICE, round, true)).status).toBe(200);
    }
    const before = await env.DB.prepare("SELECT COUNT(*) AS count FROM daily_results WHERE mode = 'head-to-head'").first<{ count: number }>();
    const practice = await exports.default.fetch(`http://localhost/api/head-to-head/practice?date=${DAY}`, {
      method: "POST",
      headers: headers(DEVICE),
      body: "{}",
    });
    expect(practice.status).toBe(200);
    const after = await env.DB.prepare("SELECT COUNT(*) AS count FROM daily_results WHERE mode = 'head-to-head'").first<{ count: number }>();
    expect(after?.count).toBe(before?.count);
    const round = ((await practice.json()) as { round: { index: number } }).round;
    expect(round.index).toBe(0);
    expect(JSON.stringify(round)).not.toContain(sequence[0].items[0].context);
  });

  it("ranks by correct answers and treats equal scores as ties", async () => {
    const now = new Date().toISOString();
    await insertResult(DEVICE, 8, now);
    await insertResult(OTHER, 8, now);
    const left = (await (await state(DEVICE)).json()) as { result: { beatPercent: number; score: number } };
    const right = (await (await state(OTHER)).json()) as { result: { beatPercent: number; score: number } };
    expect(left.result.score).toBe(8);
    expect(left.result.beatPercent).toBe(0);
    expect(right.result.beatPercent).toBe(0);
  });
});

async function insertResult(deviceId: string, score: number, now: string) {
  await env.DB.prepare(
    `INSERT INTO h2h_runs (id, device_id, puzzle_date, kind, attempt, next_index, correct_count, finished, points, created_at)
     VALUES (?, ?, ?, 'scored', 1, 10, ?, 1, ?, ?)`,
  )
    .bind(crypto.randomUUID(), deviceId, DAY, score, score, now)
    .run();
  await env.DB.prepare(
    `INSERT INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at)
     VALUES (?, ?, 'head-to-head', ?, ?, '[]', 1, ?)`,
  )
    .bind(deviceId, DAY, score, score, now)
    .run();
}

async function answerRound(deviceId: string, round: { index: number; kind: string; answer: string; items: { id: string }[] }, correct: boolean) {
  if (round.kind === "higher-lower") {
    const direction = correct ? round.answer : round.answer === "higher" ? "lower" : "higher";
    return pick(deviceId, { index: round.index, direction });
  }
  const choiceId = correct ? round.answer : round.items.find((item) => item.id !== round.answer)?.id;
  return pick(deviceId, { index: round.index, choiceId });
}

describe("weekly league", () => {
  it("moves last week's top five up a league once the group had 20 players", async () => {
    const at = new Date().toISOString();
    const others = Array.from({ length: 19 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO league_members (week, device_id, tier, grp, moved, joined_at) VALUES ('2025-12-22', ?, 0, 0, 0, ?)").bind(DEVICE, at),
      ...others.map((device) => env.DB.prepare("INSERT INTO league_members (week, device_id, tier, grp, moved, joined_at) VALUES ('2025-12-22', ?, 0, 0, 0, ?)").bind(device, at)),
      env.DB.prepare("INSERT INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at) VALUES (?, '2025-12-24', 'classic', 300, 300, '[]', 1, ?)").bind(DEVICE, at),
      env.DB.prepare("INSERT INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at) VALUES (?, ?, 'classic', 120, 120, '[]', 0, ?)").bind(DEVICE, DAY, at),
    ]);
    const before = await exports.default.fetch(`http://localhost/api/league?date=${DAY}`, { headers: headers(OTHER) });
    expect(((await before.json()) as { joined: boolean }).joined).toBe(false);
    const response = await exports.default.fetch(`http://localhost/api/league?date=${DAY}`, { headers: headers(DEVICE) });
    const table = (await response.json()) as { week: string; tier: number; name: string; moved: string; you: { points: number } };
    expect(table.week).toBe("2025-12-29");
    expect(table.tier).toBe(1);
    expect(table.name).toBe("Pilot league");
    expect(table.moved).toBe("up");
    expect(table.you.points).toBe(120);
  });

  it("moves nobody when last week's group was under 20 players", async () => {
    const at = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO league_members (week, device_id, tier, grp, moved, joined_at) VALUES ('2025-12-22', ?, 0, 0, 0, ?)").bind(DEVICE, at),
      env.DB.prepare("INSERT INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at) VALUES (?, '2025-12-24', 'classic', 300, 300, '[]', 1, ?)").bind(DEVICE, at),
      env.DB.prepare("INSERT INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at) VALUES (?, ?, 'classic', 120, 120, '[]', 0, ?)").bind(DEVICE, DAY, at),
    ]);
    const response = await exports.default.fetch(`http://localhost/api/league?date=${DAY}`, { headers: headers(DEVICE) });
    const table = (await response.json()) as { tier: number; moved: string; open: boolean };
    expect(table.tier).toBe(0);
    expect(table.moved).toBe("same");
    expect(table.open).toBe(false);
  });
});
