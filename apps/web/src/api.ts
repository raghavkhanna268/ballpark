import type { Guess, GuessResponse, PuzzleResponse } from "@ballpark/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function devQuery(): string {
  if (!import.meta.env.DEV) return "";
  const date = new URLSearchParams(window.location.search).get("date");
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `?date=${encodeURIComponent(date)}` : "";
}

async function read<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new ApiError(response.status, body?.error ?? "request_failed");
  }
  return body as T;
}

export async function getPuzzle(deviceId: string): Promise<PuzzleResponse> {
  const response = await fetch(`/api/puzzle${devQuery()}`, {
    headers: { "x-device-id": deviceId },
  });
  return read<PuzzleResponse>(response);
}

export async function postGuess(deviceId: string, questionId: string, guess: Guess): Promise<GuessResponse> {
  const response = await fetch(`/api/guess${devQuery()}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceId },
    body: JSON.stringify({ questionId, guess }),
  });
  return read<GuessResponse>(response);
}

export function errorCopy(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "rate_limited") return "Too many guesses in a short time. Wait a minute, then try again.";
    if (error.code === "already_submitted") return "That question is already locked in.";
    if (error.code === "invalid_guess") return "That guess doesn't fit this question.";
    if (error.code === "puzzle_missing") return "Today's puzzle isn't in the local database. Run npm run db:setup from the repo root.";
    return "The game couldn't score that guess.";
  }
  return "The game couldn't reach the local API. Start it with npm run dev.";
}
