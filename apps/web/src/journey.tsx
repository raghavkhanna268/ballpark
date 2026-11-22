import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
import "./journey.css";

export type Hop = { id: number; kind: "idle" | "voyage" | "stumble"; travel: number };
export type Ghost = { id: "best" | "average" | "top"; label: string; progress: number };
export type Mission = { target: number };
type Motion = "idle" | "voyage" | "stumble" | "replay";

const SOUND_KEY = "ballpark.sound";
const STOPS = WORLD_STOPS.length;
/** The climber sits this far down the scene, so you can see where you are heading. */
const ANCHOR = 0.62;
const VOYAGE_MS = 2300;
const STUMBLE_MS = 1700;
const REPLAY_MS = 3600;
const ROUTE_POINTS = 1600;
const TRAIL_OFFSET = 34;

type Pose = { v: number; cam: number; dx: number; dy: number; rot: number; sx: number; sy: number };
type Toast = { id: number; title: string; detail: string; tone: "world" | "pass" | "mission" | "space" };

const REST: Omit<Pose, "v" | "cam"> = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };

export function Journey({
  progress,
  hop,
  overview,
  page,
  mission,
  ghosts = [],
  children,
}: {
  /** 0 is the launch pad. Each correct answer climbs 1. A miss climbs about a third. */
  progress: number;
  hop: Hop;
  overview: boolean;
  /** Changes whenever the card below the scene shows a new screen, so it starts scrolled to the top. */
  page: string;
  /** Today's target height, by stop index. */
  mission?: Mission | null;
  /** Faint climbers for your best run, today's average player and today's best player. */
  ghosts?: Ghost[];
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
  const size = useRef({ w: 390, h: 520, k: 1 });
  const pose = useRef<Pose>({ v: progress, cam: progress, ...REST });
  const landedRef = useRef(-1);
  const ghostsRef = useRef(ghosts);
  const missionRef = useRef(mission);
  const [k, setK] = useState(1);
  const [motion, setMotion] = useState<Motion>("idle");
  const [landed, setLanded] = useState(() => stopAt(progress));
  const [arrived, setArrived] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [sound, setSound] = useState(() => readSound());

  ghostsRef.current = ghosts;
  missionRef.current = mission;

  useEffect(() => {
    const stage = stageRef.current;
    const scene = sceneRef.current;
    if (!stage || !scene) return;
    const measure = () => {
      const w = scene.clientWidth || 390;
      // Fit the drawn column to the width on a phone. On a wide screen, fit to height and show more sky.
      const nextK = Math.max(0.5, Math.min((stage.clientHeight * 0.8) / 700, w / 400));
      size.current = { w, h: scene.clientHeight || 520, k: nextK };
      setK(nextK);
      draw();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  /** World y at the top of the scene, so the camera's stop sits at ANCHOR of the scene height. */
  function cameraTop(cam: number): number {
    const { h, k: scale } = size.current;
    return climberY(cam) - (h * ANCHOR) / scale;
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
    if (explorer) {
      explorer.style.transform = `translate3d(${ex}px, ${ey}px, 0) translate(-50%, -50%) rotate(${p.rot}deg) scale(${p.sx}, ${p.sy})`;
      explorer.classList.toggle("suited", p.v >= SPACE_STOP - 0.5);
    }
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

  /** What changed by climbing from `from` to `to`: today's mission, space, a ghost overtaken, or a new height. */
  function announce(from: number, to: number) {
    const target = missionRef.current?.target;
    if (target !== undefined && from < target - 0.001 && to >= target - 0.001) {
      setToast({ id: Date.now(), title: "Mission complete", detail: `You reached ${WORLD_STOPS[target]!.phrase}`, tone: "mission" });
      return;
    }
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
    if (after > before) {
      const info = WORLD_STOPS[after]!;
      setToast({ id: Date.now(), title: info.label, detail: `Altitude ${info.altitude}`, tone: "world" });
    }
  }

  function run(kind: Motion, from: number, to: number, duration: number) {
    const start = performance.now();
    const d = to - from;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      pose.current = kind === "stumble" ? stumblePose(t, from, d) : kind === "replay" ? replayPose(t, from, d) : voyagePose(t, from, d);
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
        if (kind !== "replay") announce(from, to);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }

  /** The camera lags so the climber visibly rises up the screen, but it never leaves the frame. */
  function keepInFrame() {
    const { h, k: scale } = size.current;
    const p = pose.current;
    const anchor = (h * ANCHOR) / scale;
    const maxAbove = anchor - 90 / scale;
    const maxBelow = h / scale - anchor - 60 / scale;
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
      return;
    }
    const kind = hop.kind === "stumble" ? "stumble" : "voyage";
    setMotion(kind);
    if (sound) playHop(kind);
    return run(kind, from, to, kind === "stumble" ? STUMBLE_MS : VOYAGE_MS);
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

  const flying = motion !== "idle";
  const stageClass = ["stage", `is-${motion}`, flying && motion !== "replay" ? "is-focus" : "", reduced ? "quiet" : "", overview ? "is-overview" : ""].join(" ");
  const info = WORLD_STOPS[landed]!;
  const target = mission ? WORLD_STOPS[mission.target] : null;
  const missionDone = mission ? landed >= mission.target && progress >= mission.target - 0.001 : false;
  const columns = WORLD_W + SIDE * 2;

  return (
    <div className={stageClass} ref={stageRef}>
      <div className="scene" ref={sceneRef}>
        <svg ref={farRef} className="layer" style={{ width: columns * k, height: FAR_H * k }} viewBox={`${-SIDE} 0 ${columns} ${FAR_H}`} aria-hidden="true">
          <WorldFar />
        </svg>
        <svg ref={mainRef} className="layer" style={{ width: columns * k, height: WORLD_H * k }} viewBox={`${-SIDE} 0 ${columns} ${WORLD_H}`} aria-hidden="true">
          <WorldMain />
          {target && mission ? <MissionLine y={climberY(mission.target)} label={target.label} /> : null}
          {ghosts.map((ghost, index) => (
            <GhostClimber key={ghost.id} ghost={ghost} lane={index} />
          ))}
          <polyline ref={routeRef} className={`route-trace ${motion}`} points="" />
        </svg>
        <div className={`explorer ${motion}`} ref={explorerRef} aria-hidden="true">
          <Climber />
          {motion === "stumble" ? <Smoke /> : null}
        </div>
        <svg ref={frontRef} className="layer front" style={{ width: columns * k, height: FRONT_H * k }} viewBox={`${-SIDE} 0 ${columns} ${FRONT_H}`} aria-hidden="true">
          <WorldFront />
        </svg>
        <div className="speedlines" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <i key={index} style={{ left: `${10 + index * 11}%`, animationDelay: `${(index * 73) % 400}ms` }} />
          ))}
        </div>
        {motion === "stumble" ? <div className="miss-flash" key={hop.id} /> : null}
        {toast ? (
          <div className={`toast ${toast.tone}`} key={toast.id} role="status">
            <strong>{toast.title}</strong>
            <span>{toast.detail}</span>
          </div>
        ) : null}
        <div className="hud">
          <p className="where" key={arrived}>
            <span className="power" ref={altRef}>
              ALT {info.altitude}
            </span>
            <span className="place" ref={labelRef}>
              {info.label}
            </span>
          </p>
          {target ? (
            <p className={missionDone ? "mission done" : "mission"}>
              <small>{missionDone ? "Mission complete" : "Today’s mission"}</small>
              <span>Reach {target.phrase}</span>
            </p>
          ) : null}
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
            {mission ? <s className="flag" style={{ bottom: `${(mission.target / (STOPS - 1)) * 100}%` }} /> : null}
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
      <div className="sheet" ref={sheetRef}>
        {children}
      </div>
    </div>
  );
}

/** The altitude of the stop a fractional progress value rounds to. */
export function formatAltitude(progress: number): string {
  return WORLD_STOPS[stopAt(progress)]!.altitude;
}

function MissionLine({ y, label }: { y: number; label: string }) {
  return (
    <g className="mission-flag" transform={`translate(0 ${y - 54})`}>
      <line x1={-SIDE} y1="0" x2={WORLD_W + SIDE} y2="0" stroke="#ffb347" strokeOpacity="0.6" strokeDasharray="6 8" />
      <path d="M14 0 v-24 l22 7 l-22 7" fill="#ffb347" />
      <text x="42" y="-10" fill="#ffb347" fontSize="12" className="mono" letterSpacing="1">
        MISSION · {label.toUpperCase()}
      </text>
    </g>
  );
}

/** A faint outline of another climber, parked at the height they reached. */
function GhostClimber({ ghost, lane }: { ghost: Ghost; lane: number }) {
  const x = lane === 0 ? 70 : lane === 1 ? WORLD_W - 70 : WORLD_W - 130;
  const y = climberY(ghost.progress) + (lane === 2 ? -40 : 0);
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
