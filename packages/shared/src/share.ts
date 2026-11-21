/** Spoiler-free Classic card. Bands, points, and the zoom rung. No prompts or factors. */
export function classicShareText(puzzleNumber: number, emojis: string[], score: number, host: string, reached: string): string {
  return `Ballpark #${puzzleNumber} · Classic\n${emojis.join("")} ${score} pts\n${reached}\n${host}`;
}

/** Spoiler-free Head-to-head card. The zoom path and the run length. No fact labels. */
export function headToHeadShareText(puzzleNumber: number, correct: number, host: string, reached: string): string {
  return `Ballpark #${puzzleNumber} · Head-to-head\n${reached} · ${correct} in a row\n${host}`;
}
