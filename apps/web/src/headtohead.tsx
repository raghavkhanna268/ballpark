import { useEffect, useState, type ReactNode } from "react";
import type { PublicH2HRound } from "@ballpark/shared";
import { errorCopy, postHeadPick, postPractice, type HeadPickResponse, type HeadToHeadState } from "./api";
import { CountUp } from "./game";
import { haptic, shareText } from "./haptic";
import { RankBlock } from "./rivals";
import { QuestionTimer } from "./timer";

type RevealState = HeadPickResponse & { practice: boolean; timedOut: boolean };

export function HeadToHeadScreen({
  deviceId,
  initial,
  onHome,
  onOfficialFinish,
  onHop,
  onSettled,
  rivals,
}: {
  deviceId: string;
  initial: HeadToHeadState;
  onHome: () => void;
  onOfficialFinish: (date: string, score: number) => void;
  onHop: (correct: boolean, correctCount: number, index: number) => void;
  onSettled: () => void;
  /** Shown under a scored result: the friend you raced, the weekly league, the streak shield. */
  rivals?: (result: NonNullable<HeadToHeadState["result"]>) => ReactNode;
}) {
  const [practice, setPractice] = useState(initial.runKind === "practice" && initial.status === "in-progress");
  const [round, setRound] = useState<PublicH2HRound | null>(initial.round);
  const [correct, setCorrect] = useState(initial.correct);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [result, setResult] = useState(initial.result);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared" | "failed">("idle");
  const [slim, setSlim] = useState(false);

  useEffect(() => {
    if (!reveal) {
      setSlim(false);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 500 : reveal.correct ? 2600 : 2000;
    const collapse = window.setTimeout(() => setSlim(true), reduced ? 180 : 480);
    const id = window.setTimeout(() => {
      if (reveal.next) {
        setRound(reveal.next);
        setReveal(null);
        return;
      }
      if (reveal.finished) {
        setRound(null);
        setResult(reveal.result);
        setReveal(null);
        onSettled();
      }
    }, delay);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(collapse);
    };
  }, [reveal]);

  async function choose(body: { choiceId?: string; direction?: "higher" | "lower"; timedOut?: boolean }) {
    if (!round || busy) return;
    setBusy(true);
    setError(null);
    haptic("tap");
    try {
      const response = await postHeadPick(deviceId, { index: round.index, ...body });
      setCorrect(response.correctCount);
      onHop(response.correct, response.correctCount, round.index);
      haptic(response.correct ? "good" : "bad");
      if (response.finished && response.result?.official) onOfficialFinish(initial.date, response.result.score);
      setReveal({ ...response, practice, timedOut: body.timedOut === true });
    } catch (caught) {
      setError(errorCopy(caught));
    } finally {
      setBusy(false);
    }
  }

  async function practiceRun() {
    setBusy(true);
    setError(null);
    try {
      const response = await postPractice(deviceId);
      setPractice(true);
      setResult(null);
      setReveal(null);
      setCorrect(0);
      setRound(response.round);
    } catch (caught) {
      setError(errorCopy(caught));
    } finally {
      setBusy(false);
    }
  }

  if (result && !round && !reveal) {
    return (
      <div className="stack end">
        <p className="kicker">{result.official ? `Head-to-head · #${initial.puzzleNumber}` : "Practice run"}</p>
        <p className="mission">Run complete</p>
        <h2>You reached {result.reached}</h2>
        <p className="score">
          <CountUp value={result.score} pad={2} />
          <span> / 10</span>
        </p>
        {result.official ? (
          <>
            {result.place ? <RankBlock place={result.place} unit="picks" /> : null}
            <p className="best-today">Best run today: {result.bestToday}/10</p>
            {rivals?.(result)}
            <p className="emoji-row" aria-label="Ten picks">
              {result.marks}
            </p>
            <pre className="share-card">{result.shareText}</pre>
            <button
              className="primary"
              type="button"
              onClick={() => {
                haptic("tap");
                void shareText(result.shareText).then((outcome) => {
                  setShareState(outcome === "cancelled" ? "idle" : outcome === "copied" ? "copied" : outcome === "shared" ? "shared" : "failed");
                });
              }}
            >
              {shareState === "copied" ? "Copied" : shareState === "shared" ? "Shared" : shareState === "failed" ? "Copy didn’t work" : "Share"}
            </button>
          </>
        ) : (
          <p className="players">Practice only. This run is not on the board.</p>
        )}
        <button className="text-button" type="button" onClick={() => void practiceRun()} disabled={busy}>
          {busy ? "Starting…" : "Practice an unscored run"}
        </button>
        <button className="text-button" type="button" onClick={onHome}>
          Back home
        </button>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    );
  }

  const showing = reveal ?? null;
  return (
    <div className="stack">
      <div className="play-head">
        <button className="text-button" type="button" onClick={onHome}>
          Home
        </button>
        <p className={correct > 0 && !showing ? "h2h-count bump" : "h2h-count"}>{correct}</p>
      </div>
      {practice ? <p className="practice-flag">Practice · not on the board</p> : <p className="type-kicker">Head-to-head</p>}
      {showing && slim ? (
        <section className={`reveal slim ${showing.correct ? "band-green" : "band-black"}`} aria-live="polite">
          <h2>{showing.correct ? "Correct" : showing.timedOut ? "Out of time" : "Not this one"}</h2>
        </section>
      ) : showing ? (
        <section className={`reveal ${showing.correct ? "band-green" : "band-black"}`} aria-live="polite">
          <p className="emoji">{showing.correct ? "🟩" : "❌"}</p>
          <h2>{showing.correct ? "Correct" : showing.timedOut ? "Out of time" : "Not this one"}</h2>
          <ul className="rows">
            {showing.reveal.rows.map((row) => (
              <li key={row.label}>
                <strong>{row.label}</strong>
                <em>{row.valueText}</em>
              </li>
            ))}
          </ul>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              if (showing.next) {
                setRound(showing.next);
                setReveal(null);
                return;
              }
              setRound(null);
              setResult(showing.result);
              setReveal(null);
              onSettled();
            }}
          >
            {showing.next ? "Next" : "See the result"}
          </button>
        </section>
      ) : round ? (
        <>
          <QuestionTimer questionKey={`${practice ? "p" : "s"}-${round.index}`} running={!busy} onExpire={() => void choose({ timedOut: true })} />
          <RoundForm round={round} busy={busy} onChoose={(body) => void choose(body)} />
        </>
      ) : (
        <p className="status">No pair is available.</p>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

function RoundForm({
  round,
  busy,
  onChoose,
}: {
  round: PublicH2HRound;
  busy: boolean;
  onChoose: (body: { choiceId?: string; direction?: "higher" | "lower" }) => void;
}) {
  return (
    <form
      className="guess-form"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <h2 className="prompt">{round.prompt}</h2>
      {round.kind === "higher-lower" && round.shown ? (
        <>
          <p className="shown-value">
            {round.shown.label}
            <strong>{round.shown.valueText}</strong>
          </p>
          <div className="choices">
            <button className="choice" type="button" disabled={busy} onClick={() => onChoose({ direction: "higher" })}>
              {round.higherLabel}
            </button>
            <button className="choice" type="button" disabled={busy} onClick={() => onChoose({ direction: "lower" })}>
              {round.lowerLabel}
            </button>
          </div>
        </>
      ) : (
        <div className="choices">
          {round.options.map((option) => (
            <button key={option.id} className="choice" type="button" disabled={busy} onClick={() => onChoose({ choiceId: option.id })}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
