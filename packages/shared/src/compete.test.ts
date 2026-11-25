import { describe, expect, it } from "vitest";
import { advanceStreak, callsign, liveStreak, nextTier, parseRace, placement, raceCode, weekEnd, weekStart } from "./compete.js";

describe("placement", () => {
  it("ranks by score with shared ranks for ties, and names the gap to the next rank up", () => {
    expect(placement(300, [500, 400, 400, 300, 100])).toMatchObject({ rank: 4, players: 5, next: { rank: 2, gap: 100 } });
    expect(placement(500, [500, 400])).toMatchObject({ rank: 1, players: 2, next: null });
    expect(placement(400, [500, 400, 400])).toMatchObject({ rank: 2, players: 3, next: { rank: 1, gap: 100 } });
    expect(placement(7, [])).toMatchObject({ rank: 1, players: 1, next: null });
  });

  it("says what share of the others you beat, ties not counted, and nothing when you played alone", () => {
    expect(placement(300, [500, 400, 400, 300, 100]).betterThan).toBe(25);
    expect(placement(500, [500, 400]).betterThan).toBe(100);
    expect(placement(400, [500, 400, 400]).betterThan).toBe(0);
    expect(placement(7, []).betterThan).toBeNull();
  });

  it("counts every score into bands from 0 to the top for the curve", () => {
    const place = placement(260, [520, 270, 260, 90, 0]);
    expect(place.spread.top).toBe(600);
    expect(place.spread.you).toBe(260);
    expect(place.spread.bins).toHaveLength(14);
    expect(place.spread.bins.reduce((sum, count) => sum + count, 0)).toBe(5);
    expect(place.spread.bins[0]).toBe(1);
    expect(place.spread.bins[6]).toBe(2);
    // A fixed top, like Head-to-head's ten picks: a perfect run sits in the last band.
    const picks = placement(10, [10, 7, 3], 10);
    expect(picks.spread.bins).toHaveLength(10);
    expect(picks.spread.bins[9]).toBe(1);
  });
});

describe("race links", () => {
  it("round-trips a climb and rejects junk", () => {
    expect(raceCode("classic", 326, 7.354)).toBe("c326-735");
    expect(parseRace("c326-735")).toEqual({ mode: "classic", puzzleNumber: 326, progress: 7.35 });
    expect(parseRace("h12-1000")).toEqual({ mode: "h2h", puzzleNumber: 12, progress: 10 });
    expect(parseRace("h12-1143")).toEqual({ mode: "h2h", puzzleNumber: 12, progress: 11.43 });
    expect(parseRace("h12-1201")).toBeNull();
    expect(parseRace(raceCode("classic", 40, 6.5, "gold"))).toEqual({ mode: "classic", puzzleNumber: 40, progress: 6.5, skin: "gold" });
    expect(raceCode("classic", 40, 6.5, "Not a skin!")).toBe("c40-650");
    expect(parseRace("c40-650.<b>")).toBeNull();
    expect(parseRace("x12-100")).toBeNull();
    expect(parseRace("<script>")).toBeNull();
  });
});

describe("league weeks", () => {
  it("runs Monday to Sunday in UTC", () => {
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
    expect(weekEnd("2026-11-18")).toBe("2026-11-22");
  });

  it("moves the top five up and, in a big group, the bottom five down", () => {
    expect(nextTier(0, 5, 20, 120)).toBe(1);
    expect(nextTier(4, 1, 30, 900)).toBe(4);
    expect(nextTier(2, 6, 8, 120)).toBe(2);
    expect(nextTier(2, 26, 30, 10)).toBe(1);
    expect(nextTier(0, 30, 30, 0)).toBe(0);
    expect(nextTier(1, 1, 1, 0)).toBe(1);
    // Bots fill every group, so a small group of people still moves.
    expect(nextTier(0, 1, 19, 500)).toBe(1);
    expect(nextTier(2, 19, 19, 0)).toBe(1);
  });

  it("gives every device a stable callsign", () => {
    expect(callsign("device-a")).toBe(callsign("device-a"));
    expect(callsign("device-a")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/);
  });
});

describe("streak shield", () => {
  const base = { currentStreak: 4, lastPlayedDate: "2026-11-18", shieldWeek: null };

  it("keeps the streak over one missed day, once a week", () => {
    const saved = advanceStreak(base, "2026-11-20");
    expect(saved).toMatchObject({ currentStreak: 5, shielded: true, shieldWeek: "2026-11-16" });
    const again = advanceStreak({ ...saved, lastPlayedDate: "2026-11-20" }, "2026-11-22");
    expect(again).toMatchObject({ currentStreak: 1, shielded: false });
  });

  it("breaks on two missed days and counts up on consecutive days", () => {
    expect(advanceStreak(base, "2026-11-21").currentStreak).toBe(1);
    expect(advanceStreak(base, "2026-11-19").currentStreak).toBe(5);
  });

  it("shows the live streak before you play", () => {
    expect(liveStreak(base, "2026-11-19")).toBe(4);
    expect(liveStreak(base, "2026-11-20")).toBe(4);
    expect(liveStreak({ ...base, shieldWeek: "2026-11-16" }, "2026-11-20")).toBe(0);
    expect(liveStreak(base, "2026-11-21")).toBe(0);
  });
});
