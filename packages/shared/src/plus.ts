import type { Band, PublicQuestion } from "./types.js";
import type { Placement } from "./compete.js";

/**
 * Ballpark+: themed packs and no ads. The daily game, the league and every streak stay free, so paying
 * never buys league points. A pass is tied to the device, like everything else without an account.
 */

export type PlusPlan = "month" | "year";

export type PlusPrice = {
  plan: PlusPlan;
  /** Smallest currency unit, as Razorpay expects: paise. */
  amount: number;
  currency: "INR";
  label: string;
  price: string;
  note: string;
  days: number;
};

/** PLACEHOLDER prices for local play. Set the real ones before launch. */
export const PLUS_PRICES: PlusPrice[] = [
  { plan: "month", amount: 9900, currency: "INR", label: "Monthly", price: "₹99", note: "30 days", days: 30 },
  { plan: "year", amount: 79900, currency: "INR", label: "Yearly", price: "₹799", note: "365 days, about ₹67 a month", days: 365 },
];

export function plusPrice(plan: string): PlusPrice | null {
  return PLUS_PRICES.find((item) => item.plan === plan) ?? null;
}

export type PlusStatus = {
  plus: boolean;
  plan: PlusPlan | null;
  /** ISO time the pass ends, or null with no pass. */
  expiresAt: string | null;
  prices: PlusPrice[];
  /** Razorpay's public key id when real checkout is configured, else null. */
  razorpayKeyId: string | null;
  /** Local builds can unlock without paying, so the packs can be tried. */
  testUnlock: boolean;
};

export type PlusOrder = {
  orderId: string;
  amount: number;
  currency: "INR";
  keyId: string;
  plan: PlusPlan;
  name: string;
  description: string;
};

export type PackSummary = {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  questions: number;
  answered: number;
  score: number | null;
  locked: boolean;
};

export type PackResult = {
  score: number;
  bands: Band[];
  emojis: string[];
  reached: string;
  place: Placement;
  shareText: string;
};

export type PackResponse = {
  pack: PackSummary;
  questions: PublicQuestion[];
  result: PackResult | null;
};

export type PackGuessResponse = {
  reveal: import("./types.js").Reveal;
  result: PackResult | null;
};
