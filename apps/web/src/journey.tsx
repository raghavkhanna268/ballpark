import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MILESTONES, altitudeKm, formatAltitude, formatDistance, nextMilestone } from "@ballpark/shared";
import { useCountUp } from "./game";
import { CLASSIC_PAINT, IGNITION_MS, climbMs, createSky, replayMs, tierColor, type RocketPaint, type Scenery, type Sky, type SkyGhost, type SkyTrail } from "./sky";
import { playBurner, playChime, playSparkle, playSputter, readSound, setSound, unlockAudio } from "./sound";
import "./journey.css";

/** One answer's climb. */
export type Hop = {
  id: number;
  kind: "idle" | "voyage" | "stumble";
  travel: number;
  /** What a scoring answer earned: its tier label and points, and a level from 1 (Liftoff) to 5 (Supernova) that sets the burner. */
  gain?: { label: string; points: number; level: number; unit?: string };
  /** Right answers in a row after this one. Cosmetic: it never changes the score. */
  combo?: number;
  /** What the player typed. It rides above the rocket while the climb plays. Empty when the clock ran out. */
  answer?: string;
  /** Today's Afterburner was on: double the climb, with a hotter flame. */
  boost?: boolean;
};
/** The score in the heads-up display. It counts up after each answer, like an arcade score. */
export type HudScore = { value: number; label: string; digits: number };
export type Ghost = { id: "best" | "average" | "top" | "friend"; label: string; progress: number; paint?: RocketPaint };
/** One answer's stretch of the climb, coloured by its tier (0 Liftoff to 4 Supernova, -1 a miss). */
export type TrailSegment = SkyTrail;

/** "your best" or "your friend and your best", for the HUD once every ghost is behind you. */
function passedLine(ghosts: Ghost[]): string {
  return ghosts.map((ghost) => ghost.label.charAt(0).toLowerCase() + ghost.label.slice(1)).join(" and ");
}
type Motion = "idle" | "climb" | "replay";
type Toast = { id: number; born: number; title: string; detail: string };

/**
 * What the screens inside the card can reach: a slot in the heads-up display for the stage strip, a slot at the
 * bottom of the screen for the answer bar, whether a climb is still playing (so a result waits for it), and a switch
 * that clears the card away so the climb has the whole screen.
 */
type JourneyContextValue = {
  hudSlot: HTMLElement | null;
  dockSlot: HTMLElement | null;
  holding: boolean;
  setFocus: (on: boolean) => void;
  setFloat: (on: boolean) => void;
};
const JourneyContext = createContext<JourneyContextValue>({ hudSlot: null, dockSlot: null, holding: false, setFocus: () => {}, setFloat: () => {} });

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

/**
 * Like a Krillion dive's last screen: no card and no heads-up display. The screen's content floats over the dimmed
 * scene and scrolls on its own, with room at the bottom for a bar in the dock slot. The end screens call this.
 */
export function useFloatMode() {
  const { setFloat } = useContext(JourneyContext);
  useLayoutEffect(() => {
    setFloat(true);
    return () => setFloat(false);
  }, [setFloat]);
}

/** At this width and up, the card sits on the left and the rocket climbs on the right. */
const WIDE_MIN = 900;
/** Where the rocket rests, as a share of the screen height from the top. */
const ANCHOR = 0.84;
/** On an end screen the rocket rests this low, mostly behind the bottom bar, so it never sits behind the text. */
const FLOAT_ANCHOR = 0.985;
/** The rocket never rests lower than this, even under a tall card. */
const ANCHOR_MAX = 0.92;
/** The rocket's nose and a little air need this much room under the card, in pixels. */
const ROCKET_ROOM = 76;
/** The heads-up strip at the top. With the card cleared away, the open sky starts under it. */
const HUD_H = 46;
const TOAST_MS = 2600;
const GHOST_COLORS: Record<Ghost["id"], string> = {
  best: "rgba(232,241,255,0.8)",
  average: "#8fd3ff",
  top: "#ffb347",
  friend: "#ff9ad5",
};
const TOP = MILESTONES[MILESTONES.length - 1].at;

