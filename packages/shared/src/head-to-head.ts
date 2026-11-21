import { formatFactValue } from "./format.js";

export type H2HKind = "which" | "higher-lower" | "odd-one-out";

export type H2HFact = {
  id: string;
  label: string;
  value: number;
  unit: string;
  metric: string;
  context: string;
  sourceName: string;
  sourceUrl: string;
};

export type MetricCopy = {
  which: string;
  /** higher: the larger number wins. lower: the smaller number wins (earlier years). */
  polarity: "higher" | "lower";
  higher: string;
  lower: string;
};

export const METRIC_COPY: Record<string, MetricCopy> = {
  "country-population": { which: "Which has more people?", polarity: "higher", higher: "More", lower: "Fewer" },
  "country-area": { which: "Which country is larger?", polarity: "higher", higher: "Larger", lower: "Smaller" },
  "country-gdp": { which: "Which economy is larger?", polarity: "higher", higher: "Larger", lower: "Smaller" },
  "mountain-height": { which: "Which mountain is taller?", polarity: "higher", higher: "Taller", lower: "Shorter" },
  "river-length": { which: "Which river is longer?", polarity: "higher", higher: "Longer", lower: "Shorter" },
  "planet-distance": { which: "Which is farther from the Sun?", polarity: "higher", higher: "Farther", lower: "Closer" },
  "planet-diameter": { which: "Which planet is wider?", polarity: "higher", higher: "Wider", lower: "Narrower" },
  "orbit-period": { which: "Which year is longer?", polarity: "higher", higher: "Longer", lower: "Shorter" },
  "land-speed": { which: "Which is faster on land?", polarity: "higher", higher: "Faster", lower: "Slower" },
  "animal-mass": { which: "Which is heavier?", polarity: "higher", higher: "Heavier", lower: "Lighter" },
  "animal-length": { which: "Which is longer?", polarity: "higher", higher: "Longer", lower: "Shorter" },
  lifespan: { which: "Which lives longer?", polarity: "higher", higher: "Longer", lower: "Shorter" },
  "landmark-height": { which: "Which is taller?", polarity: "higher", higher: "Taller", lower: "Shorter" },
  "build-year": { which: "Which was finished earlier?", polarity: "lower", higher: "Later", lower: "Earlier" },
  "invention-year": { which: "Which came first?", polarity: "lower", higher: "Later", lower: "Earlier" },
  "premiere-year": { which: "Which was first?", polarity: "lower", higher: "Later", lower: "Earlier" },
  "publication-year": { which: "Which was published first?", polarity: "lower", higher: "Later", lower: "Earlier" },
  "melting-point": { which: "Which melts hotter?", polarity: "higher", higher: "Hotter", lower: "Cooler" },
  "atomic-number": { which: "Which has the higher atomic number?", polarity: "higher", higher: "Higher", lower: "Lower" },
  "ocean-area": { which: "Which ocean is larger?", polarity: "higher", higher: "Larger", lower: "Smaller" },
  "sea-area": { which: "Which sea is larger?", polarity: "higher", higher: "Larger", lower: "Smaller" },
  "ocean-depth": { which: "Which is deeper?", polarity: "higher", higher: "Deeper", lower: "Shallower" },
  "intestine-length": { which: "Which is longer?", polarity: "higher", higher: "Longer", lower: "Shorter" },
  "skeleton-bones": { which: "Which has more bones?", polarity: "higher", higher: "More", lower: "Fewer" },
  "teeth-count": { which: "Which set has more teeth?", polarity: "higher", higher: "More", lower: "Fewer" },
  gestation: { which: "Which pregnancy is longer?", polarity: "higher", higher: "Longer", lower: "Shorter" },
  "lung-lobes": { which: "Which lung has more lobes?", polarity: "higher", higher: "More", lower: "Fewer" },
  wingspan: { which: "Which has the wider wingspan?", polarity: "higher", higher: "Wider", lower: "Narrower" },
  "painting-area": { which: "Which painting is larger?", polarity: "higher", higher: "Larger", lower: "Smaller" },
};

