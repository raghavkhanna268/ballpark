import { exports } from "cloudflare:workers";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { assertSeed } from "../seed/content.ts";
import { resolvePlayDate } from "../src/play-date.ts";
import { HttpError } from "../src/http.ts";
import { correctGuess, resetAndSeed, spaceDay } from "./seed-db.ts";

const DEVICE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
// Day 8 is the first Space day: the fun week fills slots 0 to 6.
const DAY = "2026-01-08";

assertSeed();

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

function headers(deviceId: string): HeadersInit {
  return { "content-type": "application/json", "x-device-id": deviceId };
}

async function puzzle(deviceId = DEVICE, date = DAY) {
  return exports.default.fetch(`http://localhost/api/puzzle?date=${date}`, { headers: headers(deviceId) });
}

async function guess(deviceId: string, questionId: string, body: unknown, date = DAY) {
  return exports.default.fetch(`http://localhost/api/guess?date=${date}`, {
    method: "POST",
    headers: headers(deviceId),
    body: JSON.stringify({ questionId, guess: body }),
  });
}

describe("today's questions hide the answers", () => {
  it("omits values, context, and sources before a guess", async () => {
    const response = await puzzle();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      theme: string;
      questions: Array<{ type: string; reveal: unknown; items: Array<Record<string, unknown>> }>;
    };
    expect(body.theme).toBe("Space");
    expect(body.questions.map((question) => question.type)).toEqual(Array(7).fill("name_one"));
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("384400");
    expect(raw).not.toContain("299792458");
    expect(raw).not.toContain("NASA gives the Moon");
    expect(raw).not.toContain("Bharat");
    expect(raw).not.toContain("Congo-Kinshasa");
    expect(raw).not.toContain("\"accepted\"");
    expect(raw).not.toContain("Ganymede");
    expect(raw).not.toContain("Cassiopeia");
    const free = body.questions[0] as unknown as { suggestions?: string[] };
    expect(free.suggestions).toEqual([]);
    const named = body.questions.find((question) => (question as { suggestions?: string[] }).suggestions?.length) as { suggestions?: string[] };
    expect(named.suggestions).toContain("India");
    expect(named.suggestions).toContain("Iceland");
    expect(named.suggestions).not.toContain("Bharat");
    for (const question of body.questions) {
      expect(question.reveal).toBeNull();
      for (const item of question.items) {
        expect(item).not.toHaveProperty("value");
      }
    }
    const forbidden = ["values", "correctOrder", "context", "sourceUrl", "sourceName", "polarity", "factIds", "verified"];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          expect(forbidden).not.toContain(key);
          walk(value);
        }
      }
    };
    walk(body);
  });

  it("rejects a date override away from localhost", () => {
    expect(() => resolvePlayDate(new URL("http://example.com/api/puzzle?date=2026-01-01"), "true")).toThrow(HttpError);
    expect(() => resolvePlayDate(new URL("http://localhost/api/puzzle?date=2026-13-40"), "true")).toThrow(HttpError);
    expect(resolvePlayDate(new URL("http://localhost/api/puzzle?date=2026-01-12"), "true")).toEqual({
      date: "2026-01-12",
      devDate: true,
    });
  });
});

