import { useCallback, useEffect, useState } from "react";
import { levelForCorrectCount, levelIndexForClassicScore, type DayResult, type Guess, type PuzzleResponse, type Reveal } from "@ballpark/shared";
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
  const [h2hCorrect, setH2hCorrect] = useState(0);
  const [h2hStep, setH2hStep] = useState(0);
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

  const classicScore = puzzle?.questions.reduce((sum, question) => sum + (question.reveal?.points ?? 0), 0) ?? 0;
  const worldId = levelForCorrectCount(phase.name === "h2h" ? h2hCorrect : levelIndexForClassicScore(classicScore)).id;
  const classicIndex = phase.name === "ask" || phase.name === "reveal" ? phase.index : (puzzle?.questions.filter((question) => question.reveal).length ?? 0);

  return (
    <Journey worldId={worldId} hop={hop} dots={phase.name === "h2h" ? { total: 10, current: h2hStep } : { total: 5, current: classicIndex }}>
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
            setH2hCorrect(h2h?.correct ?? 0);
            setH2hStep(h2h?.round?.index ?? 0);
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
            setPhase({ name: "home" });
            void refresh();
          }}
          onOfficialFinish={(date, score) => setH2hStats(recordHeadToHead(date, score))}
          onHop={(correct, correctCount, index) => {
            setH2hCorrect(correctCount);
            setH2hStep(index + 1);
            setHop((current) => ({ id: current.id + 1, kind: correct ? "voyage" : "stumble", travel: correct ? 1 : 0.28 }));
          }}
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
