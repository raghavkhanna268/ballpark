import { useEffect, useState, type ReactNode } from "react";
import { ARCHIVE_FREE_DAYS, UNLIMITED_QUESTIONS, type ArchiveDay, type ArchiveResponse, type JourneyResponse, type PackSummary, type PlusStatus, type UnlimitedStatus } from "@ballpark/shared";
import { errorCopy, getArchive, getJourney, getUnlimited, postUnlimited } from "./api";
import { haptic } from "./haptic";
import { Loader } from "./loader";
import type { HomePanel } from "./screens";

/*
 * More to play, beyond the daily: pack journeys, the archive of past days, and Unlimited. All of them are for fun:
 * none adds to the streak, the rank or the league.
 */

/** Journeys, the archive and Unlimited: a short row under the play button, and tiles in the home menu. */
export function playMoreTiles({
  packs,
  plus,
  unlimited,
  onPacks,
  onArchive,
  onUnlimited,
}: {
  packs: PackSummary[];
  plus: PlusStatus | null;
  unlimited: UnlimitedStatus | null;
  onPacks: () => void;
  onArchive: () => void;
  onUnlimited: () => void;
}): HomePanel[] {
  const member = plus?.plus ?? false;
  const journeys = packs.filter((pack) => !pack.locked);
  const done = journeys.reduce((sum, pack) => sum + pack.chaptersDone, 0);
  const total = journeys.reduce((sum, pack) => sum + pack.chapters, 0);
  return [
    { id: "journeys", icon: "🗺️", title: "Journeys", note: member && total > 0 ? `${done}/${total} chapters` : "Ballpark+", onOpen: onPacks },
    { id: "archive", icon: "🗓️", title: "Archive", note: member ? "All past days" : `${ARCHIVE_FREE_DAYS} days free`, onOpen: onArchive },
    {
      id: "unlimited",
      icon: "♾️",
      title: "Unlimited",
      note: member ? (unlimited?.open ? "Round in progress" : unlimited?.best != null ? `Best ${unlimited.best}` : "Play now") : "Ballpark+",
      onOpen: onUnlimited,
    },
  ];
}

function PageHead({ kicker, title, children, onBack, backLabel = "Home" }: { kicker: string; title: string; children?: ReactNode; onBack: () => void; backLabel?: string }) {
  return (
    <>
      <div className="play-head">
        <button className="text-button" type="button" onClick={onBack}>
          ← {backLabel}
        </button>
      </div>
      <header className="page-head">
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        {children}
      </header>
    </>
  );
}

/** Every pack, each a journey of chapters. Locked for free players, with the way in to Ballpark+. */
export function PacksScreen({ packs, status, onPack, onPlus, onHome }: { packs: PackSummary[]; status: PlusStatus | null; onPack: (id: string) => void; onPlus: () => void; onHome: () => void }) {
  const plus = status?.plus ?? false;
  const cheapest = status?.prices.find((item) => item.plan === "month");
  return (
    <div className="stack more-page">
      <PageHead kicker={plus ? "Ballpark+" : "Ballpark+ only"} title="Journeys" onBack={onHome}>
        <p className="blurb">Each pack is a route of three chapters. Finish one to open the next.</p>
      </PageHead>
      <ul className="pack-list">
        {packs.map((pack) => (
          <li key={pack.id}>
            <button type="button" className={pack.locked ? "pack-row locked" : "pack-row"} onClick={() => (pack.locked ? onPlus() : onPack(pack.id))}>
              <span className="pack-emoji" aria-hidden="true">
                {pack.emoji}
              </span>
              <span className="pack-text">
                <strong>{pack.title}</strong>
                <small>{pack.route || pack.blurb}</small>
                {pack.locked ? null : <ChapterDots done={pack.chaptersDone} total={pack.chapters} />}
              </span>
              <span className="pack-state">{pack.locked ? "🔒" : pack.chaptersDone === pack.chapters ? "✓ Done" : pack.chaptersDone > 0 ? "Carry on" : "Start"}</span>
            </button>
          </li>
        ))}
      </ul>
      {plus ? null : (
        <button className="primary" type="button" onClick={onPlus}>
          Get Ballpark+{cheapest ? ` · ${cheapest.price} a month` : ""}
        </button>
      )}
    </div>
  );
}

