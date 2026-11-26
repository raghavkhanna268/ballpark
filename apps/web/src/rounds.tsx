import { useEffect, useState } from "react";
import { NAME_CAP, classicStep, type Guess, type PuzzleResponse, type Reveal, type RoundResponse, type RoundResult } from "@ballpark/shared";
import { ApiError, errorCopy, getRound, postRoundGuess, type RoundRef } from "./api";
import { BigScore, ClimbLog, EndDock, EndRule, EndTop } from "./endview";
import { TheCatch } from "./flightlog";
import { currentCombo, trailOf } from "./game";
import { haptic, shareText } from "./haptic";
import { useFloatMode } from "./journey";
import { RankBlock } from "./rivals";
import { QuestionScreen, RevealScreen, type Correction } from "./screens";
import type { SkyTrail } from "./sky";
import { playBonk } from "./sound";

/*
 * Rounds outside the daily, played with the Classic question and reveal screens: a pack chapter, a past day from
 * the archive, or an Unlimited round. None of them touch the streak, the rank or the league.
 */

type RoundPhase = { name: "loading" } | { name: "ask"; index: number } | { name: "reveal"; index: number; reveal: Reveal } | { name: "end" };

const WORDS: Record<RoundRef["kind"], { loading: string; done: string }> = {
  pack: { loading: "Loading the chapter…", done: "Chapter complete" },
  archive: { loading: "Loading that day…", done: "Day complete" },
  unlimited: { loading: "Dealing seven questions…", done: "Round complete" },
};

export function RoundRun({
  deviceId,
  round: ref,
  onHome,
  onBack,
  backLabel,
  onAgain,
  onFlight,
  onHop,
  onEnd,
}: {
  deviceId: string;
  round: RoundRef;
  onHome: () => void;
  /** Back to where the round was picked: the route, the archive, or Unlimited. */
  onBack: () => void;
  backLabel: string;
  /** Unlimited only: deal the next round. */
  onAgain?: () => void;
  /** How high the rocket already is when the round opens, the points so far, the right answers in a row, the climb so far, and how many questions the round has. */
  onFlight: (progress: number, score: number, combo: number, trail: SkyTrail[], size: number) => void;
  /** One answer scored: its points, its tier label when it scored any, and what the player typed. */
  onHop: (points: number, label: string | null, answer: string) => void;
  onEnd: () => void;
}) {
  const [round, setRound] = useState<RoundResponse | null>(null);
  const [phase, setPhase] = useState<RoundPhase>({ name: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ id: string; count: number }>({ id: "", count: 0 });
  const [correction, setCorrection] = useState<Correction & { id: string }>({ id: "", from: "", to: "", key: 0 });
  const words = WORDS[ref.kind];

  useEffect(() => {
    let live = true;
    void getRound(deviceId, ref)
      .then((loaded) => {
        if (!live) return;
        setRound(loaded);
        const points = loaded.questions.map((question) => question.reveal?.points ?? null);
        const size = loaded.questions.length;
        onFlight(flight(loaded), points.reduce<number>((sum, value) => sum + (value ?? 0), 0), currentCombo(points), trailOf(loaded.questions, size), size);
        if (loaded.result) {
          setPhase({ name: "end" });
          onEnd();
          return;
        }
        const index = loaded.questions.findIndex((question) => question.reveal === null);
        setPhase({ name: "ask", index: Math.max(0, index) });
      })
      .catch((caught: unknown) => live && setError(errorCopy(caught)));
    return () => {
      live = false;
    };
    // A round loads once per open, so the parent's callbacks are left out of the dependencies on purpose.
  }, [deviceId, ref.kind, "id" in ref ? ref.id : ref.date, ref.kind === "pack" ? ref.chapter : 0]);

  if (error && !round) {
    return (
      <div className="stack">
        <p className="form-error">{error}</p>
        <button className="text-button" type="button" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    );
  }
  if (!round || phase.name === "loading") return <p className="status">{words.loading}</p>;

  const puzzle = asPuzzle(round);

  async function submit(index: number, guess: Guess) {
    const question = round!.questions[index];
    if (!question) return;
    setBusy(true);
    setError(null);
    haptic("tap");
    try {
      const response = await postRoundGuess(deviceId, ref, question.id, guess);
      const questions = round!.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, reveal: response.reveal } : item));
      setRound({ ...round!, questions, result: response.result });
      onHop(response.reveal.points, response.reveal.points > 0 ? response.reveal.label : null, guess.type === "name_one" ? guess.text : "");
      haptic(response.reveal.band === "green" ? "good" : response.reveal.band === "black" ? "bad" : "ok");
      setPhase({ name: "reveal", index, reveal: response.reveal });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "did_you_mean" && caught.suggestion) {
        const to = caught.suggestion;
        const from = guess.type === "name_one" ? guess.text : "";
        setCorrection((current) => ({ id: question.id, from, to, key: current.key + 1 }));
        haptic("ok");
        return;
      }
      if (caught instanceof ApiError && caught.code === "not_listed") {
        setRejected((current) => ({ id: question.id, count: current.id === question.id ? current.count + 1 : 1 }));
        playBonk();
        haptic("bad");
        return;
      }
      setError(errorCopy(caught));
    } finally {
      setBusy(false);
    }
  }

  if (phase.name === "ask") {
    return (
      <QuestionScreen
        puzzle={puzzle}
        question={round.questions[phase.index]!}
        index={phase.index}
        busy={busy}
        error={error}
        rejections={rejected.id === round.questions[phase.index]?.id ? rejected.count : 0}
        correction={correction.id === round.questions[phase.index]?.id ? correction : null}
        onHome={onHome}
        onSubmit={(guess) => void submit(phase.index, guess)}
      />
    );
  }
  if (phase.name === "reveal") {
    const last = phase.index === round.questions.length - 1;
    return (
      <RevealScreen
        puzzle={puzzle}
        question={round.questions[phase.index]!}
        reveal={phase.reveal}
        index={phase.index}
        last={last}
        onHome={onHome}
        onNext={() => {
          if (last) {
            setPhase({ name: "end" });
            onEnd();
            return;
          }
          setPhase({ name: "ask", index: phase.index + 1 });
        }}
      />
    );
  }
  return round.result ? (
    <RoundEnd round={round} result={round.result} done={words.done} onBack={onBack} backLabel={backLabel} onAgain={onAgain} onHome={onHome} />
  ) : null;
}

