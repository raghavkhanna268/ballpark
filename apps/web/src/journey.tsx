import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  CLIMBER_X,
  FAR_H,
  FAR_RATE,
  FRONT_H,
  FRONT_RATE,
  SIDE,
  SPACE_STOP,
  STEP,
  WORLD_H,
  WORLD_STOPS,
  WORLD_W,
  WorldFar,
  WorldFront,
  WorldMain,
  climberY,
  stopAt,
} from "./worlds";
import { useCountUp, type Rung } from "./game";
import "./journey.css";

/** One answer's flight. */
export type Hop = {
  id: number;
  kind: "idle" | "voyage" | "stumble";
  travel: number;
  /** What a scoring answer earned: the pop-up's label and points, and a level from 1 to 5 that sizes the flame and the glow. */
  gain?: { label: string; points: number; level: number; unit?: string };
  /** Right answers in a row after this one, or the run that a miss just broke. Cosmetic: it never changes the score. */
  combo?: number;
  /** What the player typed. It rises through the sky as a tag while the climb plays. Empty when the clock ran out. */
  answer?: string;
  /** The tier lines to draw across the sky for this climb, lowest first. */
  ladder?: Rung[];
};
/** The score in the heads-up display. It counts up after each answer, like an arcade score. */
export type HudScore = { value: number; label: string; digits: number };
export type Ghost = { id: "best" | "average" | "top" | "friend"; label: string; progress: number };

/** "your best" or "your friend and your best", for the HUD once every ghost is behind you. */
function passedLine(ghosts: Ghost[]): string {
  return ghosts.map((ghost) => ghost.label.charAt(0).toLowerCase() + ghost.label.slice(1)).join(" and ");
}
type Motion = "idle" | "voyage" | "stumble" | "replay";

/**
 * What the screens inside the card can reach: a slot in the heads-up display for the stage strip, whether a climb is
 * still playing (so a result waits for it), and a switch that clears the card away so the climb has the whole screen.
 */
type JourneyContextValue = { hudSlot: HTMLElement | null; holding: boolean; setFocus: (on: boolean) => void };
const JourneyContext = createContext<JourneyContextValue>({ hudSlot: null, holding: false, setFocus: () => {} });

export function useJourney(): JourneyContextValue {
  return useContext(JourneyContext);
}

/**
 * Clears the card off the scene while the calling screen is shown. The climb plays on the whole screen, and the
 * screen's own content appears over the scene once the climb lands. A result screen calls this.
 */
export function useFocusMode() {
  const { setFocus } = useContext(JourneyContext);
  useLayoutEffect(() => {
    setFocus(true);
    return () => setFocus(false);
  }, [setFocus]);
}

const SOUND_KEY = "ballpark.sound";
const STOPS = WORLD_STOPS.length;
/**
 * The scene fills the screen and the card sits over its top. The climber rests this far down the open sky
 * under the card, so you can see where you are heading.
 */
const ANCHOR = 0.55;
/** The open sky under the card never gets smaller than this, so the climber always has room. */
const MIN_WINDOW = 180;
/** With the card cleared away, the climber starts low on the screen so the tier lines above are in view. */
const FOCUS_ANCHOR = 0.78;
/** The heads-up strip at the top. With the card cleared away, the open sky starts under it. */
const HUD_H = 46;
/** The answer tag floats this far above the climber, in pixels. The tier lines are drawn at the tag's height. */
const TAG_LIFT = 62;
const VOYAGE_MS = 2300;
/** With the card cleared away, the climb plays for about 2 seconds for the commonest answer up to 3 for the rarest. */
const RISE_MIN_MS = 1500;
const RISE_MAX_MS = 3000;
const STUMBLE_MS = 1700;
const REPLAY_MS = 3600;
const ROUTE_POINTS = 1600;
const TRAIL_OFFSET = 34;

