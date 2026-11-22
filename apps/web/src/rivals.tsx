import { parseRace, type LeagueResponse, type Placement, type Race, type RaceMode } from "@ballpark/shared";
import { formatAltitude } from "./journey";
import { WORLD_STOPS, stopAt } from "./worlds";

/*
 * The competitive layer: your rank after a game, racing a friend's climb from a shared link,
 * and the weekly league. Nothing here needs an account.
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
  return WORLD_STOPS[stopAt(progress)]!.phrase;
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

/** "You're #2 of 4 today", and what it takes to climb one more place. */
export function RankBlock({ place, unit }: { place: Placement; unit: "pts" | "picks" }) {
  const gap = place.next ? (unit === "pts" ? `${place.next.gap} pts` : `${place.next.gap} right ${place.next.gap === 1 ? "answer" : "answers"}`) : "";
  return (
    <div className="rank-block">
      <h2>
        You’re #{place.rank} <span>of {place.players} today</span>
      </h2>
      <p className="players">
        {place.next
          ? `${gap} behind #${place.next.rank}.`
          : place.players === 1
            ? "You’re the first to finish today. Everyone after you is chasing your climb."
            : "Nobody climbed higher today."}
      </p>
    </div>
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
        {league.moveDown > 0 ? ` Bottom ${league.moveDown} move down.` : ""} Classic points plus 50 per right Head-to-head pick.
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
