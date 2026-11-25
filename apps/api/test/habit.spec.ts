import { exports } from "cloudflare:workers";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { addUtcDays, playToday } from "@ballpark/shared";
import { isPushEndpoint, saveReminder, sendReminders, type ReminderEnv } from "../src/reminders.ts";
import { correctGuess, resetAndSeed, spaceDay } from "./seed-db.ts";

const DEVICE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
// Day 8 is the first Space day. It is in the past, so every request also runs that day's recount.
const DAY = "2026-01-08";
// "Name a country with more than 100 million people." Ethiopia is a Supernova while nobody else has answered.
const POPULOUS = "q-space-year";

beforeEach(async () => {
  await resetAndSeed(env.DB);
});

function headers(deviceId: string): HeadersInit {
  return { "content-type": "application/json", "x-device-id": deviceId };
}

async function call(path: string, deviceId: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  return exports.default.fetch(`http://localhost${path}${path.includes("?") ? "&" : "?"}date=${DAY}`, {
    method,
    headers: headers(deviceId),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

type Reveal = { label: string; points: number; boosted: boolean; nudged: boolean; crowd: { count?: number } };
type Result = { score: number; shareText: string; emojis: string[]; boosted: number | null; race: string; curve: unknown };

async function answer(deviceId: string, questionId: string, text: string, extras: Record<string, unknown> = {}) {
  const response = await call("/api/guess", deviceId, { questionId, guess: { type: "name_one", text }, ...extras });
  return { status: response.status, body: (await response.json()) as { reveal: Reveal; result: Result | null; error?: string } };
}

describe("Afterburner", () => {
  it("doubles one stage's points and climb, once a day, and marks it in the share", async () => {
    const plain = await answer(OTHER, POPULOUS, "Ethiopia");
    expect(plain.body.reveal.points).toBe(100);

    const boosted = await answer(DEVICE, POPULOUS, "Ethiopia", { afterburner: true, skin: "gold" });
    expect(boosted.status).toBe(200);
    expect(boosted.body.reveal.boosted).toBe(true);
    // Another player said Ethiopia first, so it is rarer than everything but a Supernova; still doubled.
    expect(boosted.body.reveal.points % 2).toBe(0);
    const single = boosted.body.reveal.points / 2;

    const second = spaceDay().find((question) => question.id !== POPULOUS)!;
    const again = await call("/api/guess", DEVICE, { questionId: second.id, guess: correctGuess(second), afterburner: true });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "afterburner_used" });

    let result: Result | null = null;
    for (const question of spaceDay()) {
      if (question.id === POPULOUS) continue;
      const response = await call("/api/guess", DEVICE, { questionId: question.id, guess: correctGuess(question), skin: "gold" });
      expect(response.status).toBe(200);
      result = ((await response.json()) as { result: Result | null }).result;
    }
    const index = spaceDay().findIndex((question) => question.id === POPULOUS);
    expect(result!.boosted).toBe(index);
    expect(result!.emojis[index]).toMatch(/🔥$/);
    expect(result!.emojis.filter((emoji) => emoji.includes("🔥"))).toHaveLength(1);
    expect(result!.shareText).toContain("🔥");
    expect(result!.race).toMatch(/^c8-\d+\.gold$/);

    // The nightly recount keeps the doubling.
    const replay = (await (await call("/api/puzzle", DEVICE)).json()) as { questions: Array<{ id: string; reveal: Reveal | null }> };
    const stored = replay.questions.find((question) => question.id === POPULOUS)!.reveal!;
    expect(stored.boosted).toBe(true);
    expect(stored.points).toBe(single * 2);
    const row = await env.DB.prepare("SELECT points, boost FROM submissions WHERE device_id = ? AND question_id = ?")
      .bind(DEVICE, POPULOUS)
      .first<{ points: number; boost: number }>();
    expect(row).toEqual({ points: single * 2, boost: 1 });
  });

  it("does not double a miss", async () => {
    const late = await call("/api/guess", DEVICE, { questionId: POPULOUS, guess: { type: "name_one", text: "", timedOut: true }, afterburner: true });
    const body = (await late.json()) as { reveal: Reveal };
    expect(body.reveal.points).toBe(0);
    expect(body.reveal.boosted).toBe(false);
  });
});

describe("stuck nudge", () => {
  it("is offered on daily questions, opens on request, and caps the answer at a Moonshot", async () => {
    const day = (await (await call("/api/puzzle", DEVICE)).json()) as { questions: Array<{ id: string; hasNudge: boolean }> };
    expect(day.questions.every((question) => question.hasNudge)).toBe(true);
    // The nudge text is never in the puzzle itself.
    expect(JSON.stringify(day)).not.toContain("Think of");

    const opened = await call("/api/nudge", DEVICE, { questionId: POPULOUS });
    expect(opened.status).toBe(200);
    const { nudge } = (await opened.json()) as { nudge: string };
    expect(nudge.length).toBeGreaterThan(10);
    expect(nudge).not.toContain("Ethiopia");

    const capped = await answer(DEVICE, POPULOUS, "Ethiopia");
    expect(capped.body.reveal.label).toBe("Moonshot");
    expect(capped.body.reveal.points).toBe(50);
    expect(capped.body.reveal.nudged).toBe(true);

    const late = await call("/api/nudge", DEVICE, { questionId: POPULOUS });
    expect(late.status).toBe(409);
    const unknown = await call("/api/nudge", DEVICE, { questionId: "q-nope" });
    expect(unknown.status).toBe(404);
  });

  it("leaves a common answer's tier alone", async () => {
    await call("/api/nudge", DEVICE, { questionId: POPULOUS });
    const common = await answer(DEVICE, POPULOUS, "India");
    expect(common.body.reveal.label).toBe("Liftoff");
  });
});

describe("should this count?", () => {
  it("queues a name that is not on the list, and the recount scores it once it is added", async () => {
    const tried = await answer(DEVICE, POPULOUS, "Germany");
    expect(tried.status).toBe(422);
    const report = await call("/api/report", DEVICE, { questionId: POPULOUS, text: "Germany" });
    expect(report.status).toBe(200);
    // Sending the same name twice keeps one row.
    await call("/api/report", DEVICE, { questionId: POPULOUS, text: " germany " });
    const rows = await env.DB.prepare("SELECT text FROM answer_reports WHERE question_id = ?").bind(POPULOUS).all<{ text: string }>();
    expect(rows.results).toHaveLength(1);
    const listed = await call("/api/report", DEVICE, { questionId: POPULOUS, text: "India" });
    expect(listed.status).toBe(400);

    // The player ran out of time on that stage.
    const late = await call("/api/guess", DEVICE, { questionId: POPULOUS, guess: { type: "name_one", text: "", timedOut: true } });
    expect(((await late.json()) as { reveal: Reveal }).reveal.points).toBe(0);

    // The owner adds Germany to the list. The day's recount (which runs on every request for a past day) scores it.
    const question = await env.DB.prepare("SELECT accepted_json FROM questions WHERE id = ?").bind(POPULOUS).first<{ accepted_json: string }>();
    const accepted = JSON.parse(question!.accepted_json) as Array<{ canonical: string; aliases: string[]; prior: number }>;
    accepted.push({ canonical: "Germany", aliases: [], prior: 1 });
    await env.DB.prepare("UPDATE questions SET accepted_json = ? WHERE id = ?").bind(JSON.stringify(accepted), POPULOUS).run();

    const replay = (await (await call("/api/puzzle", DEVICE)).json()) as { questions: Array<{ id: string; reveal: (Reveal & { answerText: string }) | null }> };
    const scored = replay.questions.find((item) => item.id === POPULOUS)!.reveal!;
    expect(scored.answerText).toBe("Germany");
    expect(scored.points).toBeGreaterThan(0);
  });
});

describe("today's board and the flight log", () => {
  it("fills the board with labelled bots from the first player, and draws the curve", async () => {
    type Today = { climbing: number | null; bots: number; board: Array<{ rank: number; callsign: string; progress: number; skin: string | null; you: boolean; bot: boolean }>; you: unknown };
    // Before anyone plays, today's bots are already on the board.
    const early = (await (await call("/api/puzzle", DEVICE)).json()) as { today: Today; field: { players: number; averageProgress: number | null } };
    expect(early.today.bots).toBeGreaterThan(10);
    // Bots are never counted as people climbing, and a handful of people is not announced.
    expect(early.today.climbing).toBeNull();
    expect(early.today.board).toHaveLength(10);
    expect(early.today.board.every((row) => row.bot && !row.you)).toBe(true);
    // Bots pick different answers, so their climbs spread out.
    expect(new Set(early.today.board.map((row) => row.progress)).size).toBeGreaterThan(3);
    expect(early.field.averageProgress).not.toBeNull();
    // The same bots, with the same climbs, on every request.
    const again = (await (await call("/api/puzzle", OTHER)).json()) as { today: Today };
    expect(again.today.board).toEqual(early.today.board);

    await finishRuns(4);
    let result: Result | null = null;
    for (const question of spaceDay()) {
      const response = await call("/api/guess", DEVICE, { questionId: question.id, guess: correctGuess(question), skin: "aurora" });
      result = ((await response.json()) as { result: Result | null }).result;
    }
    const curve = result!.curve as { bins: number[]; top: number; you: number; higherThan: number };
    expect(curve.bins.reduce((sum, count) => sum + count, 0)).toBe(5 + early.today.bots);
    expect(curve.higherThan).toBeGreaterThanOrEqual(0);
    expect(curve.higherThan).toBeLessThanOrEqual(100);

    const day = (await (await call("/api/puzzle", DEVICE)).json()) as { today: Today };
    expect(day.today.climbing).toBeNull();
    expect(day.today.board).toHaveLength(10);
    const heights = day.today.board.map((row) => row.progress);
    expect([...heights].sort((left, right) => right - left)).toEqual(heights);
    const mine = day.today.board.find((row) => row.you) ?? (day.today.you as { skin: string | null; you: boolean; bot: boolean });
    expect(mine.you).toBe(true);
    expect(mine.bot).toBe(false);
    expect(mine.skin).toBe("aurora");
    expect(JSON.stringify(day.today)).not.toContain(OTHER.slice(0, 8));
  });
});

describe("streak reminders", () => {
  it("stays off without keys, and only takes push service endpoints", async () => {
    const status = (await (await call("/api/reminder", DEVICE)).json()) as { key: string | null; on: boolean };
    expect(status).toEqual({ key: null, on: false });
    const refused = await call("/api/reminder", DEVICE, { endpoint: "https://fcm.googleapis.com/fcm/send/abc" });
    expect(refused.status).toBe(503);

    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isPushEndpoint("https://evil.example/fcm.googleapis.com")).toBe(false);
    expect(isPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
  });

  it("reminds players whose streak is alive and who have not played today, once a day", async () => {
    const reminders = await keyedEnv();
    await expect(saveReminder(reminders, DEVICE, { endpoint: "https://evil.example/x" })).rejects.toThrow();
    const today = playToday();
    const players = {
      atRisk: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shielded: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      done: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      lapsed: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      gone: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    };
    for (const [name, id] of Object.entries(players)) {
      await saveReminder(reminders, id, { endpoint: `https://fcm.googleapis.com/fcm/send/${name}` });
    }
    await played(players.atRisk, addUtcDays(today, -1));
    await played(players.shielded, addUtcDays(today, -2));
    await played(players.done, addUtcDays(today, -1));
    await played(players.done, today);
    await played(players.lapsed, addUtcDays(today, -5));
    await played(players.gone, addUtcDays(today, -1));

    const sent: Array<{ endpoint: string; authorization: string }> = [];
    const send = async (endpoint: string, authorization: string) => {
      sent.push({ endpoint, authorization });
      return endpoint.endsWith("/gone") ? 410 : 201;
    };
    const first = await sendReminders(reminders, new Date(), send);
    expect(first).toEqual({ sent: 2, dropped: 1 });
    expect(sent.map((item) => item.endpoint.split("/").pop()).sort()).toEqual(["atRisk", "gone", "shielded"]);

    // The token is a VAPID JWT for the push service, signed with the server's key.
    const [token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(sent[0]!.authorization)!.slice(1);
    expect(key).toBe(reminders.VAPID_PUBLIC_KEY);
    const [header, payload, signature] = token!.split(".");
    const claims = JSON.parse(atob(payload!.replaceAll("-", "+").replaceAll("_", "/"))) as { aud: string; sub: string; exp: number };
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("https://ballpark.local");
    const verifyKey = await crypto.subtle.importKey("raw", fromBase64Url(key!), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifyKey,
      fromBase64Url(signature!),
      new TextEncoder().encode(`${header}.${payload}`),
    );
    expect(valid).toBe(true);

    const goneRow = await env.DB.prepare("SELECT 1 AS hit FROM push_subs WHERE device_id = ?").bind(players.gone).first();
    expect(goneRow).toBeNull();
    sent.length = 0;
    expect(await sendReminders(reminders, new Date(), send)).toEqual({ sent: 0, dropped: 0 });
  });
});

/** Puts `count` other players' finished Space-day runs straight into the database, each with a different height. */
async function finishRuns(count: number): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  for (let player = 0; player < count; player += 1) {
    const id = `${String(player).padStart(8, "0")}-0000-4000-8000-000000000000`;
    let score = 0;
    spaceDay().forEach((question, index) => {
      const points = index <= player % 7 ? 25 : 10;
      score += points;
      statements.push(
        env.DB.prepare(
          `INSERT INTO submissions (id, device_id, puzzle_date, mode, question_id, guess_json, band, points, created_at)
           VALUES (?, ?, ?, 'classic', ?, ?, 'blue', ?, ?)`,
        ).bind(crypto.randomUUID(), id, DAY, question.id, JSON.stringify(correctGuess(question)), points, new Date().toISOString()),
      );
    });
    statements.push(
      env.DB.prepare(
        `INSERT INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at)
         VALUES (?, ?, 'classic', ?, ?, '[]', 0, ?)`,
      ).bind(id, DAY, score, score, new Date().toISOString()),
    );
  }
  for (let index = 0; index < statements.length; index += 40) await env.DB.batch(statements.slice(index, index + 40));
}

async function played(deviceId: string, date: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO daily_results (device_id, puzzle_date, mode, score, points, bands, finalized, created_at)
     VALUES (?, ?, 'classic', 100, 100, '[]', 0, ?)`,
  )
    .bind(deviceId, date, new Date().toISOString())
    .run();
}

async function keyedEnv(): Promise<ReminderEnv & { VAPID_PUBLIC_KEY: string }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return { DB: env.DB, SHARE_HOST: "ballpark.local", VAPID_PUBLIC_KEY: toBase64Url(raw), VAPID_PRIVATE_KEY: jwk.d! };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((text.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
