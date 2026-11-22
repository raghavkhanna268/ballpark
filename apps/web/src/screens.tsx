import { QuestionTimer } from "./timer";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { haptic, shareText } from "./haptic";
import {
  formatFactValue,
  formatNumber,
  NAME_TIERS,
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

const BUCKETS = ["0–100", "101–200", "201–300", "301–400", "401+"];

export type StreakView = { streak: number; shield: "ready" | "used" | "saved" };

export function HomeScreen({
  puzzle,
  stats,
  classicStreak,
  h2hStreak,
  h2hLabel,
  onPlay,
  onResult,
  onHeadToHead,
  challenge,
  league,
  logbook,
}: {
  puzzle: PuzzleResponse;
  stats: Stats;
  classicStreak: StreakView;
  h2hStreak: StreakView;
  h2hLabel: string;
  onPlay: () => void;
  onResult: () => void;
  onHeadToHead: () => void;
  /** A friend's race link, shown above the modes. */
  challenge?: ReactNode;
  /** This week's league table. */
  league?: ReactNode;
  /** The player's logbook card. */
  logbook?: ReactNode;
}) {
  const done = puzzle.result !== null;
  const started = puzzle.questions.some((question) => question.reveal);
  const maxBar = Math.max(1, ...stats.distribution);
  return (
    <div className="stack">
      <header className="mast">
        <p className="kicker">Daily general knowledge</p>
        <h1 className="wordmark">
          Ballpark<span>.</span>
        </h1>
        <p className="lede">How high can what you know take you? Every right answer climbs.</p>
      </header>

      <section className="card day-card">
        <div className="day-row">
          <p className="puzzle-no">#{puzzle.puzzleNumber}</p>
          <Countdown />
        </div>
        <p className="theme">{puzzle.theme}</p>
        <p className="blurb">{puzzle.blurb}</p>
        <p className="tomorrow">Tomorrow · {puzzle.nextTheme}</p>
        {puzzle.devDate ? <p className="dev-flag">Dev date {puzzle.date}. This does not change the real UTC day.</p> : null}
      </section>

      {challenge}

      <section className="card mode-card">
        <div className="mode-top">
          <h2>Classic</h2>
          <StreakTag view={classicStreak} />
        </div>
        <p>Five open questions. Name any right answer. The fewer players who think of it, the more it scores.</p>
        {done ? (
          <button className="primary" type="button" onClick={onResult}>
            See today’s result · {puzzle.result?.score} pts
          </button>
        ) : (
          <button className="primary" type="button" onClick={onPlay}>
            {started ? "Continue Classic" : "Play today’s Classic"}
          </button>
        )}
      </section>

      <section className="card mode-card">
        <div className="mode-top">
          <h2>Head-to-head</h2>
          <StreakTag view={h2hStreak} />
        </div>
        <p>Ten pairs, easy to hard. A miss does not end it. You answer every one.</p>
        <button className="primary" type="button" onClick={onHeadToHead}>
          {h2hLabel}
        </button>
      </section>

      {league}

      {logbook}

      <section className="stats" aria-label="Your stats on this device">
        <Stat label="Played" value={String(stats.played)} />
        <Stat label="Streak" value={String(classicStreak.streak)} />
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
      </section>
    </div>
  );
}

export function QuestionScreen({
  puzzle,
  question,
  index,
  busy,
  error,
  onSubmit,
  onHome,
}: {
  puzzle: PuzzleResponse;
  question: PublicQuestion;
  index: number;
  busy: boolean;
  error: string | null;
  onSubmit: (guess: Guess) => void;
  onHome: () => void;
}) {
  return (
    <div className="stack">
      <PlayHeader puzzle={puzzle} index={index} onHome={onHome} />
      <QuestionTimer
        questionKey={question.id}
        running={!busy}
        onExpire={() => onSubmit({ type: "name_one", text: "", timedOut: true })}
      />
      <p className="type-kicker">{typeLabel(question.type)}</p>
      <h2 className="prompt">{question.prompt}</h2>
      {question.type === "name_one" ? <TierLadder /> : null}
      {question.type === "estimate" && question.slider && question.unit ? (
        <EstimateForm unit={question.unit} slider={question.slider} busy={busy} onSubmit={(value, confidence) => onSubmit({ type: "estimate", value, confidence })} />
      ) : null}
      {question.type === "compare" ? (
        <CompareForm items={question.items} busy={busy} onSubmit={(choiceId) => onSubmit({ type: "compare", choiceId })} />
      ) : null}
      {question.type === "rank" ? (
        <RankForm items={question.items} busy={busy} onSubmit={(order) => onSubmit({ type: "rank", order })} />
      ) : null}
      {question.type === "name_one" ? (
        <NameForm suggestions={question.suggestions} busy={busy} onSubmit={(text) => onSubmit({ type: "name_one", text })} />
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
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
  last: boolean;
  onNext: () => void;
  onHome: () => void;
}) {
  return (
    <div className="stack">
      <PlayHeader puzzle={puzzle} index={index} onHome={onHome} />
      <section className={`reveal band-${reveal.band}`} aria-live="polite">
        <p className="emoji" aria-hidden="true">
          {reveal.emoji}
        </p>
        <h2>{reveal.label}</h2>
        <p className="points">
          {reveal.points}
          <span> pts</span>
        </p>
        {reveal.bonusPoints > 0 ? <p className="delta">Crowd bonus +{reveal.bonusPoints}</p> : null}
        {reveal.provisional ? <p className="delta">Points so far, final at reset.</p> : null}
        {reveal.confidenceDelta !== 0 ? (
          <p className="delta">
            {reveal.confidence} confidence {reveal.confidenceDelta > 0 ? "added" : "cost"} {Math.abs(reveal.confidenceDelta)}
          </p>
        ) : null}
        <p className="answer">{reveal.answerText}</p>
        {question.type !== "name_one" && reveal.detail ? <p className="detail">{reveal.detail}</p> : null}
        {reveal.track ? <Track track={reveal.track} /> : null}
        {question.type !== "estimate" && question.type !== "name_one" ? (
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
        <p className="context">{reveal.context}</p>
        <a className="source" href={reveal.sourceUrl} target="_blank" rel="noreferrer">
          {reveal.sourceName}
        </a>
        <Crowd crowd={reveal.crowd} type={question.type} />
      </section>
      <button className="primary" type="button" onClick={onNext}>
        {last ? "See the day" : "Next question"}
      </button>
    </div>
  );
}

export function EndScreen({
  puzzle,
  result,
  stats,
  streak,
  rivals,
  onHome,
}: {
  puzzle: PuzzleResponse;
  result: DayResult;
  stats: Stats;
  streak: StreakView & { savedToday: boolean };
  /** Your rank, the friend you raced, and the weekly league. */
  rivals?: ReactNode;
  onHome: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  return (
    <div className="stack end">
      <p className="kicker">
        Classic · #{puzzle.puzzleNumber}
      </p>
      <h2>You reached {result.reached}</h2>
      <p className="score">
        {result.score}
        <span> pts</span>
      </p>
      {result.provisional ? <p className="players">Points so far, final at reset.</p> : null}
      {rivals}
      <p className="emoji-row" aria-label="Five question bands">
        {result.emojis.join("")}
      </p>
      <pre className="share-card">{result.shareText}</pre>
      <button
        className="primary"
        type="button"
        onClick={() => {
          haptic("tap");
          void shareText(result.shareText).then((outcome) => {
            setShareState(outcome === "cancelled" ? "idle" : outcome === "shared" ? "shared" : outcome === "copied" ? "copied" : "failed");
          });
        }}
      >
        {shareState === "copied" ? "Copied" : shareState === "shared" ? "Shared" : shareState === "failed" ? "Copy didn’t work" : "Share"}
      </button>
      {streak.savedToday ? <p className="shield-line">Your streak shield covered the day you missed.</p> : null}
      <p className="streak-line">
        Streak {streak.streak} · Best {stats.maxStreak} · Played {stats.played}
      </p>
      <button className="text-button" type="button" onClick={onHome}>
        Back home
      </button>
    </div>
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
  return (
    <div className="play-head">
      <button className="text-button" type="button" onClick={onHome}>
        Home
      </button>
      <p>
        {index + 1} of {puzzle.questions.length}
        <span> · {puzzle.theme}</span>
      </p>
      <div className="dots" aria-hidden="true">
        {puzzle.questions.map((question, dot) => (
          <i key={question.id} className={dot === index ? "on" : question.reveal ? "done" : ""} />
        ))}
      </div>
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

function Crowd({ crowd, type }: { crowd: CrowdStat; type: PublicQuestion["type"] }) {
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

function Countdown() {
  const [label, setLabel] = useState(() => countdownLabel(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setLabel(countdownLabel(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <p className="countdown">{label}</p>;
}

function countdownLabel(now: Date): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = Math.max(0, next - now.getTime());
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const local = new Date(next).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `Resets ${local} · ${hours}h ${minutes}m ${seconds}s`;
}

/** The scoring ladder, shown before the player answers, so the goal is to think past the obvious. */
function TierLadder() {
  return (
    <ol className="tier-ladder" aria-label="Points by how rare your answer is">
      {[...NAME_TIERS].reverse().map((tier) => (
        <li key={tier.name} className={`tier-${tier.band}`}>
          <b>{tier.points}</b>
          <span>{tier.name}</span>
        </li>
      ))}
    </ol>
  );
}

function NameForm({
  suggestions,
  busy,
  onSubmit,
}: {
  suggestions: string[];
  busy: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
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
      <button className="primary" type="submit" disabled={busy}>
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
