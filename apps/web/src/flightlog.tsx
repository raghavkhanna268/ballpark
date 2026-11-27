import { formatAltitude, milestoneAt, type BoardRow, type PublicQuestion, type TodayStats } from "@ballpark/shared";
import { basePoints, maxPoints, tierOf } from "./game";
import { RocketIcon, skinById, SKINS } from "./hangar";
import { MISS_COLOR, tierColor } from "./sky";

/**
 * Lists on the end screen: your answers (what you said and how many others said the same) and today's board.
 * The climb log chart is in endview.tsx.
 */

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
                ? "only you"
                : `${crowd.count} of ${crowd.submissions}`
              : crowd.blendedPercent !== null
                ? crowd.blendedPercent < 1
                  ? "under 1%"
                  : `${crowd.blendedPercent}%`
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
            </div>
            <p className="catch-right">
              <b className="catch-points">{reveal.points > 0 ? `+${reveal.points}` : "0"}</b>
              {said ? <small className="catch-said">{said === "only you" ? "only you said it" : `${said} said it`}</small> : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** The highest climbs today (ten, or `limit`), by callsign, each in its rocket's paint job, then yours if lower. */
export function TodayBoard({ today, limit = 10 }: { today: TodayStats; limit?: number }) {
  if (today.board.length === 0) return <p className="hint">No finished climbs yet today.</p>;
  const rows = today.board.slice(0, limit);
  const mine = rows.some((row) => row.you) ? null : (today.board.find((row) => row.you) ?? today.you);
  return (
    <ol className="board">
      {rows.map((row) => (
        <BoardLine key={`${row.rank}-${row.callsign}`} row={row} />
      ))}
      {mine ? (
        <>
          <li className="board-gap" aria-hidden="true">
            ⋯
          </li>
          <BoardLine row={mine} />
        </>
      ) : null}
    </ol>
  );
}

function BoardLine({ row }: { row: BoardRow }) {
  const paint = skinById(row.skin) ?? SKINS[0]!;
  return (
    <li className={row.you ? "you" : undefined}>
      <span className="board-rank">{row.rank}</span>
      <RocketIcon paint={paint} size={26} />
      <span className="board-name">
        <strong>{row.you ? `${row.callsign} (you)` : row.callsign}</strong>
        <small>{milestoneAt(row.progress).at > 0 ? `past ${milestoneAt(row.progress).name}` : "off the pad"}</small>
      </span>
      <span className="board-height">
        <strong>{formatAltitude(row.progress)}</strong>
        <small>{row.score} pts</small>
      </span>
    </li>
  );
}
