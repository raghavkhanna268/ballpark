
/**
 * Ballpark+: pack journeys, Unlimited and the whole archive. The daily game, the league and every streak stay free, so paying
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

/** Launch prices: a pass for 30 or 365 days, paid once. */
export const PLUS_PRICES: PlusPrice[] = [
  { plan: "month", amount: 4900, currency: "INR", label: "Monthly", price: "₹49", note: "30 days", days: 30 },
  { plan: "year", amount: 39900, currency: "INR", label: "Yearly", price: "₹399", note: "365 days, about ₹33 a month", days: 365 },
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

/** A themed pack in the list: a journey of chapters, played in order. */
export type PackSummary = {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  /** Where the journey goes, such as "From gully cricket to Lord's". */
  route: string;
  chapters: number;
  /** Chapters finished on this device. */
  chaptersDone: number;
  locked: boolean;
};

/** What a restore code does: moves this device's pass to the device that types it. */
export type RestoreCode = { code: string };
