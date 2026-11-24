import { addUtcDays, playToday } from "@ballpark/shared";
import { HttpError } from "./http.js";

/**
 * Streak reminders. A player can opt in to one browser notification at 8 PM India time on days they have not
 * played yet while their streak is alive. The push carries no message body, so only the subscription's endpoint
 * is stored and nothing needs encrypting: the page's service worker shows a fixed line. Requests are signed with
 * a VAPID key pair (RFC 8292). Without the keys, reminders stay switched off.
 */

export type ReminderEnv = { DB: D1Database; SHARE_HOST: string; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string };

/** The cron that sends reminders: 14:30 UTC is 8 PM in India. */
export const REMINDER_CRON = "30 14 * * *";

/** Push services the major browsers use. A subscription anywhere else is refused, so the Worker never posts to an arbitrary host. */
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

export function reminderKey(env: ReminderEnv): string | null {
  return env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? env.VAPID_PUBLIC_KEY : null;
}

export async function reminderStatus(env: ReminderEnv, deviceId: string): Promise<{ key: string | null; on: boolean }> {
  const row = await env.DB.prepare("SELECT 1 AS hit FROM push_subs WHERE device_id = ?").bind(deviceId).first<{ hit: number }>();
  return { key: reminderKey(env), on: row !== null };
}

export async function saveReminder(env: ReminderEnv, deviceId: string, body: unknown): Promise<{ key: string | null; on: boolean }> {
  if (!reminderKey(env)) throw new HttpError(503, "reminders_off");
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 1000 || !isPushEndpoint(endpoint)) throw new HttpError(400, "invalid_subscription");
  await env.DB.prepare(
    `INSERT INTO push_subs (device_id, endpoint, created_at) VALUES (?, ?, ?)
     ON CONFLICT (device_id) DO UPDATE SET endpoint = excluded.endpoint`,
  )
    .bind(deviceId, endpoint, new Date().toISOString())
    .run();
  return { key: reminderKey(env), on: true };
}

export async function dropReminder(env: ReminderEnv, deviceId: string): Promise<{ key: string | null; on: boolean }> {
  await env.DB.prepare("DELETE FROM push_subs WHERE device_id = ?").bind(deviceId).run();
  return { key: reminderKey(env), on: false };
}

export function isPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "") return false;
  return PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

export type PushSend = (endpoint: string, authorization: string) => Promise<number>;

/**
 * Sends today's reminders: to every opted-in device that finished one of the last two days' Classic (so a
 * streak, or a streak the weekly shield can still save, is alive) and has not finished today's. Each device
 * gets at most one a day. Endpoints the push service says are gone are deleted.
 */
export async function sendReminders(env: ReminderEnv, now: Date = new Date(), send: PushSend = postPush): Promise<{ sent: number; dropped: number }> {
  if (!reminderKey(env)) return { sent: 0, dropped: 0 };
  const today = playToday(now);
  const rows = await env.DB.prepare(
    `SELECT p.device_id AS device_id, p.endpoint AS endpoint
     FROM push_subs p
     WHERE (p.last_sent IS NULL OR p.last_sent < ?)
       AND EXISTS (SELECT 1 FROM daily_results r WHERE r.device_id = p.device_id AND r.mode = 'classic' AND r.puzzle_date IN (?, ?))
       AND NOT EXISTS (SELECT 1 FROM daily_results r WHERE r.device_id = p.device_id AND r.mode = 'classic' AND r.puzzle_date = ?)`,
  )
    .bind(today, addUtcDays(today, -1), addUtcDays(today, -2), today)
    .all<{ device_id: string; endpoint: string }>();
  let sent = 0;
  let dropped = 0;
  const tokens = new Map<string, string>();
  for (const row of rows.results ?? []) {
    const audience = new URL(row.endpoint).origin;
    let token = tokens.get(audience);
    if (!token) {
      token = await vapidToken(env, audience, now);
      tokens.set(audience, token);
    }
    const status = await send(row.endpoint, `vapid t=${token}, k=${env.VAPID_PUBLIC_KEY}`).catch(() => 0);
    if (status === 404 || status === 410) {
      await env.DB.prepare("DELETE FROM push_subs WHERE device_id = ?").bind(row.device_id).run();
      dropped += 1;
      continue;
    }
    if (status >= 200 && status < 300) {
      await env.DB.prepare("UPDATE push_subs SET last_sent = ? WHERE device_id = ?").bind(today, row.device_id).run();
      sent += 1;
    }
  }
  console.log(JSON.stringify({ level: "info", event: "reminders_sent", date: today, sent, dropped }));
  return { sent, dropped };
}

async function postPush(endpoint: string, authorization: string): Promise<number> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: authorization, TTL: "14400", Urgency: "normal", "Content-Length": "0" },
  });
  return response.status;
}

/** A VAPID JWT for one push service, signed with the server's P-256 key. */
export async function vapidToken(env: ReminderEnv, audience: string, now: Date): Promise<string> {
  const publicKey = fromBase64Url(env.VAPID_PUBLIC_KEY ?? "");
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error("VAPID_PUBLIC_KEY must be an uncompressed P-256 point");
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: toBase64Url(publicKey.slice(1, 33)),
      y: toBase64Url(publicKey.slice(33, 65)),
      d: env.VAPID_PRIVATE_KEY,
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = toBase64Url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = {
    aud: audience,
    exp: Math.floor(now.getTime() / 1000) + 12 * 3600,
    sub: `https://${env.SHARE_HOST.replace(/^https?:\/\//, "")}`,
  };
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((text.length + 3) % 4);
  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}
