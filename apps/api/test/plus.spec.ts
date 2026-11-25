import { exports } from "cloudflare:workers";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { JourneyResponse, PackSummary, PlusStatus, RoundGuessResponse, RoundResponse } from "@ballpark/shared";
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

describe("pack journeys", () => {
  const chapterTwo = cricket.chapters[1]!.questionIds.map((id) => questions.find((item) => item.id === id)!);

  /** The least likely answer on the list, so the first player to say it scores high. */
  function rareGuess(question: (typeof cricketQuestions)[number]) {
    return { type: "name_one" as const, text: question.accepted!.at(-1)!.canonical };
  }

  async function playChapter(chapter: number, list: typeof cricketQuestions, deviceId = DEVICE, rare = false) {
    let last: RoundGuessResponse | null = null;
    for (const question of list) {
      const guess = rare ? rareGuess(question) : correctGuess(question);
      const response = await call(`/api/packs/cricket/chapters/${chapter}/guess`, deviceId, { questionId: question.id, guess });
      expect(response.status).toBe(200);
      last = (await response.json()) as RoundGuessResponse;
    }
    return last!;
  }

  it("lists packs for everyone but keeps their chapters behind the pass", async () => {
    const list = (await (await call("/api/packs")).json()) as { plus: boolean; packs: PackSummary[] };
    expect(list.plus).toBe(false);
    expect(list.packs.map((item) => item.id)).toEqual(["cricket", "screen", "space"]);
    expect(list.packs.every((item) => item.locked && item.chapters === 3 && item.chaptersDone === 0)).toBe(true);
    expect(list.packs[0]!.route).toBe(cricket.route);
    expect(JSON.stringify(list)).not.toContain(cricketQuestions[0]!.prompt);

    for (const path of ["/api/packs/cricket", "/api/packs/cricket/chapters/1"]) {
      const locked = await call(path);
      expect(locked.status).toBe(402);
      expect(((await locked.json()) as { error: string }).error).toBe("plus_required");
    }
    const guess = await call("/api/packs/cricket/chapters/1/guess", DEVICE, { questionId: cricketQuestions[0]!.id, guess: correctGuess(cricketQuestions[0]!) });
    expect(guess.status).toBe(402);
  });

  it("opens each chapter once the one before it is finished", async () => {
    await call("/api/plus/test-unlock", DEVICE, { plan: "month" });
    const journey = (await (await call("/api/packs/cricket")).json()) as JourneyResponse;
    expect(journey.pack.route).toBe(cricket.route);
    expect(journey.chapters.map((item) => [item.chapter, item.title, item.locked])).toEqual([
      [1, cricket.chapters[0]!.title, false],
      [2, cricket.chapters[1]!.title, true],
      [3, cricket.chapters[2]!.title, true],
    ]);
    const early = await call("/api/packs/cricket/chapters/2");
    expect(early.status).toBe(403);
    expect(((await early.json()) as { error: string }).error).toBe("chapter_locked");
    const earlyGuess = await call("/api/packs/cricket/chapters/2/guess", DEVICE, { questionId: chapterTwo[0]!.id, guess: correctGuess(chapterTwo[0]!) });
    expect(earlyGuess.status).toBe(403);

    const first = (await (await call("/api/packs/cricket/chapters/1")).json()) as RoundResponse;
    expect(first.round).toMatchObject({ kind: "pack", id: "cricket", chapter: 1, questions: 5, answered: 0, score: null });
    expect(first.questions).toHaveLength(5);
    const raw = JSON.stringify(first);
    expect(raw).not.toContain("\"accepted\"");
    expect(raw).not.toContain(cricketQuestions[0]!.context);

    const done = await playChapter(1, cricketQuestions);
    expect(done.reveal.provisional).toBe(false);
    expect(done.result?.score).toBeGreaterThan(0);
    // The first to finish a chapter is ranked among the chapter's bots.
    expect(done.result!.place!.players - done.result!.place!.bots).toBe(1);
    expect(done.result!.place!.bots).toBeGreaterThan(10);
    expect(done.result?.hypothetical).toBe(false);
    expect(done.result?.shareText).toContain("Ballpark+ · 🏏 Cricket Crazy · Chapter 1");

    const after = (await (await call("/api/packs/cricket")).json()) as JourneyResponse;
    expect(after.chapters.map((item) => item.locked)).toEqual([false, false, true]);
    expect(after.chapters[0]!.score).toBe(done.result?.score);
    const second = (await (await call("/api/packs/cricket/chapters/2")).json()) as RoundResponse;
    expect(second.questions.map((item) => item.id)).toEqual(cricket.chapters[1]!.questionIds);

    const list = (await (await call("/api/packs")).json()) as { plus: boolean; packs: PackSummary[] };
    expect(list.packs[0]).toMatchObject({ id: "cricket", chapters: 3, chaptersDone: 1, locked: false });
  });

  it("plays a chapter once, scores rarity among that chapter's players, and leaves the league alone", async () => {
    await call("/api/plus/test-unlock", DEVICE, { plan: "month" });
    await call("/api/plus/test-unlock", OTHER, { plan: "month" });
    await playChapter(1, cricketQuestions, OTHER);
    const theirs = await playChapter(2, chapterTwo, OTHER, true);
    await playChapter(1, cricketQuestions);
    const mine = await playChapter(2, chapterTwo, DEVICE, true);
    // The same rare answers again: once someone in the chapter has said them, they are no longer rare.
    expect(mine.result!.score).toBeLessThan(theirs.result!.score);
    expect(mine.result!.place!.players - mine.result!.place!.bots).toBe(2);
    expect(mine.result?.placeWhat).toBe("who played this chapter");

    const twice = await call("/api/packs/cricket/chapters/2/guess", DEVICE, { questionId: chapterTwo[0]!.id, guess: correctGuess(chapterTwo[0]!) });
    expect(twice.status).toBe(409);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM daily_results").first<{ n: number }>())?.n).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM league_members").first<{ n: number }>())?.n).toBe(0);
  });

  it("rejects unknown packs, chapters and questions from somewhere else", async () => {
    await call("/api/plus/test-unlock", DEVICE, { plan: "month" });
    expect((await call("/api/packs/nope")).status).toBe(404);
    expect((await call("/api/packs/cricket/chapters/9")).status).toBe(404);
    const daily = questions.find((item) => item.id === "q-fun-berry")!;
    const response = await call("/api/packs/cricket/chapters/1/guess", DEVICE, { questionId: daily.id, guess: correctGuess(daily) });
    expect(response.status).toBe(404);
    const nextChapter = await call("/api/packs/cricket/chapters/1/guess", DEVICE, { questionId: chapterTwo[0]!.id, guess: correctGuess(chapterTwo[0]!) });
    expect(nextChapter.status).toBe(404);
  });
});

