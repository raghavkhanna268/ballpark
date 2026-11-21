import { useEffect, useRef, useState } from "react";
import { SCALE_LEVELS, type ScaleLevel } from "@ballpark/shared";
import "./scale.css";

export function ScaleStage({ level, label = "You are here" }: { level: ScaleLevel; label?: string }) {
  const reduced = useReducedMotion();
  const [previous, setPrevious] = useState<string | null>(null);
  const seen = useRef(level.id);

  useEffect(() => {
    if (seen.current === level.id) return;
    setPrevious(seen.current);
    seen.current = level.id;
    const timer = window.setTimeout(() => setPrevious(null), reduced ? 420 : 800);
    return () => window.clearTimeout(timer);
  }, [level.id, reduced]);

  const here = level.extra && level.extra > 1 ? `${level.name} +${level.extra}` : level.name;
  const ticks = level.beyond ? [...SCALE_LEVELS, { ...level, exponent: level.exponent }] : SCALE_LEVELS;

  return (
    <section className={reduced ? "scale-stage quiet" : "scale-stage"} aria-label={`${label}: ${here}`} data-scale={level.id}>
      <div className="scale-frame">
        {previous ? <Scene id={previous} className="depart" /> : null}
        <Scene id={level.beyond ? "beyond" : level.id} className={previous ? "arrive" : ""} />
        <p className="scale-here">
          {label}: {here}
        </p>
      </div>
      <div className="scale-meter" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick.id} className={tick.exponent <= level.exponent ? "on" : ""} aria-current={tick.id === level.id ? "true" : undefined}>
            10<sup>{tick.exponent}</sup>
          </span>
        ))}
      </div>
    </section>
  );
}

export function LevelStrip({ level }: { level: ScaleLevel }) {
  const index = level.beyond ? SCALE_LEVELS.length : Math.max(0, SCALE_LEVELS.findIndex((item) => item.id === level.id));
  const shown = SCALE_LEVELS.slice(0, level.beyond ? SCALE_LEVELS.length : index + 1);
  return (
    <ol className="level-strip" aria-label="Levels on this run">
      {shown.map((item) => (
        <li key={item.id}>
          <span aria-hidden="true">{item.emoji}</span> {item.name}
        </li>
      ))}
      {level.beyond ? (
        <li>
          <span aria-hidden="true">{level.emoji}</span> {level.name}
        </li>
      ) : null}
    </ol>
  );
}

function Scene({ id, className }: { id: string; className: string }) {
  return (
    <div className={`scale-scene ${className}`.trim()} data-scene={id}>
      <div className={`world world-${id}`}>
        <span className="blob a" />
        <span className="blob b" />
        <span className="blob c" />
        <span className="ring" />
      </div>
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
