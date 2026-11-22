import { useEffect, useRef, useState } from "react";

export const QUESTION_SECONDS = 30;

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
  return (
    <div className={`timer ${left <= 0 ? "out" : seconds <= 10 ? "low" : ""}`} role="timer" aria-label={`${seconds} seconds left`}>
      <div className="timer-track">
        <b style={{ transform: `scaleX(${left / total})` }} />
      </div>
      <span className="mono">{left <= 0 ? "Time" : `${seconds}s`}</span>
    </div>
  );
}
