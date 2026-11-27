import { useId } from "react";
import { formatAltitude, milestoneAt, parseRace, type LeagueResponse, type Placement, type Race, type RaceMode } from "@ballpark/shared";

/*
 * The competitive layer: where you stand after a game, racing a friend's climb from a shared link,
 * and the weekly league. Nothing here needs an account. Rivals the server plays fill every field and table,
 * and count like everyone else.
 */

const RACE_KEY = "ballpark.race.v1";

/** Reads `?race=` from the address once, keeps it on this device, and tidies the address bar. */
export function captureRace(): Race | null {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("race");
    if (code) {
      const race = parseRace(code);
      if (race) localStorage.setItem(RACE_KEY, JSON.stringify(race));
      url.searchParams.delete("race");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
    }
    const raw = localStorage.getItem(RACE_KEY);
    return raw ? (JSON.parse(raw) as Race) : null;
  } catch {
    return null;
  }
}

/** The friend's climb you are racing in a mode today, if the link was for today's puzzle. */
export function raceFor(race: Race | null, mode: RaceMode, puzzleNumber: number | undefined): Race | null {
  if (!race || puzzleNumber === undefined) return null;
  return race.mode === mode && race.puzzleNumber === puzzleNumber ? race : null;
}

function heightPhrase(progress: number): string {
  return milestoneAt(progress).phrase;
}

export function RaceBanner({ race, onRace }: { race: Race; onRace: () => void }) {
  const mode = race.mode === "classic" ? "Classic" : "Head-to-head";
  return (
    <section className="card race-card" aria-label="A friend's challenge">
      <p className="kicker">Challenge</p>
      <h2>
        A friend reached {heightPhrase(race.progress)} in {mode}.
      </h2>
      <p>Their climb flies beside yours. Climb higher than {formatAltitude(race.progress)}.</p>
      <button className="primary" type="button" onClick={onRace}>
        Race them in {mode}
      </button>
    </section>
  );
}

/** After a game: how your climb compared with the friend whose link you opened. */
export function FriendResult({ race, mine }: { race: Race; mine: number }) {
  const diff = mine - race.progress;
  const text =
    diff > 0.05
      ? `You out-climbed your friend. They stopped at ${heightPhrase(race.progress)}.`
      : diff >= -0.05
        ? `Dead heat with your friend at ${heightPhrase(race.progress)}.`
        : `Your friend is still higher, at ${heightPhrase(race.progress)}. Send them your climb anyway.`;
  return <p className={diff > 0.05 ? "friend-line won" : "friend-line"}>{text}</p>;
}

/**
 * Where you stand after a game: "Better than 73% of today's players", everyone's scores as a curve with yours
 * marked, then your rank and what it takes to climb one more place.
 */
export function RankBlock({
  place,
  unit,
  who = "today’s players",
  among = "today",
  wouldHave = false,
  big = false,
}: {
  place: Placement;
  unit: "pts" | "picks";
  /** Whom the share counts: "today’s players". */
  who?: string;
  /** After "#3 of 40": "today", "that day", "who played this chapter". */
  among?: string;
  /** A past day: where you would have been. */
  wouldHave?: boolean;
  /** The end screen's version, like Krillion's: a wide curve with a scale, then the share in capitals under it. */
  big?: boolean;
}) {
  const gap = place.next ? (unit === "pts" ? `${place.next.gap} pts` : `${place.next.gap} right ${place.next.gap === 1 ? "pick" : "picks"}`) : "";
  const rank = `${wouldHave ? "You’d have been" : "You’re"} #${place.rank} of ${place.players.toLocaleString("en-US")} ${among}.`;
  const chase = place.next ? `${gap} behind #${place.next.rank}.` : place.players > 1 ? "Nobody scored higher." : "";
  if (big) {
    return (
      <section className="standing big" aria-label="Where you stand">
        {place.betterThan !== null ? (
          <>
            <SpreadCurve place={place} unit={unit} big />
            <p className="standing-head">
              Better than {place.betterThan}% of {who}
            </p>
          </>
        ) : null}
        <p className="players">
          {rank} {chase}
        </p>
      </section>
    );
  }
  return (
    <section className="standing" aria-label="Where you stand">
      {place.betterThan !== null ? (
        <>
          <p className="standing-head">
            <strong>Better than {place.betterThan}%</strong>
            <span> of {who}</span>
          </p>
          <SpreadCurve place={place} unit={unit} />
        </>
      ) : null}
      <p className="players">
        {rank} {chase}
      </p>
    </section>
  );
}

