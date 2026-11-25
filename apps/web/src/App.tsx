import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CLASSIC_QUESTIONS,
  NAME_CAP,
  classicStep,
  formatAltitude,
  journeyProgress,
  playToday,
  puzzleNumber,
  type DayResult,
  type FieldStats,
  type Guess,
  type LeagueResponse,
  type PackSummary,
  type PlusStatus,
  type PuzzleResponse,
  type Race,
  type Reveal,
  type UnlimitedStatus,
} from "@ballpark/shared";
import {
  ApiError,
  errorCopy,
  getHeadToHead,
  getLeague,
  getPacks,
  getPlus,
  getPuzzle,
  getUnlimited,
  postGuess,
  postNudge,
  postReport,
  postUnlimited,
  type HeadToHeadState,
  type RoundRef,
} from "./api";
import { HeadToHeadScreen } from "./headtohead";
import { haptic } from "./haptic";
import { basePoints, currentCombo, gainLevel, maxPoints, stageStep, tierOf, trailOf } from "./game";
import { HangarCard, RocketIcon, SKINS, activeSkin, earnedFrom, isUnlocked, loadHangar, newlyEarned, saveHangar, skinById, type HangarState } from "./hangar";
import { TodayBoard } from "./flightlog";
import { ReminderSwitch } from "./reminder";
import { Journey, type Ghost, type Hop, type HudScore, type TrailSegment } from "./journey";
import { LogbookCard, loadLogbook, recordFind, recordRun, type Logbook } from "./logbook";
import { ArchiveScreen, JourneyScreen, PacksScreen, PlayMore, UnlimitedScreen } from "./more";
import { AdSlot, PlusScreen } from "./plus";
import { RoundRun } from "./rounds";
import { FriendResult, LeagueCard, LeagueLine, RaceBanner, RankBlock, captureRace, raceFor } from "./rivals";
import { DevDate, EndScreen, HomeScreen, QuestionScreen, RevealScreen, StatsPanel, type Correction } from "./screens";
import { sceneryFor } from "./sky";
import { playBonk } from "./sound";
import { loadHeadToHeadStats, loadStats, recordHeadToHead, recordScore, streakStatus, type HeadToHeadStats, type StoredStats } from "./storage";

/**
 * Head-to-head is switched off for now: no home card, no fetch, no race links into it.
 * Its screen, its API and their tests stay, so setting this to true brings it back.
 */
const HEAD_TO_HEAD_ON = false;

type Phase =
  | { name: "home" }
  | { name: "ask"; index: number }
  | { name: "reveal"; index: number; reveal: Reveal; result: DayResult | null }
  | { name: "end" }
  | { name: "h2h" }
  | { name: "plus" }
  | { name: "packs" }
  | { name: "journey"; id: string }
  | { name: "archive" }
  | { name: "unlimited" }
  | { name: "round"; round: RoundRef; done: boolean };

