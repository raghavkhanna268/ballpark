import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./entities.js";
import { matchAccepted, normalizeAnswer, priorShare, type AcceptedAnswer } from "./match.js";
import { blendShare, nameOnePoints } from "./rarity.js";
import { journeyProgress, levelForClassicScore, levelForCorrectCount, levelForJourney, zoomShareLine } from "./scale.js";

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

});

describe("zoom path", () => {
  it("starts at an atom and lands on the Milky Way after ten correct answers", () => {
    expect(levelForCorrectCount(0).name).toBe("Atom");
    expect(levelForCorrectCount(1).name).toBe("Cell");
    expect(levelForCorrectCount(10).name).toBe("Milky Way");
    expect(levelForCorrectCount(12).name).toBe("Milky Way");
  });

  it("lands a perfect run and a 5/10 on different worlds once misses hop a third", () => {
    expect(journeyProgress(10, 10)).toBe(10);
    expect(levelForJourney(10, 10).name).toBe("Milky Way");
    expect(levelForJourney(5, 10).name).toBe("Moon orbit");
    expect(levelForJourney(0, 10).id).toBe("human");
    expect(levelForJourney(8, 10).name).toBe("Nearby stars");
  });

  it("maps a Classic score onto the same rungs and stays spoiler-free", () => {
    expect(levelForClassicScore(0).id).toBe("atom");
    expect(levelForClassicScore(132).name).toBe("Milky Way");
    expect(zoomShareLine(levelForCorrectCount(10))).toBe("⚛️→🏙️→🌌 reached Milky Way");
    expect(zoomShareLine(levelForCorrectCount(10))).not.toContain("correct");
  });

  it("keeps private aliases out of the public country list", () => {
    expect(COUNTRIES).toContain("India");
    expect(COUNTRIES).toContain("Iceland");
    expect(COUNTRIES).not.toContain("Bharat");
    expect(COUNTRIES).not.toContain("Congo-Kinshasa");
  });
});
