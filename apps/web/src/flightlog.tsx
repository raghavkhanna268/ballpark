import {
  CLASSIC_QUESTIONS,
  MILESTONES,
  formatAltitude,
  milestoneAt,
  type BoardRow,
  type ClimbCurve,
  type PublicQuestion,
  type TodayStats,
} from "@ballpark/shared";
import { basePoints, maxPoints, stageStep, tierOf } from "./game";
import { RocketIcon, skinById, SKINS } from "./hangar";
import { MISS_COLOR, tierColor } from "./sky";

/**
 * The flight log on the end screen: your climb stage by stage past the landmarks, where it sits among today's
 * climbs (bots included), and The catch (what you answered and how many others said the same).
 */

type Stage = { index: number; from: number; to: number; tier: number; boosted: boolean };

function stagesOf(questions: PublicQuestion[]): Stage[] {
  const stages: Stage[] = [];
  let at = 0;
  questions.forEach((question, index) => {
    if (!question.reveal) return;
    const step = stageStep(question.type, question.reveal, CLASSIC_QUESTIONS);
    stages.push({ index, from: at, to: at + step, tier: step > 0 ? tierOf(basePoints(question.reveal), maxPoints(question.type)) : -1, boosted: question.reveal.boosted });
    at += step;
  });
  return stages;
}

/** Your climb as a staircase: one step per stage in its tier's colour, with the landmarks you passed as lines. */
export function FlightPath({ questions }: { questions: PublicQuestion[] }) {
  const stages = stagesOf(questions);
  const end = stages.length > 0 ? stages[stages.length - 1]!.to : 0;
  const top = Math.max(1, end * 1.12);
  const W = 320;
  const H = 168;
  const left = 8;
  const right = 104;
  const x = (stage: number) => left + (stage / CLASSIC_QUESTIONS) * (W - left - right);
  const y = (progress: number) => H - 14 - (progress / top) * (H - 30);
  const passed = MILESTONES.filter((milestone) => milestone.at > 0 && milestone.at <= end + 1e-6);
  // Up to four landmark lines: the highest ones you passed read best.
  const lines = passed.slice(-4);
  return (
    <figure className="flight-path">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Your climb, stage by stage, to ${formatAltitude(end)}`}>
        {lines.map((milestone) => (
          <g key={milestone.id} className="mile-line">
            <line x1={left} x2={W - right + 6} y1={y(milestone.at)} y2={y(milestone.at)} />
            <text x={W - right + 10} y={y(milestone.at) + 3}>
              {milestone.name}
            </text>
          </g>
        ))}
        <line className="ground" x1={left} x2={W - right + 6} y1={y(0)} y2={y(0)} />
        {stages.map((stage, order) => {
          const x0 = x(order);
          const x1 = x(order + 1);
          const color = stage.tier >= 0 ? tierColor(stage.tier) : MISS_COLOR;
          return (
            <g key={stage.index}>
              <path d={`M${x0} ${y(stage.from)} L${x0} ${y(stage.to)} L${x1} ${y(stage.to)}`} stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <circle cx={x0} cy={y(stage.to)} r="4" fill={color} />
              {stage.boosted ? (
                <text className="boost-mark" x={x0 + 6} y={y(stage.to) - 6}>
                  ×2
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption>
        {formatAltitude(end)}
        {end > 0 ? ` · past ${milestoneAt(end).name}` : ""}
      </figcaption>
    </figure>
  );
}

/** Today's finished climbs, bots included, as bars with yours marked. */
export function CurveChart({ curve }: { curve: ClimbCurve | null }) {
  if (!curve) return <p className="hint">Finish today’s climb to see where it lands.</p>;
  const most = Math.max(1, ...curve.bins);
  const youAt = Math.min(0.999, curve.you / curve.top);
  return (
    <figure className="curve">
      <figcaption>
        <strong>Higher than {curve.higherThan}%</strong> of today’s climbs
      </figcaption>
      <div className="curve-bars" aria-hidden="true">
        {curve.bins.map((count, index) => {
          const mine = Math.floor(youAt * curve.bins.length) === index;
          return <i key={index} className={mine ? "you" : ""} style={{ height: `${Math.max(4, (count / most) * 100)}%` }} />;
        })}
        <b className="curve-you" style={{ left: `${youAt * 100}%` }}>
          You
        </b>
      </div>
      <p className="curve-axis">
        <span>Launch pad</span>
        <span>{formatAltitude(curve.top)}</span>
      </p>
    </figure>
  );
}

/** Each stage: what you answered, its tier, and how many players said the same. */
export function TheCatch({ questions }: { questions: PublicQuestion[] }) {
  return (
    <ol className="catch">
      {questions.map((question, index) => {
        const reveal = question.reveal;
        if (!reveal) return null;
        const tier = reveal.points > 0 ? tierOf(basePoints(reveal), maxPoints(question.type)) : -1;
        const crowd = reveal.crowd.kind === "named" ? reveal.crowd : null;
        const said =
          crowd && crowd.answer
            ? !crowd.fromPrior
              ? crowd.count <= 1
                ? "Only you said it"
                : `${crowd.count} of ${crowd.submissions} said it`
              : crowd.blendedPercent !== null
                ? crowd.blendedPercent < 1
                  ? "Fewer than 1 in 100 would say it"
                  : `About ${crowd.blendedPercent}% would say it`
                : ""
            : "";
        return (
          <li key={question.id} style={{ ["--c" as string]: tier >= 0 ? tierColor(tier) : MISS_COLOR }}>
            <span className="catch-stage">{index + 1}</span>
            <div>
              <p className="catch-prompt">{question.prompt}</p>
              <p className="catch-answer">
                <strong>{reveal.points > 0 ? reveal.answerText : reveal.label}</strong>
                <em>{reveal.points > 0 ? reveal.label : ""}</em>
                {reveal.boosted ? <b className="chip boost">×2</b> : null}
              </p>
              {said ? <p className="catch-said">{said}</p> : null}
            </div>
            <b className="catch-points">{reveal.points > 0 ? `+${reveal.points}` : "0"}</b>
          </li>
        );
      })}
    </ol>
  );
}

/** The ten highest climbs today, by callsign, each in its rocket's paint job. Bots fly with a 🤖. */
export function TodayBoard({ today }: { today: TodayStats }) {
  if (today.board.length === 0) return <p className="hint">No finished climbs yet today.</p>;
  return (
    <ol className="board">
      {today.board.map((row) => (
        <BoardLine key={`${row.rank}-${row.callsign}`} row={row} />
      ))}
      {today.you ? (
        <>
          <li className="board-gap" aria-hidden="true">
            ⋯
          </li>
          <BoardLine row={today.you} />
        </>
      ) : null}
    </ol>
  );
}

function BoardLine({ row }: { row: BoardRow }) {
  const paint = skinById(row.skin) ?? SKINS[0]!;
  return (
    <li className={row.you ? "you" : row.bot ? "bot" : undefined}>
      <span className="board-rank">{row.rank}</span>
      {row.bot ? (
        <span className="board-bot" aria-hidden="true">
          🤖
        </span>
      ) : (
        <RocketIcon paint={paint} size={26} />
      )}
      <span className="board-name">
        <strong>{row.you ? `${row.callsign} (you)` : row.callsign}</strong>
        <small>
          {row.bot ? "Bot · " : ""}
          {milestoneAt(row.progress).at > 0 ? `past ${milestoneAt(row.progress).name}` : "off the pad"}
        </small>
      </span>
      <span className="board-height">
        <strong>{formatAltitude(row.progress)}</strong>
        <small>{row.score} pts</small>
      </span>
    </li>
  );
}