/** A round's key, so a new round mounts fresh. */
function roundKey(round: RoundRef): string {
  return round.kind === "pack" ? `pack-${round.id}-${round.chapter}` : round.kind === "archive" ? `archive-${round.date}` : `unlimited-${round.id}`;
}

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
  const [unlimited, setUnlimited] = useState<UnlimitedStatus | null>(null);
  /** Cruise for today, picked before the first answer. Once the day has started, the puzzle says which it is. */
  const [cruisePick, setCruisePick] = useState(false);
  const [roundFlight, setRoundFlight] = useState(0);
  /** Score and right-answers-in-a-row for the heads-up display in Head-to-head and other rounds. Classic reads them from the puzzle. */
  const [h2hRun, setH2hRun] = useState({ score: 0, combo: 0 });
  const [roundRun, setRoundRun] = useState({ score: 0, combo: 0 });
  const [roundTrail, setRoundTrail] = useState<TrailSegment[]>([]);
  /** Questions in the round being played, which sets how far each answer climbs. */
  const [roundSize, setRoundSize] = useState(5);
  /** Names the server said are not on the list, for the question on screen: each one costs 2 seconds. */
  const [rejected, setRejected] = useState<{ id: string; count: number; text: string }>({ id: "", count: 0, text: "" });
  /** The listed spelling offered for a name typed close to one, on the question it belongs to. */
  const [correction, setCorrection] = useState<Correction & { id: string }>({ id: "", from: "", to: "", key: 0 });
  /** Today's Afterburner is armed for the next answer. */
  const [armed, setArmed] = useState(false);
  const [hangar, setHangar] = useState<HangarState>(() => loadHangar());
  const earned = useMemo(() => earnedFrom(stats.maxStreak, logbook), [stats.maxStreak, logbook]);
  const skin = activeSkin(hangar, earned);

  function pickSkin(id: string) {
    setHangar(saveHangar({ selected: id, seen: SKINS.filter((item) => isUnlocked(item, earned)).map((item) => item.id) }));
  }

  const refreshPlus = useCallback(async () => {
    try {
      const deviceId = loadStats().deviceId;
      const [status, list, endless] = await Promise.all([getPlus(deviceId), getPacks(deviceId), getUnlimited(deviceId)]);
      setPlus(status);
      setPacks(list.packs);
      setUnlimited(endless);
    } catch {
      // Packs, Unlimited and the Ballpark+ card wait for the next refresh. The free game still works.
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
      const [next, head] = await Promise.all([getPuzzle(deviceId), HEAD_TO_HEAD_ON ? getHeadToHead(deviceId) : Promise.resolve(null)]);
      setPuzzle(next);
      setH2h(head);
      if (next.result) setStats(recordScore(next.date, next.result.score));
      if (head?.result?.official) setH2hStats(recordHeadToHead(head.date, head.result.score));
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

  /** Today's board and the climbing count, again after a finish, so the end screen lists this run. */
  async function refreshToday() {
    try {
      const next = await getPuzzle(stats.deviceId);
      setPuzzle((current) => (current && current.date === next.date ? { ...current, today: next.today, field: next.field } : current));
    } catch {
      // The board from the start of the game stays up.
    }
  }

  async function submit(index: number, guess: Guess) {
    if (!puzzle) return;
    const question = puzzle.questions[index];
    if (!question) return;
    setBusy(true);
    setError(null);
    haptic("tap");
    try {
      const response = await postGuess(stats.deviceId, question.id, guess, { afterburner: armed || undefined, skin: skin.id, cruise: cruise || undefined });
      setArmed(false);
      const questions = puzzle.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, reveal: response.reveal } : item));
      const nextPuzzle = { ...puzzle, questions, result: response.result };
      setPuzzle(nextPuzzle);
      if (response.result) setStats(recordScore(nextPuzzle.date, response.result.score));
      const max = maxPoints(question.type);
      const travel = stageStep(question.type, response.reveal, CLASSIC_QUESTIONS);
      const scored = response.reveal.points > 0;
      const base = basePoints(response.reveal);
      const gain = scored ? { label: response.reveal.label, points: response.reveal.points, level: gainLevel(base, max) } : undefined;
      const combo = scored ? currentCombo(pointsOf(nextPuzzle)) : currentCombo(pointsOf(puzzle));
      setHop((current) => ({
        id: current.id + 1,
        kind: scored ? "voyage" : "stumble",
        travel,
        gain,
        combo,
        answer: guess.type === "name_one" ? guess.text : undefined,
        boost: response.reveal.boosted,
      }));
      if (question.type === "name_one" && base >= NAME_CAP / 2) {
        setLogbook(recordFind({ date: nextPuzzle.date, prompt: question.prompt, answer: response.reveal.answerText, tier: response.reveal.label, points: response.reveal.points }));
      }
      if (response.result) {
        setLogbook(recordRun("classic", flightFor(nextPuzzle)));
        void refreshLeague();
        void refreshToday();
      }
      haptic(response.reveal.band === "green" ? "good" : response.reveal.band === "black" ? "bad" : "ok");
      setPhase({ name: "reveal", index, reveal: response.reveal, result: response.result });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "did_you_mean" && caught.suggestion) {
        // Close to a listed name: the box fills with that spelling to confirm or edit. No time is lost.
        const to = caught.suggestion;
        const from = guess.type === "name_one" ? guess.text : "";
        setCorrection((current) => ({ id: question.id, from, to, key: current.key + 1 }));
        haptic("ok");
        return;
      }
      if (caught instanceof ApiError && caught.code === "not_listed") {
        // Not on our list: nothing is stored, the clock loses 2 seconds, and the player tries another name.
        const text = guess.type === "name_one" ? guess.text : "";
        setRejected((current) => ({ id: question.id, count: current.id === question.id ? current.count + 1 : 1, text }));
        playBonk();
        haptic("bad");
        return;
      }
      if (caught instanceof ApiError && caught.code === "afterburner_used") setArmed(false);
      if (caught instanceof ApiError && (caught.code === "already_submitted" || caught.code === "mode_locked")) {
        await refresh();
      }
      setError(errorCopy(caught));
    } finally {
      setBusy(false);
    }
  }

  const classicFlight = puzzle ? flightFor(puzzle) : 0;
  const classicTrail = useMemo(() => (puzzle ? trailOf(puzzle.questions, CLASSIC_QUESTIONS) : []), [puzzle]);
  // City night, Sunset coast and Himalaya take turns by puzzle number, the same for everyone.
  const scenery = sceneryFor(puzzle?.puzzleNumber ?? puzzleNumber(playToday()));
  const mode = phase.name === "h2h" ? "h2h" : phase.name === "round" ? "round" : "classic";
  const flight = mode === "h2h" ? h2hFlight : mode === "round" ? roundFlight : classicFlight;
  const cruise = puzzle?.cruise ?? cruisePick;
  const today = puzzle?.date ?? h2h?.date ?? "";
  const classicRace = raceFor(race, "classic", puzzle?.puzzleNumber);
  const h2hRace = raceFor(race, "h2h", h2h?.puzzleNumber);
  const ghosts =
    mode === "round" || (mode === "classic" && !withGhosts(phase))
      ? []
      : ghostsFor(bestBefore[mode], mode === "h2h" ? h2h?.field : puzzle?.field, mode === "h2h" ? h2hRace : classicRace);
  const afterburnerReady = puzzle !== null && puzzle.result === null && !puzzle.questions.some((question) => question.reveal?.boosted);
  const fresh = newlyEarned(hangar, earned);
  const showAds = plus !== null && !plus.plus;
  const classicStreak = streakStatus(stats, today || undefined);
  const h2hStreak = streakStatus(h2hStats, today || undefined);
  const challenge = classicRace && !puzzle?.result ? classicRace : HEAD_TO_HEAD_ON && h2hRace && h2h?.status !== "finished" ? h2hRace : null;
  const inClassic = phase.name === "ask" || phase.name === "reveal" || phase.name === "end";
  const hudScore: HudScore | null = inClassic
    ? { value: puzzle ? classicScore(puzzle) : 0, label: "Score", digits: 3 }
    : mode === "h2h"
      ? { value: h2hRun.score, label: "Picks", digits: 2 }
      : mode === "round"
        ? { value: roundRun.score, label: "Score", digits: 3 }
        : null;
  const combo = inClassic && puzzle ? currentCombo(pointsOf(puzzle)) : mode === "h2h" ? h2hRun.combo : mode === "round" ? roundRun.combo : 0;

  function startHeadToHead() {
    const correct = h2h?.correct ?? 0;
    const answered = h2h?.status === "finished" ? 10 : (h2h?.round?.index ?? 0);
    setH2hFlight(correct + Math.max(0, answered - correct) / 3);
    setH2hOverview(h2h?.status === "finished");
    setH2hRun({ score: h2h?.status === "finished" ? (h2h.result?.score ?? correct) : correct, combo: 0 });
    setPhase({ name: "h2h" });
  }

  function startClassic() {
    if (!puzzle) return;
    const index = puzzle.questions.findIndex((question) => question.reveal === null);
    setPhase({ name: "ask", index: index === -1 ? 0 : index });
  }

  function openRound(round: RoundRef) {
    setRoundFlight(0);
    setRoundRun({ score: 0, combo: 0 });
    setRoundTrail([]);
    setPhase({ name: "round", round, done: false });
  }

  /** Where a round goes back to: its pack's route, the archive, or Unlimited. */
  function leaveRound(round: RoundRef) {
    void refreshPlus();
    if (round.kind === "pack") setPhase({ name: "journey", id: round.id });
    else if (round.kind === "archive") setPhase({ name: "archive" });
    else setPhase({ name: "unlimited" });
  }

  async function anotherRound() {
    try {
      openRound({ kind: "unlimited", id: (await postUnlimited(stats.deviceId)).id });
    } catch {
      setPhase({ name: "unlimited" });
    }
  }

  function goHome() {
    setPhase({ name: "home" });
  }

  return (
    <Journey
      progress={flight}
      hop={hop}
      ghosts={ghosts}
      scenery={scenery}
      trail={mode === "round" ? roundTrail : mode === "classic" ? classicTrail : NO_TRAIL}
      score={hudScore}
      combo={combo}
      paint={skin}
      overview={phase.name === "end" || h2hOverview || (phase.name === "round" && phase.done)}
      page={"index" in phase ? `${phase.name}-${phase.index}` : phase.name === "round" ? roundKey(phase.round) : phase.name === "journey" ? `journey-${phase.id}` : phase.name}
    >
    <main>
      {loading && !puzzle ? <p className="status">Loading today’s puzzle…</p> : null}
      {error && phase.name === "home" ? <p className="form-error banner">{error}</p> : null}
      {puzzle && phase.name === "home" ? (
        <HomeScreen
          puzzle={puzzle}
          classicStreak={classicStreak}
          headToHead={
            HEAD_TO_HEAD_ON
              ? {
                  streak: h2hStreak,
                  label: h2h?.status === "finished" ? `See today’s run · ${h2h.result?.score ?? 0}` : h2h?.status === "in-progress" ? "Continue Head-to-head" : "Play Head-to-head",
                  onPlay: startHeadToHead,
                }
              : null
          }
          onPlay={startClassic}
          onResult={() => setPhase({ name: "end" })}
          cruise={{ on: cruise, locked: puzzle.cruise !== null, onToggle: () => setCruisePick((current) => !current) }}
          more={
            <PlayMore
              packs={packs}
              plus={plus}
              unlimited={unlimited}
              onPacks={() => setPhase({ name: "packs" })}
              onArchive={() => setPhase({ name: "archive" })}
              onUnlimited={() => setPhase({ name: "unlimited" })}
            />
          }
          challenge={challenge ? <RaceBanner race={challenge} onRace={challenge.mode === "classic" ? startClassic : startHeadToHead} /> : null}
          panels={[
            {
              id: "league",
              icon: "🏆",
              title: "League",
              note: league?.joined && league.you ? `${league.name} · ${league.you.points} pts` : (league?.name ?? "Weekly"),
              content: league ? <LeagueCard league={league} today={today} /> : <p className="hint">Loading the league…</p>,
            },
            {
              id: "plus",
              icon: "⭐",
              title: "Ballpark+",
              note: plus?.plus ? "Your pass" : "No ads, more play",
              onOpen: () => setPhase({ name: "plus" }),
            },
            {
              id: "today",
              icon: "🏁",
              title: "Today",
              note: puzzle.today.climbing ? `${puzzle.today.climbing.toLocaleString("en-US")} climbing` : "Top ten at 20 players",
              content: (
                <section className="card today-card" aria-label="Today’s board">
                  <div className="mode-top">
                    <h2>Today’s top climbs</h2>
                    <p className="streak">#{puzzle.puzzleNumber}</p>
                  </div>
                  <TodayBoard today={puzzle.today} players={puzzle.field.players} />
                </section>
              ),
            },
            {
              id: "hangar",
              icon: "🚀",
              title: "Hangar",
              note: fresh.length > 0 ? `New: ${fresh[0]!.name}` : `${SKINS.filter((item) => isUnlocked(item, earned)).length}/${SKINS.length} paint jobs`,
              content: <HangarCard state={hangar} earned={earned} streak={classicStreak.streak} onPick={pickSkin} />,
            },
            {
              id: "logbook",
              icon: "📓",
              title: "Logbook",
              note: logbook.farthest > 0 ? `Best ${formatAltitude(logbook.farthest)}` : "Not started",
              content: <LogbookCard logbook={logbook} />,
            },
            { id: "stats", icon: "📊", title: "Stats", note: `Played ${stats.played}`, content: <StatsPanel stats={stats} streak={classicStreak} /> },
          ]}
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
          rejections={rejected.id === puzzle.questions[phase.index]?.id ? rejected.count : 0}
          rejectedText={rejected.id === puzzle.questions[phase.index]?.id ? rejected.text : ""}
          correction={correction.id === puzzle.questions[phase.index]?.id ? correction : null}
          afterburner={{ ready: afterburnerReady, armed, onToggle: () => setArmed((current) => !current) }}
          clock={!cruise}
          onNudge={async () => (await postNudge(stats.deviceId, puzzle.questions[phase.index]!.id)).nudge}
          onReport={async (text) => {
            await postReport(stats.deviceId, puzzle.questions[phase.index]!.id, text);
          }}
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
              {puzzle.result.cruise ? <p className="cruise-note">⛵ A cruise: no clock, so it stays off the board and the league. Your streak still counts.</p> : null}
              {classicRace ? <FriendResult race={classicRace} mine={classicFlight} /> : null}
              <LeagueLine league={league} />
            </>
          }
          postcard={{
            puzzleNumber: puzzle.puzzleNumber,
            scenery,
            trail: classicTrail,
            progress: classicFlight,
            paint: skin,
            score: puzzle.result.score,
            tiers: puzzle.questions.map((question) =>
              question.reveal && question.reveal.points > 0 ? tierOf(basePoints(question.reveal), maxPoints(question.type)) : -1,
            ),
            boosted: puzzle.result.boosted,
            host: puzzle.shareHost,
          }}
          extras={
            <>
              {fresh.length > 0 ? (
                <div className="new-skin">
                  <RocketIcon paint={fresh[0]!} size={44} />
                  <p>
                    <strong>New paint job: {fresh[0]!.name}</strong>
                    <small>
                      {fresh.length > 1
                        ? `Also new: ${listNames(fresh.slice(1).map((item) => item.name))}. All in the Hangar.`
                        : "Earned in the Hangar. Friends see it on the board and in race links."}
                    </small>
                  </p>
                  <button type="button" className="chip-button" onClick={() => pickSkin(fresh[0]!.id)}>
                    Fly it
                  </button>
                </div>
              ) : null}
              <ReminderSwitch deviceId={stats.deviceId} />
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
          onHop={(correct, correctCount) => {
            const combo = correct ? h2hRun.combo + 1 : h2hRun.combo;
            setH2hRun({ score: correctCount, combo: correct ? combo : 0 });
            setH2hFlight((current) => current + (correct ? 1 : 1 / 3));
            setHop((current) => ({
              id: current.id + 1,
              kind: correct ? "voyage" : "stumble",
              travel: correct ? 1 : 0.33,
              gain: correct ? { label: "Correct", points: 1, level: 3, unit: "pick" } : undefined,
              combo,
            }));
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
          onPacks={() => setPhase({ name: "packs" })}
        />
      ) : null}
      {phase.name === "packs" ? <PacksScreen packs={packs} status={plus} onPack={(id) => setPhase({ name: "journey", id })} onPlus={() => setPhase({ name: "plus" })} onHome={goHome} /> : null}
      {phase.name === "journey" ? (
        <JourneyScreen
          key={phase.id}
          deviceId={stats.deviceId}
          packId={phase.id}
          onChapter={(chapter) => openRound({ kind: "pack", id: phase.id, chapter })}
          onBack={() => setPhase({ name: "packs" })}
        />
      ) : null}
      {phase.name === "archive" ? (
        <ArchiveScreen deviceId={stats.deviceId} onDay={(date) => openRound({ kind: "archive", date })} onPlus={() => setPhase({ name: "plus" })} onHome={goHome} />
      ) : null}
      {phase.name === "unlimited" ? (
        <UnlimitedScreen deviceId={stats.deviceId} onRound={(id) => openRound({ kind: "unlimited", id })} onPlus={() => setPhase({ name: "plus" })} onHome={goHome} />
      ) : null}
      {phase.name === "round" ? (
        <RoundRun
          key={roundKey(phase.round)}
          deviceId={stats.deviceId}
          round={phase.round}
          onHome={() => {
            goHome();
            void refreshPlus();
          }}
          onBack={() => leaveRound(phase.round)}
          backLabel={phase.round.kind === "pack" ? "Back to the route" : phase.round.kind === "archive" ? "Back to the archive" : "Back to Unlimited"}
          onAgain={phase.round.kind === "unlimited" ? () => void anotherRound() : undefined}
          onFlight={(progress, score, combo, trail, size) => {
            setRoundFlight(progress);
            setRoundRun({ score, combo });
            setRoundTrail(trail);
            setRoundSize(size);
          }}
          onHop={(points, label, answer) => {
            const travel = classicStep(points, NAME_CAP, roundSize);
            const combo = points > 0 ? roundRun.combo + 1 : roundRun.combo;
            setRoundRun({ score: roundRun.score + points, combo: points > 0 ? combo : 0 });
            setRoundFlight((current) => current + travel);
            if (travel > 0) setRoundTrail((current) => [...current, { from: roundFlight, to: roundFlight + travel, tier: tierOf(points, NAME_CAP) }]);
            setHop((current) => ({
              id: current.id + 1,
              kind: points > 0 ? "voyage" : "stumble",
              travel,
              gain: label ? { label, points, level: gainLevel(points, NAME_CAP) } : undefined,
              combo,
              answer,
            }));
          }}
          onEnd={() => setPhase((current) => (current.name === "round" ? { ...current, done: true } : current))}
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

const NO_TRAIL: TrailSegment[] = [];

/** Ghost rockets fly only in Classic and Head-to-head. */
function withGhosts(phase: Phase): boolean {
  return phase.name === "ask" || phase.name === "reveal" || phase.name === "end" || phase.name === "h2h";
}

function flightFor(puzzle: PuzzleResponse): number {
  return puzzle.questions.reduce((sum, question) => (question.reveal ? sum + stageStep(question.type, question.reveal, CLASSIC_QUESTIONS) : sum), 0);
}

/** Each answered question's points in order, with null for the ones still to play. */
function pointsOf(puzzle: PuzzleResponse): Array<number | null> {
  return puzzle.questions.map((question) => question.reveal?.points ?? null);
}

function classicScore(puzzle: PuzzleResponse): number {
  return puzzle.questions.reduce((sum, question) => sum + (question.reveal?.points ?? 0), 0);
}

function ghostsFor(best: number, field: FieldStats | undefined, race: Race | null): Ghost[] {
  const ghosts: Ghost[] = [];
  if (race) ghosts.push({ id: "friend", label: "Your friend", progress: race.progress, paint: skinById(race.skin) ?? undefined });
  if (best > 0) ghosts.push({ id: "best", label: "Your best", progress: best });
  if (field && field.players > 0 && field.averageProgress !== null) ghosts.push({ id: "average", label: "Today’s average", progress: field.averageProgress });
  if (field && field.players > 1 && field.bestProgress !== null) ghosts.push({ id: "top", label: "Today’s best", progress: field.bestProgress });
  return ghosts;
}

/** "A", "A and B", "A, B and C". */
function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
