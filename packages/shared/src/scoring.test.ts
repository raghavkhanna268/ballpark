import { describe, expect, it } from "vitest";
import { beatPercent, distributionBucket, puzzleNumber, puzzleSlot } from "./dates.js";
import { formatFactor } from "./format.js";
import { parseShorthand } from "./parse.js";
import { classicShareText } from "./share.js";
import {
  compareScore,
  estimateBand,
  estimateScore,
  kendallDistance,
  logDistance,
  rankScore,
} from "./scoring.js";

const ANSWER = 1000;

describe("estimate bands", () => {
  it("scores an exact guess as green", () => {
    expect(estimateBand(ANSWER, ANSWER)).toBe("green");
    expect(logDistance(ANSWER, ANSWER)).toBe(0);
  });

  it("treats a factor of 1.1 as within 10%", () => {
    expect(estimateBand(ANSWER * 1.1, ANSWER)).toBe("green");
    expect(estimateBand(ANSWER / 1.1, ANSWER)).toBe("green");
  });

  it("steps from green to yellow just past the 10% cutoff", () => {
    expect(estimateBand(ANSWER * 1.1, ANSWER)).toBe("green");
    expect(estimateBand(ANSWER * 1.15, ANSWER)).toBe("yellow");
    expect(logDistance(ANSWER * 1.15, ANSWER)).toBeGreaterThan(0.0414);
    expect(logDistance(ANSWER * 1.15, ANSWER)).toBeLessThan(0.301);
  });

  it("treats an exact factor of 2 as within 2×", () => {
    expect(estimateBand(ANSWER * 2, ANSWER)).toBe("yellow");
    expect(estimateBand(ANSWER / 2, ANSWER)).toBe("yellow");
  });

  it("uses the 10× and 100× cutoffs", () => {
    expect(estimateBand(ANSWER * 10, ANSWER)).toBe("blue");
    expect(estimateBand(ANSWER / 10, ANSWER)).toBe("blue");
    expect(estimateBand(ANSWER * 100, ANSWER)).toBe("brown");
    expect(estimateBand(ANSWER / 100, ANSWER)).toBe("brown");
    expect(estimateBand(ANSWER * 100.5, ANSWER)).toBe("black");
    expect(estimateBand(ANSWER / 1000, ANSWER)).toBe("black");
  });

  it("rejects non-positive numbers", () => {
    expect(() => estimateBand(0, ANSWER)).toThrow(/positive/);
    expect(() => estimateBand(-5, ANSWER)).toThrow(/positive/);
  });
});

describe("confidence modifier", () => {
  it("pays narrow more inside 2× and less outside it", () => {
    const close = ANSWER * 1.5;
    const far = ANSWER * 10;
    const narrowClose = estimateScore(close, ANSWER, "narrow");
    const wideClose = estimateScore(close, ANSWER, "wide");
    const narrowFar = estimateScore(far, ANSWER, "narrow");
    const wideFar = estimateScore(far, ANSWER, "wide");

    expect(narrowClose.band).toBe("yellow");
    expect(narrowClose.points).toBe(wideClose.points + 4);
    expect(narrowClose.confidenceDelta).toBe(4);

    expect(narrowFar.band).toBe("blue");
    expect(narrowFar.points).toBe(wideFar.points - 4);
    expect(narrowFar.confidenceDelta).toBe(-4);
  });

  it("caps a narrow exact guess at 20 and floors a narrow miss at 0", () => {
    expect(estimateScore(ANSWER, ANSWER, "narrow").points).toBe(20);
    expect(estimateScore(ANSWER, ANSWER, "medium").points).toBe(18);
    expect(estimateScore(ANSWER, ANSWER, "wide").points).toBe(16);
    expect(estimateScore(ANSWER * 10_000, ANSWER, "narrow").points).toBe(0);
    expect(estimateScore(ANSWER * 100, ANSWER, "narrow").points).toBe(0);
    expect(estimateScore(ANSWER * 100, ANSWER, "wide").points).toBe(4);
  });

  it("applies a smaller medium adjustment", () => {
    const close = estimateScore(ANSWER * 2, ANSWER, "medium");
    const far = estimateScore(ANSWER * 10, ANSWER, "medium");
    expect(close.points).toBe(14);
    expect(far.points).toBe(6);
  });
});

