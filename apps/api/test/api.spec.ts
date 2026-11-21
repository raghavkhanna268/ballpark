import { exports } from "cloudflare:workers";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { assertSeed } from "../seed/content.ts";
import { resolvePlayDate } from "../src/play-date.ts";
import { HttpError } from "../src/http.ts";
import { correctGuess, resetAndSeed, spaceDay } from "./seed-db.ts";

const DEVICE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DAY = "2026-01-01";

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
    expect(body.questions.map((question) => question.type)).toEqual(["estimate", "compare", "rank", "estimate", "compare"]);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("384400");
    expect(raw).not.toContain("299792458");
    expect(raw).not.toContain("NASA gives the Moon");
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
    const revealed = (await first.json()) as { reveal: { answerText: string; points: number; context: string } };
    expect(revealed.reveal.answerText).toContain("384,400");
    expect(revealed.reveal.context.length).toBeGreaterThan(20);
    expect(revealed.reveal.points).toBe(20);

    const second = await guess(DEVICE, question.id, { type: "estimate", value: 10, confidence: "wide" });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "already_submitted" });

    const stored = await env.DB.prepare("SELECT COUNT(*) AS count FROM submissions").first<{ count: number }>();
    expect(stored?.count).toBe(1);

    const other = await guess(OTHER, question.id, { type: "estimate", value: 10, confidence: "wide" });
    expect(other.status).toBe(200);
  });

  it("scores a full Classic round and reports a percentile for one player", async () => {
    type RoundResult = { score: number; beatPercent: number; players: number; shareText: string; emojis: string[] };
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
    expect(result).toMatchObject({
      score: 100,
      beatPercent: 100,
      players: 1,
      emojis: ["🟩", "🟩", "🟩", "🟩", "🟩"],
    });
    expect(result?.shareText).toBe("Ballpark #1 · Classic\n🟩🟩🟩🟩🟩 100/100\nballpark.local");

    const again = await puzzle();
    const replay = (await again.json()) as { result: { score: number }; questions: Array<{ reveal: { points: number } | null }> };
    expect(replay.result.score).toBe(100);
    expect(replay.questions.every((question) => question.reveal !== null)).toBe(true);
  });
});