describe("submissions", () => {
  it("rejects a second submission for the same device, question, and day", async () => {
    const question = spaceDay()[0];
    const first = await guess(DEVICE, question.id, correctGuess(question));
    expect(first.status).toBe(200);
    const revealed = (await first.json()) as { reveal: { answerText: string; points: number; context: string; bonusPoints: number } };
    expect(revealed.reveal.answerText).toBe("Mercury");
    expect(revealed.reveal.context.length).toBeGreaterThan(20);
    expect(revealed.reveal.points).toBeGreaterThan(0);
    expect(revealed.reveal.bonusPoints).toBe(0);

    const second = await guess(DEVICE, question.id, { type: "name_one", text: "Mars" });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "already_submitted" });

    const stored = await env.DB.prepare("SELECT COUNT(*) AS count FROM submissions").first<{ count: number }>();
    expect(stored?.count).toBe(1);

    const other = await guess(OTHER, question.id, { type: "name_one", text: "Mars" });
    expect(other.status).toBe(200);
  });

  it("scores a full Classic round and reports a percentile for one player", async () => {
    type RoundResult = { score: number; beatPercent: number; players: number; shareText: string; emojis: string[]; place: unknown };
    let result: RoundResult | null = null;
    for (const question of spaceDay()) {
      const response = await guess(DEVICE, question.id, correctGuess(question));
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        reveal: { sourceUrl: string; crowd: { submissions: number } };
        result: RoundResult | null;
      };
      expect(body.reveal.sourceUrl.startsWith("https://")).toBe(true);
      expect(body.reveal.crowd.submissions).toBe(1);
      result = body.result;
    }
    expect(result).toMatchObject({ beatPercent: 100, players: 1, place: { rank: 1, players: 1, next: null } });
    // Every answer is right, so none is black. How many points each earns depends on its rarity tier.
    expect(result!.emojis).toHaveLength(7);
    expect(result!.emojis).not.toContain("⬛");
    expect(result!.score).toBeGreaterThanOrEqual(50);
    expect(result?.shareText).toContain("Ballpark #8 · Classic");
    expect(result?.shareText).toContain("🚀");
    expect(result?.shareText).toMatch(/🚀 [\d.,]+ (m|km)/);
    expect(result?.shareText).toContain("ballpark.local/?race=c8-");
    expect(result?.shareText).not.toContain("Mercury");

    const again = await puzzle();
    const replay = (await again.json()) as { result: { score: number }; questions: Array<{ reveal: { points: number } | null }> };
    expect(replay.result.score).toBe(result!.score);
    expect(replay.questions.every((question) => question.reveal !== null)).toBe(true);
  });

  it("pays more for a rare name than a common one, and lets an unlisted name try again", async () => {
    const named = spaceDay().find((question) => question.id === "q-space-year");
    if (!named) throw new Error("missing name_one");
    const rare = await guess(DEVICE, named.id, { type: "name_one", text: "Ethiopia" });
    const rareBody = (await rare.json()) as {
      reveal: {
        band: string;
        label: string;
        points: number;
        answerText: string;
        detail: string;
        crowd: {
          kind: string;
          percent: number;
          fromPrior: boolean;
          blendedPercent: number | null;
          rare: string[];
          top: { label: string; percent: number }[];
        };
      };
    };
    // Ethiopia's prior is under 1%, and nobody else has answered yet, so it is a Supernova.
    expect(rareBody.reveal.label).toBe("Supernova");
    expect(rareBody.reveal.points).toBe(100);
    expect(rareBody.reveal.answerText).toBe("Ethiopia");
    expect(rareBody.reveal.crowd.kind).toBe("named");
    expect(rareBody.reveal.crowd.rare.length).toBeGreaterThan(0);
    const ethiopia = rareBody.reveal.crowd.top.find((row) => row.label === "Ethiopia");
    expect(ethiopia?.percent).toBe(rareBody.reveal.crowd.percent);
    expect(rareBody.reveal.crowd.percent).toBe(100);
    expect(rareBody.reveal.detail).toContain("100% of players said Ethiopia");
    expect(rareBody.reveal.crowd.fromPrior).toBe(true);
    expect(rareBody.reveal.crowd.blendedPercent).toBeLessThan(100);

    const common = await guess(OTHER, named.id, { type: "name_one", text: "Bharat" });
    const commonBody = (await common.json()) as { reveal: { band: string; points: number; answerText: string } };
    expect(commonBody.reveal.answerText).toBe("India");
    expect(commonBody.reveal.points).toBeLessThan(rareBody.reveal.points);

    // A name that is not on the list is not stored: the player gets to try again while the clock runs.
    const stranger = "55555555-5555-4555-8555-555555555555";
    const invalid = await guess(stranger, named.id, { type: "name_one", text: "Iceland" });
    expect(invalid.status).toBe(422);
    expect(((await invalid.json()) as { error: string }).error).toBe("not_listed");
    const retry = await guess(stranger, named.id, { type: "name_one", text: "Nigeria" });
    expect(retry.status).toBe(200);
    expect(((await retry.json()) as { reveal: { points: number } }).reveal.points).toBeGreaterThan(0);

    // Running out of time still locks the question at 0.
    const late = await guess("77777777-7777-4777-8777-777777777777", named.id, { type: "name_one", text: "", timedOut: true });
    const lateBody = (await late.json()) as { reveal: { band: string; points: number } };
    expect(lateBody.reveal.points).toBe(0);
    expect(lateBody.reveal.band).toBe("black");

    // A near miss is not scored on its own: the listed spelling comes back to confirm, and nothing is stored yet.
    const speller = "66666666-6666-4666-8666-666666666666";
    const typo = await guess(speller, named.id, { type: "name_one", text: "Nigera" });
    expect(typo.status).toBe(422);
    expect(await typo.json()).toEqual({ error: "did_you_mean", suggestion: "Nigeria" });
    const half = await guess(speller, named.id, { type: "name_one", text: "Ethiop" });
    expect(await half.json()).toEqual({ error: "did_you_mean", suggestion: "Ethiopia" });
    const confirmed = await guess(speller, named.id, { type: "name_one", text: "Nigeria" });
    expect(confirmed.status).toBe(200);
    const typoReveal = ((await confirmed.json()) as { reveal: { answerText: string; points: number } }).reveal;
    expect(typoReveal.answerText).toBe("Nigeria");
    expect(typoReveal.points).toBeGreaterThan(0);
  });
});