type Pose = { v: number; cam: number; dx: number; dy: number; rot: number; sx: number; sy: number };
type Toast = { id: number; title: string; detail: string; tone: "world" | "pass" | "tier" | "space" | "miss"; level?: number };

const REST: Omit<Pose, "v" | "cam"> = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };

export function Journey({
  progress,
  hop,
  overview,
  page,
  ghosts = [],
  score = null,
  combo = 0,
  children,
}: {
  /** 0 is the launch pad. Each correct answer climbs 1. A miss climbs about a third. */
  progress: number;
  hop: Hop;
  overview: boolean;
  /** Changes whenever the card below the scene shows a new screen, so it starts scrolled to the top. */
  page: string;
  /** Faint climbers for your best run, today's average and best players, and a friend you are racing. */
  ghosts?: Ghost[];
  /** The run's score, shown top right while a run is on screen. */
  score?: HudScore | null;
  /** Right answers in a row. Shown as a combo meter from two up. */
  combo?: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<SVGSVGElement>(null);
  const mainRef = useRef<SVGSVGElement>(null);
  const frontRef = useRef<SVGSVGElement>(null);
  const explorerRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<SVGPolylineElement>(null);
  const markerRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const route = useRef<Array<[number, number]>>([]);
  const tagRef = useRef<HTMLDivElement>(null);
  const rungRefs = useRef<Array<HTMLDivElement | null>>([]);
  const measureRef = useRef<() => void>(() => {});
  /** Scene size, world scale, and `top`: where the card over the scene ends, in pixels from the top. */
  const size = useRef({ w: 390, h: 520, k: 1, top: 0 });
  const motionRef = useRef<Motion>("idle");
  const pose = useRef<Pose>({ v: progress, cam: progress, ...REST });
  const hopRef = useRef(hop.id);
  hopRef.current = hop.id;
  const landedRef = useRef(-1);
  const ghostsRef = useRef(ghosts);
  const [k, setK] = useState(1);
  const [motion, setMotion] = useState<Motion>("idle");
  const [landed, setLanded] = useState(() => stopAt(progress));
  const [arrived, setArrived] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fly, setFly] = useState<{ id: number; text: string } | null>(null);
  const [sound, setSound] = useState(() => readSound());
  const [focus, setFocus] = useState(false);
  const [hudSlot, setHudSlot] = useState<HTMLDivElement | null>(null);
  /** The last answer whose climb has finished. Until the current one lands, a result waits off screen. */
  const [settledHop, setSettledHop] = useState(hop.id);
  const focusRef = useRef(focus);
  /** Where the current climb started, so the tier lines stay put in the sky while the camera follows the tag. */
  const ladderFrom = useRef({ id: hop.id, v: progress });

  ghostsRef.current = ghosts;
  motionRef.current = motion;
  focusRef.current = focus;
  if (ladderFrom.current.id !== hop.id) ladderFrom.current = { id: hop.id, v: pose.current.v };

  useEffect(() => {
    const stage = stageRef.current;
    const scene = sceneRef.current;
    const sheet = sheetRef.current;
    if (!stage || !scene || !sheet) return;
    let settle = 0;
    const measure = () => {
      const w = scene.clientWidth || 390;
      const h = scene.clientHeight || 520;
      // Fit the drawn column to the width on a phone. On a wide screen, fit to height and show more sky.
      const nextK = Math.max(0.5, Math.min((stage.clientHeight * 0.8) / 700, w / 400));
      const card = sheet.getBoundingClientRect();
      // With the card cleared away the open sky starts right under the heads-up strip.
      const top = focusRef.current ? HUD_H : Math.max(0, Math.min(h - MIN_WINDOW, Math.round(card.bottom - stage.getBoundingClientRect().top)));
      const moved = Math.abs(top - size.current.top) > 1;
      size.current = { w, h, k: nextK, top };
      stage.style.setProperty("--sheet-bottom", `${top}px`);
      setK(nextK);
      // A new card height moves the open sky. Glide the world there instead of jumping, unless a flight is drawing it.
      if (moved && motionRef.current === "idle") {
        stage.classList.add("settling");
        window.clearTimeout(settle);
        settle = window.setTimeout(() => stage.classList.remove("settling"), 450);
      }
      draw();
    };
    measureRef.current = measure;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(scene);
    observer.observe(sheet);
    return () => {
      observer.disconnect();
      window.clearTimeout(settle);
    };
  }, []);

  useLayoutEffect(() => {
    measureRef.current();
  }, [focus]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!fly) return;
    const id = window.setTimeout(() => setFly(null), 1500);
    return () => window.clearTimeout(id);
  }, [fly]);

  /** Where the climber rests on screen: ANCHOR of the way down the open sky under the card. */
  function anchorPx(): number {
    const { h, top } = size.current;
    return focusRef.current ? h * FOCUS_ANCHOR : top + (h - top) * ANCHOR;
  }

  /** World y at the top of the scene, so the camera's stop sits at the anchor. */
  function cameraTop(cam: number): number {
    return climberY(cam) - anchorPx() / size.current.k;
  }

  /** Puts every layer and the climber where the current pose says. Runs every frame while flying. */
  function draw() {
    const { w, k: scale } = size.current;
    const p = pose.current;
    const top = cameraTop(p.cam);
    const left = w / 2 - (WORLD_W / 2 + SIDE) * scale;
    if (farRef.current) farRef.current.style.transform = `translate3d(${left}px, ${-top * FAR_RATE * scale - 700 * scale}px, 0)`;
    if (mainRef.current) mainRef.current.style.transform = `translate3d(${left}px, ${-top * scale}px, 0)`;
    if (frontRef.current) frontRef.current.style.transform = `translate3d(${left}px, ${-top * FRONT_RATE * scale - 700 * scale}px, 0)`;
    const ex = w / 2 + p.dx * scale;
    const ey = (climberY(p.v) + p.dy - top) * scale;
    const explorer = explorerRef.current;
    // With the card cleared away the answer is the star, so the climber rides along a little smaller.
    const small = focusRef.current ? 0.8 : 1;
    if (explorer) {
      explorer.style.transform = `translate3d(${ex}px, ${ey}px, 0) translate(-50%, -50%) rotate(${p.rot}deg) scale(${p.sx * small}, ${p.sy * small})`;
      explorer.classList.toggle("suited", p.v >= SPACE_STOP - 0.5);
    }
    const tag = tagRef.current;
    if (tag) tag.style.transform = `translate3d(${ex}px, ${ey - TAG_LIFT}px, 0) translate(-50%, -50%) rotate(${p.rot * 0.5}deg)`;
    // Each tier line sits where an answer in that tier would carry the tag. It lights up once the tag passes it.
    const from = ladderFrom.current.v;
    rungRefs.current.forEach((rung, index) => {
      const step = hop.ladder?.[index];
      if (!rung || !step) return;
      const y = (climberY(from + step.travel) - top) * scale - TAG_LIFT;
      rung.style.transform = `translate3d(0, ${y}px, 0)`;
      rung.classList.toggle("passed", p.v >= from + step.travel - 0.002);
    });
    const share = Math.max(0, Math.min(1, p.v / (STOPS - 1)));
    if (markerRef.current) markerRef.current.style.bottom = `${share * 100}%`;
    if (fillRef.current) fillRef.current.style.height = `${share * 100}%`;
    const stop = stopAt(p.v);
    if (stop !== landedRef.current) {
      landedRef.current = stop;
      const info = WORLD_STOPS[stop]!;
      if (labelRef.current) labelRef.current.textContent = info.label;
      if (altRef.current) altRef.current.textContent = `ALT ${info.altitude}`;
    }
  }

  function pushRoute() {
    const p = pose.current;
    const point: [number, number] = [CLIMBER_X + p.dx, climberY(p.v) + p.dy + TRAIL_OFFSET];
    const last = route.current[route.current.length - 1];
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 3) return;
    route.current.push(point);
    if (route.current.length > ROUTE_POINTS) route.current.shift();
    routeRef.current?.setAttribute("points", route.current.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "));
  }

  function resetRoute(to: number) {
    route.current = [[CLIMBER_X, climberY(0) + TRAIL_OFFSET]];
    if (to > 0) route.current.push([CLIMBER_X, climberY(to) + TRAIL_OFFSET]);
    routeRef.current?.setAttribute("points", route.current.map(([x, y]) => `${x},${y}`).join(" "));
  }

  /** What changed by climbing from `from` to `to`: space, a rival overtaken, or a new height. */
  function announce(from: number, to: number) {
    if (from < SPACE_STOP - 0.5 && to >= SPACE_STOP - 0.5) {
      setToast({ id: Date.now(), title: "You’re in space", detail: "100 km up · astronaut suit on", tone: "space" });
      return;
    }
    const passed = ghostsRef.current.filter((ghost) => from < ghost.progress && to >= ghost.progress).sort((a, b) => b.progress - a.progress)[0];
    if (passed) {
      setToast({ id: Date.now(), title: `Passed ${passed.label.toLowerCase()}`, detail: `at ${formatAltitude(passed.progress)}`, tone: "pass" });
      return;
    }
    const before = stopAt(from);
    const after = stopAt(to);
    // With the card cleared away, the heads-up display already names the new place as the climb reaches it.
    if (after > before && !focusRef.current) {
      const info = WORLD_STOPS[after]!;
      setToast({ id: Date.now(), title: info.label, detail: `Altitude ${info.altitude}`, tone: "world" });
    }
  }

  /** `rise`: the card has cleared away, so the climber rises steadily under the answer tag instead of flipping. */
  function run(kind: Motion, from: number, to: number, duration: number, rise = false) {
    const start = performance.now();
    const d = to - from;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      pose.current =
        kind === "stumble"
          ? stumblePose(t, from, d)
          : kind === "replay"
            ? replayPose(t, from, d)
            : rise
              ? risePose(t, from, d)
              : voyagePose(t, from, d);
      keepInFrame();
      draw();
      pushRoute();
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        pose.current = { v: to, cam: to, ...REST };
        draw();
        pushRoute();
        setMotion("idle");
        setLanded(stopAt(to));
        setArrived((value) => value + 1);
        setSettledHop(hopRef.current);
        if (kind !== "replay") announce(from, to);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }

  /** The camera lags so the climber visibly rises up the screen, but it never leaves the frame. */
  function keepInFrame() {
    const { h, k: scale, top } = size.current;
    const p = pose.current;
    const anchor = anchorPx();
    const maxAbove = (anchor - top - 70) / scale;
    const maxBelow = (h - anchor - 60) / scale;
    const lead = (p.v - p.cam) * STEP - p.dy;
    if (lead > maxAbove) p.cam = p.v - (maxAbove + p.dy) / STEP;
    if (-lead > maxBelow) p.cam = p.v + (maxBelow - p.dy) / STEP;
  }

  useEffect(() => {
    const from = pose.current.v;
    const to = progress;
    if (overview) return;
    if (reduced || Math.abs(to - from) < 0.001 || Math.abs(to - from) > 2.2 || to < from) {
      pose.current = { v: to, cam: to, ...REST };
      resetRoute(to);
      draw();
      setLanded(stopAt(to));
      setSettledHop(hop.id);
      return;
    }
    const kind = hop.kind === "stumble" ? "stumble" : "voyage";
    setMotion(kind);
    const streak = hop.combo ?? 0;
    if (sound) playHop(kind);
    // A climb with tier lines is one the card clears away for: the lines and the result over the scene tell the story,
    // so there are no pop-ups. The result screen turns focus on in the same commit, after this render, so the hop
    // itself says which kind of climb this is.
    if (hop.ladder) return run(kind, from, to, flightMs(kind, to - from, true), true);
    if (hop.gain && kind === "voyage") {
      const { label, points, level, unit = "pts" } = hop.gain;
      setToast({ id: Date.now(), title: label, detail: `+${points} ${unit}${streak >= 2 ? ` · combo x${streak}` : ""}`, tone: "tier", level });
      if (score && points > 0) setFly({ id: hop.id, text: `+${points}` });
    }
    if (kind === "stumble") setToast({ id: Date.now(), title: "Miss", detail: streak >= 2 ? `combo x${streak} lost` : "+0 · still climbing", tone: "miss" });
    return run(kind, from, to, flightMs(kind, to - from, false));
  }, [progress, hop.id]);

  /** The end screen replays the whole climb from the launch pad to where the run landed. */
  useEffect(() => {
    if (!overview) return;
    const to = progress;
    if (reduced || to < 0.5) {
      pose.current = { v: to, cam: to, ...REST };
      draw();
      setLanded(stopAt(to));
      return;
    }
    setMotion("replay");
    pose.current = { v: 0, cam: 0, ...REST };
    resetRoute(0);
    draw();
    return run("replay", 0, to, Math.min(REPLAY_MS, 900 + to * 420));
  }, [overview]);

  useLayoutEffect(() => {
    draw();
  });

  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, [page]);

  /** A new answer whose climb has not started or not finished yet. Its result waits until the climb lands. */
  const pending = settledHop !== hop.id;
  const flying = motion !== "idle" || pending;
  const holding = focus && pending;
  const stageClass = ["stage", `is-${motion}`, reduced ? "quiet" : "", overview ? "is-overview" : "", focus ? "is-focus" : ""].join(" ");
  const earned = hop.gain?.points ?? 0;
  const info = WORLD_STOPS[landed]!;
  /** The nearest climber above you: who to beat next. */
  const rival = flying ? null : ghosts.filter((ghost) => ghost.progress > progress + 0.01).sort((a, b) => a.progress - b.progress)[0];
  // "Above everyone" only when the crowd ghosts are in play. Under 20 players only your best and a friend fly.
  const crowdGhost = ghosts.some((ghost) => ghost.id === "average" || ghost.id === "top");
  /** Liftoff 1 … Supernova 5: the flame grows with the rarity of the answer. */
  const boost = motion === "voyage" && hop.gain ? `boost-${hop.gain.level}` : "";
  const columns = WORLD_W + SIDE * 2;

  return (
    <div className={stageClass} ref={stageRef}>
      <div className="scene" ref={sceneRef}>
        <svg ref={farRef} className="layer" style={{ width: columns * k, height: FAR_H * k }} viewBox={`${-SIDE} 0 ${columns} ${FAR_H}`} aria-hidden="true">
          <WorldFar />
        </svg>
        <svg ref={mainRef} className="layer" style={{ width: columns * k, height: WORLD_H * k }} viewBox={`${-SIDE} 0 ${columns} ${WORLD_H}`} aria-hidden="true">
          <WorldMain />
          {ghosts.map((ghost, index) => (
            <GhostClimber key={ghost.id} ghost={ghost} lane={index} />
          ))}
          <polyline ref={routeRef} className={`route-trace ${motion}`} points="" />
        </svg>
        <div className={`explorer ${motion} ${boost}`} ref={explorerRef} aria-hidden="true">
          <Climber />
          {motion === "stumble" ? <Smoke /> : null}
        </div>
        <svg ref={frontRef} className="layer front" style={{ width: columns * k, height: FRONT_H * k }} viewBox={`${-SIDE} 0 ${columns} ${FRONT_H}`} aria-hidden="true">
          <WorldFront />
        </svg>
        {focus && hop.ladder ? (
          <div className={holding ? "ladder on" : "ladder"} aria-hidden="true">
            {hop.ladder.map((rung, index) => (
              <div
                key={rung.label}
                className={`rung band-${rung.band}${rung.points === earned ? " earned" : ""}`}
                ref={(element) => {
                  rungRefs.current[index] = element;
                }}
              >
                <span>
                  {rung.label} · {rung.points}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {focus && hop.answer !== undefined ? (
          <div className={`answer-tag ${hop.kind}${holding ? " on" : ""}`} ref={tagRef} aria-hidden="true">
            {hop.answer ? `“${hop.answer}”` : "Out of time"}
          </div>
        ) : null}
        <div className="speedlines" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <i key={index} style={{ left: `${10 + index * 11}%`, animationDelay: `${(index * 73) % 400}ms` }} />
          ))}
        </div>
        {motion === "stumble" ? <div className="miss-flash" key={`miss-${hop.id}`} /> : null}
        {toast ? (
          <div className={`toast ${toast.tone} ${toast.level ? `level-${toast.level}` : ""}`} key={toast.id} role="status">
            <strong>{toast.title}</strong>
            <span>{toast.detail}</span>
          </div>
        ) : null}
        {fly && !reduced ? (
          <div className="fly" key={`fly-${fly.id}`} aria-hidden="true">
            {fly.text}
          </div>
        ) : null}
        <div className="hud">
          <div className="hud-side">
            <p className="where" key={`where-${arrived}`}>
              <span className="power" ref={altRef}>
                ALT {info.altitude}
              </span>
              <span className="place" ref={labelRef}>
                {info.label}
              </span>
            </p>
          </div>
          <div className="hud-mid" ref={setHudSlot} />
          <div className="hud-side end">{score ? <ScoreBox score={score} hold={pending} /> : null}</div>
        </div>
        {/* Under the card, at the top of the open sky: the combo meter and who to beat next. */}
        <div className="sky-tags">
          <div>
            {combo >= 2 ? (
              <p className="combo" key={`combo-${combo}`}>
                Combo <b>x{combo}</b>
              </p>
            ) : null}
          </div>
          <div>
            {ghosts.length > 0 && !flying ? (
              <p className={rival ? "rival" : "rival done"}>
                <small>{rival ? "Next to beat" : crowdGhost ? "Above everyone" : "Passed"}</small>
                <span>
                  {rival ? rival.label : crowdGhost ? "you’re out in front" : passedLine(ghosts)}
                  {rival ? <em> {formatAltitude(rival.progress)}</em> : null}
                </span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="altimeter" aria-hidden="true">
          <span className="alt-end">top</span>
          <div className="alt-line">
            <b ref={fillRef} />
            {WORLD_STOPS.map((stop, index) => (
              <i
                key={stop.id}
                className={[index <= landed ? "passed" : "", index === SPACE_STOP ? "space" : ""].join(" ")}
                style={{ bottom: `${(index / (STOPS - 1)) * 100}%` }}
              />
            ))}
            {ghosts.map((ghost) => (
              <u key={ghost.id} className={`ghost-tick ${ghost.id}`} style={{ bottom: `${(Math.min(STOPS - 1, ghost.progress) / (STOPS - 1)) * 100}%` }} />
            ))}
            <em ref={markerRef} />
          </div>
          <span className="alt-end">0 m</span>
        </div>
        <button
          className="sound-toggle"
          type="button"
          aria-pressed={sound}
          onClick={() => {
            const next = !sound;
            setSound(next);
            writeSound(next);
            if (next) playHop("voyage");
          }}
        >
          {sound ? "Sound on" : "Sound off"}
        </button>
      </div>
      <div className={holding ? "sheet holding" : "sheet"} ref={sheetRef}>
        <JourneyContext.Provider value={{ hudSlot, holding, setFocus }}>{children}</JourneyContext.Provider>
      </div>
    </div>
  );
}

/** The run's score, top right. It holds still while a climb plays, then counts up as the climb lands. */
function ScoreBox({ score, hold }: { score: HudScore; hold: boolean }) {
  const settled = useRef(score.value);
  if (!hold) settled.current = score.value;
  const shown = useCountUp(hold ? settled.current : score.value, { delay: 120, duration: 600 });
  return (
    <p className={shown < score.value ? "scorebox counting" : "scorebox"}>
      <small>{score.label}</small>
      <strong>{String(shown).padStart(score.digits, "0")}</strong>
    </p>
  );
}

/** The altitude of the stop a fractional progress value rounds to. */
export function formatAltitude(progress: number): string {
  return WORLD_STOPS[stopAt(progress)]!.altitude;
}

/** A faint outline of another climber, parked at the height they reached. */
function GhostClimber({ ghost, lane }: { ghost: Ghost; lane: number }) {
  const x = [70, WORLD_W - 70, WORLD_W - 130, 130][lane % 4]!;
  const y = climberY(ghost.progress) + (lane >= 2 ? -40 : 0);
  return (
    <g className={`ghost ${ghost.id}`} transform={`translate(${x} ${y})`}>
      <circle cy="-18" r="8" fill="none" strokeWidth="1.4" />
      <rect x="-7" y="-10" width="14" height="20" rx="5" fill="none" strokeWidth="1.4" />
      <path d="M-4 10 v10 M4 10 v10" fill="none" strokeWidth="1.4" />
      <text x="0" y="38" textAnchor="middle" fontSize="11" className="mono">
        {ghost.label}
      </text>
    </g>
  );
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Right answer: crouch, blast off, a full flip at the top of the climb, then settle a whole stop higher. */
function voyagePose(t: number, from: number, d: number): Pose {
  if (t < 0.12) {
    const c = Math.sin((t / 0.12) * Math.PI);
    return { v: from, cam: from, dx: 0, dy: 12 * c, rot: 0, sx: 1 + 0.12 * c, sy: 1 - 0.15 * c };
  }
  const u = clamp01((t - 0.12) / 0.7);
  const e = ease(u);
  const flip = ease(clamp01((u - 0.3) / 0.45));
  const stretch = Math.sin(Math.min(1, u * 4) * Math.PI) * 0.2;
  const land = t > 0.82 ? Math.sin(((t - 0.82) / 0.18) * Math.PI) : 0;
  return {
    v: from + d * e,
    cam: from + d * ease(clamp01((t - 0.24) / 0.76)),
    dx: Math.sin(u * Math.PI) * 46,
    dy: land * 8,
    rot: -360 * flip + 10 * Math.sin(u * Math.PI),
    sx: 1 - stretch * 0.4,
    sy: 1 + stretch,
  };
}

/** How long one answer's climb plays. With the card cleared away, a rarer answer climbs for longer, like a deeper dive. */
function flightMs(kind: "voyage" | "stumble", distance: number, focus: boolean): number {
  if (kind === "stumble") return STUMBLE_MS;
  if (!focus) return VOYAGE_MS;
  return Math.round(RISE_MIN_MS + (RISE_MAX_MS - RISE_MIN_MS) * clamp01(distance / 1.45));
}

/** Card cleared away: a short crouch, then a steady rise with a gentle sway. No flips. The camera follows a beat later. */
function risePose(t: number, from: number, d: number): Pose {
  if (t < 0.08) {
    const c = Math.sin((t / 0.08) * Math.PI);
    return { v: from, cam: from, dx: 0, dy: 8 * c, rot: 0, sx: 1 + 0.08 * c, sy: 1 - 0.1 * c };
  }
  const u = clamp01((t - 0.08) / 0.92);
  const e = 1 - (1 - u) ** 3;
  return {
    v: from + d * e,
    cam: from + d * ease(clamp01((t - 0.18) / 0.82)),
    dx: Math.sin(u * Math.PI * 2) * 10 * (1 - u),
    dy: 0,
    rot: Math.sin(u * Math.PI * 3) * 5 * (1 - u),
    sx: 1,
    sy: 1,
  };
}

/** Wrong answer: the jetpack sputters, the climber drops and tumbles, then manages a short climb. */
function stumblePose(t: number, from: number, d: number): Pose {
  if (t < 0.38) {
    const s = t / 0.38;
    return { v: from, cam: from, dx: Math.sin(t * 110) * 5, dy: 46 * ease(s), rot: Math.sin(t * 70) * 24 + 20 * s, sx: 1, sy: 1 };
  }
  if (t < 0.82) {
    const u = (t - 0.38) / 0.44;
    const e = 1 - (1 - u) ** 2;
    return {
      v: from + d * e,
      cam: from + d * ease(clamp01((t - 0.3) / 0.7)),
      dx: 6 * Math.sin(u * 14),
      dy: 46 * (1 - e),
      rot: 20 * (1 - u) + 8 * Math.sin(u * 18),
      sx: 1,
      sy: 1,
    };
  }
  const l = (t - 0.82) / 0.18;
  return { v: from + d, cam: from + d * ease(clamp01((t - 0.3) / 0.7)), dx: 0, dy: 4 * Math.sin(l * Math.PI), rot: 6 * Math.sin(l * Math.PI * 2), sx: 1, sy: 1 };
}

/** End screen: climb the whole way again with the camera alongside. */
function replayPose(t: number, from: number, d: number): Pose {
  const e = ease(t);
  return { v: from + d * e, cam: from + d * ease(clamp01(t * 1.05 - 0.02)), dx: Math.sin(t * Math.PI * 3) * 14, dy: 0, rot: 0, sx: 1, sy: 1 };
}

/** The climber: a jetpack pilot on the way up, an astronaut once past the edge of space. */
function Climber() {
  return (
    <svg viewBox="-40 -46 80 100" width="72" height="90" className="climber" aria-hidden="true">
      <g className="flame">
        <path d="M-13 30 q5 12 0 30 q-5 -18 0 -30 Z" />
        <path d="M13 30 q5 12 0 30 q-5 -18 0 -30 Z" />
      </g>
      <rect className="pack" x="-19" y="-8" width="11" height="34" rx="5" />
      <rect className="pack" x="8" y="-8" width="11" height="34" rx="5" />
      <path className="pack" d="M-17 26 h7 l1.5 5 h-10 Z M10 26 h7 l1.5 5 h-10 Z" />
      <path className="limb" d="M-6 20 l-4 20 M6 20 l4 20" />
      <path className="limb" d="M-10 -4 q-13 4 -16 18 M10 -4 q13 4 16 18" />
      <rect className="suit" x="-10" y="-12" width="20" height="34" rx="7" />
      <rect className="panel" x="-5" y="-3" width="10" height="7" rx="1.5" />
      <g className="head-pilot">
        <circle className="suit" cy="-23" r="9" />
        <path className="cap" d="M-9 -25 a9 9 0 0 1 18 0 Z" />
        <circle className="goggle" cx="-4" cy="-22" r="3" />
        <circle className="goggle" cx="4" cy="-22" r="3" />
      </g>
      <g className="head-astro">
        <circle className="suit" cy="-24" r="13" />
        <path className="visor" d="M-9 -27 a9 6 0 0 1 18 0 v4 a9 5 0 0 1 -18 0 Z" />
        <circle className="glint" cx="-5" cy="-28" r="1.6" />
      </g>
    </svg>
  );
}

function Smoke() {
  return (
    <div className="smoke">
      {Array.from({ length: 6 }, (_, index) => (
        <i key={index} style={{ animationDelay: `${index * 110}ms` }} />
      ))}
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

function writeSound(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Sound stays on for this visit only.
  }
}

function playHop(kind: "voyage" | "stumble") {
  const context = new AudioContext();
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = kind === "voyage" ? "triangle" : "sawtooth";
  osc.frequency.value = kind === "voyage" ? 440 : 140;
  gain.gain.value = 0.035;
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  if (kind === "voyage") osc.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.25);
  else osc.frequency.exponentialRampToValueAtTime(70, context.currentTime + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
  osc.stop(context.currentTime + 0.4);
  window.setTimeout(() => void context.close(), 700);
}
