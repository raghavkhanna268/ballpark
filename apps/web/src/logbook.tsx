import { formatDistance } from "./journey";
import { WORLD_STOPS } from "./worlds";

/**
 * The logbook is what a player keeps across days: their farthest trip, the worlds they have reached,
 * today's missions completed, and the rare answers they found. It lives on this device only.
 */

export type Mode = "classic" | "h2h";
export type Find = { date: string; prompt: string; answer: string; tier: string; points: number };
export type Logbook = {
  best: Record<Mode, number>;
  farthest: number;
  worlds: number;
  missions: string[];
  finds: Find[];
};

const KEY = "ballpark.logbook.v1";
/**
 * Mission targets, as world indexes. Classic tops out at 10 worlds only with five Legendary answers, so its
 * targets sit lower: Country needs mostly Uncommon answers and Planets needs mostly Deep cuts.
 * Head-to-head reaches Earth with four right and Nearby stars with nine.
 */
const MISSION_STOPS: Record<Mode, number[]> = { classic: [5, 6, 7, 8], h2h: [6, 7, 8, 9] };

function empty(): Logbook {
  return { best: { classic: 0, h2h: 0 }, farthest: 0, worlds: 0, missions: [], finds: [] };
}

export function loadLogbook(): Logbook {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Logbook>;
    return {
      best: { classic: parsed.best?.classic ?? 0, h2h: parsed.best?.h2h ?? 0 },
      farthest: parsed.farthest ?? 0,
      worlds: parsed.worlds ?? 0,
      missions: Array.isArray(parsed.missions) ? parsed.missions : [],
      finds: Array.isArray(parsed.finds) ? parsed.finds : [],
    };
  } catch {
    return empty();
  }
}

function save(next: Logbook): Logbook {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The logbook stays in memory for this visit.
  }
  return next;
}

/** Today's target world. The same for everyone, so players can compare. */
export function missionFor(date: string, mode: Mode): number {
  let hash = mode === "h2h" ? 7 : 3;
  for (const char of date) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  const stops = MISSION_STOPS[mode];
  return stops[hash % stops.length]!;
}

export function missionKey(date: string, mode: Mode): string {
  return `${mode}:${date}`;
}

/** Call once a scored run is finished. Returns the updated logbook. */
export function recordRun(mode: Mode, date: string, progress: number): Logbook {
  const current = loadLogbook();
  const target = missionFor(date, mode);
  const key = missionKey(date, mode);
  const reached = Math.max(0, Math.min(WORLD_STOPS.length - 1, Math.round(progress)));
  return save({
    ...current,
    best: { ...current.best, [mode]: Math.max(current.best[mode], progress) },
    farthest: Math.max(current.farthest, progress),
    worlds: Math.max(current.worlds, reached),
    missions: progress >= target - 0.001 && !current.missions.includes(key) ? [...current.missions, key] : current.missions,
  });
}

export function recordFind(find: Find): Logbook {
  const current = loadLogbook();
  if (current.finds.some((item) => item.date === find.date && item.prompt === find.prompt)) return current;
  return save({ ...current, finds: [find, ...current.finds].slice(0, 50) });
}

export function LogbookCard({ logbook }: { logbook: Logbook }) {
  const farthest = WORLD_STOPS[Math.max(0, Math.min(WORLD_STOPS.length - 1, Math.round(logbook.farthest)))]!;
  return (
    <section className="card logbook" aria-label="Your logbook on this device">
      <div className="mode-top">
        <h2>Logbook</h2>
        <p className="streak">{logbook.missions.length} missions</p>
      </div>
      <div className="log-stats">
        <p>
          <span className="mono">{logbook.farthest > 0 ? formatDistance(logbook.farthest) : "—"}</span>
          <small>Farthest · {logbook.farthest > 0 ? farthest.label : "not yet"}</small>
        </p>
        <p>
          <span className="mono">
            {logbook.farthest > 0 ? logbook.worlds + 1 : 0}/{WORLD_STOPS.length}
          </span>
          <small>Worlds reached</small>
        </p>
        <p>
          <span className="mono">{logbook.finds.length}</span>
          <small>Rare finds</small>
        </p>
      </div>
      <ol className="world-strip" aria-hidden="true">
        {WORLD_STOPS.map((stop, index) => (
          <li key={stop.id} className={logbook.farthest > 0 && index <= logbook.worlds ? "on" : ""} title={stop.label} />
        ))}
      </ol>
      {logbook.finds.length > 0 ? (
        <ul className="finds">
          {logbook.finds.slice(0, 4).map((find) => (
            <li key={`${find.date}-${find.prompt}`}>
              <strong>{find.answer}</strong>
              <em>{find.tier}</em>
              <span>{find.prompt}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Rare and legendary answers you find are kept here.</p>
      )}
    </section>
  );
}
