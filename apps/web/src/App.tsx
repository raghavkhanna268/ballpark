import { useCallback, useEffect, useState } from "react";
import {
  NAME_CAP,
  classicStep,
  journeyProgress,
  type DayResult,
  type FieldStats,
  type Guess,
  type LeagueResponse,
  type PackSummary,
  type PlusStatus,
  type PuzzleResponse,
  type Race,
  type Reveal,
} from "@ballpark/shared";
import { ApiError, errorCopy, getHeadToHead, getLeague, getPacks, getPlus, getPuzzle, postGuess, type HeadToHeadState } from "./api";
import { HeadToHeadScreen } from "./headtohead";
import { haptic } from "./haptic";
import { Journey, type Ghost, type Hop } from "./journey";
import { LogbookCard, loadLogbook, recordFind, recordRun, type Logbook } from "./logbook";
import { AdSlot, PackRun, PacksCard, PlusScreen } from "./plus";
import { FriendResult, LeagueCard, LeagueLine, RaceBanner, RankBlock, captureRace, raceFor } from "./rivals";
import { DevDate, EndScreen, HomeScreen, QuestionScreen, RevealScreen } from "./screens";
import { loadHeadToHeadStats, loadStats, recordHeadToHead, recordScore, streakStatus, type HeadToHeadStats, type StoredStats } from "./storage";

