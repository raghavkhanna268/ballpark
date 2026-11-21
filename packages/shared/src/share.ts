/** Spoiler-free Classic card. Bands, points, and the zoom rung. No prompts or factors. */
export function classicShareText(puzzleNumber: number, emojis: string[], score: number, host: string, reached: string): string {
  return `Ballpark #${puzzleNumber} · Classic\n${emojis.join("")} ${score} pts\n${reached}\n${host}`;
}

/** Spoiler-free Head-to-head card. Ten marks, the correct count, and the world you reached. */
export function headToHeadShareText(
  puzzleNumber: number,
  marks: string,
  correct: number,
  total: number,
  host: string,
  reached: string,
): string {
  return `Ballpark #${puzzleNumber} · Head-to-head\n${marks} ${correct}/${total} · reached ${reached}\n${host}`;
}