function ChapterDots({ done, total }: { done: number; total: number }) {
  return (
    <span className="chapter-dots" aria-label={`${done} of ${total} chapters done`}>
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={index < done ? "on" : ""} />
      ))}
    </span>
  );
}

/** One pack's route: its chapters as stops, played in order. */
export function JourneyScreen({ deviceId, packId, onChapter, onBack }: { deviceId: string; packId: string; onChapter: (chapter: number) => void; onBack: () => void }) {
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void getJourney(deviceId, packId)
      .then((loaded) => live && setJourney(loaded))
      .catch((caught: unknown) => live && setError(errorCopy(caught)));
    return () => {
      live = false;
    };
  }, [deviceId, packId]);

  if (error) {
    return (
      <div className="stack">
        <p className="form-error">{error}</p>
        <button className="text-button" type="button" onClick={onBack}>
          Back to journeys
        </button>
      </div>
    );
  }
  if (!journey) return <Loader label="Loading the route…" />;

  const finished = journey.chapters.filter((chapter) => chapter.score !== null);
  const current = journey.chapters.find((chapter) => chapter.score === null && !chapter.locked);
  const total = finished.reduce((sum, chapter) => sum + (chapter.score ?? 0), 0);
  return (
    <div className="stack more-page journey-page">
      <PageHead kicker={`${journey.pack.emoji} ${journey.pack.title}`} title={journey.pack.route || journey.pack.title} onBack={onBack} backLabel="Journeys">
        <p className="blurb">
          {finished.length === journey.chapters.length
            ? `Journey complete · ${total} pts`
            : finished.length > 0
              ? `${finished.length} of ${journey.chapters.length} chapters · ${total} pts so far`
              : "Five questions a chapter. Rarer answers climb higher."}
        </p>
      </PageHead>
      <ol className="route">
        {journey.chapters.map((chapter) => {
          const state = chapter.score !== null ? "done" : chapter.locked ? "locked" : "open";
          return (
            <li key={chapter.chapter} className={`stop ${state}${chapter === current ? " current" : ""}`}>
              <button
                type="button"
                disabled={chapter.locked}
                onClick={() => {
                  haptic("tap");
                  onChapter(chapter.chapter);
                }}
              >
                <span className="stop-dot" aria-hidden="true">
                  {state === "done" ? "✓" : state === "locked" ? "🔒" : chapter.chapter}
                </span>
                <span className="stop-text">
                  <small>Chapter {chapter.chapter}</small>
                  <strong>{chapter.title}</strong>
                  <span>{chapter.locked ? `Opens after chapter ${chapter.chapter - 1}.` : chapter.blurb}</span>
                </span>
                <span className="stop-state">
                  {chapter.score !== null ? `${chapter.score} pts` : chapter.answered > 0 ? `${chapter.answered}/${chapter.questions}` : chapter.locked ? "" : "Play ▲"}
                </span>
              </button>
            </li>
          );
        })}
        <li className={`stop finish${finished.length === journey.chapters.length ? " done" : ""}`}>
          <span className="stop-dot" aria-hidden="true">
            🏁
          </span>
          <span className="stop-text">
            <strong>{finished.length === journey.chapters.length ? "You made it" : "End of the route"}</strong>
          </span>
        </li>
      </ol>
      <p className="fine">Rarity in a chapter counts everyone who has played it. Packs never touch your streak or the league.</p>
    </div>
  );
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** Past days, newest first. The last week is free; older days are in Ballpark+. */
export function ArchiveScreen({ deviceId, onDay, onPlus, onHome }: { deviceId: string; onDay: (date: string) => void; onPlus: () => void; onHome: () => void }) {
  const [days, setDays] = useState<ArchiveDay[]>([]);
  const [page, setPage] = useState<ArchiveResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(before?: string) {
    setBusy(true);
    try {
      const next = await getArchive(deviceId, before);
      setPage(next);
      setDays((current) => (before ? [...current, ...next.days] : next.days));
    } catch (caught) {
      setError(errorCopy(caught));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // Loads the newest page once; "Older days" asks for the rest.
  }, [deviceId]);

  return (
    <div className="stack more-page archive-page">
      <PageHead kicker="Archive" title="Past days" onBack={onHome}>
        <p className="blurb">Play a day you missed. Rarity is the day as it was played, and it never touches your streak, rank or league.</p>
      </PageHead>
      {error ? <p className="form-error">{error}</p> : null}
      {!page && !error ? <Loader label="Loading past days…" /> : null}
      {page && days.length === 0 ? <p className="hint">No past days yet. Come back tomorrow.</p> : null}
      <ul className="day-list">
        {days.map((day) => {
          const live = day.played === "daily";
          const finished = day.score !== null;
          return (
            <li key={day.date}>
              <button
                type="button"
                className={`day-row${day.locked ? " locked" : ""}${live ? " live" : ""}${finished ? " done" : ""}`}
                disabled={live}
                onClick={() => (day.locked ? onPlus() : onDay(day.date))}
              >
                <span className="day-number">#{day.number}</span>
                <span className="day-text">
                  <strong>{day.theme}</strong>
                  <small>{dayLabel(day.date)}</small>
                </span>
                <span className="day-state">
                  {day.locked ? "🔒" : live ? (finished ? `Played · ${day.score}` : "Played live") : finished ? `${day.score} pts` : day.answered > 0 ? `${day.answered}/7` : "Play"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {page?.older ? (
        <button className="ghost-button" type="button" disabled={busy} onClick={() => void load(page.older!)}>
          {busy ? "Loading…" : "Older days"}
        </button>
      ) : null}
      {page && !page.plus ? (
        <p className="fine">
          The last {ARCHIVE_FREE_DAYS} days are free.{" "}
          <button className="text-button inline" type="button" onClick={onPlus}>
            Ballpark+ opens every day
          </button>
        </p>
      ) : null}
    </div>
  );
}

/** Unlimited: as many fresh rounds of seven as a member likes. */
export function UnlimitedScreen({ deviceId, onRound, onPlus, onHome }: { deviceId: string; onRound: (id: string) => void; onPlus: () => void; onHome: () => void }) {
  const [status, setStatus] = useState<UnlimitedStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void getUnlimited(deviceId)
      .then((loaded) => live && setStatus(loaded))
      .catch((caught: unknown) => live && setError(errorCopy(caught)));
    return () => {
      live = false;
    };
  }, [deviceId]);

  async function start() {
    setBusy(true);
    setError(null);
    haptic("tap");
    try {
      onRound((await postUnlimited(deviceId)).id);
    } catch (caught) {
      setError(errorCopy(caught));
      setBusy(false);
    }
  }

  return (
    <div className="stack more-page unlimited-page">
      <PageHead kicker={status?.plus ? "Ballpark+" : "Ballpark+ only"} title="Unlimited" onBack={onHome}>
        <p className="blurb">Seven questions from every day that has run, dealt fresh each round. Play as many as you like.</p>
      </PageHead>
      {error ? <p className="form-error">{error}</p> : null}
      {!status && !error ? <Loader label="Loading…" /> : null}
      {status && status.plus ? (
        <>
          <div className="stats unlimited-stats">
            <div>
              <strong className="mono">{status.played}</strong>
              <small>Rounds</small>
            </div>
            <div>
              <strong className="mono">{status.best ?? "–"}</strong>
              <small>Best</small>
            </div>
            <div>
              <strong className="mono">{status.pool}</strong>
              <small>Questions</small>
            </div>
          </div>
          <button className="primary" type="button" disabled={busy || status.pool < UNLIMITED_QUESTIONS} onClick={() => void start()}>
            {busy ? "Dealing…" : status.open ? "Carry on your round" : status.played > 0 ? "Deal another round" : "Deal a round"}
          </button>
          <p className="fine">You get questions you haven’t answered first. Rarity counts everyone who has ever answered them. Nothing here touches your streak or the league.</p>
        </>
      ) : null}
      {status && !status.plus ? (
        <>
          <ul className="perks">
            <li>
              <strong>No waiting for tomorrow</strong>
              <span>Round after round, as long as you like.</span>
            </li>
            <li>
              <strong>Fresh questions first</strong>
              <span>Questions you haven’t met come before repeats.</span>
            </li>
          </ul>
          <button className="primary" type="button" onClick={onPlus}>
            Get Ballpark+
          </button>
        </>
      ) : null}
    </div>
  );
}