export function Journey({
  progress,
  hop,
  overview,
  page,
  scenery,
  trail = [],
  ghosts = [],
  score = null,
  combo = 0,
  paint = CLASSIC_PAINT,
  children,
}: {
  /** 0 is the launch pad and 10 the centre of the Milky Way. Height follows points. */
  progress: number;
  hop: Hop;
  /** The end screen: the whole climb replays from the launch pad. */
  overview: boolean;
  /** Changes whenever the card shows a new screen, so it starts scrolled to the top. */
  page: string;
  /** Today's scenery. */
  scenery: Scenery;
  /** The climb so far, one stretch per answer. Drawn as a coloured trail under the rocket. */
  trail?: TrailSegment[];
  /** Faint rockets for your best run, today's average and best players, and a friend you are racing. */
  ghosts?: Ghost[];
  /** The run's score, shown top right while a run is on screen. */
  score?: HudScore | null;
  /** Right answers in a row. Shown as a combo meter from two up. */
  combo?: number;
  /** Your rocket's paint job from the Hangar. */
  paint?: RocketPaint;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<Sky | null>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const altUnitRef = useRef<HTMLElement>(null);
  const markerRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const gainRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<() => void>(() => {});
  const hopRef = useRef(hop.id);
  hopRef.current = hop.id;
  const lastHop = useRef(hop.id);
  const ghostsRef = useRef(ghosts);
  ghostsRef.current = ghosts;
  /** The tier of the climb playing now, so each frame can write the right gain label. */
  const climbTier = useRef(-1);
  const gainWidth = useRef(0);
  const lastProgress = useRef(progress);
  const toastId = useRef(0);
  const [motion, setMotion] = useState<Motion>("idle");
  const [landed, setLanded] = useState(progress);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sound, setSoundOn] = useState(() => readSound());
  const [focus, setFocus] = useState(false);
  const [float, setFloat] = useState(false);
  const [hudSlot, setHudSlot] = useState<HTMLDivElement | null>(null);
  const [dockSlot, setDockSlot] = useState<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const bindDock = useCallback((element: HTMLDivElement | null) => {
    dockRef.current = element;
    setDockSlot(element);
  }, []);
  /** The last answer whose climb has finished. Until the current one lands, a result waits off screen. */
  const [settledHop, setSettledHop] = useState(hop.id);
  const focusRef = useRef(focus);
  focusRef.current = focus || float;
  const floatRef = useRef(float);
  floatRef.current = float;

  function pushToast(title: string, detail: string) {
    toastId.current += 1;
    const toast = { id: toastId.current, born: Date.now(), title, detail };
    setToasts((list) => [...list, toast].slice(-3));
  }

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const sheet = sheetRef.current;
    if (!stage || !canvas || !sheet) return;
    const sky = createSky(canvas, reduced);
    skyRef.current = sky;
    sky.setScene(scenery);
    sky.setTrail(trail);
    sky.setGhosts(skyGhosts(ghostsRef.current));
    sky.setPaint(paint);
    sky.jump(progress);
    let size = { w: 0, h: 0, wide: false };

    const measure = () => {
      const w = stage.clientWidth || 390;
      const h = stage.clientHeight || 760;
      const wide = w >= WIDE_MIN;
      if (w !== size.w || h !== size.h || wide !== size.wide) {
        size = { w, h, wide };
        sky.resize(w, h, wide);
      }
      const card = sheet.getBoundingClientRect();
      const top = focusRef.current ? HUD_H : Math.max(0, Math.round(card.bottom - stage.getBoundingClientRect().top));
      stage.style.setProperty("--sheet-bottom", `${top}px`);
      // The answer bar at the bottom: the rocket waits just above it.
      const dock = dockRef.current?.offsetHeight ?? 0;
      stage.style.setProperty("--dock-h", `${dock}px`);
      const under = focusRef.current ? ANCHOR : Math.min(ANCHOR_MAX, Math.max(ANCHOR, (top + ROCKET_ROOM) / h));
      // On an end screen the content floats over the scene, so the rocket waits down behind the bottom bar.
      sky.setAnchor(floatRef.current ? FLOAT_ANCHOR : dock > 0 ? Math.min(under, (h - dock - 10) / h) : under);
    };
    measureRef.current = measure;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(sheet);
    if (dockRef.current) observer.observe(dockRef.current);

    sky.onFrame = (frame) => {
      const km = altitudeKm(frame.progress);
      const [value, unit] = splitDistance(formatDistance(km));
      const alt = altRef.current;
      if (alt && alt.textContent !== value) {
        alt.textContent = value;
        alt.parentElement?.classList.toggle("long", value.length > 5);
      }
      if (altUnitRef.current && altUnitRef.current.textContent !== unit) altUnitRef.current.textContent = unit;
      const share = Math.max(0, Math.min(1, frame.progress / TOP));
      if (markerRef.current) markerRef.current.style.bottom = `${share * 100}%`;
      if (fillRef.current) fillRef.current.style.height = `${share * 100}%`;
      const gain = gainRef.current;
      if (gain) {
        if (frame.climbing && climbTier.current >= 0) {
          const text = `+${formatDistance(Math.max(0, km - altitudeKm(frame.from)))}`;
          if (gain.textContent !== text) {
            gain.textContent = text;
            gainWidth.current = gain.offsetWidth;
          }
        }
        // Beside the rocket on the right, or on its left when a long number would run off the screen.
        const right = frame.x + 24;
        const x = right + gainWidth.current > (stageRef.current?.clientWidth ?? 390) - 8 ? frame.x - 24 - gainWidth.current : right;
        gain.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(Math.max(66, frame.y - 64))}px, 0)`;
      }
      const tag = tagRef.current;
      if (tag) tag.style.transform = `translate3d(${Math.round(frame.x)}px, ${Math.round(Math.max(60, frame.y - 104))}px, 0) translateX(-50%)`;
      if (frame.climbing) {
        const before = lastProgress.current;
        const passed = ghostsRef.current.filter((ghost) => before < ghost.progress && frame.progress >= ghost.progress);
        for (const ghost of passed) pushToast(`Passed ${ghost.label.toLowerCase()}`, formatAltitude(ghost.progress));
      }
      lastProgress.current = frame.progress;
    };
    sky.onMilestone = (index) => {
      const milestone = MILESTONES[index];
      pushToast(`Passed ${milestone.phrase}`, formatDistance(milestone.km));
      playChime(index);
    };

    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      sky.destroy();
      skyRef.current = null;
    };
    // The sky is made once. Its scenery, trail and ghosts follow the props in the effects below.
  }, []);

  useLayoutEffect(() => {
    measureRef.current();
  }, [focus, float]);

  useEffect(() => {
    skyRef.current?.setScene(scenery);
  }, [scenery]);

  useEffect(() => {
    skyRef.current?.setTrail(trail);
  }, [trail]);

  useEffect(() => {
    skyRef.current?.setGhosts(skyGhosts(ghosts));
  }, [ghosts]);

  useEffect(() => {
    skyRef.current?.setPaint(paint);
  }, [paint]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const id = window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== oldest.id)), Math.max(0, oldest.born + TOAST_MS - Date.now()));
    return () => window.clearTimeout(id);
  }, [toasts]);

  // A new answer climbs from where the rocket is to the new height. Anything else (a reload, a new mode) jumps there.
  useEffect(() => {
    const sky = skyRef.current;
    if (!sky || overview) return;
    const from = sky.progress();
    const to = progress;
    const fresh = hop.id !== lastHop.current && hop.kind !== "idle";
    lastHop.current = hop.id;
    // The longest single climb is an Afterburner Supernova, 20/7 of a stop. Anything bigger is a reload: jump.
    if (!fresh || to < from - 0.001 || to - from > 3) {
      sky.jump(to);
      lastProgress.current = to;
      climbTier.current = -1;
      setLanded(to);
      setMotion("idle");
      setSettledHop(hop.id);
      return;
    }
    const travel = Math.max(0, to - from);
    const tier = hop.kind === "voyage" && hop.gain && travel > 0 ? Math.max(0, Math.min(4, hop.gain.level - 1)) : -1;
    climbTier.current = tier;
    const gain = gainRef.current;
    if (gain) {
      gain.textContent = tier >= 0 ? "+0 m" : "No lift";
      gain.style.setProperty("--c", tierColor(tier));
      gain.classList.toggle("big", tier >= 3);
      gainWidth.current = gain.offsetWidth;
    }
    setMotion("climb");
    const boost = hop.boost === true && tier >= 0;
    if (tier >= 0) playBurner(boost ? Math.min(4, tier + 1) : tier, climbMs(travel), IGNITION_MS);
    else playSputter(IGNITION_MS);
    if (boost) pushToast("Afterburner ×2", "Double points, double the climb");
    sky.climb({
      from,
      to,
      tier,
      boost,
      onLand: () => {
        setMotion("idle");
        setLanded(to);
        setSettledHop(hopRef.current);
        if (tier >= 3) playSparkle();
      },
    });
  }, [progress, hop.id]);

  /** The end screen replays the whole climb from the launch pad to where the run landed. */
  useEffect(() => {
    const sky = skyRef.current;
    if (!sky || !overview) return;
    const to = progress;
    climbTier.current = -1;
    if (to < 0.05) {
      sky.jump(to);
      setLanded(to);
      return;
    }
    const best = trail.reduce((top, segment) => (segment.to > segment.from ? Math.max(top, segment.tier) : top), 0);
    setMotion("replay");
    playBurner(Math.min(2, best), replayMs(to), 0);
    sky.climb({
      from: 0,
      to,
      tier: best,
      replay: true,
      onLand: () => {
        setMotion("idle");
        setLanded(to);
      },
    });
  }, [overview]);

  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, [page]);

  /** A new answer whose climb has not started or not finished yet. Its result waits until the climb lands. */
  const pending = settledHop !== hop.id;
  const flying = motion !== "idle" || pending;
  const holding = focus && pending;
  const stageClass = ["stage", `is-${motion}`, reduced ? "quiet" : "", overview ? "is-overview" : "", focus ? "is-focus" : "", float ? "is-float" : ""].join(" ");
  /** The nearest climber above you: who to beat next. */
  const rival = flying ? null : ghosts.filter((ghost) => ghost.progress > progress + 0.01).sort((a, b) => a.progress - b.progress)[0];
  // "Above everyone" only when the crowd ghosts are in play: today's average and best, bots included.
  const crowdGhost = ghosts.some((ghost) => ghost.id === "average" || ghost.id === "top");
  const next = nextMilestone(landed);
  const showGain = (focus || motion === "climb") && hop.kind !== "idle" && motion !== "replay" && !overview;

  return (
    <div className={stageClass} ref={stageRef}>
      <div className="scene">
        <canvas ref={canvasRef} className="sky-canvas" aria-hidden="true" />
        <div className={showGain ? "gain on" : "gain"} ref={gainRef} aria-hidden="true" />
        {focus && hop.answer !== undefined ? (
          <div className={`answer-tag ${hop.kind}${holding ? " on" : ""}`} ref={tagRef} aria-hidden="true">
            {hop.answer ? `“${hop.answer}”` : "Out of time"}
          </div>
        ) : null}
        <div className="toasts" role="status">
          {toasts.map((toast) => (
            <p className="toast" key={toast.id}>
              <b>{toast.title}</b> · {toast.detail}
            </p>
          ))}
        </div>
        <div className="hud">
          <div className="hud-side">
            <p className="where">
              <small>Altitude</small>
              <span className="alt-v">
                <span ref={altRef}>{splitDistance(formatAltitude(landed))[0]}</span>
                <small ref={altUnitRef}>{splitDistance(formatAltitude(landed))[1]}</small>
              </span>
            </p>
          </div>
          <div className="hud-mid" ref={setHudSlot} />
          <div className="hud-side end">{score ? <ScoreBox score={score} hold={pending} /> : null}</div>
        </div>
        {/* Under the card, at the top of the open sky: the next landmark, the combo meter and who to beat next. */}
        <div className="sky-tags">
          {next && !flying ? (
            <p className="next-mile">
              Next: {next.name} <b>{formatDistance(Math.max(0, next.km - altitudeKm(landed)))} to go</b>
            </p>
          ) : null}
          <div className="sky-row">
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
        </div>
        <div className="altimeter" aria-hidden="true">
          <span className="alt-end">top</span>
          <div className="alt-line">
            <b ref={fillRef} />
            {MILESTONES.slice(1).map((milestone) => (
              <i
                key={milestone.id}
                className={[milestone.at <= landed + 1e-6 ? "passed" : "", milestone.id === "space" ? "space" : ""].join(" ")}
                style={{ bottom: `${(milestone.at / TOP) * 100}%` }}
              />
            ))}
            {ghosts.map((ghost) => (
              <u key={ghost.id} className={`ghost-tick ${ghost.id}`} style={{ bottom: `${(Math.min(TOP, ghost.progress) / TOP) * 100}%` }} />
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
            const on = !sound;
            setSoundOn(on);
            setSound(on);
            if (on) window.setTimeout(() => playChime(1), 60);
          }}
        >
          {sound ? "Sound on" : "Sound off"}
        </button>
      </div>
      <div className={holding ? "sheet holding" : "sheet"} ref={sheetRef}>
        <JourneyContext.Provider value={{ hudSlot, dockSlot, holding, setFocus, setFloat }}>{children}</JourneyContext.Provider>
      </div>
      <div className="dock-slot" ref={bindDock} />
    </div>
  );
}

/** "384,000 km" as ["384,000", "km"], so the number can be big and the unit small. */
function splitDistance(text: string): [string, string] {
  const space = text.indexOf(" ");
  return space < 0 ? [text, ""] : [text.slice(0, space), text.slice(space + 1)];
}

function skyGhosts(ghosts: Ghost[]): SkyGhost[] {
  return ghosts.map((ghost) => ({ progress: ghost.progress, label: ghost.label, color: GHOST_COLORS[ghost.id], paint: ghost.paint }));
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

/** A tier's colour as a CSS variable, for a result card or a chip. */
export function tierStyle(tier: number): CSSProperties {
  return { ["--tier-c" as string]: tierColor(tier) } as CSSProperties;
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