export type H2HRound = {
  index: number;
  kind: H2HKind;
  prompt: string;
  polarity: "higher" | "lower";
  unit: string;
  metric: string;
  items: H2HFact[];
  /** Fact whose value is shown up front. Only set for higher-lower. */
  shownId: string | null;
  /** which / odd-one-out: winning fact id. higher-lower: "higher" or "lower". */
  answer: string;
  ratio: number;
};

export type PublicH2HRound = {
  index: number;
  kind: H2HKind;
  prompt: string;
  unit: string;
  options: { id: string; label: string }[];
  shown: { label: string; valueText: string } | null;
  otherLabel: string | null;
  higherLabel: string;
  lowerLabel: string;
};

export const H2H_LENGTH = 10;
const SEQUENCE_LENGTH = H2H_LENGTH;

export function valueRatio(a: number, b: number): number | null {
  const left = Math.abs(a);
  const right = Math.abs(b);
  const low = Math.min(left, right);
  const high = Math.max(left, right);
  if (!(low > 0) || !Number.isFinite(high)) return null;
  return high / low;
}

export function buildHeadToHeadSequence(facts: H2HFact[], seedKey: string, excludeIds: Iterable<string> = []): H2HRound[] {
  const excluded = new Set(excludeIds);
  const rng = mulberry32(hashString(seedKey));
  const groups = new Map<string, H2HFact[]>();
  const orderedFacts = [...facts].sort((a, b) => a.id.localeCompare(b.id));
  for (const fact of orderedFacts) {
    if (excluded.has(fact.id) || !METRIC_COPY[fact.metric]) continue;
    const list = groups.get(fact.metric) ?? [];
    list.push(fact);
    groups.set(fact.metric, list);
  }

  type Pair = { metric: string; a: H2HFact; b: H2HFact; ratio: number };
  const buckets: Record<"wide" | "mid" | "close", Pair[]> = { wide: [], mid: [], close: [] };
  for (const [metric, group] of groups) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const ratio = valueRatio(group[i].value, group[j].value);
        if (ratio === null || ratio <= 1) continue;
        const pair = { metric, a: group[i], b: group[j], ratio };
        if (ratio >= 5) buckets.wide.push(pair);
        else if (ratio >= 1.5) buckets.mid.push(pair);
        else buckets.close.push(pair);
      }
    }
  }
  buckets.wide = shuffle(buckets.wide, rng);
  buckets.mid = shuffle(buckets.mid, rng);
  buckets.close = shuffle(buckets.close, rng);

  const used = new Set<string>();
  const rounds: H2HRound[] = [];
  for (let index = 0; index < SEQUENCE_LENGTH; index += 1) {
    if (index === 7) {
      const odd = takeOddOneOut(groups, rng, used);
      if (odd) {
        rounds.push({ ...odd, index });
        continue;
      }
    }
    const prefer = index < 3 ? "wide" : index < 7 ? "mid" : "close";
    const pair = takePair(buckets, prefer, used);
    if (!pair) break;
    const copy = METRIC_COPY[pair.metric];
    const kind: H2HKind = index % 4 === 3 ? "higher-lower" : "which";
    rounds.push(pairToRound(pair, index, kind, copy, rng));
  }
  return rounds;
}

export function toPublicRound(round: H2HRound): PublicH2HRound {
  const copy = METRIC_COPY[round.metric];
  const shown = round.shownId ? round.items.find((item) => item.id === round.shownId) ?? null : null;
  const hidden = shown ? round.items.find((item) => item.id !== shown.id) ?? null : null;
  return {
    index: round.index,
    kind: round.kind,
    prompt: round.prompt,
    unit: round.unit,
    options:
      round.kind === "higher-lower"
        ? []
        : round.items.map((item) => ({ id: item.id, label: item.label })),
    shown: shown ? { label: shown.label, valueText: formatFactValue(shown.value, shown.unit) } : null,
    otherLabel: hidden?.label ?? null,
    higherLabel: copy?.higher ?? "Higher",
    lowerLabel: copy?.lower ?? "Lower",
  };
}

export function scoreHeadToHead(round: H2HRound, choice: { choiceId?: string; direction?: "higher" | "lower" }): boolean {
  if (round.kind === "higher-lower") return choice.direction === round.answer;
  return choice.choiceId === round.answer;
}

