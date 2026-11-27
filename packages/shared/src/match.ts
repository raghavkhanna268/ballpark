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
    .replace(/\+/g, " plus ")
    .replace(/#/g, " sharp ")
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

/** Like levenshtein, but two swapped neighbours ("Miel" for "Mile") count as one slip, not two. */
export function typoDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table: number[][] = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => (row === 0 ? column : column === 0 ? row : 0)));
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      let best = Math.min(table[row - 1]![column]! + 1, table[row]![column - 1]! + 1, table[row - 1]![column - 1]! + cost);
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) best = Math.min(best, table[row - 2]![column - 2]! + 1);
      table[row]![column] = best;
    }
  }
  return table[left.length]![right.length]!;
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

/** An exact match only: the name or one of its aliases, once case, accents and punctuation are set aside. */
export function exactAccepted(input: string, accepted: AcceptedAnswer[]): AcceptedAnswer | null {
  const norm = normalizeAnswer(input);
  if (!norm) return null;
  return accepted.find((item) => [item.canonical, ...item.aliases].some((name) => normalizeAnswer(name) === norm)) ?? null;
}

/** How far off a typed name can be and still be offered as "did you mean". A little looser than a typo that scores. */
function suggestLimit(length: number): number {
  if (length >= 9) return 3;
  if (length >= 6) return 2;
  if (length >= 4) return 1;
  return 0;
}

/** A name is filled in from its start once at least this many letters, and at least half of it, are typed. */
const PREFIX_MIN = 4;

/**
 * The listed name a typed answer looks like, for the player to confirm or edit: a near spelling, or one name that
 * is at least half typed. It comes back spelled as the list has it, so sending it again is an exact match. Null
 * for an exact match, for nothing close, and when two different answers are just as close, so a near miss never
 * picks between two names for the player.
 */
export function suggestAccepted(input: string, accepted: AcceptedAnswer[]): string | null {
  const norm = normalizeAnswer(input);
  if (!norm || exactAccepted(input, accepted)) return null;
  const limit = suggestLimit(norm.length);
  let best: { canonical: string; name: string; score: number } | null = null;
  let ambiguous = false;
  for (const item of accepted) {
    for (const name of [item.canonical, ...item.aliases]) {
      const candidate = normalizeAnswer(name);
      if (!candidate) continue;
      let score: number | null = null;
      // A clear start of a name counts as closer than any typo.
      if (norm.length >= PREFIX_MIN && candidate.startsWith(norm) && norm.length * 2 >= candidate.length) score = 0.5;
      else if (limit > 0 && Math.abs(candidate.length - norm.length) <= limit) {
        const distance = typoDistance(norm, candidate);
        if (distance <= limit) score = distance;
      }
      if (score === null) continue;
      if (!best || score < best.score) {
        best = { canonical: item.canonical, name, score };
        ambiguous = false;
      } else if (score === best.score && best.canonical !== item.canonical) {
        ambiguous = true;
      }
    }
  }
  return best && !ambiguous ? best.name : null;
}

export function priorShare(item: AcceptedAnswer, accepted: AcceptedAnswer[]): number {
  const total = accepted.reduce((sum, row) => sum + Math.max(0, row.prior), 0);
  if (total <= 0) return 1 / Math.max(1, accepted.length);
  return Math.max(0, item.prior) / total;
}
