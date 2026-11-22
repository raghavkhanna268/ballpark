import { useEffect, useRef, useState } from "react";

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

/** Stage by stage points, counted in one after another, then the best combo. Shared with the Classic end screen. */
export function Tally({ rows }: { rows: Array<{ emoji: string; label: string; points: number } | null> }) {
  const combo = bestCombo(rows.map((row) => row?.points ?? null));
  return (
    <div className="tally-block">
      <ol className="tally">
        {rows.map((row, index) =>
          row ? (
            <li key={index} style={{ animationDelay: `${300 + index * 140}ms` }}>
              <span className="tally-stage">Stage {index + 1}</span>
              <span className="tally-label">
                <span aria-hidden="true">{row.emoji}</span> {row.label}
              </span>
              <b>{row.points > 0 ? `+${row.points}` : "0"}</b>
            </li>
          ) : null,
        )}
      </ol>
      {combo >= 2 ? <p className="best-combo">Best combo x{combo}</p> : null}
    </div>
  );
}

/** The longest run of answers that scored, for the combo meter and the end screen. */
export function bestCombo(points: Array<number | null>): number {
  let best = 0;
  let run = 0;
  for (const value of points) {
    if (value === null) break;
    run = value > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
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

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
