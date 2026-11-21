import type { Guess } from "@ballpark/shared";
import { clientIp, HttpError, json, requireDevice, withCors } from "./http.js";
import { resolvePlayDate } from "./play-date.js";
import { loadPuzzleResponse, submitGuess } from "./puzzle.js";
import { enforceRateLimit } from "./rate-limit.js";

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
  const result = await submitGuess(env.DB, date, deviceId, env.EPOCH, env.SHARE_HOST, questionId, guess.guess);
  return json(result);
}

async function readGuess(request: Request): Promise<{ questionId: string; guess: Guess }> {
  const text = await request.text();
  if (text.length > 20_000) throw new HttpError(413, "body_too_large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  if (!body || typeof body !== "object") throw new HttpError(400, "invalid_guess");
  const record = body as { questionId?: unknown; guess?: unknown };
  if (typeof record.questionId !== "string" || !record.questionId) throw new HttpError(400, "invalid_guess");
  if (!record.guess || typeof record.guess !== "object") throw new HttpError(400, "invalid_guess");
  const guess = record.guess as { type?: unknown };
  if (guess.type !== "estimate" && guess.type !== "compare" && guess.type !== "rank") {
    throw new HttpError(400, "invalid_guess");
  }
  return { questionId: record.questionId, guess: record.guess as Guess };
}
