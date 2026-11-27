import { useEffect, useRef, useState } from "react";

export const QUESTION_SECONDS = 30;
/** The countdown is drawn as ten blocks, one for every three seconds, like an arcade power bar. */
const BLOCKS = 10;

/**
 * A 30-second countdown for one question. It calls onExpire once when time runs out,
 * and stops while `running` is false (for example while an answer is being sent).
 */
export function QuestionTimer({ questionKey, running, onExpire }: { questionKey: string; running: boolean; onExpire: () => void }) {
  const total = QUESTION_SECONDS * 1000;
  const [left, setLeft] = useState(total);
  const startRef = useRef(performance.now());
  const firedRef = useRef(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    startRef.current = performance.now();
    firedRef.current = false;
    setLeft(total);
  }, [questionKey]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, total - (performance.now() - startRef.current));
      setLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        expireRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running, questionKey]);

  const seconds = Math.ceil(left / 1000);
  const lit = Math.ceil((left / total) * BLOCKS);
  return (
    <div className={`timer ${left <= 0 ? "out" : seconds <= 10 ? "low" : ""}`} role="timer" aria-label={`${seconds} seconds left`}>
      <div className="timer-track" aria-hidden="true">
        {Array.from({ length: BLOCKS }, (_, block) => (
          <i key={block} className={block < lit ? "on" : ""} />
        ))}
      </div>
      <span className="mono">{left <= 0 ? "Time" : `${seconds}s`}</span>
    </div>
  );
}
