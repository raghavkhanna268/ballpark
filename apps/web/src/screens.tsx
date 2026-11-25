import { QuestionTimer } from "./timer";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CountUp, Tally, basePoints, flavourLine, maxPoints, resultIcon, tierOf } from "./game";
import { tierStyle, useFocusMode, useJourney } from "./journey";
import { haptic } from "./haptic";
import { CurveChart, FlightPath, TheCatch, TodayBoard } from "./flightlog";
import { sharePostcard, type PostcardInput } from "./postcard";
import {
  COMPARE_MIN_PLAYERS,
  canCompare,
  formatFactValue,
  formatNumber,
  nextDayStart,
  parseShorthand,
  roundSig,
  type Confidence,
  type CrowdStat,
  type DayResult,
  type Guess,
  type PublicQuestion,
  type PuzzleResponse,
  type Reveal,
  type Stats,
} from "@ballpark/shared";

const BUCKETS = ["0–140", "141–280", "281–420", "421–560", "561+"];

export type StreakView = { streak: number; shield: "ready" | "used" | "saved" };

/** One small tile on the home screen. It opens a panel in the card (the league, logbook or stats), or a page of its own. */
export type HomePanel = { id: string; icon: string; title: string; note: string; content?: ReactNode; onOpen?: () => void };

/** Cruise: today's Classic with no clock, kept for the streak but left off the board. Locked once the day has started. */
export type CruiseView = { on: boolean; locked: boolean; onToggle: () => void };

