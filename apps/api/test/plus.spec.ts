import { exports } from "cloudflare:workers";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { PackGuessResponse, PackResponse, PackSummary, PlusStatus } from "@ballpark/shared";
import { packs, questions } from "../seed/content.ts";
import { hmacHex } from "../src/plus.ts";
import { correctGuess, resetAndSeed } from "./seed-db.ts";

const DEVICE = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const SECRET = "local-test-secret";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

function call(path: string, deviceId = DEVICE, body?: unknown, host = "http://localhost") {
  return exports.default.fetch(`${host}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function addOrder(orderId: string, deviceId = DEVICE, plan = "month") {
  await env.DB.prepare(
    "INSERT INTO plus_orders (order_id, device_id, plan, amount, currency, status, created_at) VALUES (?, ?, ?, 9900, 'INR', 'created', ?)",
  )
    .bind(orderId, deviceId, plan, new Date().toISOString())
    .run();
}

const cricket = packs.find((item) => item.id === "cricket")!;
const cricketQuestions = cricket.questionIds.map((id) => questions.find((item) => item.id === id)!);

describe("Ballpark+ passes", () => {
  it("starts free, with placeholder prices and Razorpay's public key only", async () => {
    const response = await call("/api/plus");
    expect(response.status).toBe(200);
    const body = (await response.json()) as PlusStatus;
    expect(body.plus).toBe(false);
    expect(body.prices.map((item) => item.plan)).toEqual(["month", "year"]);
    expect(body.razorpayKeyId).toBe("rzp_test_local");
    expect(body.testUnlock).toBe(true);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("refuses the test unlock away from a local address", async () => {
    const response = await call("/api/plus/test-unlock", DEVICE, { plan: "month" }, "http://ballpark.example");
    expect(response.status).toBe(403);
    expect((await call("/api/plus")).status).toBe(200);
    expect(((await (await call("/api/plus")).json()) as PlusStatus).plus).toBe(false);
  });

  it("grants a pass only for a correctly signed payment on this device's own order", async () => {
    await addOrder("order_test_1");
    const forged = await call("/api/plus/verify", DEVICE, { orderId: "order_test_1", paymentId: "pay_1", signature: "0".repeat(64) });
    expect(forged.status).toBe(400);
    expect(((await forged.json()) as { error: string }).error).toBe("invalid_signature");

    const signature = await hmacHex(SECRET, "order_test_1|pay_1");
    const stranger = await call("/api/plus/verify", OTHER, { orderId: "order_test_1", paymentId: "pay_1", signature });
    expect(stranger.status).toBe(404);

    const paid = await call("/api/plus/verify", DEVICE, { orderId: "order_test_1", paymentId: "pay_1", signature });
    expect(paid.status).toBe(200);
    const status = (await paid.json()) as PlusStatus;
    expect(status.plus).toBe(true);
    expect(status.plan).toBe("month");
    const days = (Date.parse(status.expiresAt!) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);

    // Confirming the same payment again changes nothing.
    const again = await call("/api/plus/verify", DEVICE, { orderId: "order_test_1", paymentId: "pay_1", signature });
    expect(((await again.json()) as PlusStatus).expiresAt).toBe(status.expiresAt);
    // A second payment id cannot reuse a paid order.
    const reuse = await call("/api/plus/verify", DEVICE, {
      orderId: "order_test_1",
      paymentId: "pay_2",
      signature: await hmacHex(SECRET, "order_test_1|pay_2"),
    });
    expect(reuse.status).toBe(409);
  });

  it("adds a renewal on top of the days left", async () => {
    await call("/api/plus/test-unlock", DEVICE, { plan: "month" });
    const status = (await (await call("/api/plus/test-unlock", DEVICE, { plan: "year" })).json()) as PlusStatus;
    const days = (Date.parse(status.expiresAt!) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(394);
    expect(days).toBeLessThan(396);
  });
});

describe("themed packs", () => {
  it("lists packs for everyone but keeps their questions behind the pass", async () => {
    const list = (await (await call("/api/packs")).json()) as { plus: boolean; packs: PackSummary[] };
    expect(list.plus).toBe(false);
    expect(list.packs.map((item) => item.id)).toEqual(["cricket", "screen", "space"]);
    expect(list.packs.every((item) => item.locked)).toBe(true);
    expect(JSON.stringify(list)).not.toContain(cricketQuestions[0]!.prompt);

    const locked = await call("/api/packs/cricket");
    expect(locked.status).toBe(402);
    expect(((await locked.json()) as { error: string }).error).toBe("plus_required");
    const guess = await call("/api/packs/cricket/guess", DEVICE, { questionId: cricketQuestions[0]!.id, guess: correctGuess(cricketQuestions[0]!) });
    expect(guess.status).toBe(402);
  });

  it("plays a pack once, scores rarity among pack players, and leaves the league alone", async () => {
    await call("/api/plus/test-unlock", DEVICE, { plan: "month" });
    const pack = (await (await call("/api/packs/cricket")).json()) as PackResponse;
    expect(pack.pack.locked).toBe(false);
    expect(pack.questions).toHaveLength(5);
    const raw = JSON.stringify(pack);
    expect(raw).not.toContain("\"accepted\"");
    expect(raw).not.toContain(cricketQuestions[0]!.context);

    let last: PackGuessResponse | null = null;
    for (const question of cricketQuestions) {
      const response = await call("/api/packs/cricket/guess", DEVICE, { questionId: question.id, guess: correctGuess(question) });
      expect(response.status).toBe(200);
      last = (await response.json()) as PackGuessResponse;
      expect(last.reveal.points).toBeGreaterThan(0);
      expect(last.reveal.provisional).toBe(false);
    }
    expect(last?.result?.score).toBeGreaterThan(0);
    expect(last?.result?.place).toEqual({ rank: 1, players: 1, next: null });
    expect(last?.result?.shareText).toContain("Ballpark+ · 🏏 Cricket Crazy");

    const twice = await call("/api/packs/cricket/guess", DEVICE, { questionId: cricketQuestions[0]!.id, guess: correctGuess(cricketQuestions[0]!) });
    expect(twice.status).toBe(409);

    const results = await env.DB.prepare("SELECT COUNT(*) AS n FROM daily_results").first<{ n: number }>();
    expect(results?.n).toBe(0);
    const league = await env.DB.prepare("SELECT COUNT(*) AS n FROM league_members").first<{ n: number }>();
    expect(league?.n).toBe(0);

    const list = (await (await call("/api/packs")).json()) as { plus: boolean; packs: PackSummary[] };
    expect(list.plus).toBe(true);
    expect(list.packs[0]).toMatchObject({ id: "cricket", answered: 5, locked: false });
    expect(list.packs[0]!.score).toBe(last?.result?.score);
  });

  it("rejects unknown packs and questions from another pack", async () => {
    await call("/api/plus/test-unlock", DEVICE, { plan: "month" });
    expect((await call("/api/packs/nope")).status).toBe(404);
    const daily = questions.find((item) => item.id === "q-fun-berry")!;
    const response = await call("/api/packs/cricket/guess", DEVICE, { questionId: daily.id, guess: correctGuess(daily) });
    expect(response.status).toBe(404);
  });
});
