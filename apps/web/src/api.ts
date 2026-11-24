import type {
  FieldStats,
  Guess,
  GuessResponse,
  LeagueResponse,
  PackGuessResponse,
  PackResponse,
  PackSummary,
  Placement,
  PlusOrder,
  PlusPlan,
  PlusStatus,
  PublicH2HRound,
  PuzzleResponse,
} from "@ballpark/shared";

export type HeadToHeadState = {
  field: FieldStats;
  date: string;
  puzzleNumber: number;
  shareHost: string;
  devDate: boolean;
  status: "ready" | "in-progress" | "finished";
  runKind: "scored" | "practice" | null;
  correct: number;
  round: PublicH2HRound | null;
  result: {
    official: boolean;
    score: number;
    beatPercent: number | null;
    players: number | null;
    bestToday: number | null;
    shareText: string;
    cleared: boolean;
    marks: string;
    reached: string;
    provisional: boolean;
    place: Placement | null;
    race: string | null;
  } | null;
};

export type HeadPickResponse = {
  correct: boolean;
  correctCount: number;
  points: number;
  reveal: {
    prompt: string;
    rows: { label: string; valueText: string }[];
    context: string;
    sourceName: string;
    sourceUrl: string;
  };
  next: PublicH2HRound | null;
  finished: boolean;
  result: HeadToHeadState["result"];
};

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

export async function getHeadToHead(deviceId: string): Promise<HeadToHeadState> {
  const response = await fetch(`/api/head-to-head${devQuery()}`, { headers: { "x-device-id": deviceId } });
  return read<HeadToHeadState>(response);
}

export async function getLeague(deviceId: string): Promise<LeagueResponse> {
  const response = await fetch(`/api/league${devQuery()}`, { headers: { "x-device-id": deviceId } });
  return read<LeagueResponse>(response);
}

export async function postHeadPick(
  deviceId: string,
  body: { index: number; choiceId?: string; direction?: "higher" | "lower"; timedOut?: boolean },
): Promise<HeadPickResponse> {
  const response = await fetch(`/api/head-to-head/pick${devQuery()}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceId },
    body: JSON.stringify(body),
  });
  return read<HeadPickResponse>(response);
}

export async function postPractice(deviceId: string): Promise<{ round: PublicH2HRound }> {
  const response = await fetch(`/api/head-to-head/practice${devQuery()}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceId },
    body: "{}",
  });
  return read<{ round: PublicH2HRound }>(response);
}

export async function postGuess(deviceId: string, questionId: string, guess: Guess): Promise<GuessResponse> {
  const response = await fetch(`/api/guess${devQuery()}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceId },
    body: JSON.stringify({ questionId, guess }),
  });
  return read<GuessResponse>(response);
}

async function post<T>(path: string, deviceId: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceId },
    body: JSON.stringify(body),
  });
  return read<T>(response);
}

export async function getPlus(deviceId: string): Promise<PlusStatus> {
  return read<PlusStatus>(await fetch("/api/plus", { headers: { "x-device-id": deviceId } }));
}

export function postPlusOrder(deviceId: string, plan: PlusPlan): Promise<PlusOrder> {
  return post<PlusOrder>("/api/plus/order", deviceId, { plan });
}

export function postPlusVerify(deviceId: string, body: { orderId: string; paymentId: string; signature: string }): Promise<PlusStatus> {
  return post<PlusStatus>("/api/plus/verify", deviceId, body);
}

export function postTestUnlock(deviceId: string, plan: PlusPlan): Promise<PlusStatus> {
  return post<PlusStatus>("/api/plus/test-unlock", deviceId, { plan });
}

export async function getPacks(deviceId: string): Promise<{ plus: boolean; packs: PackSummary[] }> {
  return read<{ plus: boolean; packs: PackSummary[] }>(await fetch("/api/packs", { headers: { "x-device-id": deviceId } }));
}

export async function getPack(deviceId: string, id: string): Promise<PackResponse> {
  return read<PackResponse>(await fetch(`/api/packs/${encodeURIComponent(id)}`, { headers: { "x-device-id": deviceId } }));
}

export function postPackGuess(deviceId: string, id: string, questionId: string, guess: Guess): Promise<PackGuessResponse> {
  return post<PackGuessResponse>(`/api/packs/${encodeURIComponent(id)}/guess`, deviceId, { questionId, guess });
}

export function errorCopy(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "rate_limited") return "Too many guesses in a short time. Wait a minute, then try again.";
    if (error.code === "already_submitted") return "That question is already locked in.";
    if (error.code === "not_listed") return "Not on our list. Try another name.";
    if (error.code === "out_of_order") return "That pick is out of order. Reload the run and continue from the current pair.";
    if (error.code === "run_finished") return "Today's scored run is already finished.";
    if (error.code === "practice_locked") return "Finish today's scored run before practicing.";
    if (error.code === "invalid_guess") return "That guess doesn't fit this question.";
    if (error.code === "plus_required") return "Packs come with Ballpark+.";
    if (error.code === "payments_not_configured") return "Payments aren’t set up on this build yet.";
    if (error.code === "invalid_signature" || error.code === "unknown_order") return "We couldn’t confirm that payment. If you were charged, keep your Razorpay receipt.";
    if (error.code === "payment_provider_error") return "Razorpay didn’t answer. Try again in a minute.";
    if (error.code === "puzzle_missing") return "Today's puzzle isn't in the local database. Run npm run db:setup from the repo root.";
    return "The game couldn't score that guess.";
  }
  return "The game couldn't reach the local API. Start it with npm run dev.";
}