describe("compare and rank scoring", () => {
  it("maps compare to green or black", () => {
    expect(compareScore("a", "a")).toEqual({ band: "green", points: 20 });
    expect(compareScore("b", "a")).toEqual({ band: "black", points: 0 });
  });

  it("gives yellow for a single adjacent swap and black past that", () => {
    const correct = ["a", "b", "c", "d"];
    expect(kendallDistance(correct, correct)).toBe(0);
    expect(rankScore(correct, correct)).toEqual({ band: "green", points: 20 });

    expect(kendallDistance(["a", "b", "d", "c"], correct)).toBe(1);
    expect(rankScore(["a", "b", "d", "c"], correct)).toEqual({ band: "yellow", points: 12 });

    expect(kendallDistance(["b", "a", "c"], ["a", "b", "c"])).toBe(1);
    expect(rankScore(["c", "b", "a"], ["a", "b", "c"]).band).toBe("black");
    expect(rankScore(["b", "c", "a"], ["a", "b", "c"]).band).toBe("black");
  });
});

describe("shorthand, share text, and the daily number", () => {
  it("parses k, M, B, commas, and scientific notation", () => {
    expect(parseShorthand("1.5k")).toBe(1500);
    expect(parseShorthand("2M")).toBe(2_000_000);
    expect(parseShorthand("3b")).toBe(3_000_000_000);
    expect(parseShorthand("384,400")).toBe(384400);
    expect(parseShorthand("1.5e8")).toBe(150_000_000);
    expect(parseShorthand("0")).toBeNull();
    expect(parseShorthand("-4")).toBeNull();
    expect(parseShorthand("nope")).toBeNull();
  });

  it("builds the spoiler-free share card", () => {
    expect(classicShareText(12, ["🟩", "🟨", "🟦", "🟩", "⬛"], 260, "ballpark.local", "🏁→🏙️→🎈 reached the stratosphere", "c12-520")).toBe(
      "Ballpark #12 · Classic\n🟩🟨🟦🟩⬛ 260 pts\n🏁→🏙️→🎈 reached the stratosphere\nRace my climb: ballpark.local/?race=c12-520",
    );
  });

  it("numbers puzzles from the UTC epoch and rotates the sample seed", () => {
    expect(puzzleNumber("2026-01-01")).toBe(1);
    expect(puzzleNumber("2026-01-12")).toBe(12);
    expect(puzzleNumber("2026-11-21")).toBe(325);
    expect(puzzleSlot("2026-01-01")).toBe(0);
    expect(puzzleSlot("2026-01-10")).toBe(9);
    expect(puzzleSlot("2026-01-17")).toBe(16);
    expect(puzzleSlot("2026-01-18")).toBe(0);
  });

  it("reports a percentile for a single player and ignores ties", () => {
    expect(beatPercent(70, [70])).toBe(100);
    expect(beatPercent(80, [80, 40])).toBe(100);
    expect(beatPercent(40, [80, 40])).toBe(0);
    expect(beatPercent(50, [50, 50, 10])).toBe(50);
  });

  it("buckets a day's score for the local distribution", () => {
    expect(distributionBucket(0)).toBe(0);
    expect(distributionBucket(140)).toBe(0);
    expect(distributionBucket(141)).toBe(1);
    expect(distributionBucket(560)).toBe(3);
    expect(distributionBucket(700)).toBe(4);
  });

  it("describes the factor without putting it on the share card", () => {
    expect(formatFactor(1800, 1000).text).toBe("1.8× high");
    expect(formatFactor(500, 1000).direction).toBe("low");
  });
});