export function HomeScreen({
  puzzle,
  classicStreak,
  headToHead,
  onPlay,
  onResult,
  challenge,
  cruise = null,
  more,
  panels,
  ad,
}: {
  puzzle: PuzzleResponse;
  classicStreak: StreakView;
  /** The Head-to-head card. Null while the mode is switched off. */
  headToHead?: { streak: StreakView; label: string; onPlay: () => void } | null;
  onPlay: () => void;
  onResult: () => void;
  /** A friend's race link, shown above the play button. */
  challenge?: ReactNode;
  cruise?: CruiseView | null;
  /** Journeys, the archive and Unlimited, under today's Classic. */
  more?: ReactNode;
  /** The league, packs, logbook and stats. Each is a tile that opens in the card, so the home screen never scrolls. */
  panels: HomePanel[];
  /** An ad space, for free players only. It sits at the bottom of the screen, outside the card. */
  ad?: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const done = puzzle.result !== null;
  const started = puzzle.questions.some((question) => question.reveal);
  const panel = panels.find((item) => item.id === open);

  if (panel) {
    return (
      <div className="stack home-panel">
        <button className="text-button back" type="button" onClick={() => setOpen(null)}>
          ← Back
        </button>
        {panel.content}
      </div>
    );
  }

  return (
    <>
      <div className="stack home">
        <header className="home-head">
          <h1 className="wordmark">
            Ballpark<span>.</span>
          </h1>
          <Countdown />
        </header>

        <section className="day-card">
          <p className="kicker">
            #{puzzle.puzzleNumber} · Today’s climb
            {puzzle.today.climbing ? <span className="climbing"> · {puzzle.today.climbing.toLocaleString("en-US")} climbing today</span> : null}
          </p>
          <p className="theme">{puzzle.theme}</p>
          <p className="blurb">{puzzle.blurb}</p>
          <p className="tomorrow">Tomorrow · {puzzle.nextTheme}</p>
          {puzzle.devDate ? <p className="dev-flag">Dev date {puzzle.date}. This does not change the real UTC day.</p> : null}
        </section>

        {challenge}

        <section className="mode-card">
          <div className="mode-top">
            <h2>{cruise?.on ? "Cruise" : "Classic"}</h2>
            <StreakTag view={classicStreak} />
          </div>
          <p>Seven questions. Name any right answer: the fewer players who think of it, the higher you climb.</p>
          {done ? (
            <button className="primary" type="button" onClick={onResult}>
              See today’s result · {puzzle.result?.score} pts
            </button>
          ) : (
            <button className="primary" type="button" onClick={onPlay}>
              {started ? (cruise?.on ? "Continue your cruise" : "Continue Classic") : cruise?.on ? "Cruise today’s Classic" : "Play today’s Classic"}
            </button>
          )}
          {cruise && !done && !cruise.locked ? (
            <button type="button" className={`cruise-switch${cruise.on ? " on" : ""}`} role="switch" aria-checked={cruise.on} onClick={cruise.onToggle}>
              <span className="knob" aria-hidden="true" />
              <span>
                <strong>Cruise</strong> {cruise.on ? "on: no clock, off the board" : "· no clock, not ranked"}
              </span>
            </button>
          ) : null}
          {cruise?.on && cruise.locked && !done ? <p className="cruise-note">⛵ Cruising today: no clock, off the board.</p> : null}
        </section>

        {more}

        {headToHead ? (
          <section className="mode-card">
            <div className="mode-top">
              <h2>Head-to-head</h2>
              <StreakTag view={headToHead.streak} />
            </div>
            <button className="primary" type="button" onClick={headToHead.onPlay}>
              {headToHead.label}
            </button>
          </section>
        ) : null}

        <nav className="tiles" aria-label="More">
          {panels.map((item) => (
            <button key={item.id} className="tile" type="button" onClick={() => (item.onOpen ? item.onOpen() : setOpen(item.id))}>
              <span className="tile-icon" aria-hidden="true">
                {item.icon}
              </span>
              <strong>{item.title}</strong>
              <small>{item.note}</small>
            </button>
          ))}
        </nav>
      </div>
      {ad}
    </>
  );
}

/** Games played, streaks and the score spread, on this device. Opens from the home screen's Stats tile. */
export function StatsPanel({ stats, streak }: { stats: Stats; streak: StreakView }) {
  const maxBar = Math.max(1, ...stats.distribution);
  return (
    <section className="card stats-panel" aria-label="Your stats on this device">
      <div className="mode-top">
        <h2>Stats</h2>
        <p className="streak">On this device</p>
      </div>
      <div className="stats">
        <Stat label="Played" value={String(stats.played)} />
        <Stat label="Streak" value={String(streak.streak)} />
        <Stat label="Best" value={String(stats.maxStreak)} />
        <div className="dist">
          <p>Score distribution</p>
          <div className="bars">
            {stats.distribution.map((count, index) => (
              <div key={BUCKETS[index]} className="bar-col">
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${(count / maxBar) * 100}%` }} />
                </div>
                <span>{BUCKETS[index]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Today's Afterburner: ready to arm before an answer, armed for this one, or already spent. */
export type AfterburnerView = { ready: boolean; armed: boolean; onToggle: () => void };

export function QuestionScreen({
  puzzle,
  question,
  index,
  busy,
  error,
  rejections = 0,
  rejectedText = "",
  afterburner = null,
  clock = true,
  onNudge,
  onReport,
  onSubmit,
  onHome,
}: {
  puzzle: PuzzleResponse;
  question: PublicQuestion;
  index: number;
  busy: boolean;
  error: string | null;
  /** False in Cruise: no countdown, and no wait before typing. */
  clock?: boolean;
  /** Names the server said are not on the list for this question. Each one costs 2 seconds. */
  rejections?: number;
  /** The last name that was not on the list, for "Should this count?". */
  rejectedText?: string;
  afterburner?: AfterburnerView | null;
  /** Opens this question's nudge and returns its line. */
  onNudge?: () => Promise<string>;
  /** Sends a name that was not on the list for review. */
  onReport?: (text: string) => Promise<void>;
  onSubmit: (guess: Guess) => void;
  onHome: () => void;
}) {
  const readTime = useReadTime(question.id);
  const reading = clock ? readTime : 0;
  const locked = busy || reading > 0;
  const stuck = useStuck(question.id, reading === 0 && !busy);
  return (
    <div className="stack ask">
      <PlayHeader puzzle={puzzle} index={index} onHome={onHome} />
      {clock ? (
        <QuestionTimer
          questionKey={question.id}
          running={!busy && reading === 0}
          penaltyMs={rejections * RETRY_PENALTY_MS}
          waitLabel={`Clock starts in ${reading}`}
          onExpire={() => onSubmit({ type: "name_one", text: "", timedOut: true })}
        />
      ) : (
        <p className="cruise-clock">⛵ Cruise · take your time</p>
      )}
      {question.type !== "name_one" ? <p className="type-kicker">{typeLabel(question.type)}</p> : null}
      <h2 className="prompt">{question.prompt}</h2>
      {question.type === "name_one" ? <p className="rarer">▲ Rarer answers climb higher ▲</p> : null}
      {afterburner && (afterburner.ready || afterburner.armed) ? (
        <button
          type="button"
          className={`afterburner${afterburner.armed ? " armed" : ""}`}
          aria-pressed={afterburner.armed}
          disabled={busy}
          onClick={afterburner.onToggle}
        >
          <span aria-hidden="true">🔥</span>
          <strong>{afterburner.armed ? "Afterburner on" : "Afterburner ×2"}</strong>
          <small>{afterburner.armed ? "This stage scores and climbs double. Tap to save it." : "Once a day: double one stage you are sure of."}</small>
        </button>
      ) : null}
      {question.type === "estimate" && question.slider && question.unit ? (
        <EstimateForm unit={question.unit} slider={question.slider} busy={locked} onSubmit={(value, confidence) => onSubmit({ type: "estimate", value, confidence })} />
      ) : null}
      {question.type === "compare" ? (
        <CompareForm items={question.items} busy={locked} onSubmit={(choiceId) => onSubmit({ type: "compare", choiceId })} />
      ) : null}
      {question.type === "rank" ? (
        <RankForm items={question.items} busy={locked} onSubmit={(order) => onSubmit({ type: "rank", order })} />
      ) : null}
      {question.type === "name_one" ? (
        <NameForm
          suggestions={question.suggestions}
          busy={busy}
          locked={reading > 0}
          rejections={rejections}
          onSubmit={(text) => onSubmit({ type: "name_one", text })}
        />
      ) : null}
      {rejections > 0 ? (
        <p className="retry-note" key={rejections} role="alert">
          Not on our list. Try another.{clock ? <b> −2 s</b> : null}
        </p>
      ) : null}
      {rejections > 0 && rejectedText && onReport ? <ReportButton key={`${question.id}-${rejections}`} text={rejectedText} onReport={onReport} /> : null}
      {question.hasNudge && onNudge ? <NudgeLine key={question.id} ready={stuck} onNudge={onNudge} /> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

/** After this long on a question's clock with nothing locked in, a stuck player can ask for a nudge. */
const NUDGE_AFTER_MS = 15_000;

function useStuck(questionKey: string, running: boolean): boolean {
  const [stuck, setStuck] = useState(false);
  useEffect(() => setStuck(false), [questionKey]);
  useEffect(() => {
    if (!running || stuck) return;
    const id = window.setTimeout(() => setStuck(true), NUDGE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [running, questionKey, stuck]);
  return stuck;
}

/** "Stuck? Get a nudge": one line that points at a corner of the answers. The answer after it scores at most a Moonshot. */
function NudgeLine({ ready, onNudge }: { ready: boolean; onNudge: () => Promise<string> }) {
  const [state, setState] = useState<{ kind: "closed" | "opening" | "failed" } | { kind: "open"; text: string }>({ kind: "closed" });
  if (state.kind === "open") {
    return (
      <p className="nudge" role="status">
        <span aria-hidden="true">💡</span> {state.text} <small>Capped at Moonshot</small>
      </p>
    );
  }
  if (!ready) return null;
  return (
    <button
      type="button"
      className="nudge-button"
      disabled={state.kind === "opening"}
      onClick={() => {
        setState({ kind: "opening" });
        onNudge().then(
          (text) => setState({ kind: "open", text }),
          () => setState({ kind: "failed" }),
        );
      }}
    >
      {state.kind === "failed" ? "The nudge didn’t load. Try again" : "Stuck? Get a nudge"}
      <small>This stage then scores at most a Moonshot</small>
    </button>
  );
}

/** "Should this count?": sends the name that was not on the list to be checked. */
function ReportButton({ text, onReport }: { text: string; onReport: (text: string) => Promise<void> }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  if (state === "sent") return <p className="report-line">Thanks. If we add “{text}”, it scores for you at midnight.</p>;
  return (
    <button
      type="button"
      className="text-button report-line"
      disabled={state === "sending"}
      onClick={() => {
        setState("sending");
        onReport(text).then(
          () => setState("sent"),
          () => setState("failed"),
        );
      }}
    >
      {state === "failed" ? "Couldn’t send that. Try again?" : `Should “${text}” count? Tell us`}
    </button>
  );
}

export function RevealScreen({
  puzzle,
  question,
  reveal,
  index,
  last,
  lastLabel = "See the day",
  onNext,
  onHome,
}: {
  puzzle: PuzzleResponse;
  question: PublicQuestion;
  reveal: Reveal;
  index: number;
  last: boolean;
  lastLabel?: string;
  onNext: () => void;
  onHome: () => void;
}) {
  // The card clears away: the climb plays on the whole screen, then this result appears over the scene.
  useFocusMode();
  const { holding } = useJourney();
  const named = question.type === "name_one";
  const scored = reveal.points > 0;
  const tier = tierOf(basePoints(reveal), maxPoints(question.type));
  return (
    <div className="stack result">
      <PlayHeader puzzle={puzzle} index={index} onHome={onHome} />
      <section className={`reveal band-${reveal.band} tier-${tier < 0 ? "miss" : tier}`} style={tierStyle(tier)} aria-live="polite">
        <p className="result-icon" aria-hidden="true">
          {named ? resultIcon(reveal.label, reveal.emoji) : reveal.emoji}
        </p>
        <h2 className="result-tier">{reveal.label}</h2>
        {named && scored && reveal.answerText ? <p className="result-answer">“{reveal.answerText}”</p> : null}
        {!named && reveal.answerText && reveal.answerText !== reveal.label ? <p className="result-answer">{reveal.answerText}</p> : null}
        <p className="flavour">{flavourLine(reveal.label, tier, named)}</p>
        {reveal.boosted || reveal.nudged ? (
          <p className="badges">
            {reveal.boosted ? <b className="chip boost">🔥 Afterburner ×2</b> : null}
            {reveal.nudged ? <b className="chip nudged">💡 Nudged · up to Moonshot</b> : null}
          </p>
        ) : null}
        <p className="points">
          <b className="pts-line">
            {reveal.points > 0 ? "+" : ""}
            {holding ? reveal.points : <CountUp value={reveal.points} delay={250} duration={600} />}
            <span> pts</span>
          </b>
          {reveal.provisional && scored ? <small>final at reset</small> : null}
        </p>
        {reveal.bonusPoints > 0 ? <p className="delta">Crowd bonus +{reveal.bonusPoints}</p> : null}
        {reveal.confidenceDelta !== 0 ? (
          <p className="delta">
            {reveal.confidence} confidence {reveal.confidenceDelta > 0 ? "added" : "cost"} {Math.abs(reveal.confidenceDelta)}
          </p>
        ) : null}
        {!named && reveal.detail ? <p className="detail">{reveal.detail}</p> : null}
        {reveal.track ? <Track track={reveal.track} /> : null}
        {question.type !== "estimate" && !named ? (
          <ol className="rows">
            {reveal.rows.map((row, rowIndex) => (
              <li key={row.id} className={row.chosen ? "chosen" : undefined}>
                <span>{question.type === "rank" ? rowIndex + 1 : row.chosen ? "You" : rowIndex + 1}</span>
                <strong>{row.label}</strong>
                <em>{row.valueText}</em>
              </li>
            ))}
          </ol>
        ) : null}
        <Crowd crowd={reveal.crowd} type={question.type} compact />
        <p className="context">{reveal.context}</p>
        <a className="source" href={reveal.sourceUrl} target="_blank" rel="noreferrer">
          {reveal.sourceName}
        </a>
      </section>
      <button className="primary next-stage" type="button" onClick={onNext}>
        {last ? lastLabel : "Next stage"} <span aria-hidden="true">▲</span>
      </button>
    </div>
  );
}

type EndTab = "result" | "log" | "catch" | "today";
const END_TABS: Array<{ id: EndTab; label: string }> = [
  { id: "result", label: "Result" },
  { id: "log", label: "Flight log" },
  { id: "catch", label: "The catch" },
  { id: "today", label: "Today" },
];

export function EndScreen({
  puzzle,
  result,
  stats,
  streak,
  rivals,
  postcard,
  extras,
  ad,
  onHome,
}: {
  puzzle: PuzzleResponse;
  result: DayResult;
  stats: Stats;
  streak: StreakView & { savedToday: boolean };
  /** Your rank, the friend you raced, and the weekly league. */
  rivals?: ReactNode;
  /** The picture of your climb that Share sends with the text. */
  postcard: PostcardInput;
  /** A new paint job, and the streak reminder switch. */
  extras?: ReactNode;
  /** An ad space, for free players only. */
  ad?: ReactNode;
  onHome: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "busy" | "shared" | "saved" | "failed">("idle");
  const [tab, setTab] = useState<EndTab>("result");
  return (
    <>
      <div className="stack end">
        <div className="end-head">
          <p className="mission">Mission complete</p>
          <p className="kicker">
            {result.cruise ? "Cruise" : "Classic"} · #{puzzle.puzzleNumber}
          </p>
        </div>
        <div className="end-tabs" role="tablist" aria-label="Today’s climb">
          {END_TABS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {tab === "result" ? (
          <>
            <div className="end-score">
              <h2>You climbed {result.reached}</h2>
              <p className="score">
                <CountUp value={result.score} pad={3} />
                <span> pts</span>
              </p>
            </div>
            <Tally rows={puzzle.questions.map((question) => question.reveal)} />
            {result.provisional ? <p className="players">Points so far, final at reset.</p> : null}
            {rivals}
            {extras}
          </>
        ) : null}
        {tab === "log" ? (
          <>
            <FlightPath questions={puzzle.questions} />
            <CurveChart curve={result.curve} players={puzzle.field.players} />
          </>
        ) : null}
        {tab === "catch" ? <TheCatch questions={puzzle.questions} /> : null}
        {tab === "today" ? <TodayBoard today={puzzle.today} players={puzzle.field.players} /> : null}
        <button
          className="primary"
          type="button"
          disabled={shareState === "busy"}
          onClick={() => {
            haptic("tap");
            setShareState("busy");
            void sharePostcard(postcard, result.shareText).then((outcome) => setShareState(outcome === "cancelled" ? "idle" : outcome));
          }}
        >
          {shareState === "busy"
            ? "Painting your postcard…"
            : shareState === "saved"
              ? "Postcard saved, text copied"
              : shareState === "shared"
                ? "Shared"
                : shareState === "failed"
                  ? "Couldn’t share. Try again"
                  : "Share postcard"}
        </button>
        {streak.savedToday ? <p className="shield-line">Your streak shield covered the day you missed.</p> : null}
        <div className="end-foot">
          <p className="streak-line">
            Streak {streak.streak} · Best {stats.maxStreak} · Played {stats.played}
          </p>
          <button className="text-button" type="button" onClick={onHome}>
            Back home
          </button>
        </div>
      </div>
      {ad}
    </>
  );
}

/** "Streak 4 · shield ready": one missed day a week won't break a streak. */
export function StreakTag({ view }: { view: StreakView }) {
  const shield = view.shield === "ready" ? "shield ready" : view.shield === "saved" ? "shield saved it" : "shield used";
  return (
    <p className="streak" title="Streak shield: one missed day a week won’t break your streak.">
      Streak {view.streak}
      {view.streak > 0 ? <span className={`shield ${view.shield}`}> · {shield}</span> : null}
    </p>
  );
}

export function DevDate() {
  if (!import.meta.env.DEV) return null;
  const current = new URLSearchParams(window.location.search).get("date") ?? "";
  return (
    <form
      className="dev-date"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const date = String(data.get("date") ?? "");
        const url = new URL(window.location.href);
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) url.searchParams.set("date", date);
        else url.searchParams.delete("date");
        window.location.assign(url);
      }}
    >
      <label>
        Dev date
        <input name="date" defaultValue={current} placeholder="YYYY-MM-DD" inputMode="numeric" />
      </label>
      <button type="submit">Load</button>
    </form>
  );
}

function PlayHeader({ puzzle, index, onHome }: { puzzle: PuzzleResponse; index: number; onHome: () => void }) {
  const { hudSlot } = useJourney();
  const total = puzzle.questions.length;
  // The stage strip lives in the heads-up display, so it stays in view when the card clears away for the climb.
  const strip = (
    <div className="stage-strip">
      <div className="dots" aria-hidden="true">
        {puzzle.questions.map((question, dot) => (
          <i key={question.id} className={dot === index ? "on" : question.reveal ? `done band-${question.reveal.band}` : ""} />
        ))}
      </div>
      <b className="stage-no">
        Stage {index + 1}/{total}
      </b>
    </div>
  );
  return (
    <div className="play-head">
      <button className="text-button" type="button" onClick={onHome}>
        Home
      </button>
      <p>
        <span>{puzzle.theme}</span>
      </p>
      {hudSlot ? createPortal(strip, hudSlot) : strip}
    </div>
  );
}

function EstimateForm({
  unit,
  slider,
  busy,
  onSubmit,
}: {
  unit: string;
  slider: { min: number; max: number };
  busy: boolean;
  onSubmit: (value: number, confidence: Confidence) => void;
}) {
  const [text, setText] = useState(() => formatNumber(roundSig(geometricMid(slider.min, slider.max))));
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [localError, setLocalError] = useState<string | null>(null);
  const parsed = parseShorthand(text);

  return (
    <form
      className="guess-form"
      onSubmit={(event) => {
        event.preventDefault();
        const value = parseShorthand(text);
        if (value === null) {
          setLocalError("Enter a number above zero. k, M, and B mean thousand, million, and billion.");
          return;
        }
        setLocalError(null);
        onSubmit(value, confidence);
      }}
    >
      <label className="number-field">
        <span className="sr">Your guess</span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="Your guess"
        />
        <em>{unit}</em>
      </label>
      <LogNumberLine
        min={slider.min}
        max={slider.max}
        value={parsed && parsed > 0 ? parsed : geometricMid(slider.min, slider.max)}
        onChange={(next) => setText(formatNumber(roundSig(next)))}
      />
      <fieldset className="confidence">
        <legend>Confidence, optional. Narrow pays more within 2× and less if you miss that.</legend>
        {(["narrow", "medium", "wide"] as const).map((option) => (
          <label key={option} className={confidence === option ? "on" : ""}>
            <input type="radio" name="confidence" checked={confidence === option} onChange={() => setConfidence(option)} />
            {option}
          </label>
        ))}
      </fieldset>
      {localError ? <p className="form-error">{localError}</p> : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Checking…" : "Lock in guess"}
      </button>
    </form>
  );
}

function CompareForm({
  items,
  busy,
  onSubmit,
}: {
  items: PublicQuestion["items"];
  busy: boolean;
  onSubmit: (choiceId: string) => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  return (
    <form
      className="guess-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!choice) {
          setLocalError("Pick one of the two.");
          return;
        }
        onSubmit(choice);
      }}
    >
      <div className="choices">
        {items.map((item) => (
          <button key={item.id} type="button" className={choice === item.id ? "choice selected" : "choice"} aria-pressed={choice === item.id} onClick={() => setChoice(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {localError ? <p className="form-error">{localError}</p> : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Checking…" : "Lock in pick"}
      </button>
    </form>
  );
}

function RankForm({
  items,
  busy,
  onSubmit,
}: {
  items: PublicQuestion["items"];
  busy: boolean;
  onSubmit: (order: string[]) => void;
}) {
  const [order, setOrder] = useState(items.map((item) => item.id));
  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    const copy = [...order];
    const current = copy[index];
    const swap = copy[next];
    if (!current || !swap) return;
    copy[index] = swap;
    copy[next] = current;
    setOrder(copy);
  }
  return (
    <form
      className="guess-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(order);
      }}
    >
      <p className="hint">Use the arrows. Top of the list is first.</p>
      <ol className="rank-list">
        {order.map((id, index) => {
          const item = items.find((candidate) => candidate.id === id);
          if (!item) return null;
          return (
            <li key={id}>
              <span className="rank-index">{index + 1}</span>
              <span className="rank-label">{item.label}</span>
              <button type="button" aria-label={`Move ${item.label} up`} onClick={() => move(index, -1)} disabled={index === 0}>
                Up
              </button>
              <button type="button" aria-label={`Move ${item.label} down`} onClick={() => move(index, 1)} disabled={index === order.length - 1}>
                Down
              </button>
            </li>
          );
        })}
      </ol>
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Checking…" : "Lock in order"}
      </button>
    </form>
  );
}

function Track({ track }: { track: NonNullable<Reveal["track"]> }) {
  const window = zoomWindow(track.guess, track.answer, track.min, track.max);
  const guessAt = placeLog(track.guess, window);
  const answerAt = placeLog(track.answer, window);
  const [shown, setShown] = useState(guessAt);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(answerAt));
    return () => cancelAnimationFrame(id);
  }, [answerAt]);
  const gapLeft = Math.min(guessAt, shown) * 100;
  const gapWidth = Math.abs(shown - guessAt) * 100;
  return (
    <div className="track" aria-hidden="true">
      <span className="gap" style={{ left: `${gapLeft}%`, width: `${gapWidth}%` }} />
      {track.crowd.map((dot, index) => (
        <span key={`${dot}-${index}`} className="crowd-dot" style={{ left: `${placeLog(dot, window) * 100}%` }} />
      ))}
      <span className="pin you" style={{ left: `${guessAt * 100}%` }}>
        You
      </span>
      <span className="pin answer" style={{ left: `${shown * 100}%` }}>
        Answer
      </span>
    </div>
  );
}

function zoomWindow(guess: number, answer: number, min: number, max: number): { start: number; end: number } {
  const low = Math.min(Math.log10(guess), Math.log10(answer));
  const high = Math.max(Math.log10(guess), Math.log10(answer));
  const span = Math.max(0.8, high - low + 0.7);
  const mid = (low + high) / 2;
  const floor = Math.log10(min);
  const ceil = Math.log10(max);
  let start = mid - span / 2;
  let end = mid + span / 2;
  if (start < floor) {
    end += floor - start;
    start = floor;
  }
  if (end > ceil) {
    start -= end - ceil;
    end = ceil;
  }
  return { start: Math.max(floor, start), end: Math.min(ceil, end) };
}

function placeLog(value: number, window: { start: number; end: number }): number {
  if (!(value > 0)) return 0;
  const t = (Math.log10(value) - window.start) / Math.max(0.0001, window.end - window.start);
  return Math.min(1, Math.max(0, t));
}

/** "About 7%", or "Fewer than 1 in 100" for the rarest answers, where a rounded 0% would read as nobody. */
function estimateShare(percent: number): string {
  return percent < 1 ? "Fewer than 1 in 100" : `About ${percent}%`;
}

function Crowd({ crowd, type, compact = false }: { crowd: CrowdStat; type: PublicQuestion["type"]; compact?: boolean }) {
  // Over the scene after a climb there is room for one line about the crowd and the rare answers, no tables.
  if (compact && crowd.kind === "named") {
    const early = !canCompare(crowd.submissions);
    const line = !crowd.answer
      ? null
      : early
        ? crowd.blendedPercent !== null
          ? `${estimateShare(crowd.blendedPercent)} would say ${crowd.answer}. That is our estimate until ${COMPARE_MIN_PLAYERS} players.`
          : null
        : crowd.percent < 1
          ? `Under 1% of players said ${crowd.answer}.`
          : crowd.percent < 50
            ? `Only ${crowd.percent}% of players said ${crowd.answer}.`
            : `${crowd.percent}% of players said ${crowd.answer}.`;
    return (
      <div className="crowd">
        {line ? <p>{line}</p> : null}
        {crowd.rare.length > 0 ? <p>Rare right answers: {crowd.rare.join(", ")}</p> : null}
      </div>
    );
  }
  // Under 20 answers, crowd shares say more about who happened to play first than about the crowd.
  if (!canCompare(crowd.submissions)) {
    return (
      <div className="crowd">
        <p>
          {crowd.kind === "named" && !crowd.answer
            ? "That answer was not accepted."
            : crowd.kind === "named" && crowd.blendedPercent !== null
              ? `Our estimate: ${estimateShare(crowd.blendedPercent).toLowerCase()} would say ${crowd.answer}. Real crowd shares start at ${COMPARE_MIN_PLAYERS} players.`
              : `Crowd stats start at ${COMPARE_MIN_PLAYERS} players.`}
        </p>
        {crowd.kind === "named" && crowd.rare.length > 0 ? <p>Rare right answers: {crowd.rare.join(", ")}</p> : null}
      </div>
    );
  }
  if (crowd.kind === "named") {
    return (
      <div className="crowd">
        <p>
          {crowd.answer
            ? crowd.percent < 50
              ? `Only ${crowd.percent}% of players said ${crowd.answer}.`
              : `${crowd.percent}% of players said ${crowd.answer}.`
            : "That answer was not accepted."}
        </p>
        {crowd.fromPrior && crowd.blendedPercent !== null ? (
          <p>Rarity points blend a prior until 20 answers (effective share {crowd.blendedPercent}%).</p>
        ) : null}
        {crowd.top.length > 0 ? (
          <ul className="name-list">
            {crowd.top.map((item) => (
              <li key={item.label}>
                {item.label} · {item.percent}%
              </li>
            ))}
          </ul>
        ) : null}
        {crowd.rare.length > 0 ? <p>Rare valid answers: {crowd.rare.join(", ")}</p> : null}
      </div>
    );
  }
  if (crowd.kind === "median") {
    const noun = crowd.submissions === 1 ? "guess" : "guesses";
    return (
      <p className="crowd">
        Crowd median {formatFactValue(crowd.value, crowd.unit)} · {crowd.submissions} {noun}
      </p>
    );
  }
  const verb = type === "rank" ? "had the exact order" : "picked correctly";
  const noun = crowd.submissions === 1 ? "player" : "players";
  return (
    <p className="crowd">
      {crowd.percent}% {verb} · {crowd.submissions} {noun}
    </p>
  );
}

/** Each name that is not on the list costs this much of the clock. */
const RETRY_PENALTY_MS = 2000;
/** The question shows for this long before its clock starts, so reading it is free. */
const READ_SECONDS = 3;

/** Seconds of reading time left for a question: 3, 2, 1, then 0 once its clock is running. */
function useReadTime(questionKey: string): number {
  const [left, setLeft] = useState(READ_SECONDS);
  useEffect(() => {
    setLeft(READ_SECONDS);
    const started = performance.now();
    const id = window.setInterval(() => {
      const next = Math.max(0, READ_SECONDS - Math.floor((performance.now() - started) / 1000));
      setLeft(next);
      if (next === 0) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [questionKey]);
  return left;
}

function Countdown() {
  const [label, setLabel] = useState(() => countdownLabel(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setLabel(countdownLabel(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <p className="countdown">{label}</p>;
}

/** Time to the next puzzle. A new day starts at midnight India time for everyone. */
function countdownLabel(now: Date): string {
  const next = nextDayStart(now).getTime();
  const ms = Math.max(0, next - now.getTime());
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const local = new Date(next).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `Resets ${local} · ${hours}h ${minutes}m ${seconds}s`;
}

/** The scoring ladder, shown before the player answers, so the goal is to think past the obvious. */
function NameForm({
  suggestions,
  busy,
  locked = false,
  rejections = 0,
  onSubmit,
}: {
  suggestions: string[];
  busy: boolean;
  /** True during the 3-second read: the question shows, the box waits. */
  locked?: boolean;
  /** Goes up each time a name is not on the list. The box clears for the next try. */
  rejections?: number;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rejections === 0) return;
    setText("");
    setLocalError(null);
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      input.closest(".number-field")?.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }],
        { duration: 380, easing: "ease-out" },
      );
    }
  }, [rejections]);

  useEffect(() => {
    // Once the read is over, put the cursor in the box on a computer. A phone waits for a tap, so no keyboard jumps up.
    if (!locked && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [locked]);
  return (
    <form
      className="guess-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim().length < 1) {
          setLocalError(suggestions.length > 0 ? "Type an answer. The list is everyone in that group, not a hint." : "Type an answer first.");
          return;
        }
        onSubmit(text.trim());
      }}
    >
      <label className="number-field">
        <span className="sr">Your answer</span>
        <input
          ref={inputRef}
          disabled={locked}
          list={suggestions.length > 0 ? "name-suggestions" : undefined}
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          placeholder="Type any right answer"
        />
      </label>
      {suggestions.length > 0 ? (
        <datalist id="name-suggestions">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      ) : null}
      <p className="hint">
        {suggestions.length > 0
          ? "Suggestions are the whole list. They do not tell you which names score."
          : "No list for this one. Small spelling slips are fine."}
      </p>
      {localError ? <p className="form-error">{localError}</p> : null}
      <button className="primary" type="submit" disabled={busy || locked}>
        {busy ? "Checking…" : "Lock in answer"}
      </button>
    </form>
  );
}

function LogNumberLine({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (next: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const span = Math.max(1e-6, logMax - logMin) / zoom;
  const logValue = Math.log10(Math.min(max, Math.max(min, value)));
  const start = Math.min(logMax - span, Math.max(logMin, logValue - span / 2));
  const ticks: number[] = [];
  for (let exponent = Math.ceil(start); exponent <= Math.floor(start + span); exponent += 1) ticks.push(exponent);

  function setFromX(clientX: number) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onChange(Math.min(max, Math.max(min, 10 ** (start + t * span))));
  }

  return (
    <div className="log-line">
      <div className="log-zoom">
        <button type="button" onClick={() => setZoom((current) => Math.min(32, current * 2))}>
          Zoom in
        </button>
        <button type="button" onClick={() => setZoom((current) => Math.max(1, current / 2))} disabled={zoom <= 1}>
          Zoom out
        </button>
      </div>
      <div
        ref={ref}
        className="log-rail"
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-valuetext={formatNumber(roundSig(value))}
        aria-label="Guess on a logarithmic number line"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromX(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) setFromX(event.clientX);
        }}
        onKeyDown={(event) => {
          const step = span / 24;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(Math.min(max, 10 ** Math.min(logMax, logValue + step)));
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(Math.max(min, 10 ** Math.max(logMin, logValue - step)));
          }
        }}
      >
        {ticks.map((exponent) => (
          <span key={exponent} className="log-tick" style={{ left: `${((exponent - start) / span) * 100}%` }}>
            10<sup>{exponent}</sup>
          </span>
        ))}
        <span className="log-marker" style={{ left: `${((logValue - start) / span) * 100}%` }} />
      </div>
    </div>
  );
}

function geometricMid(min: number, max: number): number {
  return 10 ** ((Math.log10(min) + Math.log10(max)) / 2);
}

function typeLabel(type: PublicQuestion["type"]): string {
  if (type === "name_one") return "Name one";
  return type;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <p className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </p>
  );
}
