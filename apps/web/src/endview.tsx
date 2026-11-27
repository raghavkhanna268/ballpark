import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { slam } from "./fx";
import type { PublicQuestion } from "@ballpark/shared";
import { CountUp, basePoints, maxPoints, resultIcon, tierOf } from "./game";
import { useJourney } from "./journey";
import { tierColor } from "./sky";

/**
 * The pieces of the end screens, laid out like the end of a Krillion dive: no card, a big score, everyone's scores
 * as a curve, then the climb log, each over the dimmed scene. Share and Home wait in a bar at the bottom.
 */

/** "Mission complete" on the left, which game and which day on the right. */
export function EndTop({ title, kicker }: { title: string; kicker: string }) {
  return (
    <header className="end-top">
      <p className="end-title">{title}</p>
      <p className="end-kicker">{kicker}</p>
    </header>
  );
}

/** The score, big, with the height it reached beside it and the landmark it passed under it. */
export function BigScore({ score, reached, note }: { score: number; reached: string; note?: string }) {
  const comma = reached.indexOf(", ");
  const height = comma < 0 ? reached : reached.slice(0, comma);
  const past = comma < 0 ? "" : reached.slice(comma + 2);
  const scoreRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    // The count-up runs for 1.1 seconds after a short wait. When it stops, the number slams.
    if (scoreRef.current && score > 0) slam(scoreRef.current, { delay: 1380, scale: 1.22 });
  }, [score]);
  return (
    <div className="end-big">
      <p className="end-score" ref={scoreRef}>
        <CountUp value={score} duration={1100} />
        <span className="sr"> points</span>
      </p>
      <p className="end-height">
        <b>↑ {height}</b>
        {past ? <span>{past}</span> : null}
        {note ? <small>{note}</small> : null}
      </p>
    </div>
  );
}

/** A section heading with a dashed rule running out to the right: "CLIMB LOG  HIGHER = RARER - - - -". */
export function EndRule({ title, note }: { title: string; note?: string }) {
  return (
    <h3 className="end-rule">
      <span>{title}</span>
      {note ? <small>{note}</small> : null}
    </h3>
  );
}

/** The bar at the bottom of the screen, in the same slot as the answer bar. */
export function EndDock({ children }: { children: ReactNode }) {
  const { dockSlot } = useJourney();
  const bar = (
    <div className="end-dock">
      <div className="end-dock-bar">{children}</div>
    </div>
  );
  return dockSlot ? createPortal(bar, dockSlot) : bar;
}

/** Each tier's line on the climb log, at its share of a full answer's points. */
const LEVELS = [
  { at: 10, name: "Liftoff" },
  { at: 25, name: "Orbit" },
  { at: 50, name: "Moonshot" },
  { at: 75, name: "Deep space" },
  { at: 100, name: "Supernova" },
];
const LOG = { W: 360, H: 184, left: 66, right: 10, top: 12, base: 160 };

/** One mark per stage, as high as its answer was rare, on lines for the tiers. Misses sit on the ground. */
export function ClimbLog({ questions }: { questions: PublicQuestion[] }) {
  const { W, H, left, right, top, base } = LOG;
  const [ref, seen] = useInView<HTMLElement>();
  const count = Math.max(1, questions.length);
  const y = (share: number) => base - (share / 100) * (base - top);
  const x = (index: number) => left + ((index + 0.5) / count) * (W - left - right);
  // Once the log scrolls into view, each stage's stem grows up from the ground in turn and its icon pops on top.
  return (
    <figure className={seen ? "climb-log in-view" : "climb-log"} ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Each answer’s climb. Higher means fewer players said it.">
        {LEVELS.map((level, tier) => (
          <g key={level.name} className="log-level">
            <line x1={left} x2={W - right} y1={y(level.at)} y2={y(level.at)} />
            <text x={left - 8} y={y(level.at) + 3} textAnchor="end" style={{ fill: tierColor(tier) }}>
              {level.name}
            </text>
          </g>
        ))}
        <line className="log-ground" x1={left} x2={W - right} y1={base} y2={base} />
        {questions.map((question, index) => {
          const reveal = question.reveal;
          const cx = x(index);
          const number = (
            <text x={cx} y={base + 17} textAnchor="middle" className="log-no">
              {index + 1}
            </text>
          );
          if (!reveal) return <g key={question.id}>{number}</g>;
          const max = maxPoints(question.type);
          const scored = reveal.points > 0;
          const tier = scored ? tierOf(basePoints(reveal), max) : -1;
          const share = scored ? Math.min(100, (basePoints(reveal) / max) * 100) : 0;
          const icon = question.type === "name_one" ? resultIcon(reveal.label, reveal.emoji) : reveal.emoji;
          const color = tierColor(tier);
          const iconY = scored ? y(share) : base - 9;
          return (
            <g key={question.id} className={scored ? "log-stage" : "log-stage miss"} style={{ ["--d" as string]: `${200 + index * 160}ms` }}>
              {scored ? <line x1={cx} x2={cx} y1={base} y2={iconY + 10} stroke={color} className="log-stem" /> : null}
              <text x={cx} y={iconY + 6} textAnchor="middle" className="log-icon" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
                {icon}
              </text>
              {reveal.boosted ? (
                <text x={cx + 12} y={iconY - 8} className="log-boost">
                  ×2
                </text>
              ) : null}
              {number}
              <title>{`Stage ${index + 1}: ${reveal.label}, ${reveal.points} points`}</title>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** What the day's total says, from a quiet day to a once-in-a-while one. Yours is lit and the rest are dim. */
const RATINGS = [
  { from: 0, icon: "🎈", line: "Launch pad. The crowd’s answers kept you low today." },
  { from: 0.2, icon: "🛰️", line: "Low orbit. A few brave picks got you off the ground." },
  { from: 0.4, icon: "🌙", line: "Moon run. You think a little sideways." },
  { from: 0.6, icon: "🪐", line: "Deep space. Hardly anyone flew this far today." },
  { from: 0.8, icon: "🌟", line: "Supernova. A flight people will talk about." },
];

export function FlightRating({ score, max }: { score: number; max: number }) {
  const bands = RATINGS.map((rating, index) => {
    const low = Math.round(max * rating.from);
    const next = RATINGS[index + 1];
    return { ...rating, low, range: next ? `${low}–${Math.round(max * next.from) - 1}` : `${low}+` };
  });
  const mine = bands.reduce((found, band, index) => (score >= band.low ? index : found), 0);
  const [ref, seen] = useInView<HTMLOListElement>();
  // In view, a light runs down the bands and stops on yours, which lights up from the left.
  return (
    <ol className={seen ? "rating in-view" : "rating"} ref={ref} style={{ ["--mine" as string]: mine }}>
      {bands.map((band, index) => (
        <li key={band.from} className={index === mine ? "you" : index < mine ? "under" : undefined} style={{ ["--i" as string]: index }}>
          <span className="rating-icon" aria-hidden="true">
            {band.icon}
          </span>
          <span className="rating-range">{band.range}</span>
          <span className="rating-line">
            {band.line}
            {index === mine ? <span className="sr"> (you)</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The most points these questions can give before the Afterburner. */
export function maxScore(questions: PublicQuestion[]): number {
  return questions.reduce((sum, question) => sum + maxPoints(question.type), 0);
}

/** True once the element has scrolled into view, for a piece of the end screen that builds itself when seen. */
function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setSeen(true);
        observer.disconnect();
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);
  return [ref, seen];
}