const SMALL = { W: 320, BASE: 54, RISE: 44, H: 68 };
const BIG = { W: 360, BASE: 92, RISE: 78, H: 108 };

/** A round step for the scale under the big curve, so it has at most seven marks. */
function scaleStep(top: number): number {
  return [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((step) => top / step <= 7) ?? Math.ceil(top / 7);
}

/** Everyone's scores as a smooth hill, the part you beat lit up, and a marker at your score. */
function SpreadCurve({ place, unit, big = false }: { place: Placement; unit: "pts" | "picks"; big?: boolean }) {
  const { W, BASE, RISE, H } = big ? BIG : SMALL;
  const id = useId().replace(/:/g, "");
  const { bins, top, you } = place.spread;
  // A light blur so a small field reads as a hill rather than a comb.
  const weights = [0.1, 0.2, 0.4, 0.2, 0.1];
  const smooth = bins.map((_, index) => {
    let sum = 0;
    let weight = 0;
    weights.forEach((w, offset) => {
      const at = index + offset - 2;
      if (at < 0 || at >= bins.length) return;
      sum += bins[at]! * w;
      weight += w;
    });
    return weight > 0 ? sum / weight : 0;
  });
  const high = Math.max(...smooth, 0.001);
  const points: Array<[number, number]> = [[0, BASE], ...smooth.map((value, index): [number, number] => [((index + 0.5) / bins.length) * W, BASE - (value / high) * RISE]), [W, BASE]];
  let line = `M ${points[0]![0]} ${points[0]![1]}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [x, y] = points[index]!;
    const [nx, ny] = points[index + 1]!;
    line += ` Q ${x.toFixed(1)} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
  }
  line += ` L ${W} ${BASE}`;
  const area = `${line} Z`;
  const x = Math.max(0, Math.min(1, you / Math.max(1, top))) * W;
  let y = BASE;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x0, y0] = points[index]!;
    const [x1, y1] = points[index + 1]!;
    if (x >= x0 && x <= x1) {
      y = x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      break;
    }
  }
  const labelX = Math.max(16, Math.min(W - 16, x));
  if (big) {
    const step = scaleStep(top);
    const marks = Array.from({ length: Math.floor(top / step) + 1 }, (_, index) => index * step);
    return (
      <svg className="spread big" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Everyone’s scores, with yours at ${you} ${unit === "pts" ? "points" : "right picks"}`}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffb347" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffb347" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id={`${id}-beaten`}>
            <rect x="0" y="0" width={x} height={H} />
          </clipPath>
        </defs>
        {/* The curve draws itself left to right, the hill fades in under it, the part you beat lights up, and the
            YOU pin drops onto your score with a ripple. */}
        <path d={area} className="spread-rest" />
        <path d={area} className="spread-beaten" fill={`url(#${id}-fill)`} clipPath={`url(#${id}-beaten)`} />
        <path d={line} className="spread-line" pathLength={1} />
        <line x1="0" y1={BASE} x2={W} y2={BASE} className="spread-base" />
        {marks.map((mark) => {
          const at = (mark / Math.max(1, top)) * W;
          return (
            <g key={mark}>
              <line x1={at} x2={at} y1={BASE} y2={BASE + 4} className="spread-base" />
              {Math.abs(at - x) > 26 ? (
                <text x={at} y={BASE + 15} textAnchor={mark === 0 ? "start" : at >= W - 1 ? "end" : "middle"} className="spread-axis">
                  {mark}
                </text>
              ) : null}
            </g>
          );
        })}
        <g className="spread-pin">
          <line x1={x} y1={y} x2={x} y2={BASE + 4} className="spread-you-line" />
          <circle cx={x} cy={y} r="4" className="spread-you-dot" />
          <text x={labelX} y={BASE + 15} textAnchor="middle" className="spread-you">
            YOU
          </text>
        </g>
        <circle cx={x} cy={y} r="5" className="spread-ripple" />
      </svg>
    );
  }
  return (
    <svg className="spread" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Everyone’s scores, with yours at ${you} ${unit === "pts" ? "points" : "right picks"}`}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffb347" stopOpacity="0.04" />
        </linearGradient>
        <clipPath id={`${id}-beaten`}>
          <rect x="0" y="0" width={x} height={H} />
        </clipPath>
      </defs>
      <path d={area} className="spread-rest" />
      <path d={area} fill={`url(#${id}-fill)`} clipPath={`url(#${id}-beaten)`} />
      <path d={line} className="spread-line" />
      <line x1="0" y1={BASE} x2={W} y2={BASE} className="spread-base" />
      <line x1={x} y1={Math.min(y, BASE - 4) - 4} x2={x} y2={BASE} className="spread-you-line" />
      <circle cx={x} cy={y} r="3" className="spread-you-dot" />
      <text x={labelX} y={H - 2} textAnchor="middle" className="spread-you">
        YOU
      </text>
      {Math.abs(x) > 26 ? (
        <text x="0" y={H - 2} className="spread-axis">
          0
        </text>
      ) : null}
      {Math.abs(W - x) > 34 ? (
        <text x={W} y={H - 2} textAnchor="end" className="spread-axis">
          {unit === "pts" ? `${top} pts` : `${top}/${top}`}
        </text>
      ) : null}
    </svg>
  );
}

function daysLeft(today: string, endsOn: string): number {
  return Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) + 1;
}

