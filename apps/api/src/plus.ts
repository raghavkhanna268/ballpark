import { PLUS_PRICES, addUtcDays, plusPrice, type PlusOrder, type PlusPlan, type PlusStatus, type RestoreCode } from "@ballpark/shared";
import { HttpError } from "./http.js";

/**
 * Ballpark+ passes, paid through Razorpay. The flow is Razorpay's standard web checkout:
 *   1. POST /api/plus/order creates an order on Razorpay with the secret key and remembers it.
 *   2. The browser opens Razorpay Checkout with the public key id and that order id.
 *   3. POST /api/plus/verify checks Razorpay's signature, HMAC-SHA256(order_id|payment_id, secret),
 *      and only then grants the pass.
 * With no keys set, checkout is off and the order call answers 503. Local builds can unlock for testing instead.
 */

export type PlusEnv = Env & {
  /** Public key id, safe to send to the browser. Set with `wrangler secret put RAZORPAY_KEY_ID`. */
  RAZORPAY_KEY_ID?: string;
  /** Never in the repository or the browser. Set with `wrangler secret put RAZORPAY_KEY_SECRET`. */
  RAZORPAY_KEY_SECRET?: string;
  /** "true" lets a local request unlock a pass without paying. */
  PLUS_TEST_UNLOCK?: string;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const RAZORPAY_ORDERS = "https://api.razorpay.com/v1/orders";

type EntitlementRow = { plan: PlusPlan; expires_at: string };

function razorpayReady(env: PlusEnv): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/** The test unlock needs the flag and a local address, so a public deployment of this config can never give passes away. */
export function testUnlockAllowed(env: PlusEnv, url: URL): boolean {
  return env.PLUS_TEST_UNLOCK === "true" && LOCAL_HOSTS.has(url.hostname);
}

async function activePass(db: D1Database, deviceId: string): Promise<EntitlementRow | null> {
  const row = await db
    .prepare("SELECT plan, expires_at FROM entitlements WHERE device_id = ?")
    .bind(deviceId)
    .first<EntitlementRow>();
  if (!row || Date.parse(row.expires_at) <= Date.now()) return null;
  return row;
}

export async function hasPlus(db: D1Database, deviceId: string): Promise<boolean> {
  return (await activePass(db, deviceId)) !== null;
}

export async function requirePlus(db: D1Database, deviceId: string): Promise<void> {
  if (!(await hasPlus(db, deviceId))) throw new HttpError(402, "plus_required");
}

export async function plusStatus(db: D1Database, deviceId: string, env: PlusEnv, url: URL): Promise<PlusStatus> {
  const pass = await activePass(db, deviceId);
  return {
    plus: pass !== null,
    plan: pass?.plan ?? null,
    expiresAt: pass?.expires_at ?? null,
    prices: PLUS_PRICES,
    razorpayKeyId: razorpayReady(env) ? env.RAZORPAY_KEY_ID! : null,
    testUnlock: testUnlockAllowed(env, url),
  };
}

function readPlan(value: unknown): PlusPlan {
  if (typeof value !== "string" || !plusPrice(value)) throw new HttpError(400, "invalid_plan");
  return value as PlusPlan;
}

export async function createOrder(db: D1Database, deviceId: string, env: PlusEnv, body: unknown): Promise<PlusOrder> {
  const plan = readPlan((body as { plan?: unknown } | null)?.plan);
  if (!razorpayReady(env)) throw new HttpError(503, "payments_not_configured");
  const price = plusPrice(plan)!;
  const response = await fetch(RAZORPAY_ORDERS, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
    },
    body: JSON.stringify({
      amount: price.amount,
      currency: price.currency,
      receipt: `plus-${crypto.randomUUID().slice(0, 18)}`,
      notes: { plan },
    }),
  });
  const order = (await response.json().catch(() => null)) as { id?: unknown; amount?: unknown } | null;
  if (!response.ok || typeof order?.id !== "string") {
    console.log(JSON.stringify({ level: "error", event: "razorpay_order_failed", status: response.status }));
    throw new HttpError(502, "payment_provider_error");
  }
  await db
    .prepare(
      `INSERT INTO plus_orders (order_id, device_id, plan, amount, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'created', ?)`,
    )
    .bind(order.id, deviceId, plan, price.amount, price.currency, new Date().toISOString())
    .run();
  return {
    orderId: order.id,
    amount: price.amount,
    currency: price.currency,
    keyId: env.RAZORPAY_KEY_ID!,
    plan,
    name: "Ballpark+",
    description: `${price.label} pass · packs, Unlimited, the whole archive`,
  };
}

