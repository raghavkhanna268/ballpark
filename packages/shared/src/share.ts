/** Spoiler-free Classic card. Emoji only, plus the day's score. No prompts or factors. */
export function classicShareText(
  puzzleNumber: number,
  emojis: string[],
  score: number,
  host: string,
): string {
  return `Ballpark #${puzzleNumber} · Classic\n${emojis.join("")} ${score}/100\n${host}`;
}
