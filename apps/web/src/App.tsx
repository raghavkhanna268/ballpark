import { useCallback, useEffect, useState } from "react";
import type { DayResult, Guess, PuzzleResponse, Reveal } from "@ballpark/shared";
import { ApiError, errorCopy, getHeadToHead, getPuzzle, postGuess, type HeadToHeadState } from "./api";
import { HeadToHeadScreen } from "./headtohead";
import { haptic } from "./haptic";
import { Hop, Journey } from "./journey";
import { DevDate, EndScreen, HomeScreen, QuestionScreen, RevealScreen } from "./screens";
import { loadHeadToHeadStats, loadStats, recordHeadToHead, recordScore, type HeadToHeadStats, type StoredStats } from "./storage";

type Phase =
  | { name: "home" }
  | { name: "ask"; index: number }
  | { name: "reveal"; index: number; reveal: Reveal; result: DayResult | null }
  | { name: "end" }
  | { name: "h2h" };

export function App() {
  const [stats, setStats] = useState<StoredStats>(() => loadStats());
  const [h2hStats, setH2hStats] = useState<HeadToHeadStats>(() => loadHeadToHeadStats());
  const [h2h, setH2h] = useState<HeadToHeadState | null>(null);
  const [puzzle, setPuzzle] = useState<PuzzleResponse | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "home" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [h2hFlight, setH2hFlight] = useState(0);
  const [h2hOverview, setH2hOverview] = useState(false);
  const [hop, setHop] = useState<Hop>({ id: 0, kind: "idle", travel: 1 });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const deviceId = loadStats().deviceId;
      const [next, head] = await Promise.all([getPuzzle(deviceId), getHeadToHead(deviceId)]);
      setPuzzle(next);
      setH2h(head);
      if (next.result) setStats(recordScore(next.date, next.result.score));
      if (head.result?.official) setH2hStats(recordHeadToHead(head.date, head.result.score));
    } catch (caught) {
      setError(errorCopy(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit(index: number, guess: Guess) {
    if (!puzzle) return;
    const question = puzzle.questions[index];
    if (!question) return;
    setBusy(true);
    setError(null);
    haptic("tap");
    try {
      const response = await postGuess(stats.deviceId, question.id, guess);
      const questions = puzzle.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, reveal: response.reveal } : item));
      const nextPuzzle = { ...puzzle, questions, result: response.result };
      setPuzzle(nextPuzzle);
      if (response.result) setStats(recordScore(nextPuzzle.date, response.result.score));
      const max = question.type === "name_one" ? 36 : 20;
      const travel = Math.max(0.15, response.reveal.points / max);
      setHop((current) => ({ id: current.id + 1, kind: response.reveal.points > 0 ? "voyage" : "stumble", travel }));
      haptic(response.reveal.band === "green" ? "good" : response.reveal.band === "black" ? "bad" : "ok");
      setPhase({ name: "reveal", index, reveal: response.reveal, result: response.result });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "already_submitted") {
        await refresh();
      }
      setError(errorCopy(caught));
    } finally {
      setBusy(false);
    }
  }

  const classicFlight =
    puzzle?.questions.reduce((sum, question) => {
      if (!question.reveal) return sum;
      const max = question.type === "name_one" ? 36 : 20;
      return sum + (question.reveal.points <= 0 ? 0.28 : (question.reveal.points / max) * 2);
    }, 0) ?? 0;
  const flight = phase.name === "h2h" ? h2hFlight : classicFlight;

  return (
    <Journey progress={flight} hop={hop} overview={phase.name === "end" || h2hOverview} page={"index" in phase ? `${phase.name}-${phase.index}` : phase.name}>
    <main>
      {loading && !puzzle ? <p className="status">Loading today’s puzzle…</p> : null}
      {error && phase.name === "home" ? <p className="form-error banner">{error}</p> : null}
      {puzzle && phase.name === "home" ? (
        <HomeScreen
          puzzle={puzzle}
          stats={stats}
          h2hStreak={h2hStats.currentStreak}
          h2hLabel={h2h?.status === "finished" ? `See today’s run · ${h2h.result?.score ?? 0}` : h2h?.status === "in-progress" ? "Continue Head-to-head" : "Play Head-to-head"}
          onHeadToHead={() => {
            const correct = h2h?.correct ?? 0;
            const answered = h2h?.status === "finished" ? 10 : (h2h?.round?.index ?? 0);
            setH2hFlight(correct + Math.max(0, answered - correct) / 3);
            setH2hOverview(h2h?.status === "finished");
            setPhase({ name: "h2h" });
          }}
          onPlay={() => {
            const index = puzzle.questions.findIndex((question) => question.reveal === null);
            setPhase({ name: "ask", index: index === -1 ? 0 : index });
          }}
          onResult={() => setPhase({ name: "end" })}
        />
      ) : null}
      {puzzle && phase.name === "ask" ? (
        <QuestionScreen
          puzzle={puzzle}
          question={puzzle.questions[phase.index]!}
          index={phase.index}
          busy={busy}
          error={error}
          onHome={() => setPhase({ name: "home" })}
          onSubmit={(guess) => void submit(phase.index, guess)}
        />
      ) : null}
      {puzzle && phase.name === "reveal" ? (
        <RevealScreen
          puzzle={puzzle}
          question={puzzle.questions[phase.index]!}
          reveal={phase.reveal}
          index={phase.index}
          last={phase.index === puzzle.questions.length - 1}
          onHome={() => setPhase({ name: "home" })}
          onNext={() => {
            if (phase.index >= puzzle.questions.length - 1) {
              setPhase({ name: "end" });
              return;
            }
            setPhase({ name: "ask", index: phase.index + 1 });
          }}
        />
      ) : null}
      {puzzle && phase.name === "end" && puzzle.result ? (
        <EndScreen puzzle={puzzle} result={puzzle.result} stats={stats} onHome={() => setPhase({ name: "home" })} />
      ) : null}
      {h2h && phase.name === "h2h" ? (
        <HeadToHeadScreen
          deviceId={stats.deviceId}
          initial={h2h}
          onHome={() => {
            setH2hOverview(false);
            setPhase({ name: "home" });
            void refresh();
          }}
          onOfficialFinish={(date, score) => setH2hStats(recordHeadToHead(date, score))}
          onHop={(correct) => {
            setH2hFlight((current) => current + (correct ? 1 : 1 / 3));
            setHop((current) => ({ id: current.id + 1, kind: correct ? "voyage" : "stumble", travel: correct ? 1 : 0.33 }));
          }}
          onSettled={() => setH2hOverview(true)}
        />
      ) : null}
      <footer>
        <p>Sample puzzles, pending editorial verification. No ads, no account, no paywall.</p>
        <DevDate />
      </footer>
    </main>
    </Journey>
  );
}
