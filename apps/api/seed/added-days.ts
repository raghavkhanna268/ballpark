import { addedDaysA } from "./added-days-a.ts";
import { addedDaysB } from "./added-days-b.ts";
import type { AddedQuestion } from "./added-helpers.ts";

/**
 * The 14 days added after the first 17 (slots LEGACY_SLOTS and up). They start playing on NEW_DAYS_FROM, so dates
 * before it keep their old puzzles.
 */
const days = [...addedDaysA, ...addedDaysB];

export const addedDays: { theme: string; blurb: string; questionIds: string[] }[] = days.map((day) => ({
  theme: day.theme,
  blurb: day.blurb,
  questionIds: day.items.map((item) => item.id),
}));

export const addedNameOne: AddedQuestion[] = days.flatMap((day) => day.items);
