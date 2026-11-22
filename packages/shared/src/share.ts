import { raceUrl } from "./compete.js";

/** The last line of a share card: a link a friend can open to race your climb, or just the host. */
function linkLine(host: string, race?: string): string {
  return race ? `Race my climb: ${raceUrl(host, race)}` : host;
}

/** Spoiler-free Classic card. Bands, points, the height reached, and a race link. No prompts or answers. */
export function classicShareText(puzzleNumber: number, emojis: string[], score: number, host: string, reached: string, race?: string): string {
  return `Ballpark #${puzzleNumber} · Classic\n${emojis.join("")} ${score} pts\n${reached}\n${linkLine(host, race)}`;
}

/** Spoiler-free Head-to-head card. Ten marks, the correct count, the height reached, and a race link. */
export function headToHeadShareText(
  puzzleNumber: number,
  marks: string,
  correct: number,
  total: number,
  host: string,
  reached: string,
  race?: string,
): string {
  return `Ballpark #${puzzleNumber} · Head-to-head\n${marks} ${correct}/${total} · reached ${reached}\n${linkLine(host, race)}`;
}
