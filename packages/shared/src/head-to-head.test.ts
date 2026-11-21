import { describe, expect, it } from "vitest";
import { buildHeadToHeadSequence, scoreHeadToHead, toPublicRound, valueRatio, type H2HFact } from "./head-to-head.js";
import { headToHeadShareText } from "./share.js";
import { levelForCorrectCount, zoomShareLine } from "./scale.js";

function fact(id: string, value: number, metric = "country-population"): H2HFact {
  return {
    id,
    label: id,
    value,
    unit: "people",
    metric,
    context: `${id} context`,
    sourceName: "Sample",
    sourceUrl: "https://example.com/" + id,
  };
}

describe("head-to-head sequences", () => {
  const pool: H2HFact[] = [
    fact("b", 10),
    fact("c", 100),
    fact("d", 1000),
    fact("e", 5000),
    fact("i", 20),
    fact("j", 40),
    fact("k", 80),
    fact("f", 1010),
    fact("g", 1020),
    fact("h", 1035),
    fact("l", 1044),
    fact("m", 1052),
    fact("n", 1066),
    fact("o", 1078),
    fact("p", 1090),
  ];

  it("is deterministic for a seed and changes with the seed", () => {
    const first = buildHeadToHeadSequence(pool, "2026-01-01");
    const second = buildHeadToHeadSequence(pool, "2026-01-01");
    const other = buildHeadToHeadSequence(pool, "2026-08-08");
    expect(first.map(signature)).toEqual(second.map(signature));
    expect(first.map(signature)).not.toEqual(other.map(signature));
  });

  it("ramps from wide ratios to close ones", () => {
    const rounds = buildHeadToHeadSequence(pool, "ramp-seed");
    expect(rounds.length).toBeGreaterThanOrEqual(12);
    for (const round of rounds.filter((item) => item.index < 5)) {
      expect(round.ratio).toBeGreaterThanOrEqual(5);
    }
    for (const round of rounds.filter((item) => item.index >= 10 && item.kind !== "odd-one-out")) {
      expect(round.ratio).toBeLessThan(1.5);
    }
  });

  it("only pairs facts that share a metric", () => {
    const rounds = buildHeadToHeadSequence(pool, "metric-seed");
    for (const round of rounds) {
      expect(new Set(round.items.map((item) => item.metric)).size).toBe(1);
    }
  });

  it("includes an odd-one-out when a metric has a clear outlier", () => {
    const rounds = buildHeadToHeadSequence(
      [
        fact("c1", 10, "animal-mass"),
        fact("c2", 11, "animal-mass"),
        fact("c3", 12, "animal-mass"),
        fact("c4", 13, "animal-mass"),
        fact("c5", 14, "animal-mass"),
        fact("wide-out", 80, "animal-mass"),
      ],
      "odd-seed",
    );
    expect(rounds[7]?.kind).toBe("odd-one-out");
    expect(rounds[7]?.answer).toBe("wide-out");
    expect(rounds[7]?.items).toHaveLength(4);
  });

  it("does not put values on a which-round payload", () => {
    const round = buildHeadToHeadSequence(pool, "public-seed").find((item) => item.kind === "which");
    expect(round).toBeTruthy();
    const payload = JSON.stringify(toPublicRound(round!));
    for (const item of round!.items) {
      expect(payload).not.toContain(String(item.value));
      expect(payload).not.toContain(item.context);
      expect(payload).not.toContain(item.sourceUrl);
    }
    expect(scoreHeadToHead(round!, { choiceId: round!.answer })).toBe(true);
    expect(scoreHeadToHead(round!, { choiceId: "nope" })).toBe(false);
  });

  it("scores higher-or-lower against the hidden value", () => {
    const round = buildHeadToHeadSequence(pool, "direction-seed").find((item) => item.kind === "higher-lower");
    expect(round?.shownId).toBeTruthy();
    const payload = JSON.stringify(toPublicRound(round!));
    const hidden = round!.items.find((item) => item.id !== round!.shownId)!;
    const shown = round!.items.find((item) => item.id === round!.shownId)!;
    expect(payload).toContain(shown.label);
    expect(payload).not.toContain(String(hidden.value));
    expect(scoreHeadToHead(round!, { direction: round!.answer as "higher" | "lower" })).toBe(true);
  });

  it("formats the share card", () => {
    expect(zoomShareLine(levelForCorrectCount(7))).toBe("⚛️→🧍→🌍 reached Earth");
    expect(headToHeadShareText(325, 7, "ballpark.local", zoomShareLine(levelForCorrectCount(7)))).toBe(
      "Ballpark #325 · Head-to-head\n⚛️→🧍→🌍 reached Earth · 7 in a row\nballpark.local",
    );
  });

  it("treats a factor of five as wide and just under 1.5 as close", () => {
    expect(valueRatio(5, 1)).toBe(5);
    expect(valueRatio(14, 10)).toBeLessThan(1.5);
  });
});

function signature(round: { kind: string; answer: string; items: { id: string }[] }): string {
  return `${round.kind}:${round.items.map((item) => item.id).join(",")}:${round.answer}`;
}
