import { useEffect, useRef, useState } from "react";

export const QUESTION_SECONDS = 25;
/** The countdown is drawn as ten blocks, one for every two and a half seconds, like an arcade power bar. */
const BLOCKS = 10;

/**
 * A 25-second countdown for one question. It starts the first time `running` is true, so the 3-second read before
 * it is free, and pauses its ticking while `running` is false (for example while an answer is being sent).
 * `penaltyMs` comes off the time left: each name that is not on the list costs 2 seconds.
 * It calls onExpire once when time runs out.
 */
export function QuestionTimer({
  questionKey,
  running,
  penaltyMs = 0,
  waitLabel,
  onExpire,
}: {
  questionKey: string;
  running: boolean;
  penaltyMs?: number;
  /** Shown instead of the seconds before the clock starts, like "Clock starts in 3". */
  waitLabel?: string;
  onExpire: () => void;
}) {
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

  const seconds = Math.ceil(left / 1000);
  const lit = Math.ceil((left / total) * BLOCKS);
  const waiting = waitLabel !== undefined && startRef.current === null;
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
