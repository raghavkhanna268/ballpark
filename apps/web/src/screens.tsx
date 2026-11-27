import { ClockFuse, ClockRing, DangerEdge, QUESTION_SECONDS, QuestionTimer, useDanger, useQuestionClock } from "./timer";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { burnAway, caretSparks, dropAway, flash, jolt, sparks, zap } from "./fx";
import { playWhoosh } from "./sound";
import { createPortal } from "react-dom";
import { CountUp, answerTitle, basePoints, flavourLine, maxPoints, resultIcon, tierOf } from "./game";
import { tierStyle, useFloatMode, useFocusMode, useJourney } from "./journey";
import { tierColor } from "./sky";
import { haptic } from "./haptic";
import { BigScore, ClimbLog, EndDock, EndRule, EndTop, FlightRating, maxScore } from "./endview";
import { TheCatch, TodayBoard } from "./flightlog";
import { sharePostcard, type PostcardInput } from "./postcard";
import {
  COLD_START_RESPONSES,
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

/** One tile in the home menu. It opens a panel in the card (the league, logbook or stats), or a page of its own. */
export type HomePanel = {
  id: string;
  icon: string;
  title: string;
  note: string;
  content?: ReactNode;
  onOpen?: () => void;
  /** Something new inside, such as a paint job just earned. Puts a dot on the menu button and the tile. */
  alert?: boolean;
};

/** Cruise: today's Classic with no clock, kept for the streak but left off the board. Locked once the day has started. */
export type CruiseView = { on: boolean; locked: boolean; onToggle: () => void };

/**
 * The home screen, like a game's title screen: the day, the rules in one line, the play button, the streak and a
 * short row of other ways to play. Everything else (the league, today's board, the Hangar, the logbook, stats, how to
 * play, Ballpark+ and tomorrow's theme) sits behind the Menu button.
 */
export function HomeScreen({
  puzzle,
  classicStreak,
  headToHead,
  onPlay,
  onResult,
  challenge,
  cruise = null,
  play = [],
  panels,
  plus = null,
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
  /** Journeys, the archive and Unlimited: a short row under the play button, and tiles in the menu. */
  play?: HomePanel[];
  /** The league, today's board, the Hangar, the logbook and stats. Each is a menu tile that opens in the card. */
  panels: HomePanel[];
  /** Ballpark+, a wide row at the foot of the menu. */
  plus?: HomePanel | null;
  /** An ad space, for free players only. It sits at the bottom of the screen, outside the card. */
  ad?: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const done = puzzle.result !== null;
  const started = puzzle.questions.some((question) => question.reveal);
  const howTo: HomePanel = { id: "how", icon: "❓", title: "How to play", note: "The rules", content: <HowToPlay count={puzzle.questions.length} /> };
  const panel = [...panels, howTo].find((item) => item.id === open);
  const alert = [...play, ...panels].some((item) => item.alert);

  function pick(item: HomePanel) {
    setMenu(false);
    if (item.onOpen) item.onOpen();
    else setOpen(item.id);
  }

  if (panel) {
    return (
      <div className="stack home-panel">
        <button
          className="text-button back"
          type="button"
          onClick={() => {
            setOpen(null);
            setMenu(true);
          }}
        >
          ← Menu
        </button>
        {panel.content}
      </div>
    );
  }

  return (
    <>
      <div className="stack home">
        <header className="home-head">
          <h1 className="wordmark" aria-label="Ballpark">
            {/* Each letter bobs on its own beat, with a colour split, and the title flickers now and then. */}
            {Array.from("Ballpark", (letter, index) => (
              <span className="wl" aria-hidden="true" key={index} style={{ animationDelay: `${index * -0.35}s` }}>
                {letter}
              </span>
            ))}
            <span aria-hidden="true">.</span>
          </h1>
          <button ref={menuButton} type="button" className={alert ? "menu-button alert" : "menu-button"} aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu(true)}>
            <span className="burger" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Menu
          </button>
        </header>

        <section className="day-card">
          <p className="kicker">
            #{puzzle.puzzleNumber} · Today’s climb
            {puzzle.today.climbing > 0 ? <span className="climbing"> · {puzzle.today.climbing.toLocaleString("en-US")} climbing</span> : null}
          </p>
          <p className="theme">{puzzle.theme}</p>
          <p className="rules">
            {puzzle.questions.length} questions · {cruise?.on ? "no clock" : `${QUESTION_SECONDS} seconds each`} · rarer answers climb higher
          </p>
          {puzzle.devDate ? <p className="dev-flag">Dev date {puzzle.date}. This does not change the real UTC day.</p> : null}
        </section>

        {challenge}

        <section className="mode-card">
          {done ? (
            <button className="primary" type="button" onClick={onResult}>
              See today’s result · {puzzle.result?.score} pts
            </button>
          ) : (
            <button className="primary" type="button" onClick={onPlay}>
              {started ? (cruise?.on ? "Continue your cruise" : "Continue Classic") : cruise?.on ? "Cruise today’s Classic" : "Play today’s Classic"}
            </button>
          )}
          <div className="home-meta">
            <StreakTag view={classicStreak} />
            {cruise && !done && !cruise.locked ? (
              <button type="button" className={`cruise-switch${cruise.on ? " on" : ""}`} role="switch" aria-checked={cruise.on} onClick={cruise.onToggle}>
                <span className="knob" aria-hidden="true" />
                <span>
                  <strong>Cruise</strong> · {cruise.on ? "not ranked" : "no clock"}
                </span>
              </button>
            ) : null}
            {cruise?.on && cruise.locked && !done ? <p className="cruise-note">⛵ Cruising: no clock</p> : null}
          </div>
        </section>

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

        {play.length > 0 ? (
          <nav className="quick-play" aria-label="More to play">
            {play.map((item) => (
              <button key={item.id} type="button" onClick={() => pick(item)}>
                <span aria-hidden="true">{item.icon}</span>
                {item.title}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      {ad}
      {menu ? (
        <HomeMenu
          puzzle={puzzle}
          daily={{ note: done ? `Done · ${puzzle.result?.score ?? 0} pts` : started ? "Carry on" : `#${puzzle.puzzleNumber} · ${puzzle.theme}`, onOpen: done ? onResult : onPlay }}
          play={play}
          more={[...panels, howTo]}
          plus={plus}
          onPick={pick}
          onClose={() => {
            setMenu(false);
            menuButton.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * The home menu: a modal over the scene with today's theme, every way to play, your league, board, Hangar, logbook and
 * stats, how to play, Ballpark+ and tomorrow's theme. A native dialog, so Escape closes it and focus stays inside.
 */
function HomeMenu({
  puzzle,
  daily,
  play,
  more,
  plus,
  onPick,
  onClose,
}: {
  puzzle: PuzzleResponse;
  daily: { note: string; onOpen: () => void };
  play: HomePanel[];
  more: HomePanel[];
  plus: HomePanel | null;
  onPick: (item: HomePanel) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  // Closing the dialog itself hands focus back to the Menu button, and its close event tells the home screen.
  const close = () => ref.current?.close();
  const tiles = (items: HomePanel[]) =>
    items.map((item) => (
      <button key={item.id} type="button" className={item.alert ? "menu-tile alert" : "menu-tile"} onClick={() => onPick(item)}>
        <span className="tile-icon" aria-hidden="true">
          {item.icon}
        </span>
        <strong>{item.title}</strong>
        <small>{item.note}</small>
      </button>
    ));
  return (
    <dialog
      ref={ref}
      className="home-menu"
      aria-labelledby="home-menu-title"
      onClose={onClose}
      onClick={(event) => {
        // A tap on the dimmed sky around the panel closes it.
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="menu-body">
        <header className="menu-head">
          <h2 id="home-menu-title">Menu</h2>
          <button type="button" className="menu-close" aria-label="Close the menu" onClick={close}>
            ✕
          </button>
        </header>
        <p className="menu-today">
          <b>{puzzle.theme}</b> · {puzzle.blurb}
        </p>
        <p className="menu-label">Play</p>
        <div className="menu-grid">
          <button type="button" className="menu-tile daily" onClick={daily.onOpen}>
            <span className="tile-icon" aria-hidden="true">
              ▶️
            </span>
            <strong>Today’s Classic</strong>
            <small>{daily.note}</small>
          </button>
          {tiles(play)}
        </div>
        <p className="menu-label">You</p>
        <div className="menu-grid">{tiles(more)}</div>
        {plus ? (
          <button type="button" className="menu-plus" onClick={() => onPick(plus)}>
            <span aria-hidden="true">{plus.icon}</span>
            <strong>{plus.title}</strong>
            <small>{plus.note}</small>
            <span className="go" aria-hidden="true">
              →
            </span>
          </button>
        ) : null}
        <div className="menu-foot">
          <p>Tomorrow · {puzzle.nextTheme}</p>
          <Countdown />
        </div>
      </div>
    </dialog>
  );
}

/** The rules, in the menu. */
function HowToPlay({ count }: { count: number }) {
  return (
    <section className="card how-to" aria-labelledby="how-to-title">
      <div className="mode-top">
        <h2 id="how-to-title">How to play</h2>
      </div>
      <ol>
        <li>
          <b>One theme a day, {count} questions.</b> Each one asks you to name something.
        </li>
        <li>
          <b>Any right answer counts.</b> The fewer players who name it, the higher your rocket climbs: Liftoff, Orbit, Moonshot, Deep space, then
          Supernova.
        </li>
        <li>
          <b>{QUESTION_SECONDS} seconds a question.</b> A name that isn’t on the list costs 2 seconds, then try another.
        </li>
        <li>
          <b>Cruise</b> turns the clock off. It keeps your streak but stays off the board and the league.
        </li>
        <li>
          <b>A new climb at midnight India time.</b> Your streak shield covers one missed day a week.
        </li>
      </ol>
    </section>
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

/**
 * A typed name that is close to a listed one: the box is filled with the listed spelling for the player to lock in
 * or edit. `key` goes up with each new offer.
 */
export type Correction = { from: string; to: string; key: number };

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
  correction = null,
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
  /** The listed spelling offered for the last name typed, if it was close to one. */
  correction?: Correction | null;
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
  const cardRef = useRef<HTMLDivElement>(null);
  /** An answer is on its way. If the result replaces this screen, the card burns away. */
  const sent = useRef(false);
  const send = (guess: Guess) => {
    sent.current = true;
    onSubmit(guess);
  };
  useEffect(() => {
    // The answer came back: not on the list, a spelling to confirm, or an error. The card stays.
    if (rejections > 0 || correction || error) sent.current = false;
  }, [rejections, correction?.key, error]);
  useBurnAway(cardRef, sent);
  const locked = busy || reading > 0;
  const stuck = useStuck(question.id, reading === 0 && !busy);
  const naming = question.type === "name_one";
  // A name-one question answers in the bar at the bottom of the screen, with the clock beside the box.
  const dockClock = useQuestionClock({
    questionKey: question.id,
    running: clock && naming && !busy && reading === 0,
    penaltyMs: rejections * RETRY_PENALTY_MS,
    onExpire: () => send({ type: "name_one", text: "", timedOut: true }),
  });
  return (
    <div className="stack ask" ref={cardRef}>
      <PlayHeader puzzle={puzzle} index={index} onHome={onHome} />
      {naming ? null : clock ? (
        <QuestionTimer
          questionKey={question.id}
          running={!busy && reading === 0}
          penaltyMs={rejections * RETRY_PENALTY_MS}
          waitLabel={`Clock starts in ${reading}`}
          onExpire={() => send({ type: "name_one", text: "", timedOut: true })}
        />
      ) : (
        <p className="cruise-clock">⛵ Cruise · take your time</p>
      )}
      {question.type !== "name_one" ? <p className="type-kicker">{typeLabel(question.type)}</p> : null}
      <h2 className="prompt">{question.prompt}</h2>
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
        <EstimateForm unit={question.unit} slider={question.slider} busy={locked} onSubmit={(value, confidence) => send({ type: "estimate", value, confidence })} />
      ) : null}
      {question.type === "compare" ? (
        <CompareForm items={question.items} busy={locked} onSubmit={(choiceId) => send({ type: "compare", choiceId })} />
      ) : null}
      {question.type === "rank" ? (
        <RankForm items={question.items} busy={locked} onSubmit={(order) => send({ type: "rank", order })} />
      ) : null}
      {naming ? (
        <NameForm
          busy={busy}
          locked={reading > 0}
          rejections={rejections}
          correction={correction}
          clock={clock ? { left: dockClock.left, total: dockClock.total, read: reading } : null}
          onSubmit={(text) => send({ type: "name_one", text })}
        />
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

/**
 * When an answer's result replaces the question, the card burns away and the answer bar drops off the screen. React
 * runs this cleanup while the old card is still on the page, so it can be copied as it looked.
 */
function useBurnAway(cardRef: RefObject<HTMLDivElement | null>, sent: RefObject<boolean>) {
  useLayoutEffect(() => {
    const card = cardRef.current;
    return () => {
      if (!sent.current || !card) return;
      burnAway(card);
      const bar = card.closest(".stage")?.querySelector<HTMLElement>(".dock-slot > .answer-dock");
      if (bar) dropAway(bar);
      playWhoosh();
    };
  }, [cardRef, sent]);
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
  onNext,
  onHome,
}: {
  puzzle: PuzzleResponse;
  question: PublicQuestion;
  reveal: Reveal;
  index: number;
  /** The last stage: its button lands the capsule back on the pad before `onNext` shows the end screen. */
  last: boolean;
  onNext: () => void;
  onHome: () => void;
}) {
  // The card clears away: the climb plays on the whole screen, then this result floats over the scene with no card,
  // like a Krillion dive: what you got, your answer, the points and one line. The fact and the source are left out.
  useFocusMode();
  const { holding, land } = useJourney();
  const [leaving, setLeaving] = useState(false);
  const named = question.type === "name_one";
  const scored = reveal.points > 0;
  const tier = tierOf(basePoints(reveal), maxPoints(question.type));
  return (
    <div className="stack result">
      <PlayHeader puzzle={puzzle} index={index} onHome={onHome} />
      <section className={`reveal band-${reveal.band} tier-${tier < 0 ? "miss" : tier}`} style={tierStyle(tier)} aria-live="polite">
        <p className="result-icon" aria-hidden="true">
          <span>{named ? resultIcon(reveal.label, reveal.emoji) : reveal.emoji}</span>
        </p>
        {named ? (
          <>
            <h2 className="result-tier">{answerTitle(reveal.label, tier)}</h2>
            <p className="result-rank">{tier < 0 ? reveal.label : `${reveal.label} tier`}</p>
          </>
        ) : (
          <h2 className="result-tier">{reveal.label}</h2>
        )}
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
      </section>
      <button
        className={last ? "primary next-stage land" : "primary next-stage"}
        type="button"
        disabled={leaving}
        onClick={() => {
          if (!last) return onNext();
          setLeaving(true);
          land(onNext);
        }}
      >
        {last ? "Land" : "Next stage"} <span aria-hidden="true">{last ? "▼" : "▲"}</span>
      </button>
    </div>
  );
}

export function EndScreen({
  puzzle,
  result,
  stats,
  streak,
  standing,
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
  /** Where you stand among today's players, right under the score. */
  standing?: ReactNode;
  /** The friend you raced, and the weekly league. */
  rivals?: ReactNode;
  /** The picture of your climb that Share sends with the text. */
  postcard: PostcardInput;
  /** A new paint job, and the streak reminder switch. */
  extras?: ReactNode;
  /** An ad space, for free players only. */
  ad?: ReactNode;
  onHome: () => void;
}) {
  // Like the end of a Krillion dive: no card, the score big, the curve, then the climb log, all over the scene.
  useFloatMode();
  const [shareState, setShareState] = useState<"idle" | "busy" | "shared" | "saved" | "failed">("idle");
  return (
    <>
      <div className="stack end">
        <EndTop title="Mission complete" kicker={`${result.cruise ? "Cruise" : "Classic"} #${puzzle.puzzleNumber}`} />
        <BigScore score={result.score} reached={result.reached} note={result.provisional ? "Points so far, final at reset" : undefined} />
        {standing}
        <section className="end-section">
          <EndRule title="Climb log" note="Higher = rarer" />
          <ClimbLog questions={puzzle.questions} />
        </section>
        <section className="end-section">
          <EndRule title="Flight rating" />
          <FlightRating score={result.score} max={maxScore(puzzle.questions)} />
        </section>
        <section className="end-section">
          <EndRule title="Your answers" />
          <TheCatch questions={puzzle.questions} />
        </section>
        <section className="end-section">
          <EndRule title="Today’s top climbs" />
          <TodayBoard today={puzzle.today} limit={5} />
        </section>
        <section className="end-section end-more">
          {rivals}
          {extras}
          {streak.savedToday ? <p className="shield-line">Your streak shield covered the day you missed.</p> : null}
          <p className="streak-line">
            Streak {streak.streak} · Best {stats.maxStreak} · Played {stats.played}
          </p>
        </section>
        {ad}
      </div>
      <EndDock>
        <button className="text-button" type="button" onClick={onHome}>
          Home
        </button>
        <button
          className="dock-go"
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
      </EndDock>
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
  const { hudSlot, holding } = useJourney();
  const total = puzzle.questions.length;
  // The stage strip lives in the heads-up display, so it stays in view when the card clears away for the climb.
  // Each answered stage's square takes its tier's colour. The one just answered pops in that colour once its climb
  // lands; the one being asked pulses.
  const strip = (
    <div className="stage-strip">
      <div className="dots" aria-hidden="true">
        {puzzle.questions.map((question, dot) => {
          const reveal = question.reveal;
          const asking = dot === index && (!reveal || holding);
          if (asking || !reveal) return <i key={question.id} className={asking ? "on" : ""} />;
          const tier = reveal.points > 0 ? tierOf(basePoints(reveal), maxPoints(question.type)) : -1;
          const fresh = dot === index ? " fresh" : "";
          return <i key={question.id} className={`done band-${reveal.band}${tier < 0 ? " miss" : ""}${fresh}`} style={{ ["--c" as string]: tierColor(tier) }} />;
        })}
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
  // Over the scene after a climb there is room for one short line about the crowd, no tables and no rare answers.
  if (compact && crowd.kind === "named") {
    // Until enough people have answered, the share is the prior blended with them: an estimate, said as one.
    const line = !crowd.answer
      ? null
      : crowd.fromPrior
        ? crowd.blendedPercent !== null
          ? `${estimateShare(crowd.blendedPercent)} would say ${crowd.answer}.`
          : null
        : crowd.percent < 1
          ? `Under 1% of players said ${crowd.answer}.`
          : crowd.percent < 50
            ? `Only ${crowd.percent}% of players said ${crowd.answer}.`
            : `${crowd.percent}% of players said ${crowd.answer}.`;
    return line ? (
      <div className="crowd">
        <p>{line}</p>
      </div>
    ) : null;
  }
  // With only a few answers in, live shares say more about who played first than about the crowd: show the estimate.
  if (crowd.kind === "named" ? crowd.fromPrior : crowd.submissions < COLD_START_RESPONSES) {
    const line =
      crowd.kind === "named" && !crowd.answer
        ? "That answer was not accepted."
        : crowd.kind === "named" && crowd.blendedPercent !== null
          ? `${estimateShare(crowd.blendedPercent)} would say ${crowd.answer}.`
          : null;
    return (
      <div className="crowd">
        {line ? <p>{line}</p> : null}
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

/**
 * The answer bar, fixed to the bottom of the screen like a Krillion dive: the clock in a ring, the box with a fuse
 * line that burns down under it, and Lock in. Notes about the last try (not on the list, did you mean) sit just above
 * it. On a phone the bar rides on top of the keyboard.
 */
function NameForm({
  busy,
  locked = false,
  rejections = 0,
  correction = null,
  clock,
  onSubmit,
}: {
  busy: boolean;
  /** A listed spelling to fill the box with, for the player to confirm or edit. */
  correction?: Correction | null;
  /** True during the 3-second read: the question shows, the box waits. */
  locked?: boolean;
  /** Goes up each time a name is not on the list. The box clears for the next try. */
  rejections?: number;
  /** The question's clock, or null in Cruise. `read` counts down the 3-second read before it starts. */
  clock: { left: number; total: number; read: number } | null;
  onSubmit: (text: string) => void;
}) {
  const { dockSlot } = useJourney();
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [offer, setOffer] = useState<Correction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  useKeyboardLift();
  const seconds = clock ? Math.ceil(clock.left / 1000) : 0;
  const danger = useDanger(seconds, clock !== null && clock.read === 0 && !busy);

  useEffect(() => {
    // Fill in the spelling from the list. Lock in sends it as it stands; any edit puts the box back in the player's hands.
    if (!correction) return;
    setText(correction.to);
    setOffer(correction);
    setLocalError(null);
    inputRef.current?.focus({ preventScroll: true });
    // Only a new offer refills the box.
  }, [correction?.key]);

  useEffect(() => {
    if (rejections === 0) return;
    setText("");
    setLocalError(null);
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    // Not on our list: the box jolts and flashes red, and static crackles over the screen.
    const field = input.closest(".number-field");
    if (field) {
      jolt(field);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        field.animate(
          [
            { borderColor: "#ff5a4e", boxShadow: "0 0 0 1px #ff5a4e, 0 0 18px rgba(255, 90, 78, 0.55)" },
            { borderColor: "#ff5a4e", boxShadow: "0 0 0 1px #ff5a4e, 0 0 18px rgba(255, 90, 78, 0.55)", offset: 0.6 },
            {},
          ],
          { duration: 900, easing: "ease-out" },
        );
      }
    }
    zap();
    flash("#ff5a4e", 0.12, 300);
  }, [rejections]);

  useEffect(() => {
    // Once the read is over, put the cursor in the box on a computer. A phone waits for a tap, so no keyboard jumps up.
    if (!locked && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [locked]);
  const dock = (
    <div className="answer-dock">
      <div className="dock-notes">
        {rejections > 0 ? (
          <p className="retry-note" key={rejections} role="alert">
            Not on our list. Try another.{clock ? <b> −2 s</b> : null}
          </p>
        ) : null}
        {offer ? (
          <p className="did-you-mean" id="did-you-mean" role="status" key={offer.key}>
            <span>
              “{offer.from}” <i aria-hidden="true">→</i>
              <span className="sr"> looks like </span> <b>{offer.to}</b>
            </span>
            <small>Lock in to confirm, or edit it</small>
          </p>
        ) : null}
        {localError ? <p className="form-error">{localError}</p> : null}
      </div>
      <form
        className="guess-form dock-bar"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim().length < 1) {
            setLocalError("Type an answer first.");
            const field = inputRef.current?.closest(".number-field");
            if (field) jolt(field, 5);
            return;
          }
          const go = goRef.current?.getBoundingClientRect();
          if (go) sparks(go.left + go.width / 2, go.top + go.height / 2, { count: 16, spread: 60, size: 4, rise: 14, ms: 600, colors: ["#ffffff", "#8fd3ff", "#fff3d6"] });
          onSubmit(text.trim());
        }}
      >
        {clock ? (
          <ClockRing left={clock.left} total={clock.total} read={clock.read} />
        ) : (
          <span className="dock-cruise" title="Cruise: no clock" aria-label="Cruise, no clock">
            ⛵
          </span>
        )}
        <label className="number-field dock-field">
          <span className="sr">Your answer</span>
          <input
            ref={inputRef}
            disabled={locked}
            value={text}
            onChange={(event) => {
              const input = event.target;
              if (input.value.length > text.length) caretSparks(input);
              setText(input.value);
              setOffer(null);
            }}
            aria-describedby={offer ? "did-you-mean" : undefined}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="send"
            placeholder={clock && clock.read > 0 ? `Clock starts in ${clock.read}` : "Type any right answer"}
          />
          {clock ? <ClockFuse left={clock.left} total={clock.total} read={clock.read} /> : null}
        </label>
        <button className="dock-go" type="submit" disabled={busy || locked} ref={goRef}>
          {busy ? "…" : "Lock in"}
        </button>
      </form>
    </div>
  );
  return (
    <>
      {dockSlot ? createPortal(dock, dockSlot) : dock}
      {danger ? <DangerEdge /> : null}
    </>
  );
}

/**
 * Keeps the answer bar on top of a phone's keyboard. The keyboard shrinks the visible part of the page, and `--kb`
 * says by how much, so the bar can sit just above it.
 */
function useKeyboardLift() {
  useEffect(() => {
    const view = window.visualViewport;
    if (!view) return;
    const root = document.documentElement;
    const update = () => {
      const covered = Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop));
      root.style.setProperty("--kb", `${covered}px`);
    };
    update();
    view.addEventListener("resize", update);
    view.addEventListener("scroll", update);
    return () => {
      view.removeEventListener("resize", update);
      view.removeEventListener("scroll", update);
      root.style.removeProperty("--kb");
    };
  }, []);
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
