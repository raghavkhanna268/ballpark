import type {
  ArchiveResponse,
  FieldStats,
  Guess,
  GuessResponse,
  JourneyResponse,
  LeagueResponse,
  PackSummary,
  Placement,
  PlusOrder,
  PlusPlan,
  PlusStatus,
  PublicH2HRound,
  PuzzleResponse,
  RestoreCode,
  RoundGuessResponse,
  RoundResponse,
  UnlimitedStatus,
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

function devQuery(extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (import.meta.env.DEV) {
    const date = new URLSearchParams(window.location.search).get("date");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) params.set("date", date);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
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

/**
 * `afterburner` spends today's Afterburner on this stage. `skin` is the Hangar paint job, for the board and race links.
 * `cruise` plays the day with no clock and off the board; the first answer of a day decides it.
 */
export async function postGuess(
  deviceId: string,
  questionId: string,
  guess: Guess,
  extras: { afterburner?: boolean; skin?: string; cruise?: boolean } = {},
): Promise<GuessResponse> {
  const response = await fetch(`/api/guess${devQuery()}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceId },
    body: JSON.stringify({ questionId, guess, ...extras }),
  });
  return read<GuessResponse>(response);
}

/** Opens a stuck nudge for one of today's questions. The answer that follows scores at most a Moonshot. */
export function postNudge(deviceId: string, questionId: string): Promise<{ nudge: string }> {
  return post<{ nudge: string }>(`/api/nudge${devQuery()}`, deviceId, { questionId });
}

/** "Should this count?": sends a name that was not on the list for review. */
export function postReport(deviceId: string, questionId: string, text: string): Promise<{ ok: true }> {
  return post<{ ok: true }>(`/api/report${devQuery()}`, deviceId, { questionId, text });
}

export type ReminderState = { key: string | null; on: boolean };

export async function getReminder(deviceId: string): Promise<ReminderState> {
  return read<ReminderState>(await fetch("/api/reminder", { headers: { "x-device-id": deviceId } }));
}

export function postReminder(deviceId: string, endpoint: string): Promise<ReminderState> {
  return post<ReminderState>("/api/reminder", deviceId, { endpoint });
}

export async function deleteReminder(deviceId: string): Promise<ReminderState> {
  return read<ReminderState>(await fetch("/api/reminder", { method: "DELETE", headers: { "x-device-id": deviceId } }));
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

/** A round outside the daily: a pack chapter, a past day, or an Unlimited round. */
export type RoundRef = { kind: "pack"; id: string; chapter: number } | { kind: "archive"; date: string } | { kind: "unlimited"; id: string };

function roundPath(ref: RoundRef): string {
  if (ref.kind === "pack") return `/api/packs/${encodeURIComponent(ref.id)}/chapters/${ref.chapter}`;
  if (ref.kind === "archive") return `/api/archive/${encodeURIComponent(ref.date)}`;
  return `/api/unlimited/${encodeURIComponent(ref.id)}`;
}

export async function getJourney(deviceId: string, id: string): Promise<JourneyResponse> {
  return read<JourneyResponse>(await fetch(`/api/packs/${encodeURIComponent(id)}`, { headers: { "x-device-id": deviceId } }));
}

export async function getRound(deviceId: string, ref: RoundRef): Promise<RoundResponse> {
  return read<RoundResponse>(await fetch(`${roundPath(ref)}${devQuery()}`, { headers: { "x-device-id": deviceId } }));
}

export function postRoundGuess(deviceId: string, ref: RoundRef, questionId: string, guess: Guess): Promise<RoundGuessResponse> {
  return post<RoundGuessResponse>(`${roundPath(ref)}/guess${devQuery()}`, deviceId, { questionId, guess });
}

export async function getArchive(deviceId: string, before?: string): Promise<ArchiveResponse> {
  return read<ArchiveResponse>(await fetch(`/api/archive${devQuery(before ? { before } : {})}`, { headers: { "x-device-id": deviceId } }));
}

export async function getUnlimited(deviceId: string): Promise<UnlimitedStatus> {
  return read<UnlimitedStatus>(await fetch(`/api/unlimited${devQuery()}`, { headers: { "x-device-id": deviceId } }));
}

/** Starts an Unlimited round, or hands back the one still open. */
export function postUnlimited(deviceId: string): Promise<{ id: string }> {
  return post<{ id: string }>(`/api/unlimited${devQuery()}`, deviceId, {});
}

export async function getRestoreCode(deviceId: string): Promise<RestoreCode> {
  return read<RestoreCode>(await fetch("/api/plus/restore-code", { headers: { "x-device-id": deviceId } }));
}

export function postRestore(deviceId: string, code: string): Promise<PlusStatus> {
  return post<PlusStatus>("/api/plus/restore", deviceId, { code });
}

export function errorCopy(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "rate_limited") return "Too many guesses in a short time. Wait a minute, then try again.";
    if (error.code === "already_submitted") return "That question is already locked in.";
    if (error.code === "not_listed") return "Not on our list. Try another name.";
    if (error.code === "afterburner_used") return "Today’s Afterburner is already spent. Lock in without it.";
    if (error.code === "out_of_order") return "That pick is out of order. Reload the run and continue from the current pair.";
    if (error.code === "run_finished") return "Today's scored run is already finished.";
    if (error.code === "practice_locked") return "Finish today's scored run before practicing.";
    if (error.code === "invalid_guess") return "That guess doesn't fit this question.";
    if (error.code === "plus_required") return "That comes with Ballpark+.";
    if (error.code === "mode_locked") return "Today’s run started in the other mode. It finishes the way it began.";
    if (error.code === "chapter_locked") return "Finish the chapter before this one first.";
    if (error.code === "played_that_day") return "You played that day live, so it stays as you played it.";
    if (error.code === "unknown_day") return "That day isn’t in the archive.";
    if (error.code === "pool_too_small") return "Unlimited needs a few more days of questions first.";
    if (error.code === "unknown_round") return "That round isn’t on this device.";
    if (error.code === "invalid_code") return "That doesn’t look like a restore code. It reads BP-, then three groups of four.";
    if (error.code === "unknown_code") return "We don’t know that code. Check it against the one on your other device.";
    if (error.code === "pass_expired") return "The pass behind that code has run out.";
    if (error.code === "payments_not_configured") return "Payments aren’t set up on this build yet.";
    if (error.code === "invalid_signature" || error.code === "unknown_order") return "We couldn’t confirm that payment. If you were charged, keep your Razorpay receipt.";
    if (error.code === "payment_provider_error") return "Razorpay didn’t answer. Try again in a minute.";
    if (error.code === "puzzle_missing") return "Today's puzzle isn't in the local database. Run npm run db:setup from the repo root.";
    return "The game couldn't score that guess.";
  }
  return "The game couldn't reach the local API. Start it with npm run dev.";
}