function RoundEnd({
  round,
  result,
  done,
  onBack,
  backLabel,
  onAgain,
  onHome,
}: {
  round: RoundResponse;
  result: RoundResult;
  done: string;
  onBack: () => void;
  backLabel: string;
  onAgain?: () => void;
  onHome: () => void;
}) {
  // The same open layout as the daily's end screen: no card, the score big, the curve, then the climb log.
  useFloatMode();
  const [shared, setShared] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  return (
    <>
      <div className="stack end round-end">
        <EndTop title={done} kicker={`${round.round.emoji} ${round.round.title}`} />
        <BigScore score={result.score} reached={result.reached} />
        <RoundPlace result={result} />
        <section className="end-section">
          <EndRule title="Climb log" note="Higher = rarer" />
          <ClimbLog questions={round.questions} />
        </section>
        <section className="end-section">
          <EndRule title="Your answers" />
          <TheCatch questions={round.questions} />
        </section>
        <section className="end-section end-more">
          <p className="round-note">{round.round.kind === "pack" ? "Packs never touch your streak or the league." : "Played for fun: no streak, rank or league points."}</p>
          <button className="text-button" type="button" onClick={onHome}>
            Back home
          </button>
        </section>
      </div>
      <EndDock>
        <button className="text-button" type="button" onClick={onBack}>
          {backLabel}
        </button>
        {onAgain ? (
          <button className="ghost-button" type="button" onClick={onAgain}>
            Another ♾️
          </button>
        ) : null}
        <button
          className="dock-go"
          type="button"
          onClick={() => {
            haptic("tap");
            void shareText(result.shareText).then((outcome) => setShared(outcome === "cancelled" ? "idle" : outcome));
          }}
        >
          {shared === "copied" ? "Copied" : shared === "shared" ? "Shared" : shared === "failed" ? "Copy didn’t work" : "Share"}
        </button>
      </EndDock>
    </>
  );
}

function RoundPlace({ result }: { result: RoundResult }) {
  if (!result.place) {
    return <p className="players">Rarity here counts everyone who has ever answered these questions.</p>;
  }
  if (result.hypothetical) return <RankBlock place={result.place} unit="pts" who="that day’s players" among="that day" wouldHave big />;
  return <RankBlock place={result.place} unit="pts" who={`everyone ${result.placeWhat}`} among={result.placeWhat} big />;
}

/** A round in the shape the Classic screens read. */
function asPuzzle(round: RoundResponse): PuzzleResponse {
  return {
    date: "",
    puzzleNumber: 0,
    theme: `${round.round.emoji} ${round.round.title}`,
    blurb: round.round.blurb,
    nextTheme: "",
    mode: "classic",
    shareHost: "",
    devDate: false,
    cruise: null,
    questions: round.questions,
    result: null,
    field: { players: 0, averageProgress: null, bestProgress: null },
    today: { climbing: 0, board: [], you: null },
  };
}

function flight(round: RoundResponse): number {
  const size = round.questions.length;
  return round.questions.reduce((sum, question) => (question.reveal ? sum + classicStep(question.reveal.points, NAME_CAP, size) : sum), 0);
}