export async function verifyPayment(db: D1Database, deviceId: string, env: PlusEnv, url: URL, body: unknown): Promise<PlusStatus> {
  if (!razorpayReady(env)) throw new HttpError(503, "payments_not_configured");
  const record = (body ?? {}) as { orderId?: unknown; paymentId?: unknown; signature?: unknown };
  const { orderId, paymentId, signature } = record;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string") {
    throw new HttpError(400, "invalid_payment");
  }
  if (orderId.length > 64 || paymentId.length > 64 || signature.length > 128) throw new HttpError(400, "invalid_payment");

  const order = await db
    .prepare("SELECT device_id, plan, status, payment_id FROM plus_orders WHERE order_id = ?")
    .bind(orderId)
    .first<{ device_id: string; plan: PlusPlan; status: string; payment_id: string | null }>();
  if (!order || order.device_id !== deviceId) throw new HttpError(404, "unknown_order");

  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET!, `${orderId}|${paymentId}`);
  if (!sameText(expected, signature.toLowerCase())) {
    console.log(JSON.stringify({ level: "info", event: "razorpay_signature_rejected" }));
    throw new HttpError(400, "invalid_signature");
  }

  if (order.status === "paid") {
    // The same payment confirmed twice (a retry or a double tap) grants nothing new.
    if (order.payment_id === paymentId) return plusStatus(db, deviceId, env, url);
    throw new HttpError(409, "order_already_paid");
  }

  const now = new Date().toISOString();
  const claimed = await db
    .prepare("UPDATE plus_orders SET status = 'paid', payment_id = ?, paid_at = ? WHERE order_id = ? AND status = 'created'")
    .bind(paymentId, now, orderId)
    .run();
  if ((claimed.meta?.changes ?? 0) !== 1) return plusStatus(db, deviceId, env, url);
  await grantPass(db, deviceId, order.plan, "razorpay", paymentId);
  console.log(JSON.stringify({ level: "info", event: "plus_granted", plan: order.plan, source: "razorpay" }));
  return plusStatus(db, deviceId, env, url);
}

export async function testUnlock(db: D1Database, deviceId: string, env: PlusEnv, url: URL, body: unknown): Promise<PlusStatus> {
  if (!testUnlockAllowed(env, url)) throw new HttpError(403, "test_unlock_disabled");
  const plan = readPlan((body as { plan?: unknown } | null)?.plan ?? "month");
  await grantPass(db, deviceId, plan, "test", null);
  return plusStatus(db, deviceId, env, url);
}

