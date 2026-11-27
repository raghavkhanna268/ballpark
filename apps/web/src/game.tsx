import { useEffect, useRef, useState } from "react";
import { AFTERBURNER, NAME_CAP, classicStep, type QuestionType } from "@ballpark/shared";
import type { SkyTrail } from "./sky";

/**
 * Counts a number up to `value` like an arcade score tally. It starts at `from` (or at `value`, so a first render
 * shows the number as is), waits `delay`, then counts. A lower value, or reduced motion, jumps straight there.
 */
export function useCountUp(value: number, { from, delay = 0, duration = 700 }: { from?: number; delay?: number; duration?: number } = {}): number {
  const [shown, setShown] = useState(from ?? value);
  const shownRef = useRef(from ?? value);

  useEffect(() => {
    const start = shownRef.current;
    if (value <= start || prefersReducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const timer = window.setTimeout(() => {
      const began = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - began) / duration);
        const next = Math.round(start + (value - start) * (1 - (1 - t) ** 3));
        shownRef.current = next;
        setShown(next);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return shown;
}

/** A number that tallies up from zero when it first appears. Screen readers get the final value. */
export function CountUp({ value, delay = 250, duration = 900, pad = 0 }: { value: number; delay?: number; duration?: number; pad?: number }) {
  const shown = useCountUp(value, { from: 0, delay, duration });
  return (
    <>
      <span className="count" aria-hidden="true">
        {String(shown).padStart(pad, "0")}
      </span>
      <span className="sr">{value}</span>
    </>
  );
}

/** Right answers in a row at the end of what has been answered so far. */
export function currentCombo(points: Array<number | null>): number {
  let run = 0;
  for (const value of points) {
    if (value === null) break;
    run = value > 0 ? run + 1 : 0;
  }
  return run;
}

/** 1 for the smallest win up to 5 for the rarest, which sets the flame size and the pop-up glow. */
export function gainLevel(points: number, max: number): number {
  return Math.max(1, Math.min(5, Math.round((points / Math.max(1, max)) * 4) + 1));
}

/** The most a question of this type can score: 100 for naming one, 20 for the others. */
export function maxPoints(type: QuestionType): number {
  return type === "name_one" ? NAME_CAP : 20;
}

/** 0 for Liftoff up to 4 for Supernova, or -1 when an answer scored nothing. Sets the colours and the burner. */
export function tierOf(points: number, max: number): number {
  return points > 0 ? gainLevel(points, max) - 1 : -1;
}

type Scored = { points: number; boosted?: boolean };

/** A stage's points before the Afterburner doubled them, which is what sets its tier and colour. */
export function basePoints(reveal: Scored): number {
  return reveal.boosted ? reveal.points / AFTERBURNER : reveal.points;
}

/** How far one answered stage climbs: in proportion to its points, doubled by the Afterburner. */
export function stageStep(type: QuestionType, reveal: Scored, count: number): number {
  return classicStep(reveal.points, maxPoints(type), count, reveal.boosted ? AFTERBURNER : 1);
}

/** The climb so far as one stretch per scoring answer, in order, coloured by tier. */
export function trailOf(questions: Array<{ type: QuestionType; reveal: Scored | null }>, count: number): SkyTrail[] {
  const trail: SkyTrail[] = [];
  let at = 0;
  for (const question of questions) {
    if (!question.reveal) continue;
    const step = stageStep(question.type, question.reveal, count);
    if (step > 0) trail.push({ from: at, to: at + step, tier: tierOf(basePoints(question.reveal), maxPoints(question.type)) });
    at += step;
  }
  return trail;
}

/**
 * What a "name one" answer makes you, by tier, from the most said to the rarest: the big word on the result card.
 * The tier name (Liftoff … Supernova) still sits under it, and on the tiles, the ladder and the share card.
 */
const NAME_TITLE = ["Space Tourist", "Wingman", "Pathfinder", "Lone Voyager", "One of a Kind"];
const NAME_FLAVOUR = [
  "Rush hour on the launch pad. A small hop.",
  "You flew with the pack. Steady lift.",
  "Off the beaten track. Big lift!",
  "Hardly anyone came this way. Rare air.",
  "Nobody saw that coming. Full burn!",
];

/** The big word on a name-one result: what the answer makes you. Misses and timeouts keep the rocket on the ground. */
export function answerTitle(label: string, tier: number): string {
  if (tier < 0) return label === "Out of time" ? "Stuck on the Pad" : "Grounded";
  return NAME_TITLE[Math.min(4, tier)]!;
}
const GUESS_FLAVOUR = ["In the ballpark. A small hop.", "Not bad. Steady lift.", "Good call. Big lift!", "Very close. Rare air.", "Spot on! Full burn."];

/** One line under the result on what the answer did for the climb. */
export function flavourLine(label: string, tier: number, named: boolean): string {
  if (tier < 0) return label === "Out of time" ? "Time ran out. The rocket holds its height." : "No lift this time. The rocket holds its height.";
  return (named ? NAME_FLAVOUR : GUESS_FLAVOUR)[Math.min(4, tier)];
}

/** A picture for each result, shown big over the scene once the climb lands. */
const RESULT_ICON: Record<string, string> = {
  Liftoff: "🎈",
  Orbit: "🛰️",
  Moonshot: "🌙",
  "Deep space": "🪐",
  Supernova: "🌟",
  "Not on the list": "💨",
  "Out of time": "⏱️",
};

export function resultIcon(label: string, fallback: string): string {
  return RESULT_ICON[label] ?? fallback;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
