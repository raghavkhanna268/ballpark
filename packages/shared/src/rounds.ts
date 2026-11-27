import type { Placement } from "./compete.js";
import type { Band, PublicQuestion, Reveal } from "./types.js";

/**
 * Rounds played with the Classic screens outside the daily: a pack chapter, a past day from the archive, or an
 * Unlimited round. None of them count for the streak, the rank or the league.
 */

export type RoundKind = "pack" | "archive" | "unlimited";

/** The archive's last few days are free. Older days are in Ballpark+. */
export const ARCHIVE_FREE_DAYS = 7;
/** Days per page of the archive list. */
export const ARCHIVE_PAGE = 28;
/** An Unlimited round has as many questions as the daily. */
export const UNLIMITED_QUESTIONS = 7;

export type RoundSummary = {
  kind: RoundKind;
  /** The pack id, the date, or the Unlimited round id. */
  id: string;
  /** A pack's chapter, from 1. Null for the other kinds. */
  chapter: number | null;
  title: string;
  emoji: string;
  blurb: string;
  questions: number;
  answered: number;
  score: number | null;
};

export type RoundResult = {
  score: number;
  bands: Band[];
  emojis: string[];
  reached: string;
  /** Where this score sits, or null when there is nobody to compare with (Unlimited). */
  place: Placement | null;
  /** Who the place is among: "who played this chapter", or "that day" for a past day. */
  placeWhat: string;
  /** True for a past day: the rank is where you would have been, not a rank you hold. */
  hypothetical: boolean;
  shareText: string;
};

export type RoundResponse = {
  round: RoundSummary;
  questions: PublicQuestion[];
  result: RoundResult | null;
};

export type RoundGuessResponse = {
  reveal: Reveal;
  result: RoundResult | null;
};

/** One stop on a pack's route. */
export type ChapterSummary = {
  chapter: number;
  title: string;
  blurb: string;
  questions: number;
  answered: number;
  score: number | null;
  /** The chapter before it is not finished yet. */
  locked: boolean;
};

export type JourneyResponse = {
  pack: { id: string; title: string; emoji: string; blurb: string; route: string };
  chapters: ChapterSummary[];
};

export type ArchiveDay = {
  date: string;
  number: number;
  theme: string;
  /** You played that day's daily, or this day in the archive, or neither yet. */
  played: "daily" | "archive" | null;
  answered: number;
  score: number | null;
  /** Older than the free days and you have no Ballpark+. */
  locked: boolean;
};

export type ArchiveResponse = {
  plus: boolean;
  days: ArchiveDay[];
  /** Pass as `before` for the next, older page, or null at the first day. */
  older: string | null;
};

export type UnlimitedStatus = {
  plus: boolean;
  /** Finished Unlimited rounds on this device. */
  played: number;
  best: number | null;
  /** A round started and not finished, to carry on with. */
  open: string | null;
  /** Questions in the Unlimited pool. */
  pool: number;
};
