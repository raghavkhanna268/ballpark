import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./entities.js";
import { matchAccepted, normalizeAnswer, priorShare, type AcceptedAnswer } from "./match.js";
import {
  beatPercentRuns,
  blendShare,
  estimateCrowdBonus,
  estimatePriorFarther,
  h2hPickPoints,
  nameOnePoints,
} from "./rarity.js";
import { levelForClassicScore, levelForCorrectCount, zoomShareLine } from "./scale.js";

const accepted: AcceptedAnswer[] = [
  { canonical: "India", aliases: ["Bharat"], prior: 30 },
  { canonical: "Nigeria", aliases: [], prior: 2 },
  { canonical: "United States", aliases: ["USA", "US"], prior: 18 },
  { canonical: "Côte d'Ivoire", aliases: ["Ivory Coast"], prior: 1 },
];

describe("answer matching", () => {
  it("ignores case, accents, and punctuation", () => {
    expect(normalizeAnswer("  Côte d'Ivoire ")).toBe("cote divoire");
    expect(matchAccepted("COTE D'IVOIRE", accepted)?.canonical).toBe("Côte d'Ivoire");
    expect(matchAccepted("ivory coast", accepted)?.canonical).toBe("Côte d'Ivoire");
    expect(matchAccepted("u.s.a.", [{ canonical: "United States", aliases: ["USA"], prior: 1 }])?.canonical).toBe("United States");
  });

  it("accepts aliases and small typos, and rejects a short near-miss", () => {
    expect(matchAccepted("Bharat", accepted)?.canonical).toBe("India");
    expect(matchAccepted("Nigera", accepted)?.canonical).toBe("Nigeria");
    expect(matchAccepted("Niger", accepted)).toBeNull();
    expect(matchAccepted("US", accepted)?.canonical).toBe("United States");
    expect(matchAccepted("U", accepted)).toBeNull();
  });

  it("does not award an ambiguous typo", () => {
    const twins: AcceptedAnswer[] = [
      { canonical: "Niger", aliases: [], prior: 1 },
      { canonical: "Nigeria", aliases: [], prior: 1 },
    ];
    expect(matchAccepted("Nigeri", twins)).toBeNull();
  });
});

describe("rarity scoring", () => {
  it("blends a prior into the live share until 20 responses", () => {
    expect(blendShare(0.9, 0, 0.2)).toBeCloseTo(0.2);
    expect(blendShare(1, 10, 0.2)).toBeCloseTo((0.2 * 10 + 1 * 10) / 20);
    expect(blendShare(0.25, 20, 0.8)).toBeCloseTo(0.25);
    expect(blendShare(0.25, 40, 0.8)).toBeCloseTo(0.25);
  });

  it("pays more for a rarer correct name and nothing for a miss", () => {
    const rare = nameOnePoints(priorShare(accepted[1]!, accepted));
    const common = nameOnePoints(priorShare(accepted[0]!, accepted));
    expect(rare).toBeGreaterThan(common);
    expect(nameOnePoints(0)).toBe(36);
    expect(nameOnePoints(1)).toBe(10);
  });

  it("adds an estimate bonus only when the guess is close and the field was farther", () => {
    expect(estimatePriorFarther(1)).toBeLessThan(estimatePriorFarther(3));
    expect(estimateCrowdBonus("green", 1)).toBe(6);
    expect(estimateCrowdBonus("yellow", 0.5)).toBe(3);
    expect(estimateCrowdBonus("black", 1)).toBe(0);
    expect(estimateCrowdBonus("blue", 1)).toBe(0);
  });

  it("breaks a head-to-head tie on points after run length", () => {
    const field = [
      { length: 5, points: 3 },
      { length: 5, points: 1 },
      { length: 4, points: 100 },
    ];
    expect(beatPercentRuns(field[0]!, field)).toBe(100);
    expect(beatPercentRuns(field[1]!, field)).toBe(50);
    expect(beatPercentRuns(field[2]!, field)).toBe(0);
    expect(h2hPickPoints(1)).toBe(5);
    expect(h2hPickPoints(0)).toBe(1);
  });
});

describe("zoom path", () => {
  it("starts at an atom and steps out once per correct answer", () => {
    expect(levelForCorrectCount(0).name).toBe("Atom");
    expect(levelForCorrectCount(1).name).toBe("Cell");
    expect(levelForCorrectCount(7).name).toBe("Earth");
    expect(levelForCorrectCount(12).name).toBe("Observable universe");
    expect(levelForCorrectCount(13).beyond).toBe(true);
    expect(levelForCorrectCount(15).extra).toBe(3);
  });

  it("maps a Classic score onto the same rungs and stays spoiler-free", () => {
    expect(levelForClassicScore(0).id).toBe("atom");
    expect(levelForClassicScore(100).id).toBe("universe");
    expect(zoomShareLine(levelForCorrectCount(11))).toBe("⚛️→🏙️→🌌 reached Milky Way");
    expect(zoomShareLine(levelForCorrectCount(11))).not.toContain("correct");
  });

  it("keeps private aliases out of the public country list", () => {
    expect(COUNTRIES).toContain("India");
    expect(COUNTRIES).toContain("Iceland");
    expect(COUNTRIES).not.toContain("Bharat");
    expect(COUNTRIES).not.toContain("Congo-Kinshasa");
  });
});
