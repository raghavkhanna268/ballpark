import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./entities.js";
import { exactAccepted, matchAccepted, normalizeAnswer, priorShare, suggestAccepted, type AcceptedAnswer } from "./match.js";
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

  it("offers the listed spelling for a near miss or a name that is half typed, for the player to confirm", () => {
    const units: AcceptedAnswer[] = [
      { canonical: "Kilometre", aliases: ["Kilometer", "km"], prior: 14 },
      { canonical: "Mile", aliases: [], prior: 20 },
      { canonical: "Furlong", aliases: [], prior: 2 },
      { canonical: "Fathom", aliases: [], prior: 2 },
    ];
    expect(exactAccepted("kilometer", units)?.canonical).toBe("Kilometre");
    expect(exactAccepted("Kilomter", units)).toBeNull();
    // An exact name needs no offer.
    expect(suggestAccepted("Kilometre", units)).toBeNull();
    // The closest spelling on the list wins, alias or not, and a tie goes to the main name.
    expect(suggestAccepted("Kilomter", units)).toBe("Kilometer");
    expect(suggestAccepted("kilometr", units)).toBe("Kilometre");
    expect(suggestAccepted("Furlog", units)).toBe("Furlong");
    // Half typed: filled in from the start of one name.
    expect(suggestAccepted("Kilom", units)).toBe("Kilometre");
    expect(suggestAccepted("furl", units)).toBe("Furlong");
    // Too short, too far, or a start shared by two answers: nothing is offered.
    expect(suggestAccepted("Kil", units)).toBeNull();
    expect(suggestAccepted("Kilogram", units)).toBeNull();
    expect(suggestAccepted("Lightyear", units)).toBeNull();
    expect(suggestAccepted("Nige", [{ canonical: "Niger", aliases: [], prior: 1 }, { canonical: "Nigeria", aliases: [], prior: 1 }])).toBeNull();
    // A short name is only offered for a one-letter slip.
    expect(suggestAccepted("Mle", units)).toBeNull();
    expect(suggestAccepted("Miel", units)).toBe("Mile");
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
    expect(nameOnePoints(0)).toBe(100);
    expect(nameOnePoints(0.02)).toBe(75);
    expect(nameOnePoints(0.05)).toBe(50);
    expect(nameOnePoints(0.15)).toBe(25);
    expect(nameOnePoints(1)).toBe(10);
  });

});

describe("altitude climb", () => {
  it("starts on the launch pad and reaches the Milky Way after ten correct answers", () => {
    expect(levelForCorrectCount(0).name).toBe("Launch pad");
    expect(levelForCorrectCount(1).name).toBe("Rooftops");
    expect(levelForCorrectCount(6).name).toBe("Edge of space");
    expect(levelForCorrectCount(10).name).toBe("Milky Way");
    expect(levelForCorrectCount(12).name).toBe("Milky Way");
  });

  it("lands a perfect run and a 5/10 on different worlds once misses hop a third", () => {
    expect(journeyProgress(10, 10)).toBe(10);
    expect(levelForJourney(10, 10).name).toBe("Milky Way");
    expect(levelForJourney(5, 10).name).toBe("Space station");
    expect(levelForJourney(0, 10).id).toBe("clouds");
    expect(levelForJourney(8, 10).name).toBe("Planets");
  });

  it("maps a Classic score onto the same rungs and stays spoiler-free", () => {
    expect(levelForClassicScore(0).id).toBe("launch");
    expect(levelForClassicScore(700).name).toBe("Milky Way");
    // Seven questions at up to 100 each: 500 is no longer a perfect run.
    expect(levelForClassicScore(500).name).not.toBe("Milky Way");
    expect(zoomShareLine(levelForCorrectCount(10))).toBe("🏁→🎈→🌌 reached the Milky Way");
    expect(zoomShareLine(levelForCorrectCount(6))).toBe("🏁→☁️→🚀 reached the edge of space");
    expect(zoomShareLine(levelForCorrectCount(10))).not.toContain("correct");
  });

  it("keeps private aliases out of the public country list", () => {
    expect(COUNTRIES).toContain("India");
    expect(COUNTRIES).toContain("Iceland");
    expect(COUNTRIES).not.toContain("Bharat");
    expect(COUNTRIES).not.toContain("Congo-Kinshasa");
  });
});