/** Adds the plan's days to whatever is left on the current pass, so renewing early loses nothing. */
async function grantPass(db: D1Database, deviceId: string, plan: PlusPlan, source: "razorpay" | "test", paymentId: string | null): Promise<void> {
  const price = plusPrice(plan)!;
  const current = await activePass(db, deviceId);
  const now = new Date();
  const from = current ? new Date(current.expires_at) : now;
  const day = from.toISOString().slice(0, 10);
  const expires = `${addUtcDays(day, price.days)}${from.toISOString().slice(10)}`;
  await db
    .prepare(
      `INSERT INTO entitlements (device_id, plan, source, payment_id, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET plan = excluded.plan, source = excluded.source, payment_id = excluded.payment_id,
         expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
    )
    .bind(deviceId, plan, source, paymentId, expires, now.toISOString(), now.toISOString())
    .run();
}

/* ---------- restore on another device ---------- */

/** No 0, 1, I, L or O, so a code read aloud or copied by hand comes out right. */
const RESTORE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const RESTORE_LENGTH = 12;

function newRestoreCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RESTORE_LENGTH));
  const chars = [...bytes].map((byte) => RESTORE_ALPHABET[byte % RESTORE_ALPHABET.length]).join("");
  return `BP-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** "bp 7kq4 m2xd 9hta" and "BP-7KQ4-M2XD-9HTA" are the same code. Anything that cannot be one is null. */
export function normalizeRestoreCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  let chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (chars.length === RESTORE_LENGTH + 2 && chars.startsWith("BP")) chars = chars.slice(2);
  if (chars.length !== RESTORE_LENGTH || [...chars].some((char) => !RESTORE_ALPHABET.includes(char))) return null;
  return `BP-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** This device's restore code, made the first time a member asks for it. It stays the same until it is used. */
export async function restoreCode(db: D1Database, deviceId: string): Promise<RestoreCode> {
  await requirePlus(db, deviceId);
  const existing = await db.prepare("SELECT code FROM restore_codes WHERE device_id = ?").bind(deviceId).first<{ code: string }>();
  if (existing) return { code: existing.code };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = newRestoreCode();
    const made = await db
      .prepare("INSERT OR IGNORE INTO restore_codes (code, device_id, created_at) VALUES (?, ?, ?)")
      .bind(code, deviceId, new Date().toISOString())
      .run();
    if ((made.meta?.changes ?? 0) === 1) return { code };
  }
  throw new HttpError(500, "restore_code_failed");
}

/**
 * Moves the pass behind a restore code to this device. The old device loses it, so one pass is one device at a time.
 * If this device has a pass too, it keeps whichever ends later. Progress in packs and Unlimited stays with the old
 * device, because answers are kept by device.
 */
export async function redeemRestore(db: D1Database, deviceId: string, env: PlusEnv, url: URL, body: unknown): Promise<PlusStatus> {
  const code = normalizeRestoreCode((body as { code?: unknown } | null)?.code);
  if (!code) throw new HttpError(400, "invalid_code");
  const holder = await db.prepare("SELECT device_id FROM restore_codes WHERE code = ?").bind(code).first<{ device_id: string }>();
  if (!holder) throw new HttpError(404, "unknown_code");
  if (holder.device_id === deviceId) return plusStatus(db, deviceId, env, url);
  const pass = await db
    .prepare("SELECT plan, source, payment_id, expires_at FROM entitlements WHERE device_id = ?")
    .bind(holder.device_id)
    .first<{ plan: PlusPlan; source: "razorpay" | "test"; payment_id: string | null; expires_at: string }>();
  if (!pass || Date.parse(pass.expires_at) <= Date.now()) throw new HttpError(410, "pass_expired");
  const here = await activePass(db, deviceId);
  const expires = here && here.expires_at > pass.expires_at ? here.expires_at : pass.expires_at;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("DELETE FROM entitlements WHERE device_id = ?").bind(holder.device_id),
    db
      .prepare(
        `INSERT INTO entitlements (device_id, plan, source, payment_id, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(device_id) DO UPDATE SET plan = excluded.plan, source = excluded.source, payment_id = excluded.payment_id,
           expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
      )
      .bind(deviceId, pass.plan, pass.source, pass.payment_id, expires, now, now),
    db.prepare("DELETE FROM restore_codes WHERE device_id = ? AND code <> ?").bind(deviceId, code),
    db.prepare("UPDATE restore_codes SET device_id = ?, used_at = ? WHERE code = ?").bind(deviceId, now, code),
  ]);
  console.log(JSON.stringify({ level: "info", event: "plus_restored" }));
  return plusStatus(db, deviceId, env, url);
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Compares without stopping at the first difference. */
function sameText(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}