export function LeagueCard({ league, today }: { league: LeagueResponse; today: string }) {
  const left = daysLeft(today, league.endsOn);
  const ends = left <= 1 ? "Ends tonight" : `${left} days left`;
  if (!league.joined) {
    return (
      <section className="card league" aria-label="Weekly league">
        <div className="mode-top">
          <h2>{league.name}</h2>
          <p className="streak">{ends}</p>
        </div>
        <p className="hint">Finish a game this week to join. Every point you score counts, and the top {league.moveUp} move up a league each Monday.</p>
      </section>
    );
  }
  const rows = league.standings;
  const mine = rows.findIndex((row) => row.you);
  const shown = rows.slice(0, 8);
  if (mine >= 8) shown.push(rows[mine]!);
  return (
    <section className="card league" aria-label="Weekly league">
      <div className="mode-top">
        <h2>{league.name}</h2>
        <p className="streak">{ends}</p>
      </div>
      {league.moved === "up" ? <p className="league-moved up">Promoted last week. Welcome to the {league.name}.</p> : null}
      {league.moved === "down" ? <p className="league-moved">Moved down last week. Finish top {league.moveUp} to climb back.</p> : null}
      <ol className="league-table">
        {shown.map((row, index) => (
          <li key={`${row.callsign}-${index}`} className={[row.you ? "you" : "", league.above && index === league.moveUp - 1 && rows.length > league.moveUp ? "cut" : ""].join(" ")}>
            <span className="mono">{row.rank}</span>
            <strong>{row.you ? `You · ${row.callsign}` : row.callsign}</strong>
            <span className="mono">{row.points}</span>
          </li>
        ))}
      </ol>
      <p className="hint">
        {league.above ? `Top ${league.moveUp} move up to the ${league.above}.` : "This is the top league. Stay in the top 5 to keep your rank."}
        {league.moveDown > 0 ? ` Bottom ${league.moveDown} move down.` : ""} Your Classic points count.
      </p>
    </section>
  );
}

/** One line on the end screen: where this week stands now. */
export function LeagueLine({ league }: { league: LeagueResponse | null }) {
  if (!league?.joined || !league.you) return null;
  const zone = league.above && league.you.rank <= league.moveUp ? ` · in the top ${league.moveUp}, on course for the ${league.above}` : "";
  return (
    <p className="league-line">
      {league.name}: #{league.you.rank} of {league.standings.length} this week, {league.you.points} pts{zone}.
    </p>
  );
}
