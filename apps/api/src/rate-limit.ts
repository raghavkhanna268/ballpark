import { HttpError } from "./http.js";

const WINDOW_MS = 60_000;

export async function enforceRateLimit(db: D1Database, bucket: string, limit: number): Promise<void> {
  const windowStart = Math.floor(Date.now() / WINDOW_MS);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)
       ON CONFLICT(bucket, window_start) DO UPDATE SET hits = hits + 1
       RETURNING hits`,
    )
    .bind(bucket, windowStart)
    .first<{ hits: number }>();
  if ((row?.hits ?? 1) > limit) throw new HttpError(429, "rate_limited");
}
