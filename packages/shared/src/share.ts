/** Spoiler-free Classic card. Emoji only, plus the day's score. No prompts or factors. */
/** Spoiler-free Head-to-head card. Greens are correct picks; the cross is the miss that ended the run. */
export function headToHeadShareText(puzzleNumber: number, correct: number, host: string, clearedDeck = false): string {
  const marks = `${"🟩".repeat(correct)}${clearedDeck ? "" : "❌"}`;
  return `Ballpark #${puzzleNumber} · Head-to-head\n${marks} ${correct} in a row\n${host}`;
}

export function classicShareText(
  puzzleNumber: number,
  emojis: string[],
  score: number,
  host: string,
): string {
  return `Ballpark #${puzzleNumber} · Classic\n${emojis.join("")} ${score}/100\n${host}`;
}