type Phase =
  | { name: "home" }
  | { name: "ask"; index: number }
  | { name: "reveal"; index: number; reveal: Reveal; result: DayResult | null }
  | { name: "end" }
  | { name: "h2h" }
  | { name: "plus" }
  | { name: "pack"; id: string; done: boolean };

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
  const [logbook, setLogbook] = useState<Logbook>(() => loadLogbook());
  /** "Your best" ghost is your best before this visit, so finishing a run does not overtake itself. */
  const [bestBefore] = useState(() => loadLogbook().best);
  /** A friend's climb from a shared `?race=` link. */
  const [race] = useState<Race | null>(() => captureRace());
  const [league, setLeague] = useState<LeagueResponse | null>(null);
  const [plus, setPlus] = useState<PlusStatus | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [packFlight, setPackFlight] = useState(0);

  const refreshPlus = useCallback(async () => {
    try {
      const deviceId = loadStats().deviceId;
      const [status, list] = await Promise.all([getPlus(deviceId), getPacks(deviceId)]);
      setPlus(status);
      setPacks(list.packs);
    } catch {
      // Packs and the Ballpark+ card wait for the next refresh. The free game still works.
    }
  }, []);

  const refreshLeague = useCallback(async () => {
    try {
      setLeague(await getLeague(loadStats().deviceId));
    } catch {
      // The league card waits for the next refresh.
    }
  }, []);

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
      void refreshLeague();
      void refreshPlus();
    } catch (caught) {
      setError(errorCopy(caught));
    } finally {
      setLoading(false);
    }
  }, [refreshLeague, refreshPlus]);

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
      const max = question.type === "name_one" ? NAME_CAP : 20;
      const travel = classicStep(response.reveal.points, max);
      const tier = question.type === "name_one" && response.reveal.points > 0 ? { name: response.reveal.label, points: response.reveal.points } : undefined;
      setHop((current) => ({ id: current.id + 1, kind: response.reveal.points > 0 ? "voyage" : "stumble", travel, tier }));
      if (question.type === "name_one" && response.reveal.points >= NAME_CAP / 2) {
        setLogbook(recordFind({ date: nextPuzzle.date, prompt: question.prompt, answer: response.reveal.answerText, tier: response.reveal.label, points: response.reveal.points }));
      }
      if (response.result) {
        setLogbook(recordRun("classic", flightFor(nextPuzzle)));
        void refreshLeague();
      }
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

  const classicFlight = puzzle ? flightFor(puzzle) : 0;
  const mode = phase.name === "h2h" ? "h2h" : phase.name === "pack" ? "pack" : "classic";
  const flight = mode === "h2h" ? h2hFlight : mode === "pack" ? packFlight : classicFlight;
  const today = puzzle?.date ?? h2h?.date ?? "";
  const classicRace = raceFor(race, "classic", puzzle?.puzzleNumber);
  const h2hRace = raceFor(race, "h2h", h2h?.puzzleNumber);
  const ghosts =
    phase.name === "home" || phase.name === "plus" || mode === "pack"
      ? []
      : ghostsFor(bestBefore[mode], mode === "h2h" ? h2h?.field : puzzle?.field, mode === "h2h" ? h2hRace : classicRace);
  const showAds = plus !== null && !plus.plus;
  const classicStreak = streakStatus(stats, today || undefined);
  const h2hStreak = streakStatus(h2hStats, today || undefined);
  const challenge = classicRace && !puzzle?.result ? classicRace : h2hRace && h2h?.status !== "finished" ? h2hRace : null;

  function startHeadToHead() {
    const correct = h2h?.correct ?? 0;
    const answered = h2h?.status === "finished" ? 10 : (h2h?.round?.index ?? 0);
    setH2hFlight(correct + Math.max(0, answered - correct) / 3);
    setH2hOverview(h2h?.status === "finished");
    setPhase({ name: "h2h" });
  }

  function startClassic() {
    if (!puzzle) return;
    const index = puzzle.questions.findIndex((question) => question.reveal === null);
    setPhase({ name: "ask", index: index === -1 ? 0 : index });
  }

  function openPack(id: string) {
    setPackFlight(0);
    setPhase({ name: "pack", id, done: false });
  }

  function goHome() {
    setPhase({ name: "home" });
  }

  return (
    <Journey
      progress={flight}
      hop={hop}
      ghosts={ghosts}
      overview={phase.name === "end" || h2hOverview || (phase.name === "pack" && phase.done)}
      page={"index" in phase ? `${phase.name}-${phase.index}` : phase.name === "pack" ? `pack-${phase.id}` : phase.name}
    >
    <main>
      {loading && !puzzle ? <p className="status">Loading today’s puzzle…</p> : null}
      {error && phase.name === "home" ? <p className="form-error banner">{error}</p> : null}
      {puzzle && phase.name === "home" ? (
        <HomeScreen
          puzzle={puzzle}
          stats={stats}
          classicStreak={classicStreak}
          h2hStreak={h2hStreak}
          h2hLabel={h2h?.status === "finished" ? `See today’s run · ${h2h.result?.score ?? 0}` : h2h?.status === "in-progress" ? "Continue Head-to-head" : "Play Head-to-head"}
          onHeadToHead={startHeadToHead}
          onPlay={startClassic}
          onResult={() => setPhase({ name: "end" })}
          challenge={challenge ? <RaceBanner race={challenge} onRace={challenge.mode === "classic" ? startClassic : startHeadToHead} /> : null}
          league={league ? <LeagueCard league={league} today={today} /> : null}
          logbook={<LogbookCard logbook={logbook} />}
          packs={<PacksCard packs={packs} status={plus} onPack={openPack} onPlus={() => setPhase({ name: "plus" })} />}
          ad={showAds ? <AdSlot onPlus={() => setPhase({ name: "plus" })} /> : null}
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
        <EndScreen
          puzzle={puzzle}
          result={puzzle.result}
          stats={stats}
          streak={classicStreak}
          rivals={
            <>
              {puzzle.result.place ? <RankBlock place={puzzle.result.place} unit="pts" /> : null}
              {classicRace ? <FriendResult race={classicRace} mine={classicFlight} /> : null}
              <LeagueLine league={league} />
            </>
          }
          ad={showAds ? <AdSlot onPlus={() => setPhase({ name: "plus" })} /> : null}
          onHome={() => setPhase({ name: "home" })}
        />
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
          onOfficialFinish={(date, score) => {
            setH2hStats(recordHeadToHead(date, score));
            setLogbook(recordRun("h2h", journeyProgress(score, 10)));
            void refreshLeague();
          }}
          rivals={(result) => (
            <>
              {h2hRace ? <FriendResult race={h2hRace} mine={journeyProgress(result.score, 10)} /> : null}
              <LeagueLine league={league} />
              {h2hStreak.savedToday ? <p className="shield-line">Your streak shield covered the day you missed.</p> : null}
            </>
          )}
          onHop={(correct) => {
            setH2hFlight((current) => current + (correct ? 1 : 1 / 3));
            setHop((current) => ({ id: current.id + 1, kind: correct ? "voyage" : "stumble", travel: correct ? 1 : 0.33 }));
          }}
          onSettled={() => setH2hOverview(true)}
        />
      ) : null}
      {plus && phase.name === "plus" ? (
        <PlusScreen
          deviceId={stats.deviceId}
          status={plus}
          onStatus={(next) => {
            setPlus(next);
            void refreshPlus();
          }}
          onHome={goHome}
          onPacks={goHome}
        />
      ) : null}
      {phase.name === "pack" ? (
        <PackRun
          key={phase.id}
          deviceId={stats.deviceId}
          packId={phase.id}
          onHome={() => {
            goHome();
            void refreshPlus();
          }}
          onFlight={setPackFlight}
          onHop={(points, tier) => {
            const travel = classicStep(points, NAME_CAP);
            setPackFlight((current) => current + travel);
            setHop((current) => ({ id: current.id + 1, kind: points > 0 ? "voyage" : "stumble", travel, tier: tier ? { name: tier, points } : undefined }));
          }}
          onEnd={() => setPhase((current) => (current.name === "pack" ? { ...current, done: true } : current))}
        />
      ) : null}
      <footer>
        <p>Sample puzzles, pending editorial verification. No account needed. The daily game is free.</p>
        <DevDate />
      </footer>
    </main>
    </Journey>
  );
}

function flightFor(puzzle: PuzzleResponse): number {
  return puzzle.questions.reduce((sum, question) => {
    if (!question.reveal) return sum;
    return sum + classicStep(question.reveal.points, question.type === "name_one" ? NAME_CAP : 20);
  }, 0);
}

function ghostsFor(best: number, field: FieldStats | undefined, race: Race | null): Ghost[] {
  const ghosts: Ghost[] = [];
  if (race) ghosts.push({ id: "friend", label: "Your friend", progress: race.progress });
  if (best > 0) ghosts.push({ id: "best", label: "Your best", progress: best });
  if (field && field.players > 0 && field.averageProgress !== null) ghosts.push({ id: "average", label: "Today’s average", progress: field.averageProgress });
  if (field && field.players > 1 && field.bestProgress !== null) ghosts.push({ id: "top", label: "Today’s best", progress: field.bestProgress });
  return ghosts;
}