describe("restore on a new device", () => {
  it("moves the pass to another device with a code, once", async () => {
    expect((await call("/api/plus/restore-code")).status).toBe(402);
    const before = (await (await call("/api/plus/test-unlock", DEVICE, { plan: "year" })).json()) as PlusStatus;
    const { code } = (await (await call("/api/plus/restore-code")).json()) as { code: string };
    expect(code).toMatch(/^BP-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    // The same code until it is used.
    expect(((await (await call("/api/plus/restore-code")).json()) as { code: string }).code).toBe(code);

    expect((await call("/api/plus/restore", OTHER, { code: "nope" })).status).toBe(400);
    expect((await call("/api/plus/restore", OTHER, { code: "BP-2222-2222-2222" })).status).toBe(404);

    // Typed loosely, without dashes, in lower case.
    const moved = await call("/api/plus/restore", OTHER, { code: code.replaceAll("-", "").toLowerCase() });
    expect(moved.status).toBe(200);
    const after = (await moved.json()) as PlusStatus;
    expect(after.plus).toBe(true);
    expect(after.expiresAt).toBe(before.expiresAt);
    expect(((await (await call("/api/plus")).json()) as PlusStatus).plus).toBe(false);
    // The code went with the pass: the new device sees it, and using it again from the old device does nothing.
    expect(((await (await call("/api/plus/restore-code", OTHER)).json()) as { code: string }).code).toBe(code);
    expect(((await (await call("/api/plus/restore", OTHER, { code })).json()) as PlusStatus).plus).toBe(true);
  });

  it("refuses a code whose pass has run out", async () => {
    await call("/api/plus/test-unlock", DEVICE, { plan: "month" });
    const { code } = (await (await call("/api/plus/restore-code")).json()) as { code: string };
    await env.DB.prepare("UPDATE entitlements SET expires_at = ? WHERE device_id = ?").bind("2020-01-01T00:00:00.000Z", DEVICE).run();
    const response = await call("/api/plus/restore", OTHER, { code });
    expect(response.status).toBe(410);
    expect(((await response.json()) as { error: string }).error).toBe("pass_expired");
  });
});
