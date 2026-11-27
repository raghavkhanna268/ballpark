import { MILESTONES, formatAltitude, milestoneAt, milestonesReached } from "@ballpark/shared";

/**
 * The logbook is what a player keeps across days: their highest climb, the landmarks they have passed,
 * and the rare answers they found. It lives on this device only.
 */

export type Mode = "classic" | "h2h";
export type Find = { date: string; prompt: string; answer: string; tier: string; points: number };
export type Logbook = {
  best: Record<Mode, number>;
  farthest: number;
  worlds: number;
  finds: Find[];
};

const KEY = "ballpark.logbook.v2";
function empty(): Logbook {
  return { best: { classic: 0, h2h: 0 }, farthest: 0, worlds: 0, finds: [] };
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

/** Call once a scored run is finished. Returns the updated logbook. */
export function recordRun(mode: Mode, progress: number): Logbook {
  const current = loadLogbook();
  const farthest = Math.max(current.farthest, progress);
  return save({
    ...current,
    best: { ...current.best, [mode]: Math.max(current.best[mode], progress) },
    farthest,
    worlds: milestonesReached(farthest),
  });
}

export function recordFind(find: Find): Logbook {
  const current = loadLogbook();
  if (current.finds.some((item) => item.date === find.date && item.prompt === find.prompt)) return current;
  return save({ ...current, finds: [find, ...current.finds].slice(0, 50) });
}

export function LogbookCard({ logbook }: { logbook: Logbook }) {
  const farthest = milestoneAt(logbook.farthest);
  const reached = milestonesReached(logbook.farthest);
  const landmarks = MILESTONES.slice(1);
  return (
    <section className="card logbook" aria-label="Your logbook on this device">
      <div className="mode-top">
        <h2>Logbook</h2>
        <p className="streak">On this device</p>
      </div>
      <div className="log-stats">
        <p>
          <span className="mono">{logbook.farthest > 0 ? formatAltitude(logbook.farthest) : "—"}</span>
          <small>Highest · {logbook.farthest > 0 ? (farthest.at > 0 ? `past ${farthest.name}` : "off the pad") : "not yet"}</small>
        </p>
        <p>
          <span className="mono">
            {reached}/{landmarks.length}
          </span>
          <small>Landmarks passed</small>
        </p>
        <p>
          <span className="mono">{logbook.finds.length}</span>
          <small>Moonshots or better</small>
        </p>
      </div>
      <ol className="world-strip" aria-hidden="true">
        {landmarks.map((milestone, index) => (
          <li key={milestone.id} className={index < reached ? "on" : ""} title={milestone.name} />
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
        <p className="hint">Moonshot, Deep space and Supernova answers you find are kept here.</p>
      )}
    </section>
  );
}
