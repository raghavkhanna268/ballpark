import { useEffect, useRef, useState } from "react";

export const QUESTION_SECONDS = 25;
/** The countdown is drawn as ten blocks, one for every two and a half seconds, like an arcade power bar. */
const BLOCKS = 10;

type ClockInput = {
  questionKey: string;
  running: boolean;
  penaltyMs?: number;
  onExpire: () => void;
};

/**
 * A 25-second countdown for one question. It starts the first time `running` is true, so the 3-second read before
 * it is free, and pauses its ticking while `running` is false (for example while an answer is being sent).
 * `penaltyMs` comes off the time left: each name that is not on the list costs 2 seconds.
 * It calls onExpire once when time runs out.
 */
export function useQuestionClock({ questionKey, running, penaltyMs = 0, onExpire }: ClockInput): { left: number; total: number; started: boolean } {
  const total = QUESTION_SECONDS * 1000;
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    startRef.current = null;
    firedRef.current = false;
    setElapsed(0);
  }, [questionKey]);

  useEffect(() => {
    if (!running) return;
    if (startRef.current === null) startRef.current = performance.now();
    const started = startRef.current;
    const tick = () => setElapsed(performance.now() - started);
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [running, questionKey]);

  const left = Math.max(0, total - elapsed - penaltyMs);
  useEffect(() => {
    if (left > 0 || !running || startRef.current === null || firedRef.current) return;
    firedRef.current = true;
    expireRef.current();
  }, [left, running]);

  return { left, total, started: startRef.current !== null };
}

/** The clock as ten blocks on the card, for the question types that answer on the card. */
export function QuestionTimer({
  waitLabel,
  ...clock
}: ClockInput & {
  /** Shown instead of the seconds before the clock starts, like "Clock starts in 3". */
  waitLabel?: string;
}) {
  const { left, total, started } = useQuestionClock(clock);
  const seconds = Math.ceil(left / 1000);
  const lit = Math.ceil((left / total) * BLOCKS);
  const waiting = waitLabel !== undefined && !started;
  return (
    <div
      className={`timer ${waiting ? "waiting" : left <= 0 ? "out" : seconds <= 10 ? "low" : ""}`}
      role="timer"
      aria-label={waiting ? waitLabel : `${seconds} seconds left`}
    >
      <div className="timer-track" aria-hidden="true">
        {Array.from({ length: BLOCKS }, (_, block) => (
          <i key={block} className={block < lit ? "on" : ""} />
        ))}
      </div>
      <span className="mono">{waiting ? waitLabel : left <= 0 ? "Time" : `${seconds}s`}</span>
    </div>
  );
}

const RING = 2 * Math.PI * 23;

/**
 * The clock in the answer bar: the seconds left inside a ring that empties. During the 3-second read it shows the
 * read count in amber instead.
 */
export function ClockRing({ left, total, read }: { left: number; total: number; read: number }) {
  const seconds = Math.ceil(left / 1000);
  const state = read > 0 ? "waiting" : left <= 0 ? "out" : seconds <= 10 ? "low" : "";
  return (
    <div className={`clock-ring ${state}`} role="timer" aria-label={read > 0 ? `Clock starts in ${read}` : `${seconds} seconds left`}>
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <circle className="clock-track" cx="27" cy="27" r="23" />
        <circle className="clock-left" cx="27" cy="27" r="23" strokeDasharray={RING} strokeDashoffset={read > 0 ? 0 : RING * (1 - left / total)} />
      </svg>
      <b aria-hidden="true">{read > 0 ? read : seconds}</b>
    </div>
  );
}

/** A thin line under the answer box that burns down with the clock. */
export function ClockFuse({ left, total, read }: { left: number; total: number; read: number }) {
  const low = read === 0 && left <= 10_000;
  return (
    <i className={`clock-fuse${low ? " low" : ""}`} aria-hidden="true">
      <b style={{ transform: `scaleX(${read > 0 ? 1 : left / total})` }} />
    </i>
  );
}
