import { describe, expect, it } from "vitest";
import { nextDayStart, playToday } from "./dates.js";
import {
  AFTERBURNER,
  MAX_PROGRESS,
  MILESTONES,
  altitudeKm,
  classicStep,
  climbShareLine,
  climbedPhrase,
  formatDistance,
  milestoneAt,
  milestonesReached,
  nextMilestone,
} from "./scale.js";

describe("classicStep", () => {
  it("climbs in proportion to points, with no base amount", () => {
    const liftoff = classicStep(10, 100, 7);
    const supernova = classicStep(100, 100, 7);
    expect(supernova / liftoff).toBeCloseTo(10);
    expect(classicStep(0, 100, 7)).toBe(0);
  });

  it("takes a perfect run to the Milky Way whatever its length", () => {
    expect(7 * classicStep(100, 100, 7)).toBeCloseTo(10);
    expect(5 * classicStep(100, 100, 5)).toBeCloseTo(10);
  });

  it("doubles one Afterburner stage's climb, and only up to double the top step", () => {
    expect(classicStep(50 * AFTERBURNER, 100, 7, AFTERBURNER)).toBeCloseTo(2 * classicStep(50, 100, 7));
    expect(classicStep(100 * AFTERBURNER, 100, 7, AFTERBURNER)).toBeCloseTo(20 / 7);
    expect(classicStep(500, 100, 7, AFTERBURNER)).toBeCloseTo(20 / 7);
    expect(6 * classicStep(100, 100, 7) + classicStep(200, 100, 7, AFTERBURNER)).toBeCloseTo(MAX_PROGRESS);
  });
});

describe("altitude", () => {
  it("hits each landmark's real height at its place on the climb", () => {
    for (const milestone of MILESTONES) {
      if (milestone.km === 0) expect(altitudeKm(milestone.at)).toBe(0);
      else expect(altitudeKm(milestone.at) / milestone.km).toBeCloseTo(1, 9);
    }
  });

  it("only ever goes up", () => {
    let last = -1;
    for (let progress = 0; progress <= MAX_PROGRESS; progress += 0.05) {
      const km = altitudeKm(progress);
      expect(km).toBeGreaterThan(last);
      last = km;
    }
  });

  it("writes heights the way people say them", () => {
    expect(formatDistance(0.073)).toBe("73 m");
    expect(formatDistance(9.6)).toBe("9.6 km");
    expect(formatDistance(384_400)).toBe("384,400 km");
    expect(formatDistance(2.25e8)).toBe("225 million km");
    expect(formatDistance(1.43e9)).toBe("1.4 billion km");
    expect(formatDistance(2.4599e17)).toBe("26,000 light years");
  });

  it("names the landmark passed and the next one", () => {
    expect(milestoneAt(1.4).name).toBe("Everest summit");
    expect(nextMilestone(1.4)?.name).toBe("Where jets cruise");
    expect(nextMilestone(10)?.name).toBe("Andromeda");
    expect(nextMilestone(MAX_PROGRESS)).toBeNull();
    expect(milestonesReached(0)).toBe(0);
    expect(milestonesReached(10)).toBe(MILESTONES.length - 2);
    expect(milestonesReached(MAX_PROGRESS)).toBe(MILESTONES.length - 1);
  });

  it("puts the height and landmark on the share card without answers", () => {
    expect(climbShareLine(0)).toBe("🚀 still on the launch pad");
    expect(climbShareLine(1.4)).toMatch(/^🚀 \d+\.\d km · past Everest summit$/);
    expect(climbedPhrase(6.3)).toBe("384,000 km, past the Moon");
  });
});

describe("game day", () => {
  it("turns over at midnight India time", () => {
    expect(playToday(new Date("2026-11-24T18:29:00Z"))).toBe("2026-11-24");
    expect(playToday(new Date("2026-11-24T18:30:00Z"))).toBe("2026-11-25");
  });

  it("knows when the next day starts", () => {
    expect(nextDayStart(new Date("2026-11-24T19:00:00Z")).toISOString()).toBe("2026-11-25T18:30:00.000Z");
    expect(nextDayStart(new Date("2026-11-24T10:00:00Z")).toISOString()).toBe("2026-11-24T18:30:00.000Z");
  });
});
