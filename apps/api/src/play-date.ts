import { isIsoDate, utcToday } from "@ballpark/shared";
import { HttpError } from "./http.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Official play is the current UTC date.
 * `?date=YYYY-MM-DD` works only when the override flag is on and the request
 * is aimed at a local host, so a public deployment of this config cannot
 * browse other days.
 */
export function resolvePlayDate(url: URL, allowFlag: string): { date: string; devDate: boolean } {
  const requested = url.searchParams.get("date");
  if (!requested) return { date: utcToday(), devDate: false };
  if (!isIsoDate(requested)) throw new HttpError(400, "invalid_date");
  const allowed = allowFlag === "true" && LOCAL_HOSTS.has(url.hostname);
  if (!allowed) throw new HttpError(400, "date_override_disabled");
  return { date: requested, devDate: true };
}
