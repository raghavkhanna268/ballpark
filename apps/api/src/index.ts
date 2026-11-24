import type { Guess } from "@ballpark/shared";
import { finalizeYesterday } from "./finalize.js";
import { clientIp, HttpError, json, requireDevice, withCors } from "./http.js";
import { resolvePlayDate } from "./play-date.js";
import { loadHeadToHead, pickHeadToHead, startPractice } from "./headtohead.js";
import { loadLeague } from "./league.js";
import { listPacks, loadPack, submitPackGuess } from "./packs.js";
import { createOrder, plusStatus, requirePlus, testUnlock, verifyPayment, type PlusEnv } from "./plus.js";
import { loadPuzzleResponse, openNudge, questionsForDate, reportAnswer, submitGuess } from "./puzzle.js";
import { enforceRateLimit } from "./rate-limit.js";
import { REMINDER_CRON, dropReminder, reminderStatus, saveReminder, sendReminders, type ReminderEnv } from "./reminders.js";

const DEVICE_LIMIT = 40;
const IP_LIMIT = 80;

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/health" && request.method === "GET") {
        return withCors(json({ ok: true }));
      }
      if (url.pathname === "/api/puzzle" && request.method === "GET") {
        return withCors(await handlePuzzle(request, env, url));
      }
      if (url.pathname === "/api/guess" && request.method === "POST") {
        return withCors(await handleGuess(request, env, url));
      }
      if (url.pathname === "/api/nudge" && request.method === "POST") {
        return withCors(await handleNudge(request, env, url));
      }
      if (url.pathname === "/api/report" && request.method === "POST") {
        return withCors(await handleReport(request, env, url));
      }
      if (url.pathname === "/api/reminder") {
        return withCors(await handleReminder(request, env));
      }
      if (url.pathname === "/api/head-to-head" && request.method === "GET") {
        return withCors(await handleHeadToHead(request, env, url));
      }
      if (url.pathname === "/api/head-to-head/pick" && request.method === "POST") {
        return withCors(await handleHeadPick(request, env, url));
      }
      if (url.pathname === "/api/head-to-head/practice" && request.method === "POST") {
        return withCors(await handlePractice(request, env, url));
      }
      if (url.pathname === "/api/league" && request.method === "GET") {
        return withCors(await handleLeague(request, env, url));
      }
      if (url.pathname.startsWith("/api/plus")) {
        return withCors(await handlePlus(request, env, url));
      }
      if (url.pathname === "/api/packs" || url.pathname.startsWith("/api/packs/")) {
        return withCors(await handlePacks(request, env, url));
      }
      return withCors(json({ error: "not_found" }, 404));
    } catch (error) {
      if (error instanceof HttpError) {
        console.log(JSON.stringify({ level: "info", event: "request_rejected", code: error.code, status: error.status }));
        return withCors(json({ error: error.code }, error.status));
      }
      console.log(
        JSON.stringify({
          level: "error",
          event: "request_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
      return withCors(json({ error: "server_error" }, 500));
    }
  },

  async scheduled(controller, env, ctx) {
    const when = new Date(controller.scheduledTime);
    if (controller.cron === REMINDER_CRON) {
      ctx.waitUntil(sendReminders(env as ReminderEnv, when));
      return;
    }
    ctx.waitUntil(finalizeYesterday(env.DB, when, (date) => questionsForDate(env.DB, date, env.EPOCH)));
  },
} satisfies ExportedHandler<Env>;

async function handlePuzzle(request: Request, env: Env, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  const ip = clientIp(request);
  await enforceRateLimit(env.DB, `get:${deviceId}`, DEVICE_LIMIT * 3);
  await enforceRateLimit(env.DB, `get-ip:${ip}`, IP_LIMIT * 3);
  const { date, devDate } = resolvePlayDate(url, env.ALLOW_DATE_OVERRIDE);
  const puzzle = await loadPuzzleResponse(env.DB, date, deviceId, env.EPOCH, env.SHARE_HOST, devDate);
  return json(puzzle);
}

async function handleGuess(request: Request, env: Env, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  const ip = clientIp(request);
  await enforceRateLimit(env.DB, `post:${deviceId}`, DEVICE_LIMIT);
  await enforceRateLimit(env.DB, `post-ip:${ip}`, IP_LIMIT);
  const { date } = resolvePlayDate(url, env.ALLOW_DATE_OVERRIDE);
  const guess = await readGuess(request);
  const questionId = guess.questionId;
  const result = await submitGuess(env.DB, date, deviceId, env.EPOCH, env.SHARE_HOST, questionId, guess.guess, {
    afterburner: guess.afterburner,
    skin: guess.skin,
  });
  return json(result);
}

async function handleNudge(request: Request, env: Env, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  await enforceRateLimit(env.DB, `post:${deviceId}`, DEVICE_LIMIT);
  await enforceRateLimit(env.DB, `post-ip:${clientIp(request)}`, IP_LIMIT);
  const { date } = resolvePlayDate(url, env.ALLOW_DATE_OVERRIDE);
  const body = (await readJson(request)) as { questionId?: unknown } | null;
  if (typeof body?.questionId !== "string" || !body.questionId) throw new HttpError(400, "invalid_request");
  return json(await openNudge(env.DB, date, deviceId, env.EPOCH, body.questionId));
}

async function handleReport(request: Request, env: Env, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  await enforceRateLimit(env.DB, `report:${deviceId}`, 20);
  await enforceRateLimit(env.DB, `report-ip:${clientIp(request)}`, 60);
  const { date } = resolvePlayDate(url, env.ALLOW_DATE_OVERRIDE);
  const body = (await readJson(request)) as { questionId?: unknown; text?: unknown } | null;
  if (typeof body?.questionId !== "string" || typeof body.text !== "string") throw new HttpError(400, "invalid_report");
  return json(await reportAnswer(env.DB, date, deviceId, env.EPOCH, body.questionId, body.text));
}

async function handleReminder(request: Request, env: Env): Promise<Response> {
  const deviceId = requireDevice(request);
  const reminders = env as ReminderEnv;
  if (request.method === "GET") {
    await enforceRateLimit(env.DB, `get:${deviceId}`, DEVICE_LIMIT * 3);
    return json(await reminderStatus(reminders, deviceId));
  }
  await enforceRateLimit(env.DB, `remind:${deviceId}`, 10);
  await enforceRateLimit(env.DB, `remind-ip:${clientIp(request)}`, 30);
  if (request.method === "POST") return json(await saveReminder(reminders, deviceId, await readJson(request)));
  if (request.method === "DELETE") return json(await dropReminder(reminders, deviceId));
  throw new HttpError(404, "not_found");
}

async function handleHeadToHead(request: Request, env: Env, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  await enforceRateLimit(env.DB, `get:${deviceId}`, DEVICE_LIMIT * 3);
  await enforceRateLimit(env.DB, `get-ip:${clientIp(request)}`, IP_LIMIT * 3);
  const { date, devDate } = resolvePlayDate(url, env.ALLOW_DATE_OVERRIDE);
  return json(await loadHeadToHead(env.DB, date, deviceId, env.EPOCH, env.SHARE_HOST, devDate));
}

async function handleHeadPick(request: Request, env: Env, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  await enforceRateLimit(env.DB, `post:${deviceId}`, DEVICE_LIMIT);
  await enforceRateLimit(env.DB, `post-ip:${clientIp(request)}`, IP_LIMIT);
  const { date } = resolvePlayDate(url, env.ALLOW_DATE_OVERRIDE);
  const body = await readJson(request);
  const record = body as { index?: unknown; choiceId?: unknown; direction?: unknown; timedOut?: unknown };
  if (typeof record.index !== "number") throw new HttpError(400, "invalid_guess");
  const choiceId = typeof record.choiceId === "string" ? record.choiceId : undefined;
  const direction = record.direction === "higher" || record.direction === "lower" ? record.direction : undefined;
  const timedOut = record.timedOut === true && choiceId === undefined && direction === undefined;
  return json(await pickHeadToHead(env.DB, date, deviceId, env.EPOCH, env.SHARE_HOST, record.index, { choiceId, direction, timedOut }));
}

async function handlePractice(request: Request, env: Env, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  await enforceRateLimit(env.DB, `post:${deviceId}`, DEVICE_LIMIT);
  await enforceRateLimit(env.DB, `post-ip:${clientIp(request)}`, IP_LIMIT);
  const { date } = resolvePlayDate(url, env.ALLOW_DATE_OVERRIDE);
  return json({ round: await startPractice(env.DB, date, deviceId, env.EPOCH) });
}

async function handleLeague(request: Request, env: Env, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  await enforceRateLimit(env.DB, `get:${deviceId}`, DEVICE_LIMIT * 3);
  await enforceRateLimit(env.DB, `get-ip:${clientIp(request)}`, IP_LIMIT * 3);
  const { date } = resolvePlayDate(url, env.ALLOW_DATE_OVERRIDE);
  return json(await loadLeague(env.DB, deviceId, date));
}

async function handlePlus(request: Request, env: PlusEnv, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  const ip = clientIp(request);
  if (url.pathname === "/api/plus" && request.method === "GET") {
    await enforceRateLimit(env.DB, `get:${deviceId}`, DEVICE_LIMIT * 3);
    await enforceRateLimit(env.DB, `get-ip:${ip}`, IP_LIMIT * 3);
    return json(await plusStatus(env.DB, deviceId, env, url));
  }
  if (request.method !== "POST") throw new HttpError(404, "not_found");
  // Payment calls get a tighter budget than guesses.
  await enforceRateLimit(env.DB, `pay:${deviceId}`, 10);
  await enforceRateLimit(env.DB, `pay-ip:${ip}`, 30);
  const body = await readJson(request);
  if (url.pathname === "/api/plus/order") return json(await createOrder(env.DB, deviceId, env, body));
  if (url.pathname === "/api/plus/verify") return json(await verifyPayment(env.DB, deviceId, env, url, body));
  if (url.pathname === "/api/plus/test-unlock") return json(await testUnlock(env.DB, deviceId, env, url, body));
  throw new HttpError(404, "not_found");
}

const PACK_PATH = /^\/api\/packs\/([a-z0-9-]{2,24})(\/guess)?$/;

async function handlePacks(request: Request, env: Env, url: URL): Promise<Response> {
  const deviceId = requireDevice(request);
  const ip = clientIp(request);
  if (url.pathname === "/api/packs" && request.method === "GET") {
    await enforceRateLimit(env.DB, `get:${deviceId}`, DEVICE_LIMIT * 3);
    await enforceRateLimit(env.DB, `get-ip:${ip}`, IP_LIMIT * 3);
    return json(await listPacks(env.DB, deviceId));
  }
  const match = PACK_PATH.exec(url.pathname);
  if (!match) throw new HttpError(404, "not_found");
  const id = match[1]!;
  if (!match[2] && request.method === "GET") {
    await enforceRateLimit(env.DB, `get:${deviceId}`, DEVICE_LIMIT * 3);
    await enforceRateLimit(env.DB, `get-ip:${ip}`, IP_LIMIT * 3);
    await requirePlus(env.DB, deviceId);
    return json(await loadPack(env.DB, id, deviceId, env.SHARE_HOST));
  }
  if (match[2] && request.method === "POST") {
    await enforceRateLimit(env.DB, `post:${deviceId}`, DEVICE_LIMIT);
    await enforceRateLimit(env.DB, `post-ip:${ip}`, IP_LIMIT);
    await requirePlus(env.DB, deviceId);
    const guess = await readGuess(request);
    return json(await submitPackGuess(env.DB, id, deviceId, env.SHARE_HOST, guess.questionId, guess.guess));
  }
  throw new HttpError(404, "not_found");
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 20_000) throw new HttpError(413, "body_too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

/** A rocket paint job id from the Hangar: short, lowercase. Anything else is dropped. */
const SKIN = /^[a-z0-9-]{1,24}$/;

async function readGuess(request: Request): Promise<{ questionId: string; guess: Guess; afterburner: boolean; skin: string | null }> {
  const body = await readJson(request);
  if (!body || typeof body !== "object") throw new HttpError(400, "invalid_guess");
  const record = body as { questionId?: unknown; guess?: unknown; afterburner?: unknown; skin?: unknown };
  if (typeof record.questionId !== "string" || !record.questionId) throw new HttpError(400, "invalid_guess");
  if (!record.guess || typeof record.guess !== "object") throw new HttpError(400, "invalid_guess");
  const guess = record.guess as { type?: unknown };
  if (guess.type !== "estimate" && guess.type !== "compare" && guess.type !== "rank" && guess.type !== "name_one") {
    throw new HttpError(400, "invalid_guess");
  }
  return {
    questionId: record.questionId,
    guess: record.guess as Guess,
    afterburner: record.afterburner === true,
    skin: typeof record.skin === "string" && SKIN.test(record.skin) ? record.skin : null,
  };
}