function pairToRound(pair: { metric: string; a: H2HFact; b: H2HFact; ratio: number }, index: number, kind: H2HKind, copy: MetricCopy, rng: () => number): H2HRound {
  const ordered = rng() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a];
  if (kind === "which") {
    const winner = winnerId(ordered, copy.polarity);
    return {
      index,
      kind,
      prompt: copy.which,
      polarity: copy.polarity,
      unit: ordered[0].unit,
      metric: pair.metric,
      items: ordered,
      shownId: null,
      answer: winner,
      ratio: pair.ratio,
    };
  }
  const shown = ordered[0];
  const hidden = ordered[1];
  const answer = hidden.value === shown.value ? "higher" : hidden.value > shown.value ? "higher" : "lower";
  const prompt = `Is ${hidden.label} ${copy.lower.toLowerCase()} or ${copy.higher.toLowerCase()} than ${shown.label}?`;
  return {
    index,
    kind,
    prompt,
    polarity: copy.polarity,
    unit: shown.unit,
    metric: pair.metric,
    items: [shown, hidden],
    shownId: shown.id,
    answer,
    ratio: pair.ratio,
  };
}

function winnerId(items: H2HFact[], polarity: "higher" | "lower"): string {
  const sorted = [...items].sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
  return polarity === "higher" ? sorted[sorted.length - 1].id : sorted[0].id;
}

function takePair(buckets: Record<"wide" | "mid" | "close", { metric: string; a: H2HFact; b: H2HFact; ratio: number }[]>, prefer: "wide" | "mid" | "close", used: Set<string>) {
  const order = prefer === "wide" ? (["wide", "mid", "close"] as const) : prefer === "mid" ? (["mid", "wide", "close"] as const) : (["close", "mid", "wide"] as const);
  for (const name of order) {
    const pool = buckets[name];
    while (pool.length > 0) {
      const pair = pool.shift();
      if (!pair) break;
      const key = pair.a.id < pair.b.id ? `${pair.a.id}|${pair.b.id}` : `${pair.b.id}|${pair.a.id}`;
      if (used.has(key)) continue;
      used.add(key);
      return pair;
    }
  }
  return null;
}

function takeOddOneOut(groups: Map<string, H2HFact[]>, rng: () => number, used: Set<string>): Omit<H2HRound, "index"> | null {
  const candidates: { metric: string; items: H2HFact[]; outlier: H2HFact; ratio: number; high: boolean }[] = [];
  for (const [metric, group] of groups) {
    if (group.length < 4) continue;
    for (const outlier of group) {
      const rest = group.filter((item) => item.id !== outlier.id);
      const sorted = [...rest].sort((a, b) => Math.abs(a.value) - Math.abs(b.value));
      for (let i = 0; i + 2 < sorted.length; i += 1) {
        const trio = [sorted[i], sorted[i + 1], sorted[i + 2]];
        const cluster = valueRatio(trio[0].value, trio[2].value);
        if (cluster === null || cluster >= 1.5) continue;
        const nearest = Math.max(...trio.map((item) => Math.abs(item.value)));
        const farthest = Math.min(...trio.map((item) => Math.abs(item.value)));
        const highRatio = Math.abs(outlier.value) / nearest;
        const lowRatio = farthest / Math.abs(outlier.value);
        if (highRatio >= 5) candidates.push({ metric, items: [...trio, outlier], outlier, ratio: highRatio, high: true });
        else if (lowRatio >= 5 && Math.abs(outlier.value) > 0) candidates.push({ metric, items: [...trio, outlier], outlier, ratio: lowRatio, high: false });
      }
    }
  }
  const shuffled = shuffle(candidates, rng);
  for (const candidate of shuffled) {
    const key = `odd|${candidate.outlier.id}`;
    if (used.has(key)) continue;
    used.add(key);
    const copy = METRIC_COPY[candidate.metric];
    const items = shuffle(candidate.items, rng);
    return {
      kind: "odd-one-out",
      prompt: candidate.high ? "Which is far bigger than the other three?" : "Which is far smaller than the other three?",
      polarity: copy.polarity,
      unit: items[0].unit,
      metric: candidate.metric,
      items,
      shownId: null,
      answer: candidate.outlier.id,
      ratio: candidate.ratio,
    };
  }
  return null;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i];
    copy[i] = copy[j];
    copy[j] = current;
  }
  return copy;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
