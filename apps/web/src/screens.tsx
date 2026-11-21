import { useEffect, useState } from "react";
import { haptic, shareText } from "./haptic";
import {
  formatFactValue,
  formatNumber,
  parseShorthand,
  roundSig,
  sliderToValue,
  valueToSlider,
  type Confidence,
  type CrowdStat,
  type DayResult,
  type Guess,
  type PublicQuestion,
  type PuzzleResponse,
  type Reveal,
  type Stats,
} from "@ballpark/shared";

const BUCKETS = ["0–20", "21–40", "41–60", "61–80", "81–100"];

export function HomeScreen({
  puzzle,
  stats,
  onPlay,
  onResult,
}: {
  puzzle: PuzzleResponse;
  stats: Stats;
  onPlay: () => void;
  onResult: () => void;
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
        <p className="lede">Five questions. One UTC day. No account.</p>
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

      <section className="card mode-card">
        <div className="mode-top">
          <h2>Classic</h2>
          <p className="streak">Streak {stats.currentStreak}</p>
        </div>
        <p>Estimate a number, pick the larger one, or put a short list in order.</p>
        {done ? (
          <button className="primary" type="button" onClick={onResult}>
            See today’s result · {puzzle.result?.score}/100
          </button>
        ) : (
          <button className="primary" type="button" onClick={onPlay}>
            {started ? "Continue Classic" : "Play today’s Classic"}
          </button>
        )}
      </section>

      <section className="card quiet-card">
        <div className="mode-top">
          <h2>Head-to-head</h2>
          <p className="soon">Coming next</p>
        </div>
        <p>A run of higher-or-lower until you miss, with its own streak. Same facts, not in this milestone.</p>
      </section>

      <section className="stats" aria-label="Your stats on this device">
        <Stat label="Played" value={String(stats.played)} />
        <Stat label="Streak" value={String(stats.currentStreak)} />
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
      <p className="type-kicker">{question.type}</p>
      <h2 className="prompt">{question.prompt}</h2>
      {question.type === "estimate" && question.slider && question.unit ? (
        <EstimateForm unit={question.unit} slider={question.slider} busy={busy} onSubmit={(value, confidence) => onSubmit({ type: "estimate", value, confidence })} />
      ) : null}
      {question.type === "compare" ? (
        <CompareForm items={question.items} busy={busy} onSubmit={(choiceId) => onSubmit({ type: "compare", choiceId })} />
      ) : null}
      {question.type === "rank" ? (
        <RankForm items={question.items} busy={busy} onSubmit={(order) => onSubmit({ type: "rank", order })} />
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
          <span> / 20</span>
        </p>
        {reveal.confidenceDelta !== 0 ? (
          <p className="delta">
            {reveal.confidence} confidence {reveal.confidenceDelta > 0 ? "added" : "cost"} {Math.abs(reveal.confidenceDelta)}
          </p>
        ) : null}
        <p className="answer">{reveal.answerText}</p>
        <p className="detail">{reveal.detail}</p>
        {reveal.track ? <Track track={reveal.track} /> : null}
        {question.type !== "estimate" ? (
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
  onHome,
}: {
  puzzle: PuzzleResponse;
  result: DayResult;
  stats: Stats;
  onHome: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  return (
    <div className="stack end">
      <p className="kicker">
        Classic · #{puzzle.puzzleNumber}
      </p>
      <p className="score">
        {result.score}
        <span>/100</span>
      </p>
      <h2>You beat {result.beatPercent}% of players today</h2>
      <p className="players">
        {result.players === 1 ? "You’re the only finisher so far, so that’s the whole field." : `${result.players} players finished today.`}
      </p>
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
      <p className="streak-line">
        Streak {stats.currentStreak} · Best {stats.maxStreak} · Played {stats.played}
      </p>
      <button className="text-button" type="button" onClick={onHome}>
        Back home
      </button>
    </div>
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
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [localError, setLocalError] = useState<string | null>(null);
  const parsed = parseShorthand(text);
  const sliderValue = parsed && parsed >= slider.min && parsed <= slider.max ? valueToSlider(parsed, slider.min, slider.max) : 0;

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
      <label className="slider-field">
        <span className="sr">Log scale</span>
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(sliderValue * 1000)}
          onChange={(event) => {
            const next = sliderToValue(Number(event.target.value) / 1000, slider.min, slider.max);
            setText(formatNumber(roundSig(next)));
          }}
        />
        <span className="slider-ends">
          <span>{formatNumber(slider.min)}</span>
          <span>{formatNumber(slider.max)}</span>
        </span>
      </label>
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
  const guessAt = valueToSlider(track.guess, track.min, track.max);
  const answerAt = valueToSlider(track.answer, track.min, track.max);
  const [shown, setShown] = useState(guessAt);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(answerAt));
    return () => cancelAnimationFrame(id);
  }, [answerAt]);
  return (
    <div className="track" aria-hidden="true">
      <span className="pin you" style={{ left: `${guessAt * 100}%` }}>
        You
      </span>
      <span className="pin answer" style={{ left: `${shown * 100}%` }}>
        Answer
      </span>
    </div>
  );
}

function Crowd({ crowd, type }: { crowd: CrowdStat; type: PublicQuestion["type"] }) {
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <p className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </p>
  );
}
