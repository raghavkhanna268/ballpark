/** Accepted names stay on the server. The client only sees a broad entity list. */
export type AcceptedAnswer = {
  canonical: string;
  aliases: string[];
  prior: number;
};

export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’.]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  const prev = new Array<number>(right.length + 1);
  const curr = new Array<number>(right.length + 1);
  for (let column = 0; column <= right.length; column += 1) prev[column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    curr[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      curr[column] = Math.min(curr[column - 1]! + 1, prev[column]! + 1, prev[column - 1]! + cost);
    }
    for (let column = 0; column <= right.length; column += 1) prev[column] = curr[column]!;
  }
  return prev[right.length]!;
}

function typoLimit(length: number): number {
  if (length >= 8) return 2;
  if (length >= 5) return 1;
  return 0;
}

/**
 * Exact alias match first, then a small edit distance.
 * An ambiguous typo matches nothing, so two nearby names cannot steal each other.
 */
export function matchAccepted(input: string, accepted: AcceptedAnswer[]): AcceptedAnswer | null {
  const norm = normalizeAnswer(input);
  if (!norm) return null;
  for (const item of accepted) {
    if ([item.canonical, ...item.aliases].some((name) => normalizeAnswer(name) === norm)) return item;
  }
  const limit = typoLimit(norm.length);
  if (limit === 0) return null;
  let best: AcceptedAnswer | null = null;
  let bestDistance = limit + 1;
  let ambiguous = false;
  for (const item of accepted) {
    for (const name of [item.canonical, ...item.aliases]) {
      const candidate = normalizeAnswer(name);
      if (!candidate || Math.abs(candidate.length - norm.length) > limit) continue;
      const distance = levenshtein(norm, candidate);
      if (distance > limit) continue;
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
        ambiguous = false;
        continue;
      }
      if (distance === bestDistance && best && best.canonical !== item.canonical) ambiguous = true;
    }
  }
  return ambiguous ? null : best;
}

export function priorShare(item: AcceptedAnswer, accepted: AcceptedAnswer[]): number {
  const total = accepted.reduce((sum, row) => sum + Math.max(0, row.prior), 0);
  if (total <= 0) return 1 / Math.max(1, accepted.length);
  return Math.max(0, item.prior) / total;
}
